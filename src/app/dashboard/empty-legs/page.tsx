"use client";

import { useFleet } from "@/components/fleet-provider";
import { AircraftHeader, EmptyLegTable } from "@/components/sections";
import { Card } from "@/components/ui";
import { usd, usdCompact } from "@/lib/format";

export default function EmptyLegsPage() {
  const { dataset, analytics: a } = useFleet();
  const line = a.improvement.lines.find((l) => l.key === "empty_legs");
  const upcoming = a.emptyLegs.reduce((s, l) => s + l.expectedNet, 0);
  const stats = [
    { label: "Empty, unsold hours (12 mo)", value: `${Math.round(a.emptyHours)} hrs`, sub: `${Math.round(a.emptyLegShare * 100)}% of all flying` },
    { label: "Positioning legs monetized", value: `${Math.round(a.monetizedPositioningShare * 100)}%`, sub: `of ${Math.round(a.hoursByPurpose.positioning)} positioning hrs` },
    { label: "Annual revenue left on the table", value: usdCompact(line?.annual ?? 0), sub: "probability-weighted, after commission" },
    { label: "Upcoming legs expected net", value: usd(upcoming), sub: `${a.emptyLegs.length} legs on the schedule` },
  ];
  return (
    <div className="space-y-4">
      <AircraftHeader ds={dataset} a={a} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="text-xs text-muted">{s.label}</div>
            <div className="num mt-2 text-2xl font-semibold">{s.value}</div>
            <div className="mt-1 text-xs text-muted">{s.sub}</div>
          </Card>
        ))}
      </div>
      <EmptyLegTable ds={dataset} a={a} />
      <Card className="p-5 text-sm leading-relaxed text-text-2">
        <h2 className="mb-2 text-sm font-semibold text-text">How empty legs are priced</h2>
        <p>
          List price is the type&apos;s retail charter rate ({usd(dataset.profile.charterRatePerHour)}/hr) × block hours × 40–65%, scaled by
          destination demand and seasonality. Sell probability falls when there are fewer than four days to market. Expected net is what reaches
          the owner after an 85/15 operator split and ~$450 of handling and catering, weighted by sell probability. Because the aircraft is
          flying the leg anyway, fuel and crew are not incremental costs.
        </p>
        {!dataset.profile.charterEnabled && (
          <p className="mt-2 text-amber">
            {dataset.profile.tail} operates under Part 91. Selling seats or legs for compensation requires listing through a Part 135 certificate
            holder.
          </p>
        )}
      </Card>
    </div>
  );
}
