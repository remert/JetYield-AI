import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Recommendation } from "@/lib/types";
import { buildAircraftContext } from "./context";
import { ADVISOR_PERSONA, CHAT_INSTRUCTIONS, RECOMMEND_INSTRUCTIONS, dataBlock } from "./prompts";
import { TOOL_DEFS, TOOL_LABELS, executeTool } from "./tools";
import type { AIInput, ChatEvent, ChatTurn, RecommendResult, YieldAdvisor } from "./types";

export const DEFAULT_MODEL = "claude-opus-5-5";
const MAX_TOOL_ROUNDS = 4;

// Server-side refusal fallback: if a request is declined by a safety
// classifier, the API retries it on a suitable model automatically.
const FALLBACK_BETA = "server-side-fallback-2026-07-01";
const supportsFallbacks = (model: string) =>
  /^claude-(opus-5-5|opus-5|fable-5-1|sonnet-5-5)$/.test(model);

const recommendSchema = z.object({
  summary: z.string(),
  recommendations: z.array(
    z.object({
      id: z.string(),
      priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      title: z.string(),
      detail: z.string(),
      actions: z.array(z.string()),
    }),
  ),
});

const RECOMMEND_JSON_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    recommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          priority: { type: "integer", enum: [1, 2, 3] },
          title: { type: "string" },
          detail: { type: "string" },
          actions: { type: "array", items: { type: "string" } },
        },
        required: ["id", "priority", "title", "detail", "actions"],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "recommendations"],
  additionalProperties: false,
};

export class ClaudeAdvisor implements YieldAdvisor {
  readonly mode = "claude" as const;
  private client: Anthropic;
  private model: string;

  constructor(opts: { apiKey?: string; model?: string } = {}) {
    // Keep requests inside the route's 60s budget so failures fall back to the engine quickly.
    this.client = new Anthropic({ ...(opts.apiKey ? { apiKey: opts.apiKey } : {}), timeout: 45_000, maxRetries: 1 });
    this.model = opts.model || DEFAULT_MODEL;
  }

  private fallbackParams() {
    return supportsFallbacks(this.model)
      ? { betas: [FALLBACK_BETA], fallbacks: "default" as const }
      : {};
  }

  private system(input: AIInput, instructions: string): Anthropic.Beta.Messages.BetaTextBlockParam[] {
    const ctx = buildAircraftContext(input.dataset, input.analytics, input.baseline);
    return [
      { type: "text", text: `${ADVISOR_PERSONA}\n\n${instructions}` },
      // Cache the aircraft data so follow-up chat turns reuse the prefix.
      { type: "text", text: dataBlock(ctx), cache_control: { type: "ephemeral" } },
    ];
  }

  async recommend(input: AIInput): Promise<RecommendResult> {
    const response = await this.client.beta.messages.create({
      model: this.model,
      max_tokens: 16000,
      system: this.system(input, RECOMMEND_INSTRUCTIONS),
      messages: [{ role: "user", content: "Produce the prioritized recommendation list for this aircraft." }],
      output_config: { effort: "medium", format: { type: "json_schema", schema: RECOMMEND_JSON_SCHEMA } },
      ...this.fallbackParams(),
    });
    if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
      throw new Error(`Recommendation request ended with stop_reason=${response.stop_reason}`);
    }
    const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    const parsed = recommendSchema.parse(JSON.parse(text));

    // Merge model wording onto engine figures. Impact numbers always come
    // from the deterministic engine, never from the model.
    const byId = new Map(input.baseline.map((r) => [r.id, r]));
    const recommendations: Recommendation[] = parsed.recommendations.flatMap((r) => {
      const base = byId.get(r.id);
      if (!base) return [];
      return [{ ...base, priority: r.priority, title: r.title, detail: r.detail, actions: r.actions.slice(0, 3) }];
    });
    if (recommendations.length === 0) throw new Error("Model returned no usable recommendations");
    return { mode: "claude", summary: parsed.summary, recommendations };
  }

  async *chat(input: AIInput & { messages: ChatTurn[] }): AsyncGenerator<ChatEvent> {
    const system = this.system(input, CHAT_INSTRUCTIONS);
    const messages: Anthropic.Beta.Messages.BetaMessageParam[] = input.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    const tools = TOOL_DEFS.map((t) => ({ ...t, eager_input_streaming: true }));

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const stream = this.client.beta.messages.stream({
        model: this.model,
        max_tokens: 8000,
        system,
        messages,
        tools,
        output_config: { effort: "low" },
        ...this.fallbackParams(),
      });

      // Forward text deltas as they arrive.
      const queue: string[] = [];
      let wake: (() => void) | null = null;
      let finished = false;
      stream.on("text", (delta) => {
        queue.push(delta);
        wake?.();
      });
      const final = stream.finalMessage().finally(() => {
        finished = true;
        wake?.();
      });
      while (!finished || queue.length) {
        if (queue.length) {
          yield { type: "text", text: queue.splice(0).join("") };
          continue;
        }
        await new Promise<void>((r) => (wake = r));
        wake = null;
      }
      const message = await final;

      if (message.stop_reason === "refusal") {
        yield { type: "text", text: "\n\nI can't help with that request. Try asking about this aircraft's costs, utilization, empty legs or maintenance." };
        return;
      }
      if (message.stop_reason !== "tool_use") return;

      // Append the full assistant content (including thinking blocks) unchanged.
      messages.push({ role: "assistant", content: message.content });
      const results: Anthropic.Beta.Messages.BetaToolResultBlockParam[] = [];
      for (const block of message.content) {
        if (block.type !== "tool_use") continue;
        yield { type: "tool", name: block.name, label: TOOL_LABELS[block.name] ?? block.name };
        const out = executeTool(block.name, block.input, input);
        results.push({ type: "tool_result", tool_use_id: block.id, content: out.content, is_error: out.isError });
      }
      messages.push({ role: "user", content: results });
    }
    yield { type: "text", text: "\n\n(Stopped after several tool calls. Try a more specific question.)" };
  }
}
