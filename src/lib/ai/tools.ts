import { z } from "zod";
import { monthKey } from "@/lib/dates";
import { runScenario } from "@/lib/engine/analytics";
import type { AIInput } from "./types";

// Tools the chat agent can call. Both are deterministic: the model decides
// WHAT to compute, the engine does the arithmetic.

export const scenarioInput = z.object({
  additional_hours: z.number().min(-1000).max(2000),
  charter_share: z.number().min(0).max(1),
  fuel_price_per_gallon: z.number().min(1).max(20).optional(),
});

export const flightLogInput = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  purpose: z.enum(["owner", "charter", "positioning", "maintenance"]).optional(),
});

export const TOOL_DEFS = [
  {
    name: "run_scenario",
    description:
      "Recompute annual costs for a what-if utilization scenario. Use for any question about flying more or fewer hours, adding charter, or a fuel price change. Returns hours, all-in and cash cost per hour, total annual cost, added cost, added revenue, net cost and the change in net cost (negative = owner saves).",
    input_schema: {
      type: "object" as const,
      properties: {
        additional_hours: { type: "number", description: "Hours added to the current annualized total (negative to fly less)." },
        charter_share: { type: "number", description: "Share (0-1) of the added hours flown as revenue charter. 0 = all owner flying." },
        fuel_price_per_gallon: { type: "number", description: "Optional fuel price override in USD/gal." },
      },
      required: ["additional_hours", "charter_share"],
      additionalProperties: false,
    },
  },
  {
    name: "get_flight_log",
    description: "List individual flight legs from the trailing 12-month log, optionally filtered by month (YYYY-MM) and purpose. Use when the question needs leg-level detail.",
    input_schema: {
      type: "object" as const,
      properties: {
        month: { type: "string", description: "YYYY-MM" },
        purpose: { type: "string", enum: ["owner", "charter", "positioning", "maintenance"] },
      },
      additionalProperties: false,
    },
  },
] as const;

export const TOOL_LABELS: Record<string, string> = {
  run_scenario: "Running what-if scenario",
  get_flight_log: "Reading flight log",
};

export function executeTool(name: string, rawInput: unknown, ctx: AIInput): { content: string; isError: boolean } {
  if (name === "run_scenario") {
    const parsed = scenarioInput.safeParse(rawInput);
    if (!parsed.success) return { content: `Invalid input: ${parsed.error.message}`, isError: true };
    const r = runScenario(ctx.analytics, ctx.dataset.profile, {
      additionalHours: parsed.data.additional_hours,
      charterShare: parsed.data.charter_share,
      fuelPrice: parsed.data.fuel_price_per_gallon,
    });
    return {
      content: JSON.stringify({
        baseline: {
          hours: ctx.analytics.annualizedHours,
          allInCostPerHour: ctx.analytics.allInCostPerHour,
          cashCostPerHour: ctx.analytics.cashCostPerHour,
          totalAnnual: ctx.analytics.totalAnnual,
          netCostAnnual: ctx.analytics.netCostAnnual,
        },
        scenario: r,
      }),
      isError: false,
    };
  }
  if (name === "get_flight_log") {
    const parsed = flightLogInput.safeParse(rawInput ?? {});
    if (!parsed.success) return { content: `Invalid input: ${parsed.error.message}`, isError: true };
    const legs = ctx.dataset.flights
      .filter((f) => (!parsed.data.month || monthKey(f.date) === parsed.data.month) && (!parsed.data.purpose || f.purpose === parsed.data.purpose))
      .slice(-60)
      .map((f) => ({ date: f.date, from: f.from, to: f.to, hrs: f.blockHours, purpose: f.purpose, pax: f.passengers, revenue: f.revenue }));
    return { content: JSON.stringify({ count: legs.length, legs }), isError: false };
  }
  return { content: `Unknown tool ${name}`, isError: true };
}
