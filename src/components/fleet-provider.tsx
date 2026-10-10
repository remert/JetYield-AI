"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { SAMPLE_AIRCRAFT, generateSampleDataset, modeledCostsForFlights } from "@/lib/data/generate";
import { todayISO } from "@/lib/dates";
import { computeAnalytics } from "@/lib/engine/analytics";
import { buildRecommendations } from "@/lib/engine/recommendations";
import type {
  AircraftDataset,
  AircraftProfile,
  Analytics,
  CostEntry,
  FlightLeg,
  MaintenanceItem,
  Recommendation,
  ScheduledTrip,
} from "@/lib/types";

// Uploaded data lives in the browser only (localStorage). Nothing is stored server-side.
interface Uploads {
  flights?: FlightLeg[];
  costs?: CostEntry[];
  maintenance?: MaintenanceItem[];
  airframeHours?: number;
}

interface FleetState {
  ready: boolean;
  aircraft: AircraftProfile[];
  selectedId: string;
  select: (id: string) => void;
  dataset: AircraftDataset;
  analytics: Analytics;
  baseline: Recommendation[];
  scores: Record<string, number>;
  uploads: Uploads;
  applyUpload: (patch: Uploads) => void;
  resetUploads: () => void;
}

const STORAGE_KEY = "jetyield:v1";
const FleetContext = createContext<FleetState | null>(null);

function load(): { selectedId?: string; uploads?: Record<string, Uploads> } {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function save(state: { selectedId: string; uploads: Record<string, Uploads> }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked: the session still works in memory.
  }
}

// Future-dated legs in an uploaded log become the schedule used for empty-leg planning.
function scheduleFromFlights(flights: FlightLeg[], profile: AircraftProfile, today: string): ScheduledTrip[] {
  const future = flights.filter((f) => f.date > today && f.purpose !== "positioning" && f.passengers > 0);
  return future.map((f, i) => {
    const prev = future[i - 1];
    const next = future[i + 1];
    // Outbound: one-way if passengers don't fly onward from the destination.
    // Inbound: one-way if the aircraft wasn't already there from a prior leg.
    const oneWay = f.to !== profile.homeBase ? !(next && next.from === f.to) : !(prev && prev.to === f.from);
    return { id: `u-t${i + 1}`, date: f.date, from: f.from, to: f.to, passengers: f.passengers, oneWay };
  });
}

export function buildDataset(id: string, uploads: Uploads | undefined, today: string): AircraftDataset {
  const sample = generateSampleDataset(id, today);
  if (!uploads || (!uploads.flights && !uploads.costs && !uploads.maintenance)) return sample;
  // A flight log without a cost file: model costs from the uploaded legs rather
  // than pairing the sample ledger (sized for sample hours) with different flying.
  const lastPast = uploads.flights?.map((f) => f.date).filter((d) => d <= today).sort().at(-1);
  const costs = uploads.costs ?? (uploads.flights && lastPast ? modeledCostsForFlights(id, uploads.flights.filter((f) => f.date <= today), lastPast) : sample.costs);
  return {
    ...sample,
    airframeHours: uploads.airframeHours ?? sample.airframeHours,
    flights: uploads.flights ?? sample.flights,
    costs,
    maintenance: uploads.maintenance ?? sample.maintenance,
    schedule: uploads.flights ? scheduleFromFlights(uploads.flights, sample.profile, today) : sample.schedule,
    source: "uploaded",
  };
}

export function FleetProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [selectedId, setSelectedId] = useState(SAMPLE_AIRCRAFT[0].id);
  const [allUploads, setAllUploads] = useState<Record<string, Uploads>>({});
  const [today] = useState(todayISO);

  // Hydrate from storage and the ?aircraft= query param after mount.
  useEffect(() => {
    const stored = load();
    const fromUrl = new URLSearchParams(window.location.search).get("aircraft");
    const valid = (id?: string | null) => !!id && SAMPLE_AIRCRAFT.some((a) => a.id === id);
    /* eslint-disable react-hooks/set-state-in-effect -- one-time hydration from browser-only state */
    if (valid(fromUrl)) setSelectedId(fromUrl!);
    else if (valid(stored.selectedId)) setSelectedId(stored.selectedId!);
    if (stored.uploads) setAllUploads(stored.uploads);
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (ready) save({ selectedId, uploads: allUploads });
  }, [ready, selectedId, allUploads]);

  const select = useCallback((id: string) => {
    setSelectedId(id);
    const url = new URL(window.location.href);
    url.searchParams.set("aircraft", id);
    window.history.replaceState(null, "", url);
  }, []);

  const uploads = useMemo(() => allUploads[selectedId] ?? {}, [allUploads, selectedId]);
  const dataset = useMemo(() => buildDataset(selectedId, uploads, today), [selectedId, uploads, today]);
  const analytics = useMemo(() => computeAnalytics(dataset, today), [dataset, today]);
  const baseline = useMemo(() => buildRecommendations(dataset, analytics), [dataset, analytics]);

  const scores = useMemo(() => {
    const out: Record<string, number> = {};
    for (const a of SAMPLE_AIRCRAFT) {
      out[a.id] =
        a.id === selectedId ? analytics.yieldScore.score : computeAnalytics(buildDataset(a.id, allUploads[a.id], today), today).yieldScore.score;
    }
    return out;
  }, [allUploads, analytics, selectedId, today]);

  const applyUpload = useCallback(
    (patch: Uploads) => setAllUploads((prev) => ({ ...prev, [selectedId]: { ...prev[selectedId], ...patch } })),
    [selectedId],
  );
  const resetUploads = useCallback(
    () =>
      setAllUploads((prev) => {
        const next = { ...prev };
        delete next[selectedId];
        return next;
      }),
    [selectedId],
  );

  const value: FleetState = {
    ready,
    aircraft: SAMPLE_AIRCRAFT,
    selectedId,
    select,
    dataset,
    analytics,
    baseline,
    scores,
    uploads,
    applyUpload,
    resetUploads,
  };
  return <FleetContext.Provider value={value}>{children}</FleetContext.Provider>;
}

export function useFleet(): FleetState {
  const ctx = useContext(FleetContext);
  if (!ctx) throw new Error("useFleet must be used inside <FleetProvider>");
  return ctx;
}
