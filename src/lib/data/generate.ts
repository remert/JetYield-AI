import { addDays, daysBetween, monthKey } from "@/lib/dates";
import type {
  AircraftDataset,
  CostEntry,
  FlightLeg,
  MaintenanceItem,
  ScheduledTrip,
} from "@/lib/types";
import { estimateBlockHours } from "./airports";
import { FLEET, type FleetSeed } from "./fleet";

// Deterministic PRNG so the demo shows identical numbers on every load.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function pick<T>(rng: () => number, items: T[]): T {
  return items[Math.floor(rng() * items.length)];
}

function generateFlights(seed: FleetSeed, asOf: string, rng: () => number): FlightLeg[] {
  const { profile } = seed;
  const base = profile.homeBase;
  const start = addDays(asOf, -364);
  const legs: FlightLeg[] = [];
  let n = 0;
  const push = (leg: Omit<FlightLeg, "id" | "fuelGallons">) => {
    if (daysBetween(leg.date, asOf) < 0) return;
    legs.push({
      ...leg,
      id: `${profile.id}-f${++n}`,
      fuelGallons: Math.round(leg.blockHours * profile.fuelBurnGph * (0.95 + rng() * 0.1)),
    });
  };

  // Pace trips adaptively so the year's hours land close to annualHours and are
  // spread across all twelve months.
  let hours = 0;
  let trips = 0;
  let day = 2;
  while (hours < seed.annualHours && day < 362) {
    const date = addDays(start, day);
    const dest = pick(rng, seed.destinations);
    const out = estimateBlockHours(base, dest, profile.cruiseKtas);
    const back = estimateBlockHours(dest, base, profile.cruiseKtas);
    const isCharter = rng() < seed.charterShare;
    const purpose = isCharter ? "charter" : "owner";
    const pax = 2 + Math.floor(rng() * (profile.seats - 2));
    const revenue = (h: number) => (isCharter ? Math.round(h * profile.charterRatePerHour * 0.85) : 0);
    const stay = 1 + Math.floor(rng() * 5);

    if (rng() < seed.oneWayRate) {
      // One-way: passengers dropped off, aircraft repositions home empty.
      push({ date, from: base, to: dest, blockHours: out, purpose, passengers: pax, revenue: revenue(out) });
      const sold = rng() < seed.monetizedPositioningRate;
      push({
        date: addDays(date, rng() < 0.6 ? 0 : 1),
        from: dest,
        to: base,
        blockHours: back,
        purpose: "positioning",
        passengers: sold ? 2 + Math.floor(rng() * 3) : 0,
        revenue: sold ? Math.round(back * profile.charterRatePerHour * 0.45 * 0.85) : 0,
      });
      // Later pickup: reposition out empty, fly passengers home.
      if (rng() < 0.55) {
        const pickup = addDays(date, stay + 2);
        push({ date: pickup, from: base, to: dest, blockHours: out, purpose: "positioning", passengers: 0, revenue: 0 });
        push({ date: pickup, from: dest, to: base, blockHours: back, purpose, passengers: pax, revenue: revenue(back) });
        hours += out + back;
      }
      hours += out + back;
    } else {
      push({ date, from: base, to: dest, blockHours: out, purpose, passengers: pax, revenue: revenue(out) });
      push({ date: addDays(date, stay), from: dest, to: base, blockHours: back, purpose, passengers: pax, revenue: revenue(back) });
      hours += out + back;
    }

    trips++;
    const avgTripHours = hours / trips;
    const remainingTrips = Math.max(1, (seed.annualHours - hours) / avgTripHours);
    const gap = ((362 - day) / remainingTrips) * (0.6 + rng() * 0.8);
    day += Math.max(1, Math.round(gap));
  }

  // One maintenance ferry flight to the service center and back.
  const mxDate = addDays(start, 150 + Math.floor(rng() * 60));
  push({ date: mxDate, from: base, to: base, blockHours: 0.6, purpose: "maintenance", passengers: 0, revenue: 0 }); // post-inspection test flight

  return legs.sort((a, b) => a.date.localeCompare(b.date)).map((l) => ({ ...l, blockHours: round1(l.blockHours) }));
}

function generateCosts(seed: FleetSeed, flights: FlightLeg[], asOf: string, rng: () => number): CostEntry[] {
  const c = seed.costs;
  const costs: CostEntry[] = [];
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(`${asOf.slice(0, 7)}-01T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - i);
    months.push(d.toISOString().slice(0, 7));
  }
  const monthEnd = (m: string) => {
    const d = new Date(`${m}-01T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + 1);
    d.setUTCDate(0);
    const iso = d.toISOString().slice(0, 10);
    return iso > asOf ? asOf : iso;
  };
  const fixed = (date: string, category: CostEntry["category"], description: string, amount: number) =>
    costs.push({ date, category, description, amount: Math.round(amount), kind: "fixed" });
  const variable = (
    date: string,
    category: CostEntry["category"],
    description: string,
    amount: number,
    gallons?: number,
  ) => {
    if (amount <= 0) return;
    costs.push({ date, category, description, amount: Math.round(amount), kind: "variable", ...(gallons ? { gallons } : {}) });
  };

  months.forEach((m, i) => {
    const d = `${m}-01`;
    fixed(d, "crew", "Pilot salaries & benefits", c.crew / 12);
    fixed(d, "hangar", "Hangar rent", c.hangar / 12);
    fixed(d, "management", "Management fee", c.management / 12);
    fixed(d, "subscriptions", "Nav data, Wi-Fi, CAMP, flight planning", c.subscriptions / 12);
    fixed(d, "capital", "Depreciation & cost of capital", c.capital / 12);
    if (i === 3) fixed(d, "insurance", "Hull & liability premium (annual)", c.insurance);
    if (i === 2 || i === 8) fixed(d, "training", "Recurrent simulator training", c.training / 2);

    const legs = flights.filter((f) => monthKey(f.date) === m);
    if (legs.length === 0) return;
    const end = monthEnd(m);
    const hrs = legs.reduce((s, f) => s + f.blockHours, 0);
    const gal = legs.reduce((s, f) => s + (f.fuelGallons ?? 0), 0);
    variable(end, "fuel", "Jet-A purchases", gal * c.fuelPrice, gal);
    variable(end, "engine_reserve", "Engine program hourly", hrs * c.engineReservePerHour);
    variable(end, "maintenance", "Scheduled & unscheduled maintenance", hrs * c.maintenancePerHour * (0.75 + rng() * 0.5));
    variable(end, "fees", "Landing, handling & FBO fees", legs.length * c.feesPerLeg);
    const overnights = legs.filter((f) => f.purpose !== "positioning").length * 0.5;
    variable(end, "crew_travel", "Crew hotels & per diem", overnights * c.crewTravelPerOvernight);
  });
  return costs.filter((e) => e.date <= asOf);
}

function generateMaintenance(seed: FleetSeed, asOf: string): MaintenanceItem[] {
  return seed.maintenance.map((m, i) => ({
    id: `${seed.profile.id}-mx${i + 1}`,
    item: m.item,
    dueHours: m.dueInHours !== undefined ? seed.airframeHours + m.dueInHours : undefined,
    dueDate: m.dueInDays !== undefined ? addDays(asOf, m.dueInDays) : undefined,
    estimatedCost: m.estimatedCost,
    downtimeDays: m.downtimeDays,
    notes: m.notes,
  }));
}

function generateSchedule(seed: FleetSeed, asOf: string, rng: () => number): ScheduledTrip[] {
  const trips: ScheduledTrip[] = [];
  const count = seed.profile.id === "xls" ? 9 : 6;
  let day = 2;
  for (let i = 0; i < count; i++) {
    const dest = pick(rng, seed.destinations);
    const outbound = rng() < 0.7;
    trips.push({
      id: `${seed.profile.id}-t${i + 1}`,
      date: addDays(asOf, day),
      from: outbound ? seed.profile.homeBase : dest,
      to: outbound ? dest : seed.profile.homeBase,
      passengers: 2 + Math.floor(rng() * (seed.profile.seats - 2)),
      // Sample schedules skew toward one-way trips so there are legs to list.
      oneWay: rng() < Math.max(0.55, seed.oneWayRate + 0.15),
    });
    day += 3 + Math.floor(rng() * 6);
  }
  return trips;
}

export function generateSampleDataset(id: string, asOf: string): AircraftDataset {
  const seed = FLEET.find((f) => f.profile.id === id) ?? FLEET[0];
  const rng = mulberry32(seed.seed);
  const flights = generateFlights(seed, asOf, rng);
  const costs = generateCosts(seed, flights, asOf, rng);
  return {
    profile: seed.profile,
    airframeHours: seed.airframeHours,
    flights,
    costs,
    maintenance: generateMaintenance(seed, asOf),
    schedule: generateSchedule(seed, asOf, rng),
    source: "sample",
  };
}

// Cost ledger for an uploaded flight log when no cost file was provided:
// fixed costs from the aircraft's cost model, variable costs from the uploaded legs.
export function modeledCostsForFlights(id: string, flights: FlightLeg[], asOf: string): CostEntry[] {
  const seed = FLEET.find((f) => f.profile.id === id) ?? FLEET[0];
  const legs = flights.map((f) => ({
    ...f,
    fuelGallons: f.fuelGallons ?? Math.round(f.blockHours * seed.profile.fuelBurnGph),
  }));
  return generateCosts(seed, legs, asOf, mulberry32(seed.seed));
}

export const SAMPLE_AIRCRAFT = FLEET.map((f) => f.profile);
