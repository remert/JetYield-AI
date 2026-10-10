import { describe, expect, it } from "vitest";
import { answerQuestion } from "@/lib/ai/demo";
import { generateSampleDataset } from "@/lib/data/generate";
import { computeAnalytics, runScenario } from "@/lib/engine/analytics";
import { buildRecommendations } from "@/lib/engine/recommendations";
import { datasetSchema } from "@/lib/schema";

const TODAY = "2026-10-10";
const fleet = ["cj3", "xls", "hawker"].map((id) => {
  const ds = generateSampleDataset(id, TODAY);
  return { id, ds, a: computeAnalytics(ds, TODAY) };
});

describe("sample data", () => {
  it("is deterministic for a given date", () => {
    expect(generateSampleDataset("cj3", TODAY)).toEqual(generateSampleDataset("cj3", TODAY));
  });

  it("passes the API request schema", () => {
    for (const { ds } of fleet) expect(datasetSchema.safeParse(ds).success).toBe(true);
  });

  it("spreads flying across all twelve months", () => {
    for (const { a } of fleet) expect(a.monthly.filter((m) => m.total > 0).length).toBeGreaterThanOrEqual(11);
  });
});

describe("cost engine", () => {
  it("reconciles cost per hour with annual totals", () => {
    for (const { a } of fleet) {
      expect(a.fixedAnnual + a.variableAnnual).toBeCloseTo(a.totalAnnual, -1);
      expect(a.allInCostPerHour).toBeCloseTo(a.totalAnnual / a.annualizedHours, -1);
      expect(a.cashCostPerHour).toBeLessThan(a.allInCostPerHour);
    }
  });

  it("produces distinct scenarios across the fleet", () => {
    const scores = Object.fromEntries(fleet.map(({ id, a }) => [id, a.yieldScore.score]));
    expect(scores.xls).toBeGreaterThan(scores.cj3);
    expect(scores.xls).toBeGreaterThan(scores.hawker);
  });

  it("lowers cost per hour but raises total spend for extra owner hours", () => {
    const { ds, a } = fleet[0];
    const r = runScenario(a, ds.profile, { additionalHours: 50, charterShare: 0 });
    expect(r.allInCostPerHour).toBeLessThan(a.allInCostPerHour);
    expect(r.addedCost).toBeGreaterThan(0);
    expect(r.netCostDelta).toBeGreaterThan(0);
  });

  it("reduces net cost when extra hours are charter", () => {
    const { ds, a } = fleet[1];
    const r = runScenario(a, ds.profile, { additionalHours: 50, charterShare: 1 });
    expect(r.netCostDelta).toBeLessThan(0);
  });

  it("is a no-op scenario at zero additional hours", () => {
    const { ds, a } = fleet[2];
    const r = runScenario(a, ds.profile, { additionalHours: 0, charterShare: 0 });
    expect(Math.abs(r.netCostDelta)).toBeLessThan(5);
  });
});

describe("recommendations", () => {
  it("never produces negative impact and always sorts by priority", () => {
    for (const { ds, a } of fleet) {
      const recs = buildRecommendations(ds, a);
      expect(recs.length).toBeGreaterThan(2);
      for (const r of recs) expect(r.impactAnnual).toBeGreaterThanOrEqual(0);
      const priorities = recs.map((r) => r.priority);
      expect([...priorities].sort()).toEqual(priorities);
    }
  });

  it("flags the missing engine program on the Hawker", () => {
    const { ds, a } = fleet[2];
    expect(buildRecommendations(ds, a).some((r) => r.id === "engine-program")).toBe(true);
  });
});

describe("demo advisor", () => {
  const { ds, a } = fleet[0];
  const ctx = { dataset: ds, analytics: a, baseline: buildRecommendations(ds, a) };

  it("answers the headline questions from engine figures", () => {
    expect(answerQuestion("What is my true cost per hour?", ctx).answer).toContain(a.allInCostPerHour.toLocaleString("en-US"));
    expect(answerQuestion("How much would I save if I flew 50 more hours?", ctx).tool).toBe("run_scenario");
    expect(answerQuestion("Which empty legs should I list this month?", ctx).answer).toContain(a.emptyLegs[0].from);
  });
});

describe("uploaded data", () => {
  it("models costs for a short flight-only upload instead of reusing the sample ledger", async () => {
    const { buildDataset } = await import("@/components/fleet-provider");
    const flights = [
      { id: "a", date: "2026-07-02", from: "KSDL", to: "KASE", blockHours: 1.4, purpose: "owner" as const, passengers: 4, revenue: 0 },
      { id: "b", date: "2026-07-02", from: "KASE", to: "KSDL", blockHours: 1.4, purpose: "positioning" as const, passengers: 0, revenue: 0 },
      { id: "c", date: "2026-09-20", from: "KSDL", to: "KLAS", blockHours: 1.0, purpose: "owner" as const, passengers: 3, revenue: 0 },
      { id: "d", date: "2026-09-23", from: "KLAS", to: "KSDL", blockHours: 1.0, purpose: "owner" as const, passengers: 3, revenue: 0 },
    ];
    const ds = buildDataset("cj3", { flights }, TODAY);
    const a = computeAnalytics(ds, TODAY);
    expect(ds.source).toBe("uploaded");
    // ~3 months of data annualized, and variable cost/hr in the type's normal range.
    expect(a.annualizedHours).toBeGreaterThan(15);
    expect(a.variablePerHour).toBeGreaterThan(1500);
    expect(a.variablePerHour).toBeLessThan(4000);
  });
});
