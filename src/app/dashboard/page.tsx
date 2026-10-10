"use client";

import { MessageSquare, Sparkles } from "lucide-react";
import { CostBreakdown, MonthlyHoursChart } from "@/components/charts";
import { SUGGESTED_QUESTIONS, useChat } from "@/components/chat";
import { useFleet } from "@/components/fleet-provider";
import { KpiRow } from "@/components/kpis";
import { RecommendationsPanel } from "@/components/recommendations";
import { AircraftHeader, EmptyLegTable, MaintenanceList } from "@/components/sections";
import { Card } from "@/components/ui";
import { WhatIfPanel } from "@/components/what-if";

export default function OverviewPage() {
  const { dataset, analytics, selectedId } = useFleet();
  const { ask } = useChat();
  return (
    <div className="space-y-4">
      <AircraftHeader ds={dataset} a={analytics} />
      <KpiRow a={analytics} />

      <Card className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
        <div className="flex items-center gap-2 text-sm font-medium text-text">
          <MessageSquare size={16} className="text-accent" aria-hidden /> Ask about {dataset.profile.tail}
        </div>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_QUESTIONS.slice(0, 3).map((q) => (
            <button
              key={q}
              onClick={() => ask(q)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs text-text-2 transition-colors hover:border-accent/50 hover:text-text"
            >
              <Sparkles size={12} className="text-accent" aria-hidden /> {q}
            </button>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <MonthlyHoursChart a={analytics} />
        </div>
        <CostBreakdown a={analytics} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RecommendationsPanel />
        </div>
        <WhatIfPanel key={selectedId} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <EmptyLegTable ds={dataset} a={analytics} limit={4} />
        </div>
        <MaintenanceList a={analytics} limit={3} />
      </div>
    </div>
  );
}
