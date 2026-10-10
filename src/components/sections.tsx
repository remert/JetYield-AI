"use client";

import { Check, Copy, MapPin, Plane, Wrench } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { formatDate } from "@/lib/dates";
import { usd, usdCompact } from "@/lib/format";
import type { AircraftDataset, Analytics, EmptyLegOpportunity } from "@/lib/types";
import { useChat } from "./chat";
import { Badge, Card, CardHeader, SeverityBadge } from "./ui";

export function AircraftHeader({ ds, a }: { ds: AircraftDataset; a: Analytics }) {
  const p = ds.profile;
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold tracking-tight">
            {p.model} <span className="num text-text-2">· {p.tail}</span>
          </h2>
          <Badge tone={p.charterEnabled ? "good" : "neutral"}>{p.operation}</Badge>
          {ds.source === "uploaded" && <Badge tone="amber">Uploaded data</Badge>}
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="flex items-center gap-1">
            <MapPin size={12} aria-hidden /> Based {p.homeBase}
          </span>
          <span>{p.year} · {p.seats} seats · {p.cruiseKtas} ktas</span>
          <span className="num">{ds.airframeHours.toLocaleString("en-US")} TT</span>
          <span>
            {a.legs} legs analyzed · through {formatDate(a.asOf)}
          </span>
        </p>
      </div>
    </div>
  );
}

function listingText(l: EmptyLegOpportunity, ds: AircraftDataset) {
  return `Empty leg: ${ds.profile.name} (${ds.profile.seats} seats)\n${l.fromCity} (${l.from}) → ${l.toCity} (${l.to})\n${formatDate(l.date)}, flexible ±1 hr · ${l.blockHours} hr flight\nPrice: ${usd(l.listPrice)} for the aircraft`;
}

function CopyListing({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          // Clipboard blocked; nothing else to do.
        }
      }}
      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-text-2 hover:bg-surface-3 hover:text-text"
      aria-label="Copy listing text"
    >
      {done ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
      {done ? "Copied" : "Copy listing"}
    </button>
  );
}

const DEMAND_TONE = { high: "good", medium: "accent", low: "neutral" } as const;

export function EmptyLegTable({ ds, a, limit }: { ds: AircraftDataset; a: Analytics; limit?: number }) {
  const legs = limit ? a.emptyLegs.slice(0, limit) : a.emptyLegs;
  const { ask } = useChat();
  return (
    <Card>
      <CardHeader
        icon={<Plane size={15} />}
        title="Upcoming empty legs"
        subtitle={
          ds.profile.charterEnabled
            ? "Repositioning legs on your schedule, ranked by expected net revenue"
            : "Part 91: these can only be sold through a Part 135 certificate holder"
        }
        right={
          limit && a.emptyLegs.length > limit ? (
            <Link href="/dashboard/empty-legs" className="text-xs text-accent hover:underline">
              View all {a.emptyLegs.length}
            </Link>
          ) : undefined
        }
      />
      {legs.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-muted">No one-way trips on the upcoming schedule. Add future-dated legs to your flight log to plan empty legs.</p>
      ) : (
        <div className="overflow-x-auto px-2 pb-3">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="text-[11px] tracking-wide text-muted uppercase">
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Route</th>
                <th className="px-3 py-2 text-right font-medium">Hrs</th>
                <th className="px-3 py-2 text-right font-medium">List price</th>
                <th className="px-3 py-2 text-right font-medium">Sell prob.</th>
                <th className="px-3 py-2 text-right font-medium">Expected net</th>
                <th className="px-3 py-2 font-medium">Demand</th>
                {!limit && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody>
              {legs.map((l) => (
                <tr key={l.id} className="border-t border-border align-top">
                  <td className="num px-3 py-2.5 whitespace-nowrap text-text-2">{formatDate(l.date)}</td>
                  <td className="px-3 py-2.5">
                    <div className="num font-medium text-text">
                      {l.from} → {l.to}
                    </div>
                    <div className="text-xs text-muted">
                      {l.fromCity} to {l.toCity}
                    </div>
                    {!limit && <div className="mt-1 max-w-xs text-xs text-text-2">{l.rationale}</div>}
                  </td>
                  <td className="num px-3 py-2.5 text-right text-text-2">{l.blockHours}</td>
                  <td className="num px-3 py-2.5 text-right">{usd(l.listPrice)}</td>
                  <td className="num px-3 py-2.5 text-right text-text-2">{Math.round(l.sellProbability * 100)}%</td>
                  <td className="num px-3 py-2.5 text-right font-semibold text-[#4ad44a]">{usd(l.expectedNet)}</td>
                  <td className="px-3 py-2.5">
                    <Badge tone={DEMAND_TONE[l.demand]}>{l.demand}</Badge>
                  </td>
                  {!limit && (
                    <td className="px-3 py-2.5">
                      <CopyListing text={listingText(l, ds)} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {limit && (
            <button onClick={() => ask("Which empty legs should I list this month?")} className="mt-2 ml-3 text-xs text-accent hover:underline">
              Ask JetYield which to list →
            </button>
          )}
        </div>
      )}
    </Card>
  );
}

export function MaintenanceList({ a, limit }: { a: Analytics; limit?: number }) {
  const items = limit ? a.maintenanceAlerts.slice(0, limit) : a.maintenanceAlerts;
  const budget90 = a.maintenanceAlerts.filter((m) => m.daysUntilDue <= 90).reduce((s, m) => s + m.estimatedCost, 0);
  return (
    <Card>
      <CardHeader
        icon={<Wrench size={15} />}
        title="Maintenance timing"
        subtitle={`${usdCompact(budget90)} due in the next 90 days`}
        right={
          limit && a.maintenanceAlerts.length > limit ? (
            <Link href="/dashboard/maintenance" className="text-xs text-accent hover:underline">
              View all
            </Link>
          ) : undefined
        }
      />
      <ul className="space-y-2 px-5 pb-5">
        {items.map((m) => (
          <li key={m.id} className="rounded-lg border border-border bg-surface-2/50 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium text-text">{m.item}</div>
                <div className="num mt-0.5 text-xs text-muted">{m.dueLabel}</div>
              </div>
              <SeverityBadge severity={m.severity} />
            </div>
            {!limit && <p className="mt-2 text-xs leading-relaxed text-text-2">{m.advice}</p>}
            <div className="mt-2 flex gap-3 text-[11px] text-muted">
              {m.estimatedCost > 0 && <span className="num">Est. {usd(m.estimatedCost)}</span>}
              {m.downtimeDays > 0 && <span>{m.downtimeDays} days down</span>}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
