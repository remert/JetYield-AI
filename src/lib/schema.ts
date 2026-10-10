import { z } from "zod";

// Server-side validation for datasets posted by the browser. The client owns
// the data (sample or uploaded), so the API never trusts its shape.

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const icao = z.string().regex(/^[A-Z0-9]{3,4}$/);
const money = z.number().finite().min(-1e8).max(1e8);

export const profileSchema = z.object({
  id: z.string().max(40),
  name: z.string().max(80),
  model: z.string().max(80),
  tail: z.string().max(12),
  year: z.number().int().min(1960).max(2100),
  aircraftClass: z.enum(["light", "midsize", "super-midsize"]),
  homeBase: icao,
  seats: z.number().int().min(1).max(30),
  cruiseKtas: z.number().min(100).max(700),
  fuelBurnGph: z.number().min(10).max(1000),
  targetHours: z.number().min(10).max(2000),
  charterRatePerHour: z.number().min(0).max(50_000),
  operation: z.string().max(80),
  charterEnabled: z.boolean(),
  marketValue: money,
  scenario: z.string().max(200),
});

export const datasetSchema = z.object({
  profile: profileSchema,
  airframeHours: z.number().min(0).max(100_000),
  flights: z
    .array(
      z.object({
        id: z.string().max(40),
        date: isoDate,
        from: icao,
        to: icao,
        blockHours: z.number().min(0).max(16),
        purpose: z.enum(["owner", "charter", "positioning", "maintenance"]),
        passengers: z.number().int().min(0).max(30),
        revenue: money,
        fuelGallons: z.number().min(0).max(10_000).optional(),
      }),
    )
    .max(5000),
  costs: z
    .array(
      z.object({
        date: isoDate,
        category: z.enum([
          "crew", "hangar", "insurance", "training", "management", "subscriptions", "capital",
          "fuel", "maintenance", "engine_reserve", "fees", "crew_travel", "other",
        ]),
        description: z.string().max(200),
        amount: money,
        kind: z.enum(["fixed", "variable"]),
        gallons: z.number().min(0).max(1e6).optional(),
      }),
    )
    .max(5000),
  maintenance: z
    .array(
      z.object({
        id: z.string().max(40),
        item: z.string().max(200),
        dueHours: z.number().min(0).max(100_000).optional(),
        dueDate: isoDate.optional(),
        estimatedCost: money,
        downtimeDays: z.number().min(0).max(365),
        notes: z.string().max(300).optional(),
      }),
    )
    .max(200),
  schedule: z
    .array(
      z.object({
        id: z.string().max(40),
        date: isoDate,
        from: icao,
        to: icao,
        passengers: z.number().int().min(0).max(30),
        oneWay: z.boolean(),
      }),
    )
    .max(200),
  source: z.enum(["sample", "uploaded"]),
});

export const chatRequestSchema = z.object({
  dataset: datasetSchema,
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) }))
    .min(1)
    .max(30),
});

export const recommendRequestSchema = z.object({ dataset: datasetSchema });

// Max accepted request body (bytes). A full year of legs + costs is ~60 KB.
export const MAX_BODY_BYTES = 1_000_000;
