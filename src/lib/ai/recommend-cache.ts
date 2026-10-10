import "server-only";
import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";
import type { AIInput, RecommendResult, YieldAdvisor } from "./types";

// Recommendations depend only on the dataset, so identical datasets share one
// model call. Sample aircraft regenerate identically for every visitor on a
// given day, so the public demo makes at most one call per aircraft per day.
const TTL_SECONDS = 24 * 60 * 60;

// Bump when prompts or output handling change so stale entries are ignored.
const CACHE_VERSION = "recs-v1";

const inFlight = new Map<string, Promise<RecommendResult>>();

export function datasetFingerprint(input: AIInput): string {
  return createHash("sha256").update(JSON.stringify(input.dataset)).digest("hex");
}

export async function cachedRecommend(advisor: YieldAdvisor, input: AIInput): Promise<RecommendResult> {
  // Demo mode is free and instant; nothing to cache.
  if (advisor.mode !== "claude") return advisor.recommend(input);

  const key = [CACHE_VERSION, process.env.ANTHROPIC_MODEL ?? "default", datasetFingerprint(input)].join(":");

  // Collapse concurrent misses for the same dataset on this instance into one call.
  const pending = inFlight.get(key);
  if (pending) return pending;

  // The input is closed over (not passed as an argument) so the cache key stays
  // the short fingerprint. Errors are thrown, never cached.
  const run = unstable_cache(() => advisor.recommend(input), [key], { revalidate: TTL_SECONDS, tags: ["recommendations"] });
  const promise = run().finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}
