import { describe, expect, it } from "vitest";
import { costsToCsv, flightsToCsv, maintenanceToCsv, parseCosts, parseFlights, parseMaintenance } from "@/lib/csv";
import { generateSampleDataset } from "@/lib/data/generate";

const ds = generateSampleDataset("xls", "2026-10-10");

describe("CSV round trip", () => {
  it("re-imports the exported sample files without errors", () => {
    const f = parseFlights(flightsToCsv(ds.flights));
    const c = parseCosts(costsToCsv(ds.costs));
    const m = parseMaintenance(maintenanceToCsv(ds.maintenance));
    expect(f.issues.filter((i) => i.level === "error")).toEqual([]);
    expect(f.rows).toHaveLength(ds.flights.length);
    expect(c.rows).toHaveLength(ds.costs.length);
    expect(m.rows).toHaveLength(ds.maintenance.length);
  });
});

describe("validation", () => {
  it("reports missing required columns", () => {
    const r = parseFlights("date,from,to\n2026-01-01,KTEB,KPBI");
    expect(r.missingColumns).toEqual(["block_hours", "purpose"]);
    expect(r.rows).toHaveLength(0);
  });

  it("skips bad rows with row-numbered errors and keeps good ones", () => {
    const csv = [
      "Date,From,To,Block Hours,Purpose,Passengers",
      "2026-01-05,KTEB,KPBI,2.6,owner,4",
      "2026-13-05,KTEB,KPBI,2.6,owner,4",
      "2026-01-07,KPBI,KTEB,abc,owner,4",
      "2026-01-08,KPBI,KTEB,2.4,joyride,4",
    ].join("\n");
    const r = parseFlights(csv);
    expect(r.rows).toHaveLength(1);
    expect(r.issues.filter((i) => i.level === "error").map((i) => i.row)).toEqual([2, 3, 4]);
  });

  it("accepts currency formatting and infers cost kind from category", () => {
    const r = parseCosts("date,category,amount\n2026-02-01,fuel,\"$12,400\"\n2026-02-01,hangar,4500");
    expect(r.rows.map((x) => [x.amount, x.kind])).toEqual([
      [12400, "variable"],
      [4500, "fixed"],
    ]);
  });

  it("requires a due date or due hours for maintenance", () => {
    const r = parseMaintenance("item,estimated_cost\nPhase 5,42000");
    expect(r.rows).toHaveLength(0);
    expect(r.issues[0].message).toMatch(/due_hours or due_date/);
  });
});
