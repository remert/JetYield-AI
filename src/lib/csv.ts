import Papa from "papaparse";
import { isKnownAirport } from "@/lib/data/airports";
import { isValidISODate } from "@/lib/dates";
import type { CostCategory, CostEntry, FlightLeg, FlightPurpose, MaintenanceItem } from "@/lib/types";

export type UploadKind = "flights" | "costs" | "maintenance";

export interface ColumnSpec {
  name: string;
  required: boolean;
  description: string;
  example: string;
}

export const CSV_SPECS: Record<UploadKind, { title: string; description: string; columns: ColumnSpec[] }> = {
  flights: {
    title: "Flight log",
    description: "One row per leg. Positioning legs with 0 passengers are counted as empty.",
    columns: [
      { name: "date", required: true, description: "YYYY-MM-DD", example: "2026-09-14" },
      { name: "from", required: true, description: "Departure ICAO", example: "KSDL" },
      { name: "to", required: true, description: "Arrival ICAO", example: "KASE" },
      { name: "block_hours", required: true, description: "Block time in hours", example: "1.4" },
      { name: "purpose", required: true, description: "owner | charter | positioning | maintenance", example: "owner" },
      { name: "passengers", required: false, description: "Passenger count (default 0)", example: "4" },
      { name: "revenue", required: false, description: "Revenue collected, USD (default 0)", example: "0" },
      { name: "fuel_gallons", required: false, description: "Fuel uplift in gallons", example: "240" },
    ],
  },
  costs: {
    title: "Cost ledger",
    description: "Invoices or monthly totals. Fixed vs variable drives the cost-per-hour math.",
    columns: [
      { name: "date", required: true, description: "YYYY-MM-DD", example: "2026-09-01" },
      {
        name: "category",
        required: true,
        description:
          "crew | hangar | insurance | training | management | subscriptions | capital | fuel | maintenance | engine_reserve | fees | crew_travel | other",
        example: "hangar",
      },
      { name: "amount", required: true, description: "USD, no currency symbol needed", example: "4500" },
      { name: "kind", required: false, description: "fixed | variable (inferred from category if blank)", example: "fixed" },
      { name: "description", required: false, description: "Free text", example: "Hangar rent - September" },
      { name: "gallons", required: false, description: "Fuel rows only; enables $/gal analysis", example: "1200" },
    ],
  },
  maintenance: {
    title: "Maintenance tracking",
    description: "Upcoming inspections and events. Provide due_hours, due_date, or both.",
    columns: [
      { name: "item", required: true, description: "Inspection or component", example: "Phase 5 inspection" },
      { name: "due_hours", required: false, description: "Airframe total time when due", example: "1310" },
      { name: "due_date", required: false, description: "YYYY-MM-DD", example: "2026-11-17" },
      { name: "estimated_cost", required: false, description: "USD", example: "42000" },
      { name: "downtime_days", required: false, description: "Expected days out of service", example: "6" },
      { name: "notes", required: false, description: "Free text", example: "Bundle with avionics update" },
    ],
  },
};

const PURPOSES: FlightPurpose[] = ["owner", "charter", "positioning", "maintenance"];
const CATEGORIES: CostCategory[] = [
  "crew", "hangar", "insurance", "training", "management", "subscriptions", "capital",
  "fuel", "maintenance", "engine_reserve", "fees", "crew_travel", "other",
];
const VARIABLE_CATEGORIES = new Set<CostCategory>(["fuel", "maintenance", "engine_reserve", "fees", "crew_travel"]);

export const MAX_ROWS = 5000;

export interface ParseIssue {
  row: number; // 1-based data row (header excluded)
  message: string;
  level: "error" | "warning";
}

export interface ParseResult<T> {
  rows: T[];
  issues: ParseIssue[];
  totalRows: number;
  missingColumns: string[];
}

function normalizeHeader(h: string) {
  return h.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function num(v: string | undefined): number | null {
  if (v === undefined || v.trim() === "") return null;
  const n = Number(v.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

function parseRaw(text: string) {
  return Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normalizeHeader,
  });
}

function check<T>(kind: UploadKind, text: string, rowFn: (r: Record<string, string>, i: number, issues: ParseIssue[]) => T | null): ParseResult<T> {
  const parsed = parseRaw(text);
  const fields = parsed.meta.fields ?? [];
  const missingColumns = CSV_SPECS[kind].columns.filter((c) => c.required && !fields.includes(c.name)).map((c) => c.name);
  const issues: ParseIssue[] = parsed.errors.slice(0, 10).map((e) => ({
    row: (e.row ?? 0) + 1,
    message: e.message,
    level: "error" as const,
  }));
  if (missingColumns.length) return { rows: [], issues, totalRows: parsed.data.length, missingColumns };
  if (parsed.data.length > MAX_ROWS) {
    issues.push({ row: 0, message: `File has ${parsed.data.length} rows; only the first ${MAX_ROWS} are used.`, level: "warning" });
  }
  const rows: T[] = [];
  parsed.data.slice(0, MAX_ROWS).forEach((r, i) => {
    const out = rowFn(r, i + 1, issues);
    if (out) rows.push(out);
  });
  return { rows, issues, totalRows: parsed.data.length, missingColumns };
}

export function parseFlights(text: string): ParseResult<FlightLeg> {
  return check("flights", text, (r, row, issues) => {
    const err = (message: string) => (issues.push({ row, message, level: "error" }), null);
    const date = r.date?.trim();
    if (!isValidISODate(date)) return err(`Invalid date "${r.date}" (expected YYYY-MM-DD)`);
    const from = r.from?.trim().toUpperCase();
    const to = r.to?.trim().toUpperCase();
    if (!/^[A-Z0-9]{3,4}$/.test(from ?? "") || !/^[A-Z0-9]{3,4}$/.test(to ?? "")) return err(`Invalid airport code "${r.from}" → "${r.to}"`);
    const hours = num(r.block_hours);
    if (hours === null || Number.isNaN(hours) || hours <= 0 || hours > 16) return err(`block_hours must be between 0 and 16 (got "${r.block_hours}")`);
    const purpose = r.purpose?.trim().toLowerCase() as FlightPurpose;
    if (!PURPOSES.includes(purpose)) return err(`purpose must be one of ${PURPOSES.join(", ")} (got "${r.purpose}")`);
    const pax = num(r.passengers) ?? 0;
    const revenue = num(r.revenue) ?? 0;
    const fuel = num(r.fuel_gallons);
    if (Number.isNaN(pax) || Number.isNaN(revenue) || pax < 0 || revenue < 0) return err("passengers and revenue must be non-negative numbers");
    if (!isKnownAirport(from) || !isKnownAirport(to)) {
      issues.push({ row, level: "warning", message: `${!isKnownAirport(from) ? from : to} isn't in the demo airport directory; empty-leg pricing will use average demand.` });
    }
    return {
      id: `u-f${row}`,
      date,
      from,
      to,
      blockHours: hours,
      purpose,
      passengers: Math.round(pax),
      revenue,
      ...(fuel !== null && !Number.isNaN(fuel) ? { fuelGallons: fuel } : {}),
    };
  });
}

export function parseCosts(text: string): ParseResult<CostEntry> {
  return check("costs", text, (r, row, issues) => {
    const err = (message: string) => (issues.push({ row, message, level: "error" }), null);
    const date = r.date?.trim();
    if (!isValidISODate(date)) return err(`Invalid date "${r.date}" (expected YYYY-MM-DD)`);
    const category = r.category?.trim().toLowerCase().replace(/\s+/g, "_") as CostCategory;
    if (!CATEGORIES.includes(category)) return err(`Unknown category "${r.category}"`);
    const amount = num(r.amount);
    if (amount === null || Number.isNaN(amount)) return err(`amount must be a number (got "${r.amount}")`);
    if (amount < 0) issues.push({ row, level: "warning", message: "Negative amount treated as a credit." });
    const kindRaw = r.kind?.trim().toLowerCase();
    if (kindRaw && kindRaw !== "fixed" && kindRaw !== "variable") return err(`kind must be fixed or variable (got "${r.kind}")`);
    const kind = (kindRaw as "fixed" | "variable") || (VARIABLE_CATEGORIES.has(category) ? "variable" : "fixed");
    const gallons = num(r.gallons);
    return {
      date,
      category,
      amount,
      kind,
      description: r.description?.trim() || category,
      ...(gallons !== null && !Number.isNaN(gallons) && gallons > 0 ? { gallons } : {}),
    };
  });
}

export function parseMaintenance(text: string): ParseResult<MaintenanceItem> {
  return check("maintenance", text, (r, row, issues) => {
    const err = (message: string) => (issues.push({ row, message, level: "error" }), null);
    const item = r.item?.trim();
    if (!item) return err("item is required");
    const dueHours = num(r.due_hours);
    const dueDate = r.due_date?.trim();
    if (dueHours === null && !dueDate) return err("Provide due_hours or due_date");
    if (dueHours !== null && Number.isNaN(dueHours)) return err(`due_hours must be a number (got "${r.due_hours}")`);
    if (dueDate && !isValidISODate(dueDate)) return err(`Invalid due_date "${r.due_date}"`);
    const cost = num(r.estimated_cost) ?? 0;
    const downtime = num(r.downtime_days) ?? 0;
    if (Number.isNaN(cost) || Number.isNaN(downtime)) return err("estimated_cost and downtime_days must be numbers");
    return {
      id: `u-mx${row}`,
      item,
      ...(dueHours !== null ? { dueHours } : {}),
      ...(dueDate ? { dueDate } : {}),
      estimatedCost: cost,
      downtimeDays: downtime,
      ...(r.notes?.trim() ? { notes: r.notes.trim() } : {}),
    };
  });
}

// ---------- Export sample data as CSV (used for the downloadable templates) ----------

export function flightsToCsv(rows: FlightLeg[]): string {
  return Papa.unparse(
    rows.map((f) => ({
      date: f.date,
      from: f.from,
      to: f.to,
      block_hours: f.blockHours,
      purpose: f.purpose,
      passengers: f.passengers,
      revenue: f.revenue,
      fuel_gallons: f.fuelGallons ?? "",
    })),
  );
}

export function costsToCsv(rows: CostEntry[]): string {
  return Papa.unparse(
    rows.map((c) => ({
      date: c.date,
      category: c.category,
      amount: c.amount,
      kind: c.kind,
      description: c.description,
      gallons: c.gallons ?? "",
    })),
  );
}

export function maintenanceToCsv(rows: MaintenanceItem[]): string {
  return Papa.unparse(
    rows.map((m) => ({
      item: m.item,
      due_hours: m.dueHours ?? "",
      due_date: m.dueDate ?? "",
      estimated_cost: m.estimatedCost,
      downtime_days: m.downtimeDays,
      notes: m.notes ?? "",
    })),
  );
}
