import { DemoAdvisor, getAdvisor, type ChatEvent } from "@/lib/ai";
import { parseRequest } from "@/lib/api";
import { computeAnalytics } from "@/lib/engine/analytics";
import { buildRecommendations } from "@/lib/engine/recommendations";
import { chatRequestSchema } from "@/lib/schema";

export const maxDuration = 60;

// Streams newline-delimited JSON ChatEvents.
export async function POST(req: Request) {
  const parsed = await parseRequest(req, chatRequestSchema);
  if (!parsed.ok) return parsed.response;
  const { dataset, messages } = parsed.data;
  const analytics = computeAnalytics(dataset);
  const baseline = buildRecommendations(dataset, analytics);
  const advisor = getAdvisor();
  const encoder = new TextEncoder();

  const body = new ReadableStream({
    async start(controller) {
      const send = (e: ChatEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      const input = { dataset, analytics, baseline, messages };
      let sentText = false;
      send({ type: "meta", mode: advisor.mode });
      try {
        for await (const event of advisor.chat(input)) {
          if (req.signal.aborted) break;
          if (event.type === "text") sentText = true;
          send(event);
        }
      } catch (err) {
        console.error("[chat] provider error:", err);
        if (sentText) {
          send({ type: "error", message: "The AI service dropped the connection. Please try again." });
        } else {
          // Nothing streamed yet: answer from the deterministic engine instead.
          send({ type: "meta", mode: "demo" });
          for await (const event of new DemoAdvisor().chat(input)) send(event);
        }
      }
      send({ type: "done" });
      controller.close();
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
