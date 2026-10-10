import type { AircraftProfile } from "@/lib/types";

// Cost assumptions used to synthesize each sample aircraft's ledger.
// Annual figures in USD; per-hour figures in USD per block hour.
export interface CostModel {
  crew: number;
  hangar: number;
  insurance: number;
  training: number;
  management: number;
  subscriptions: number;
  capital: number; // depreciation + cost of capital
  fuelPrice: number; // USD/gal paid at the pump, incl. into-plane fees
  engineReservePerHour: number; // 0 = not enrolled in an hourly engine program
  maintenancePerHour: number;
  feesPerLeg: number;
  crewTravelPerOvernight: number;
}

export interface FleetSeed {
  profile: AircraftProfile;
  costs: CostModel;
  airframeHours: number;
  annualHours: number; // what the generator aims to have flown in the last 12 months
  oneWayRate: number; // share of owner trips that strand the aircraft away from base
  charterShare: number; // share of trips that are charter (managed aircraft only)
  monetizedPositioningRate: number; // share of positioning legs already sold as empty legs
  destinations: string[];
  seed: number;
  maintenance: {
    item: string;
    dueInHours?: number;
    dueInDays?: number;
    estimatedCost: number;
    downtimeDays: number;
    notes?: string;
  }[];
}

export const FLEET: FleetSeed[] = [
  {
    profile: {
      id: "cj3",
      name: "Citation CJ3+",
      model: "Cessna Citation CJ3+",
      tail: "N525JY",
      year: 2019,
      aircraftClass: "light",
      homeBase: "KSDL",
      seats: 7,
      cruiseKtas: 416,
      fuelBurnGph: 170,
      targetHours: 250,
      charterRatePerHour: 4300,
      operation: "Part 91 · owner use only",
      charterEnabled: false,
      marketValue: 9_200_000,
      scenario: "Light jet at ~65% of target. Frequent one-way trips reposition home empty.",
    },
    costs: {
      crew: 238_000,
      hangar: 54_000,
      insurance: 41_000,
      training: 48_000,
      management: 72_000,
      subscriptions: 31_000,
      capital: 506_000,
      fuelPrice: 6.85,
      engineReservePerHour: 520,
      maintenancePerHour: 640,
      feesPerLeg: 520,
      crewTravelPerOvernight: 350,
    },
    airframeHours: 1_284,
    annualHours: 162,
    oneWayRate: 0.5,
    charterShare: 0,
    monetizedPositioningRate: 0,
    destinations: ["KASE", "KLAS", "KVNY", "KSNA", "KSAN", "KAPA", "KSUN", "KJAC", "KSJC", "KDAL", "KEGE"],
    seed: 525,
    maintenance: [
      { item: "Phase 5 inspection (600 hr / 12 mo)", dueInDays: 38, estimatedCost: 42_000, downtimeDays: 6 },
      { item: "Williams FJ44-3A oil analysis + borescope", dueInHours: 22, estimatedCost: 6_500, downtimeDays: 1 },
      { item: "ELT battery replacement", dueInDays: 120, estimatedCost: 1_800, downtimeDays: 0 },
      { item: "Garmin G3000 database + annual nav cert", dueInDays: 17, estimatedCost: 900, downtimeDays: 0 },
    ],
  },
  {
    profile: {
      id: "xls",
      name: "Citation XLS+",
      model: "Cessna Citation XLS+",
      tail: "N560XL",
      year: 2016,
      aircraftClass: "midsize",
      homeBase: "KTEB",
      seats: 9,
      cruiseKtas: 430,
      fuelBurnGph: 230,
      targetHours: 450,
      charterRatePerHour: 6900,
      operation: "Part 135 · managed with charter",
      charterEnabled: true,
      marketValue: 7_500_000,
      scenario: "Managed midsize near target with charter revenue, but ~1 in 4 hours flies empty.",
    },
    costs: {
      crew: 445_000,
      hangar: 196_000,
      insurance: 66_000,
      training: 96_000,
      management: 168_000,
      subscriptions: 44_000,
      capital: 338_000,
      fuelPrice: 6.25,
      engineReservePerHour: 690,
      maintenancePerHour: 820,
      feesPerLeg: 780,
      crewTravelPerOvernight: 420,
    },
    airframeHours: 4_912,
    annualHours: 395,
    oneWayRate: 0.35,
    charterShare: 0.4,
    monetizedPositioningRate: 0.15,
    destinations: ["KPBI", "KOPF", "KACK", "KBED", "KMDW", "KCHS", "KBNA", "KFLL", "KASE", "KDAL", "KPDK"],
    seed: 560,
    maintenance: [
      { item: "Doc 12-month inspection", dueInDays: 64, estimatedCost: 58_000, downtimeDays: 8 },
      { item: "PW545C hot section inspection", dueInHours: 140, estimatedCost: 0, downtimeDays: 10, notes: "Covered under ESP Gold; downtime only" },
      { item: "Landing gear overhaul", dueInDays: 210, estimatedCost: 96_000, downtimeDays: 14 },
      { item: "Part 135 crew recurrent (SIC)", dueInDays: 26, estimatedCost: 22_000, downtimeDays: 0 },
    ],
  },
  {
    profile: {
      id: "hawker",
      name: "Hawker 800XP",
      model: "Hawker Beechcraft 800XP",
      tail: "N800HK",
      year: 2004,
      aircraftClass: "midsize",
      homeBase: "KPDK",
      seats: 8,
      cruiseKtas: 430,
      fuelBurnGph: 275,
      targetHours: 200,
      charterRatePerHour: 5700,
      operation: "Part 91 · owner use only",
      charterEnabled: false,
      marketValue: 2_400_000,
      scenario: "Aging midsize at ~125 hrs, no engine program, and a major inspection coming due.",
    },
    costs: {
      crew: 395_000,
      hangar: 69_000,
      insurance: 58_000,
      training: 92_000,
      management: 90_000,
      subscriptions: 29_000,
      capital: 216_000,
      fuelPrice: 6.4,
      engineReservePerHour: 0,
      maintenancePerHour: 1_450,
      feesPerLeg: 560,
      crewTravelPerOvernight: 380,
    },
    airframeHours: 8_640,
    annualHours: 126,
    oneWayRate: 0.4,
    charterShare: 0,
    monetizedPositioningRate: 0,
    destinations: ["KPBI", "KTEB", "KBNA", "KAUS", "KDAL", "KHOU", "KCHS", "KMDW", "KOPF"],
    seed: 800,
    maintenance: [
      { item: "12-year inspection + corrosion check", dueInDays: 55, estimatedCost: 385_000, downtimeDays: 35, notes: "Typically uncovers additional findings" },
      { item: "TFE731-5BR hot section (engine #2)", dueInHours: 64, estimatedCost: 240_000, downtimeDays: 12, notes: "Not enrolled in MSP: owner pays at event" },
      { item: "Thrust reverser overhaul", dueInDays: 150, estimatedCost: 68_000, downtimeDays: 5 },
      { item: "Pitot-static / transponder (24 mo)", dueInDays: 21, estimatedCost: 3_200, downtimeDays: 1 },
    ],
  },
];

export const FUEL_MARKET_PRICE = 6.2; // national contract-fuel average, USD/gal

export const CLASS_BENCHMARKS = {
  light: { fixedCash: 470_000, variablePerHour: 2_350, hours: 300 },
  midsize: { fixedCash: 860_000, variablePerHour: 3_300, hours: 400 },
  "super-midsize": { fixedCash: 1_150_000, variablePerHour: 4_100, hours: 450 },
} as const;
