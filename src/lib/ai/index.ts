import "server-only";
import { ClaudeAdvisor } from "./claude";
import { DemoAdvisor } from "./demo";
import type { YieldAdvisor } from "./types";

// Provider selection. To swap in another model provider, implement
// YieldAdvisor and return it here.
export function getAdvisor(): YieldAdvisor {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) return new ClaudeAdvisor({ apiKey, model: process.env.ANTHROPIC_MODEL });
  return new DemoAdvisor();
}

export { DemoAdvisor };
export type * from "./types";
