"use client";

import clsx from "clsx";
import { Banknote, Gauge, Plane, RefreshCw, Sparkles, Wrench } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RecommendResult } from "@/lib/ai/types";
import type { RecommendationCategory } from "@/lib/types";
import { useFleet } from "./fleet-provider";
import { Badge, Card, CardHeader, Skeleton } from "./ui";

const CATEGORY: Record<RecommendationCategory, { label: string; icon: React.ElementType }> = {
  empty_leg: { label: "Empty legs", icon: Plane },
  utilization: { label: "Utilization", icon: Gauge },
  cost: { label: "Cost", icon: Banknote },
  maintenance: { label: "Maintenance", icon: Wrench },
};

const PRIORITY = {
  1: { label: "This week", tone: "critical" as const },
  2: { label: "This quarter", tone: "amber" as const },
  3: { label: "When convenient", tone: "neutral" as const },
};

export function RecommendationsPanel() {
  const { dataset, baseline, ready } = useFleet();
  const [result, setResult] = useState<(RecommendResult & { degraded?: boolean }) | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      if (id === reqId.current) setResult(data);
    } catch (e) {
      if (id === reqId.current) {
        setError((e as Error).message);
        // Show engine output so the panel is never empty.
        setResult({ mode: "demo", summary: "", recommendations: baseline });
      }
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [dataset, baseline]);

  useEffect(() => {
    if (!ready) return;
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on aircraft/data change */
    setResult(null);
    void load();
  }, [ready, load]);

  return (
    <Card>
      <CardHeader
        icon={<Sparkles size={15} />}
        title="AI recommendations"
        subtitle={
          result?.mode === "claude" ? "Prioritized by Claude · figures from the JetYield engine" : "Prioritized by the JetYield engine"
        }
        right={
          // Results are cached server-side, so a retry only helps when the AI call failed.
          result?.degraded || error ? (
            <button
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-text-2 hover:bg-surface-2 hover:text-text disabled:opacity-50"
            >
              <RefreshCw size={12} className={clsx(loading && "animate-spin")} aria-hidden /> Retry AI
            </button>
          ) : undefined
        }
      />
      <div className="px-5 pb-5">
        {loading && !result ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted">
              <Sparkles size={13} className="animate-pulse-soft text-accent" aria-hidden /> Analyzing {dataset.profile.tail}&apos;s costs, schedule and
              maintenance…
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : result ? (
          <div className={clsx("space-y-3 transition-opacity", loading && "opacity-50")}>
            {result.summary && (
              <p className="rounded-lg border border-accent/20 bg-accent/[0.06] px-3.5 py-2.5 text-sm text-text">{result.summary}</p>
            )}
            {error && <p className="text-xs text-amber">AI service unavailable ({error}). Showing engine recommendations.</p>}
            <ol className="space-y-2.5">
              {result.recommendations.map((r, i) => {
                const cat = CATEGORY[r.category];
                const Icon = cat.icon;
                return (
                  <li key={r.id} className="rounded-xl border border-border bg-surface-2/50 p-3.5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-3 text-accent">
                        <Icon size={15} aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="num text-xs text-muted">{String(i + 1).padStart(2, "0")}</span>
                          <h3 className="text-sm font-semibold text-text">{r.title}</h3>
                        </div>
                        <p className="mt-1 text-[13px] leading-relaxed text-text-2">{r.detail}</p>
                        {r.actions.length > 0 && (
                          <ul className="mt-2 space-y-0.5 text-xs text-muted">
                            {r.actions.map((a) => (
                              <li key={a} className="flex gap-1.5">
                                <span className="text-accent" aria-hidden>
                                  →
                                </span>
                                {a}
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                          <Badge tone={PRIORITY[r.priority].tone}>{PRIORITY[r.priority].label}</Badge>
                          <Badge>{cat.label}</Badge>
                          <Badge tone={r.impactAnnual > 0 ? "good" : "neutral"}>{r.impactLabel}</Badge>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
