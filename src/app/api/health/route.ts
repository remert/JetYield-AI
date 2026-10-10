export function GET() {
  return Response.json({ ok: true, ai: process.env.ANTHROPIC_API_KEY ? "claude" : "demo" });
}
