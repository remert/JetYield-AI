// Core domain model for JetYield AI.
// All analytics are derived from these records; nothing in the dashboard is
// hardcoded, so uploaded CSVs flow through the same engine as the sample data.

export type AircraftClass = "light" | "midsize" | "super-midsize";

export interface AircraftProfile {
  id: string;
  name: string; // display name, e.g. "Citation CJ3+"
  model: string;
  tail: string;
  year: number;
  aircraftClass: AircraftClass;
  homeBase: string; // ICAO
  seats: number;
  cruiseKtas: number;
  fuelBurnGph: number;
  targetHours: number; // annual utilization goal
  charterRatePerHour: number; // prevailing retail charter rate for the type
  operation: string; // e.g. "Part 91, owner use only"
  charterEnabled: boolean; // already on a Part 135 certificate
  marketValue: number;
  scenario: string; // one-line story for the scenario switcher
}

export type FlightPurpose = "owner" | "charter" | "positioning" | "maintenance";

export interface FlightLeg {
  id: string;
  date: string; // YYYY-MM-DD
  from: string; // ICAO
  to: string; // ICAO
  blockHours: number;
  purpose: FlightPurpose;
  passengers: number;
  revenue: number; // charter or empty-leg revenue collected, USD
  fuelGallons?: number;
}

export type CostCategory =
  | "crew"
  | "hangar"
  | "insurance"
  | "training"
  | "management"
  | "subscriptions"
  | "capital" // depreciation + cost of capital: the line most owners leave out
  | "fuel"
  | "maintenance"
  | "engine_reserve"
  | "fees"
  | "crew_travel"
  | "other";

export type CostKind = "fixed" | "variable";

export interface CostEntry {
  date: string; // YYYY-MM-DD
  category: CostCategory;
  description: string;
  amount: number; // USD
  kind: CostKind;
  gallons?: number; // fuel entries only
}

export interface MaintenanceItem {
  id: string;
  item: string;
  dueHours?: number; // airframe total time at which item is due
  dueDate?: string; // YYYY-MM-DD
  estimatedCost: number;
  downtimeDays: number;
  notes?: string;
}

export interface ScheduledTrip {
  id: string;
  date: string;
  from: string;
  to: string;
  passengers: number;
  // When true the aircraft must reposition empty to or from home base.
  oneWay: boolean;
}

export interface AircraftDataset {
  profile: AircraftProfile;
  airframeHours: number; // current total time
  flights: FlightLeg[];
  costs: CostEntry[];
  maintenance: MaintenanceItem[];
  schedule: ScheduledTrip[];
  source: "sample" | "uploaded";
}

// ---------- Derived analytics ----------

export interface MonthlyPoint {
  month: string; // YYYY-MM
  label: string; // "Oct"
  owner: number;
  charter: number;
  positioning: number;
  maintenance: number;
  total: number;
  targetPace: number;
}

export interface CostBreakdownItem {
  category: CostCategory;
  label: string;
  kind: CostKind;
  annual: number;
  perHour: number;
}

export interface EmptyLegOpportunity {
  id: string;
  date: string;
  from: string;
  to: string;
  fromCity: string;
  toCity: string;
  blockHours: number;
  listPrice: number;
  sellProbability: number; // 0..1
  incrementalCost: number;
  expectedNet: number; // probability-weighted net revenue
  demand: "high" | "medium" | "low";
  rationale: string;
}

export interface MaintenanceAlert {
  id: string;
  item: string;
  severity: "critical" | "warning" | "info";
  dueLabel: string;
  daysUntilDue: number;
  hoursUntilDue?: number;
  estimatedCost: number;
  downtimeDays: number;
  advice: string;
}

export interface YieldScore {
  score: number; // 0..100
  grade: "A" | "B" | "C" | "D";
  components: { key: string; label: string; score: number; weight: number; detail: string }[];
}

export interface ImprovementLine {
  key: string;
  label: string;
  annual: number;
  detail: string;
}

export interface Analytics {
  asOf: string;
  periodDays: number;
  hoursFlown: number;
  annualizedHours: number;
  targetHours: number;
  utilizationPct: number;
  hoursByPurpose: Record<FlightPurpose, number>;
  legs: number;
  emptyHours: number;
  emptyLegShare: number; // empty positioning hours / total hours
  monetizedPositioningShare: number;
  fixedAnnual: number;
  fixedCashAnnual: number;
  capitalAnnual: number;
  variableAnnual: number;
  variablePerHour: number;
  totalAnnual: number;
  cashCostPerHour: number;
  allInCostPerHour: number;
  revenueAnnual: number;
  netCostAnnual: number;
  netCostPerHour: number;
  avgFuelPrice: number;
  benchmarkCostPerHour: number;
  costBreakdown: CostBreakdownItem[];
  monthly: MonthlyPoint[];
  emptyLegs: EmptyLegOpportunity[];
  maintenanceAlerts: MaintenanceAlert[];
  yieldScore: YieldScore;
  improvement: { total: number; lines: ImprovementLine[] };
}

export interface ScenarioInput {
  additionalHours: number;
  charterShare: number; // 0..1 share of additional hours flown as charter
  fuelPrice?: number; // override USD/gal
}

export interface ScenarioResult {
  hours: number;
  allInCostPerHour: number;
  cashCostPerHour: number;
  totalAnnual: number;
  addedCost: number;
  addedRevenue: number;
  netCostAnnual: number;
  netCostDelta: number; // negative = owner saves money
  ownerCostPerOwnerHour: number;
}

export type RecommendationCategory = "empty_leg" | "utilization" | "cost" | "maintenance";

export interface Recommendation {
  id: string;
  category: RecommendationCategory;
  priority: 1 | 2 | 3; // 1 = do this week
  title: string;
  detail: string;
  impactAnnual: number; // USD, 0 if not quantifiable
  impactLabel: string;
  actions: string[];
}
