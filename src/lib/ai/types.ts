import type { AircraftDataset, Analytics, Recommendation } from "@/lib/types";

export type AIMode = "claude" | "demo";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

// Newline-delimited JSON events streamed from /api/chat to the browser.
export type ChatEvent =
  | { type: "meta"; mode: AIMode }
  | { type: "text"; text: string }
  | { type: "tool"; name: string; label: string }
  | { type: "error"; message: string }
  | { type: "done" };

export interface AIInput {
  dataset: AircraftDataset;
  analytics: Analytics;
  baseline: Recommendation[];
}

export interface RecommendResult {
  mode: AIMode;
  summary: string;
  recommendations: Recommendation[];
}

// Swap providers by implementing this interface (see ./index.ts).
export interface YieldAdvisor {
  readonly mode: AIMode;
  recommend(input: AIInput): Promise<RecommendResult>;
  chat(input: AIInput & { messages: ChatTurn[] }): AsyncGenerator<ChatEvent>;
}
