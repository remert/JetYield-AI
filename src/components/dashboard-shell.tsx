"use client";

import clsx from "clsx";
import { CalendarClock, Database, LayoutDashboard, Plane, Sparkles, Wrench } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChatProvider, useChat } from "./chat";
import { FleetProvider, useFleet } from "./fleet-provider";
import { Logo } from "./logo";
import { Skeleton } from "./ui";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/empty-legs", label: "Empty legs", icon: Plane },
  { href: "/dashboard/maintenance", label: "Maintenance", icon: Wrench },
  { href: "/dashboard/data", label: "Data upload", icon: Database },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <FleetProvider>
      <ChatProvider>
        <Frame>{children}</Frame>
      </ChatProvider>
    </FleetProvider>
  );
}

function useAIMode() {
  const [mode, setMode] = useState<"claude" | "demo" | null>(null);
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setMode(d.ai))
      .catch(() => setMode("demo"));
  }, []);
  return mode;
}

function Frame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { ready } = useFleet();
  const { setOpen } = useChat();
  const mode = useAIMode();

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-4 px-4 lg:px-6">
          <Link href="/" className="shrink-0" aria-label="JetYield SI home">
            <Logo />
          </Link>
          <div className="hidden h-5 w-px bg-border md:block" />
          <span className="hidden items-center gap-1.5 text-xs text-muted md:flex">
            <span className={clsx("h-1.5 w-1.5 rounded-full", mode === "claude" ? "bg-good" : "bg-amber")} aria-hidden />
            {mode === null ? "Connecting…" : mode === "claude" ? "Claude agent live" : "Demo engine (no API key)"}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-[#04121f] transition-colors hover:bg-[#63c8ff]"
            >
              <Sparkles size={15} aria-hidden /> Ask JetYield
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1440px] gap-6 px-4 py-5 lg:px-6">
        <nav className="sticky top-[76px] hidden h-fit w-48 shrink-0 space-y-1 lg:block" aria-label="Dashboard">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                pathname === href ? "bg-surface-2 text-text" : "text-text-2 hover:bg-surface hover:text-text",
              )}
            >
              <Icon size={16} className={pathname === href ? "text-accent" : ""} aria-hidden />
              {label}
            </Link>
          ))}
          <div className="mt-6 rounded-xl border border-border p-3 text-xs leading-relaxed text-muted">
            <CalendarClock size={14} className="mb-1.5 text-accent" aria-hidden />
            Sample fleet data regenerates relative to today. Upload CSVs to analyze your own aircraft; files never leave your browser except for AI requests.
          </div>
        </nav>

        <main className="min-w-0 flex-1 pb-16">
          <nav className="-mx-4 mb-4 flex gap-1 overflow-x-auto px-4 lg:hidden" aria-label="Dashboard sections">
            {NAV.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "shrink-0 rounded-full border px-3 py-1.5 text-xs",
                  pathname === href ? "border-accent/50 bg-accent/10 text-accent" : "border-border text-text-2",
                )}
              >
                {label}
              </Link>
            ))}
          </nav>
          <AircraftSwitcher />
          {ready ? children : <LoadingState />}
        </main>
      </div>
    </div>
  );
}

function AircraftSwitcher() {
  const { aircraft, selectedId, select, scores, ready, dataset } = useFleet();
  return (
    <div className="mb-5">
      <div className="mb-2 flex items-baseline justify-between">
        <h1 className="text-xs font-medium tracking-wider text-muted uppercase">Scenario · select an aircraft</h1>
        {ready && dataset.source === "uploaded" && <span className="text-xs text-amber">Using your uploaded data</span>}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Aircraft">
        {aircraft.map((a) => {
          const active = a.id === selectedId;
          const score = scores[a.id];
          return (
            <button
              key={a.id}
              role="radio"
              aria-checked={active}
              onClick={() => select(a.id)}
              className={clsx(
                "group rounded-xl border p-3 text-left transition-all",
                active ? "border-accent/60 bg-accent/[0.06] ring-1 ring-accent/30" : "border-border bg-surface hover:border-border-strong",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="num text-sm font-semibold text-text">{a.tail}</span>
                    <span className="truncate text-sm text-text-2">{a.name}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted">{a.scenario}</p>
                </div>
                {ready && score !== undefined && (
                  <div className="shrink-0 text-right">
                    <div className="num text-lg leading-none font-semibold text-text">{score}</div>
                    <div className="text-[10px] text-muted uppercase">Yield</div>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}
