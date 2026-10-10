"use client";

import { useFleet } from "@/components/fleet-provider";
import { AircraftHeader, MaintenanceList } from "@/components/sections";
import { Card } from "@/components/ui";
import { usdCompact } from "@/lib/format";

export default function MaintenancePage() {
  const { dataset, analytics: a } = useFleet();
  const within = (d: number) => a.maintenanceAlerts.filter((m) => m.daysUntilDue <= d);
  const stats = [
    { label: "Critical items", value: String(a.maintenanceAlerts.filter((m) => m.severity === "critical").length), sub: "≤30 days or ≤25 hrs" },
    { label: "Due in 90 days", value: usdCompact(within(90).reduce((s, m) => s + m.estimatedCost, 0)), sub: `${within(90).length} items` },
    { label: "Downtime in 90 days", value: `${within(90).reduce((s, m) => s + m.downtimeDays, 0)} days`, sub: "before bundling" },
    { label: "Current pace", value: `${(a.annualizedHours / 12).toFixed(1)} hrs/mo`, sub: "used to project hour-based items" },
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
      <MaintenanceList a={a} />
    </div>
  );
}
