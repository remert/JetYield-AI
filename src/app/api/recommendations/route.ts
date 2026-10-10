import { DemoAdvisor, getAdvisor } from "@/lib/ai";
import { cachedRecommend } from "@/lib/ai/recommend-cache";
import { parseRequest } from "@/lib/api";
import { computeAnalytics } from "@/lib/engine/analytics";
import { buildRecommendations } from "@/lib/engine/recommendations";
import { recommendRequestSchema } from "@/lib/schema";

export const maxDuration = 60;

export async function POST(req: Request) {
  const parsed = await parseRequest(req, recommendRequestSchema);
  if (!parsed.ok) return parsed.response;
  const dataset = parsed.data.dataset;
  const analytics = computeAnalytics(dataset);
  const baseline = buildRecommendations(dataset, analytics);
  const input = { dataset, analytics, baseline };

  const advisor = getAdvisor();
  try {
    return Response.json(await cachedRecommend(advisor, input));
  } catch (err) {
    // Never leave the panel empty: fall back to the deterministic engine.
    console.error("[recommendations] AI provider failed, using engine output:", err);
    const fallback = await new DemoAdvisor().recommend(input);
    return Response.json({ ...fallback, degraded: true });
  }
}
