"use client";

import clsx from "clsx";
import { SlidersHorizontal } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { runScenario } from "@/lib/engine/analytics";
import { usd, usdCompact } from "@/lib/format";
import { CostCurveChart } from "./charts";
import { useFleet } from "./fleet-provider";
import { Card, CardHeader } from "./ui";

function Slider({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const id = useId();
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <label htmlFor={id} className="text-text-2">
          {label}
        </label>
        <span className="num text-text">{display}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" />
    </div>
  );
}

function Delta({ value, invert = false }: { value: number; invert?: boolean }) {
  // For costs, negative is good. invert=true for revenue-like values.
  const good = invert ? value > 0 : value < 0;
  if (Math.round(value) === 0) return <span className="num text-muted">$0</span>;
  return (
    <span className={clsx("num", good ? "text-[#4ad44a]" : "text-serious")}>
      {value > 0 ? "+" : "−"}
      {usdCompact(Math.abs(value))}
    </span>
  );
}

export function WhatIfPanel() {
  const { analytics: a, dataset } = useFleet();
  const p = dataset.profile;
  const [add, setAdd] = useState(50);
  const [charter, setCharter] = useState(p.charterEnabled ? 0.5 : 0);
  const [fuel, setFuel] = useState(a.avgFuelPrice);

  const r = useMemo(() => runScenario(a, p, { additionalHours: add, charterShare: charter, fuelPrice: fuel }), [a, p, add, charter, fuel]);

  return (
    <Card>
      <CardHeader icon={<SlidersHorizontal size={15} />} title="What-if simulator" subtitle="Lower cost per hour isn't the same as saving money" />
      <div className="space-y-4 px-5 pb-5">
        <div className="space-y-3">
          <Slider label="Additional hours / year" value={add} display={`${add > 0 ? "+" : ""}${add} hrs`} min={-100} max={250} step={5} onChange={setAdd} />
          <Slider
            label="Flown as charter"
            value={charter}
            display={`${Math.round(charter * 100)}%`}
            min={0}
            max={1}
            step={0.05}
            onChange={setCharter}
          />
          <Slider label="Fuel price" value={fuel} display={`$${fuel.toFixed(2)}/gal`} min={4} max={9} step={0.05} onChange={setFuel} />
          {!p.charterEnabled && charter > 0 && (
            <p className="text-[11px] text-amber">Charter revenue requires placing {p.tail} on a Part 135 certificate.</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border border-border bg-surface-2/60 p-2.5">
            <div className="text-muted">All-in cost / hr</div>
            <div className="num mt-0.5 text-lg font-semibold text-text">{usd(r.allInCostPerHour)}</div>
            <div className="text-muted">
              from <span className="num">{usd(a.allInCostPerHour)}</span>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-surface-2/60 p-2.5">
            <div className="text-muted">Net annual cost</div>
            <div className="num mt-0.5 text-lg font-semibold text-text">{usdCompact(r.netCostAnnual)}</div>
            <div className="text-muted">
              change <Delta value={r.netCostDelta} />
            </div>
          </div>
          <div className="rounded-lg border border-border bg-surface-2/60 p-2.5">
            <div className="text-muted">Added operating cost</div>
            <div className="num mt-0.5 text-sm font-semibold">
              <Delta value={r.addedCost} />
            </div>
          </div>
          <div className="rounded-lg border border-border bg-surface-2/60 p-2.5">
            <div className="text-muted">Added charter revenue</div>
            <div className="num mt-0.5 text-sm font-semibold">
              <Delta value={r.addedRevenue} invert />
            </div>
          </div>
        </div>

        <CostCurveChart a={a} scenarioHours={r.hours} />
      </div>
    </Card>
  );
}
