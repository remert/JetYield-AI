import { airport, routeDemand, estimateBlockHours } from "@/lib/data/airports";
import { CLASS_BENCHMARKS, FUEL_MARKET_PRICE } from "@/lib/data/fleet";
import { addDays, daysBetween, formatDate, monthKey, monthLabel, todayISO } from "@/lib/dates";
import type {
  AircraftDataset,
  AircraftProfile,
  Analytics,
  CostBreakdownItem,
  CostCategory,
  EmptyLegOpportunity,
  FlightLeg,
  FlightPurpose,
  ImprovementLine,
  MaintenanceAlert,
  MonthlyPoint,
  ScenarioInput,
  ScenarioResult,
  YieldScore,
} from "@/lib/types";

export const CATEGORY_LABELS: Record<CostCategory, string> = {
  crew: "Crew salaries",
  hangar: "Hangar",
  insurance: "Insurance",
  training: "Training",
  management: "Management",
  subscriptions: "Subscriptions & nav data",
  capital: "Depreciation & capital",
  fuel: "Fuel",
  maintenance: "Maintenance",
  engine_reserve: "Engine program",
  fees: "Landing & FBO fees",
  crew_travel: "Crew travel",
  other: "Other",
};

// Share of charter / empty-leg revenue that reaches the owner after the
// certificate holder's commission.
export const OWNER_REVENUE_SHARE = 0.85;
// Catering, handling, passenger fees and platform fees on a sold empty leg.
const EMPTY_LEG_INCREMENTAL_COST = 450;

const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
const round = (n: number, step = 1) => Math.round(n / step) * step;

export function priceEmptyLeg(
  profile: AircraftProfile,
  from: string,
  to: string,
  date: string,
  blockHours: number,
  asOf: string,
): Omit<EmptyLegOpportunity, "id" | "date" | "from" | "to"> {
  const month = Number(date.slice(5, 7));
  const demandIdx = routeDemand(from, to, month);
  const leadDays = daysBetween(asOf, date);
  // Empty legs typically clear at 40–65% of the retail one-way price.
  const listPrice = round(profile.charterRatePerHour * blockHours * (0.4 + 0.25 * demandIdx), 50);
  let sellProbability = 0.15 + 0.6 * demandIdx;
  if (leadDays >= 0 && leadDays < 4) sellProbability *= 0.6; // too little time to market
  if (blockHours < 1) sellProbability *= 0.8;
  sellProbability = clamp(sellProbability, 0.05, 0.85);
  const ownerNet = listPrice * OWNER_REVENUE_SHARE - EMPTY_LEG_INCREMENTAL_COST;
  const demand = demandIdx >= 0.78 ? "high" : demandIdx >= 0.62 ? "medium" : "low";
  const toAp = airport(to);
  const rationale =
    demand === "high"
      ? `${toAp.city} is a top-demand destination${toAp.peakMonths?.includes(month) ? " in peak season" : ""}.`
      : demand === "medium"
        ? `Steady demand into ${toAp.city}; price to sell 5–7 days out.`
        : `Thin demand into ${toAp.city}; list early and price aggressively.`;
  return {
    fromCity: airport(from).city,
    toCity: toAp.city,
    blockHours,
    listPrice,
    sellProbability: Math.round(sellProbability * 100) / 100,
    incrementalCost: EMPTY_LEG_INCREMENTAL_COST,
    expectedNet: Math.max(0, round(ownerNet * sellProbability, 10)),
    demand,
    rationale,
  };
}

function upcomingEmptyLegs(ds: AircraftDataset, asOf: string): EmptyLegOpportunity[] {
  const p = ds.profile;
  const out: EmptyLegOpportunity[] = [];
  for (const trip of ds.schedule) {
    if (!trip.oneWay || trip.date < asOf) continue;
    // Drop-off away from base -> fly home empty. Pickup away from base -> fly out empty first.
    const leg =
      trip.from === p.homeBase
        ? { from: trip.to, to: p.homeBase, date: trip.date }
        : trip.to === p.homeBase
          ? { from: p.homeBase, to: trip.from, date: addDays(trip.date, -1) }
          : { from: trip.to, to: p.homeBase, date: trip.date };
    const hrs = estimateBlockHours(leg.from, leg.to, p.cruiseKtas);
    out.push({ id: `el-${trip.id}`, ...leg, ...priceEmptyLeg(p, leg.from, leg.to, leg.date, hrs, asOf) });
  }
  return out.sort((a, b) => b.expectedNet - a.expectedNet);
}

function maintenanceAlerts(ds: AircraftDataset, asOf: string, hoursPerDay: number): MaintenanceAlert[] {
  const alerts: MaintenanceAlert[] = ds.maintenance.map((m) => {
    const hoursUntil = m.dueHours !== undefined ? round(m.dueHours - ds.airframeHours, 0.1) : undefined;
    const daysByHours = hoursUntil !== undefined && hoursPerDay > 0 ? Math.round(hoursUntil / hoursPerDay) : Infinity;
    const daysByDate = m.dueDate ? daysBetween(asOf, m.dueDate) : Infinity;
    const days = Math.min(daysByHours, daysByDate);
    const severity: MaintenanceAlert["severity"] =
      days <= 30 || (hoursUntil !== undefined && hoursUntil <= 25) ? "critical" : days <= 90 ? "warning" : "info";
    const dueLabel =
      daysByDate <= daysByHours
        ? `${days < 0 ? "Overdue" : `Due ${formatDate(m.dueDate!)}`} · ${Math.abs(days)} days${days < 0 ? " ago" : ""}`
        : `Due in ${hoursUntil} hrs · ~${days} days at current pace`;
    const tripsInWindow = ds.schedule.filter(
      (t) => t.date >= asOf && daysBetween(asOf, t.date) <= days + m.downtimeDays && daysBetween(asOf, t.date) >= days - 3,
    ).length;
    let advice: string;
    if (m.downtimeDays >= 7) {
      advice = `${m.downtimeDays} days of downtime. Book the slot now and pull forward any items due within 90 days to avoid a second visit.`;
    } else if (m.downtimeDays > 0) {
      advice = `Schedule alongside the next base overnight to avoid a dedicated down day.`;
    } else {
      advice = `No downtime. Complete before the due date to avoid a grounding.`;
    }
    if (tripsInWindow > 0) advice += ` ${tripsInWindow} scheduled trip${tripsInWindow > 1 ? "s" : ""} fall in that window.`;
    if (m.notes) advice += ` Note: ${m.notes}.`;
    return {
      id: m.id,
      item: m.item,
      severity,
      dueLabel,
      daysUntilDue: Number.isFinite(days) ? days : 9999,
      hoursUntilDue: hoursUntil,
      estimatedCost: m.estimatedCost,
      downtimeDays: m.downtimeDays,
      advice,
    };
  });
  return alerts.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}

function isEmptyPositioning(f: FlightLeg) {
  return f.purpose === "positioning" && f.passengers === 0 && f.revenue === 0;
}

export function computeAnalytics(ds: AircraftDataset, today: string = todayISO()): Analytics {
  const p = ds.profile;
  // Analyze the trailing 12 months ending at the latest record (uploaded logs may be older).
  const pastDates = [...ds.flights.map((f) => f.date), ...ds.costs.map((c) => c.date)].filter((d) => d <= today);
  const asOf = pastDates.length ? pastDates.reduce((a, b) => (a > b ? a : b)) : today;
  const windowStart = addDays(asOf, -364);
  const flights = ds.flights.filter((f) => f.date >= windowStart && f.date <= asOf);
  const costs = ds.costs.filter((c) => c.date >= windowStart && c.date <= asOf);
  // Flights and costs may cover different spans (e.g. a 3-month log against a
  // full-year ledger), so each is annualized over its own coverage.
  const spanDays = (dates: string[]) =>
    Math.max(30, Math.min(365, daysBetween(dates.reduce((a, b) => (a < b ? a : b), asOf), asOf) + 1));
  const periodDays = spanDays(flights.map((f) => f.date));
  const annualize = 365 / periodDays;
  // Monthly bills are dated on the 1st, so measure ledger coverage in billing months too.
  const costMonths = new Set(costs.map((c) => monthKey(c.date))).size;
  const costAnnualize = 365 / Math.min(365, Math.max(spanDays(costs.map((c) => c.date)), (costMonths * 365) / 12));

  const hoursByPurpose: Record<FlightPurpose, number> = { owner: 0, charter: 0, positioning: 0, maintenance: 0 };
  for (const f of flights) hoursByPurpose[f.purpose] += f.blockHours;
  const hoursFlown = Object.values(hoursByPurpose).reduce((a, b) => a + b, 0);
  const annualizedHours = hoursFlown * annualize;
  const safeHours = Math.max(annualizedHours, 1);

  const emptyHours = flights.filter(isEmptyPositioning).reduce((s, f) => s + f.blockHours, 0);
  const positioningHours = hoursByPurpose.positioning;
  const monetizedPositioningShare = positioningHours > 0 ? 1 - emptyHours / positioningHours : 1;

  // Cost aggregation
  const byCat = new Map<CostCategory, { amount: number; kind: "fixed" | "variable" }>();
  let gallons = 0;
  let fuelSpend = 0;
  for (const c of costs) {
    const cur = byCat.get(c.category) ?? { amount: 0, kind: c.kind };
    cur.amount += c.amount;
    byCat.set(c.category, cur);
    if (c.category === "fuel" && c.gallons) {
      gallons += c.gallons;
      fuelSpend += c.amount;
    }
  }
  const costBreakdown: CostBreakdownItem[] = [...byCat.entries()]
    .map(([category, v]) => ({
      category,
      label: CATEGORY_LABELS[category],
      kind: v.kind,
      // Variable costs scale with the flying they paid for; fixed costs with the calendar.
      annual: round(v.amount * (v.kind === "variable" ? annualize : costAnnualize)),
      perHour: round((v.amount * (v.kind === "variable" ? annualize : costAnnualize)) / safeHours),
    }))
    .sort((a, b) => b.annual - a.annual);

  const sum = (pred: (i: CostBreakdownItem) => boolean) =>
    costBreakdown.filter(pred).reduce((s, i) => s + i.annual, 0);
  const fixedAnnual = sum((i) => i.kind === "fixed");
  const capitalAnnual = sum((i) => i.category === "capital");
  const fixedCashAnnual = fixedAnnual - capitalAnnual;
  const variableAnnual = sum((i) => i.kind === "variable");
  const variablePerHour = variableAnnual / safeHours;
  const totalAnnual = fixedAnnual + variableAnnual;
  const revenueAnnual = flights.reduce((s, f) => s + f.revenue, 0) * annualize;
  const netCostAnnual = totalAnnual - revenueAnnual;
  const avgFuelPrice = gallons > 0 ? fuelSpend / gallons : FUEL_MARKET_PRICE;

  const bench = CLASS_BENCHMARKS[p.aircraftClass];
  const benchmarkCostPerHour = bench.fixedCash / bench.hours + bench.variablePerHour;

  // Monthly series (last 12 calendar months ending at asOf)
  const monthly: MonthlyPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(`${asOf.slice(0, 7)}-01T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - i);
    const key = d.toISOString().slice(0, 7);
    const pt: MonthlyPoint = {
      month: key,
      label: monthLabel(key),
      owner: 0,
      charter: 0,
      positioning: 0,
      maintenance: 0,
      total: 0,
      targetPace: Math.round((p.targetHours / 12) * 10) / 10,
    };
    for (const f of flights) if (monthKey(f.date) === key) pt[f.purpose] += f.blockHours;
    pt.owner = Math.round(pt.owner * 10) / 10;
    pt.charter = Math.round(pt.charter * 10) / 10;
    pt.positioning = Math.round(pt.positioning * 10) / 10;
    pt.maintenance = Math.round(pt.maintenance * 10) / 10;
    pt.total = Math.round((pt.owner + pt.charter + pt.positioning + pt.maintenance) * 10) / 10;
    monthly.push(pt);
  }

  const emptyLegs = upcomingEmptyLegs(ds, today < asOf ? asOf : today);
  const alerts = maintenanceAlerts(ds, today < asOf ? asOf : today, annualizedHours / 365);

  // ----- Yield score -----
  const utilization = annualizedHours / p.targetHours;
  const unmonetizedShare = emptyHours / Math.max(hoursFlown, 1);
  const costEff = clamp(
    (bench.variablePerHour / Math.max(variablePerHour, 1) + bench.fixedCash / Math.max(fixedCashAnnual, 1)) / 2,
  );
  const revenueOffset = clamp(revenueAnnual / Math.max(fixedCashAnnual * 0.6, 1));
  const components: YieldScore["components"] = [
    {
      key: "utilization",
      label: "Utilization",
      weight: 0.35,
      score: clamp(utilization),
      detail: `${Math.round(annualizedHours)} of ${p.targetHours} target hours`,
    },
    {
      key: "empty",
      label: "Empty-leg capture",
      weight: 0.25,
      score: clamp(1 - unmonetizedShare / 0.4),
      detail: `${Math.round(unmonetizedShare * 100)}% of hours flown empty and unsold`,
    },
    {
      key: "cost",
      label: "Cost efficiency",
      weight: 0.25,
      score: costEff,
      detail: `Variable $${round(variablePerHour, 10).toLocaleString("en-US")}/hr vs $${bench.variablePerHour.toLocaleString("en-US")} class benchmark`,
    },
    {
      key: "revenue",
      label: "Revenue offset",
      weight: 0.15,
      score: revenueOffset,
      detail: revenueAnnual > 0 ? `Revenue covers ${Math.round((revenueAnnual / fixedCashAnnual) * 100)}% of cash fixed costs` : "No charter or empty-leg revenue",
    },
  ];
  const score = Math.round(components.reduce((s, c) => s + c.score * c.weight, 0) * 100);
  const yieldScore: YieldScore = {
    score,
    grade: score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : "D",
    components,
  };

  // ----- Improvement potential (annual, conservative) -----
  const lines: ImprovementLine[] = [];
  const emptyLegAnnual =
    flights
      .filter(isEmptyPositioning)
      .reduce((s, f) => s + priceEmptyLeg(p, f.from, f.to, f.date, f.blockHours, addDays(f.date, -10)).expectedNet, 0) *
    annualize;
  if (emptyLegAnnual > 1000) {
    lines.push({
      key: "empty_legs",
      label: "Sell empty repositioning legs",
      annual: round(emptyLegAnnual, 100),
      detail: `${Math.round(emptyHours)} empty hrs in the last 12 months, probability-weighted at market empty-leg rates${p.charterEnabled ? "" : " (requires a Part 135 certificate)"}.`,
    });
  }
  const gapHours = Math.max(0, p.targetHours - annualizedHours);
  if (gapHours >= 10) {
    const charterHours = Math.min(gapHours, p.targetHours * 0.3);
    const margin = p.charterRatePerHour * OWNER_REVENUE_SHARE - variablePerHour;
    if (margin > 0) {
      lines.push({
        key: "charter",
        label: "Fill utilization gap with charter",
        annual: round(charterHours * margin * 0.6, 100),
        detail: `${Math.round(charterHours)} charter hrs at $${round(margin, 10).toLocaleString("en-US")}/hr contribution, 60% fill rate${p.charterEnabled ? "" : " (requires a Part 135 certificate)"}.`,
      });
    }
  }
  if (avgFuelPrice > FUEL_MARKET_PRICE + 0.15 && gallons > 0) {
    lines.push({
      key: "fuel",
      label: "Contract fuel program",
      annual: round(gallons * annualize * (avgFuelPrice - FUEL_MARKET_PRICE) * 0.8, 100),
      detail: `Paying $${avgFuelPrice.toFixed(2)}/gal vs ~$${FUEL_MARKET_PRICE.toFixed(2)} contract average.`,
    });
  }
  const crew = byCat.get("crew")?.amount ?? 0;
  if (annualizedHours < 200 && crew * costAnnualize > 300_000) {
    lines.push({
      key: "crew",
      label: "Right-size crew structure",
      annual: round(crew * costAnnualize * 0.15, 100),
      detail: `Under 200 hrs/yr: a full-time captain with contract SIC typically cuts crew cost 15–25%.`,
    });
  }
  const improvement = { total: lines.reduce((s, l) => s + l.annual, 0), lines };

  return {
    asOf,
    periodDays,
    hoursFlown: Math.round(hoursFlown * 10) / 10,
    annualizedHours: Math.round(annualizedHours * 10) / 10,
    targetHours: p.targetHours,
    utilizationPct: Math.round(utilization * 1000) / 10,
    hoursByPurpose: {
      owner: Math.round(hoursByPurpose.owner * 10) / 10,
      charter: Math.round(hoursByPurpose.charter * 10) / 10,
      positioning: Math.round(hoursByPurpose.positioning * 10) / 10,
      maintenance: Math.round(hoursByPurpose.maintenance * 10) / 10,
    },
    legs: flights.length,
    emptyHours: Math.round(emptyHours * 10) / 10,
    emptyLegShare: Math.round((emptyHours / Math.max(hoursFlown, 1)) * 1000) / 1000,
    monetizedPositioningShare: Math.round(monetizedPositioningShare * 1000) / 1000,
    fixedAnnual: round(fixedAnnual),
    fixedCashAnnual: round(fixedCashAnnual),
    capitalAnnual: round(capitalAnnual),
    variableAnnual: round(variableAnnual),
    variablePerHour: round(variablePerHour),
    totalAnnual: round(totalAnnual),
    cashCostPerHour: round((fixedCashAnnual + variableAnnual) / safeHours),
    allInCostPerHour: round(totalAnnual / safeHours),
    revenueAnnual: round(revenueAnnual),
    netCostAnnual: round(netCostAnnual),
    netCostPerHour: round(netCostAnnual / safeHours),
    avgFuelPrice: Math.round(avgFuelPrice * 100) / 100,
    benchmarkCostPerHour: round(benchmarkCostPerHour),
    costBreakdown,
    monthly,
    emptyLegs,
    maintenanceAlerts: alerts,
    yieldScore,
    improvement,
  };
}

// What-if model: how do costs move if the aircraft flies more (or fewer) hours?
// The key truth it encodes: extra hours lower cost per hour but RAISE total spend
// unless they bring in revenue.
export function runScenario(a: Analytics, profile: AircraftProfile, input: ScenarioInput): ScenarioResult {
  const hours = Math.max(1, a.annualizedHours + input.additionalHours);
  const fuel = a.costBreakdown.find((c) => c.category === "fuel");
  const fuelPerHour = fuel ? fuel.annual / Math.max(a.annualizedHours, 1) : 0;
  const fuelFactor = input.fuelPrice && a.avgFuelPrice > 0 ? input.fuelPrice / a.avgFuelPrice : 1;
  const variablePerHour = a.variablePerHour - fuelPerHour + fuelPerHour * fuelFactor;
  // Work in deltas from the baseline so a zero-change scenario is exactly zero.
  const addedCost =
    variablePerHour * (hours - a.annualizedHours) + (variablePerHour - a.variablePerHour) * a.annualizedHours;
  const totalAnnual = a.totalAnnual + addedCost;
  const charterShare = clamp(input.charterShare);
  const addedRevenue = Math.max(0, input.additionalHours) * charterShare * profile.charterRatePerHour * OWNER_REVENUE_SHARE;
  const netCostAnnual = totalAnnual - (a.revenueAnnual + addedRevenue);
  const ownerHours = Math.max(
    1,
    a.hoursByPurpose.owner * (a.annualizedHours / Math.max(a.hoursFlown, 1)) +
      Math.max(0, input.additionalHours) * (1 - charterShare),
  );
  return {
    hours: Math.round(hours),
    allInCostPerHour: round(totalAnnual / hours),
    cashCostPerHour: round((totalAnnual - a.capitalAnnual) / hours),
    totalAnnual: round(totalAnnual),
    addedCost: round(addedCost),
    addedRevenue: round(addedRevenue),
    netCostAnnual: round(netCostAnnual),
    netCostDelta: round(netCostAnnual - a.netCostAnnual),
    ownerCostPerOwnerHour: round(netCostAnnual / ownerHours),
  };
}

// Cost-per-hour curve for the chart: fixed costs spread over more hours.
export function costCurve(a: Analytics, maxHours: number) {
  const pts: { hours: number; allIn: number; cash: number }[] = [];
  const step = Math.max(10, Math.round(maxHours / 40 / 10) * 10);
  for (let h = Math.max(50, step); h <= maxHours; h += step) {
    pts.push({
      hours: h,
      allIn: round(a.fixedAnnual / h + a.variablePerHour),
      cash: round(a.fixedCashAnnual / h + a.variablePerHour),
    });
  }
  return pts;
}
