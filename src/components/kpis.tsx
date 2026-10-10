"use client";

import { Gauge, Plane, Receipt, Target, TrendingUp } from "lucide-react";
import { usd, usdCompact } from "@/lib/format";
import type { Analytics } from "@/lib/types";
import { Card } from "./ui";

function Tile({
  icon,
  label,
  children,
  footer,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted">
        <span className="text-accent">{icon}</span>
        {label}
      </div>
      <div className="mt-3 flex-1">{children}</div>
      {footer && <div className="mt-3 border-t border-border pt-2.5 text-xs text-muted">{footer}</div>}
    </Card>
  );
}

function Meter({ value, color = "var(--accent)" }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3" role="presentation">
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(2, value * 100))}%`, background: color }} />
    </div>
  );
}

export function ScoreRing({ score, size = 76 }: { score: number; size?: number }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const color = score >= 80 ? "var(--good)" : score >= 65 ? "var(--accent)" : score >= 50 ? "var(--warning)" : "var(--serious)";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Yield score ${score} of 100`}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--surface-3)" strokeWidth="7" fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth="7"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${(score / 100) * c} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="num" fill="var(--text)" fontSize={size * 0.3} fontWeight={600}>
        {score}
      </text>
    </svg>
  );
}

export function KpiRow({ a }: { a: Analytics }) {
  const util = a.annualizedHours / a.targetHours;
  const fixedShare = a.fixedAnnual / Math.max(a.totalAnnual, 1);
  const emptyLine = a.improvement.lines.find((l) => l.key === "empty_legs");
  const upcoming = a.emptyLegs.reduce((s, l) => s + l.expectedNet, 0);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Tile
        icon={<Target size={14} />}
        label="Annual utilization"
        footer={
          <>
            {a.utilizationPct}% of target · {Math.round(a.hoursByPurpose.owner)} owner / {Math.round(a.hoursByPurpose.charter)} charter hrs
          </>
        }
      >
        <div className="num text-3xl font-semibold">
          {Math.round(a.annualizedHours)}
          <span className="ml-1 text-base font-normal text-muted">/ {a.targetHours} hrs</span>
        </div>
        <div className="mt-3">
          <Meter value={util} color={util >= 0.9 ? "var(--good)" : util >= 0.7 ? "var(--accent)" : "var(--warning)"} />
        </div>
      </Tile>

      <Tile
        icon={<Gauge size={14} />}
        label="True all-in cost / hour"
        footer={
          <>
            Cash {usd(a.cashCostPerHour)}/hr · class benchmark {usd(a.benchmarkCostPerHour)}
          </>
        }
      >
        <div className="num text-3xl font-semibold">{usd(a.allInCostPerHour)}</div>
        <p className="mt-2 text-xs text-text-2">
          Variable is only <span className="num text-text">{usd(a.variablePerHour)}</span>; fixed costs add{" "}
          <span className="num text-text">{usd(a.allInCostPerHour - a.variablePerHour)}</span> to every hour.
        </p>
      </Tile>

      <Tile
        icon={<Receipt size={14} />}
        label="Annual cost"
        footer={
          a.revenueAnnual > 0 ? (
            <>
              Net of {usdCompact(a.revenueAnnual)} revenue: <span className="num text-text-2">{usdCompact(a.netCostAnnual)}</span>
            </>
          ) : (
            <>No revenue offsets these costs</>
          )
        }
      >
        <div className="num text-3xl font-semibold">{usdCompact(a.totalAnnual)}</div>
        <div className="mt-3 flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label={`Fixed ${Math.round(fixedShare * 100)}%, variable ${Math.round((1 - fixedShare) * 100)}%`}>
          <div className="h-full rounded-l-full bg-accent" style={{ width: `${fixedShare * 100}%` }} />
          <div className="h-full rounded-r-full bg-amber" style={{ width: `${(1 - fixedShare) * 100}%` }} />
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-muted">
          <span>
            <span className="text-accent">■</span> Fixed {usdCompact(a.fixedAnnual)}
          </span>
          <span>
            <span className="text-amber">■</span> Variable {usdCompact(a.variableAnnual)}
          </span>
        </div>
      </Tile>

      <Tile
        icon={<Plane size={14} />}
        label="Empty-leg opportunity"
        footer={
          <>
            {a.emptyLegs.length} upcoming leg{a.emptyLegs.length === 1 ? "" : "s"} worth ~{usdCompact(upcoming)}
          </>
        }
      >
        <div className="num text-3xl font-semibold">
          {usdCompact(emptyLine?.annual ?? 0)}
          <span className="ml-1 text-base font-normal text-muted">/yr</span>
        </div>
        <p className="mt-2 text-xs text-text-2">
          <span className="num text-text">{Math.round(a.emptyHours)} hrs</span> ({Math.round(a.emptyLegShare * 100)}% of flying) repositioned empty and unsold.
        </p>
      </Tile>

      <Tile
        icon={<TrendingUp size={14} />}
        label="Yield score"
        footer={
          <>
            Potential improvement <span className="num text-good">+{usdCompact(a.improvement.total)}/yr</span>
          </>
        }
      >
        <div className="flex items-center gap-3">
          <ScoreRing score={a.yieldScore.score} />
          <div className="space-y-1 text-[11px] text-muted">
            {a.yieldScore.components.map((c) => (
              <div key={c.key} className="flex items-center gap-1.5">
                <span className="w-20 truncate">{c.label}</span>
                <span className="num text-text-2">{Math.round(c.score * 100)}</span>
              </div>
            ))}
          </div>
        </div>
      </Tile>
    </div>
  );
}
