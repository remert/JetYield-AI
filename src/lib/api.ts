import type { z } from "zod";
import { MAX_BODY_BYTES } from "./schema";
import { clientKey, rateLimit } from "./rate-limit";

type Parsed<T> = { ok: true; data: T } | { ok: false; response: Response };

// Shared request guard for the AI routes: rate limit, size cap, schema validation.
export async function parseRequest<S extends z.ZodType>(req: Request, schema: S): Promise<Parsed<z.infer<S>>> {
  const limit = rateLimit(clientKey(req));
  if (!limit.ok) {
    return {
      ok: false,
      response: Response.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      ),
    };
  }
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) {
    return { ok: false, response: Response.json({ error: "Request too large" }, { status: 413 }) };
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, response: Response.json({ error: "Invalid JSON" }, { status: 400 }) };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, response: Response.json({ error: "Invalid request", issues: parsed.error.issues.slice(0, 5) }, { status: 400 }) };
  }
  return { ok: true, data: parsed.data };
}
