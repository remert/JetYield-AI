"use client";

import { BarChart3, LineChart as LineIcon, PieChart } from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { costCurve } from "@/lib/engine/analytics";
import { usd, usdCompact } from "@/lib/format";
import type { Analytics } from "@/lib/types";
import { Card, CardHeader } from "./ui";

const AXIS = { stroke: "var(--muted)", fontSize: 11, tickLine: false, axisLine: false } as const;

const SERIES = [
  { key: "owner", label: "Owner", color: "var(--series-owner)" },
  { key: "positioning", label: "Positioning", color: "var(--series-empty)" },
  { key: "charter", label: "Charter", color: "var(--series-charter)" },
  { key: "maintenance", label: "Maintenance", color: "var(--series-mx)" },
] as const;

function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="rounded-lg border border-border-strong bg-surface-2/95 px-3 py-2 text-xs shadow-xl shadow-black/40 backdrop-blur">
      <div className="mb-1 font-medium text-text">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4 text-text-2">
          <span className="flex items-center gap-1.5">
            {r.color && <span className="h-2 w-2 rounded-sm" style={{ background: r.color }} />}
            {r.label}
          </span>
          <span className="num text-text">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

export function MonthlyHoursChart({ a }: { a: Analytics }) {
  const visible = SERIES.filter((s) => a.monthly.some((m) => m[s.key] > 0));
  return (
    <Card>
      <CardHeader
        icon={<BarChart3 size={15} />}
        title="Monthly flight hours"
        subtitle={`Trailing 12 months vs. ${a.targetHours}-hr annual target pace`}
        right={
          <div className="flex flex-wrap justify-end gap-x-3 gap-y-1 text-[11px] text-text-2">
            {visible.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
                {s.label}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="h-0 w-3 border-t-2 border-dashed border-amber" />
              Target pace
            </span>
          </div>
        }
      />
      <div className="h-64 px-2 pb-3">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={a.monthly} margin={{ top: 8, right: 12, left: -8, bottom: 0 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="label" {...AXIS} />
            <YAxis {...AXIS} width={40} />
            <Tooltip
              cursor={{ fill: "rgba(94,184,255,0.06)" }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={`${label} · ${payload[0].payload.total} hrs`}
                    rows={[
                      ...visible.map((s) => ({ label: s.label, value: `${payload[0].payload[s.key]} hrs`, color: s.color })),
                      { label: "Target pace", value: `${payload[0].payload.targetPace} hrs` },
                    ]}
                  />
                ) : null
              }
            />
            {visible.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                stackId="h"
                fill={s.color}
                stroke="var(--surface)"
                strokeWidth={1}
                radius={i === visible.length - 1 ? [4, 4, 0, 0] : 0}
                isAnimationActive={false}
              />
            ))}
            <Line dataKey="targetPace" stroke="var(--amber)" strokeDasharray="5 4" strokeWidth={2} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function CostBreakdown({ a }: { a: Analytics }) {
  const max = Math.max(...a.costBreakdown.map((c) => c.annual), 1);
  return (
    <Card>
      <CardHeader icon={<PieChart size={15} />} title="Where the money goes" subtitle={`Annualized · ${usdCompact(a.totalAnnual)} total`} />
      <ul className="space-y-2.5 px-5 pb-5">
        {a.costBreakdown.map((c) => (
          <li key={c.category}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate text-text-2">
                {c.label}
                <span className="ml-1.5 text-[10px] text-muted uppercase">{c.kind}</span>
              </span>
              <span className="num shrink-0 text-text">
                {usdCompact(c.annual)}
                <span className="ml-1.5 text-muted">{usd(c.perHour)}/hr</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-3">
              <div
                className="h-full rounded-full"
                style={{ width: `${(c.annual / max) * 100}%`, background: c.kind === "fixed" ? "var(--accent)" : "var(--amber)" }}
              />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function CostCurveChart({ a, scenarioHours }: { a: Analytics; scenarioHours?: number }) {
  const maxHours = Math.max(a.targetHours * 1.6, (scenarioHours ?? 0) * 1.2, 300);
  const data = costCurve(a, Math.round(maxHours / 50) * 50);
  const current = a.allInCostPerHour;
  const scenarioCost = scenarioHours ? Math.round(a.fixedAnnual / scenarioHours + a.variablePerHour) : undefined;
  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-xs text-muted">
        <LineIcon size={13} className="text-accent" aria-hidden /> All-in cost per hour vs. annual hours
      </div>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 12, left: -4, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="hours" type="number" domain={["dataMin", "dataMax"]} {...AXIS} tickFormatter={(v) => `${v}h`} />
            <YAxis {...AXIS} width={48} tickFormatter={(v) => usdCompact(v)} domain={[0, "auto"]} />
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={`${payload[0].payload.hours} hrs / year`}
                    rows={[
                      { label: "All-in", value: usd(payload[0].payload.allIn), color: "var(--accent)" },
                      { label: "Cash", value: usd(payload[0].payload.cash), color: "var(--muted)" },
                    ]}
                  />
                ) : null
              }
            />
            <ReferenceLine x={a.targetHours} stroke="var(--amber)" strokeDasharray="4 4" label={{ value: "Target", position: "insideTopRight", fill: "var(--amber)", fontSize: 10 }} />
            <Line dataKey="cash" stroke="var(--muted)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            <Line dataKey="allIn" stroke="var(--accent)" strokeWidth={2} dot={false} isAnimationActive={false} />
            <ReferenceDot x={Math.round(a.annualizedHours)} y={current} r={5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
            {scenarioHours && scenarioCost && Math.round(scenarioHours) !== Math.round(a.annualizedHours) && (
              <ReferenceDot x={Math.round(scenarioHours)} y={scenarioCost} r={5} fill="var(--good)" stroke="var(--surface)" strokeWidth={2} />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex gap-3 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-accent" /> Today
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-good" /> Scenario
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0 w-3 border-t border-muted" /> Cash only
        </span>
      </div>
    </div>
  );
}
