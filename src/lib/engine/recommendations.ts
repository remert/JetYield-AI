import { FUEL_MARKET_PRICE } from "@/lib/data/fleet";
import { formatDate } from "@/lib/dates";
import type { AircraftDataset, Analytics, Recommendation } from "@/lib/types";
import { runScenario } from "./analytics";

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

// Rules-based recommendations. These are always computed; the AI layer
// re-ranks and rewrites them, but every dollar figure originates here.
export function buildRecommendations(ds: AircraftDataset, a: Analytics): Recommendation[] {
  const p = ds.profile;
  const recs: Recommendation[] = [];

  // --- Empty legs ---
  const legs = a.emptyLegs.slice(0, 3);
  if (legs.length > 0) {
    const total = legs.reduce((s, l) => s + l.expectedNet, 0);
    recs.push({
      id: "empty-legs-upcoming",
      category: "empty_leg",
      priority: 1,
      title: `List ${legs.length} upcoming empty leg${legs.length > 1 ? "s" : ""}`,
      detail: legs
        .map(
          (l) =>
            `${l.from}→${l.to} on ${formatDate(l.date)} (${l.blockHours} hr): list at ${usd(l.listPrice)}, ${Math.round(l.sellProbability * 100)}% sell probability.`,
        )
        .join(" ") + (p.charterEnabled ? "" : " Requires listing through a Part 135 operator."),
      impactAnnual: total,
      impactLabel: `${usd(total)} expected, next 45 days`,
      actions: [
        p.charterEnabled ? "Push legs to your operator's empty-leg feed today" : "Ask your management company to list these under their certificate",
        "Set a price floor at 40% of retail and allow 1-hour departure flexibility",
      ],
    });
  }

  if (!p.charterEnabled && a.emptyHours > 15) {
    const line = a.improvement.lines.find((l) => l.key === "empty_legs");
    recs.push({
      id: "part-135",
      category: "empty_leg",
      priority: 2,
      title: "Place the aircraft on a Part 135 certificate",
      detail: `${a.emptyHours} hours flew empty last year. Under Part 91 you cannot sell those seats. A management company's 135 certificate unlocks empty-leg and charter revenue while you keep owner priority.`,
      impactAnnual: line?.annual ?? 0,
      impactLabel: line ? `${usd(line.annual)}/yr from empty legs alone` : "Unlocks charter revenue",
      actions: ["Request 135 management proposals from 2–3 operators", "Negotiate owner-priority days and an 85/15 revenue split"],
    });
  }

  // --- Utilization ---
  const gap = a.targetHours - a.annualizedHours;
  if (gap > 10) {
    const add = Math.round(Math.min(gap, 50) / 5) * 5 || 5;
    const asOwner = runScenario(a, p, { additionalHours: add, charterShare: 0 });
    const asCharter = runScenario(a, p, { additionalHours: add, charterShare: 1 });
    recs.push({
      id: "utilization",
      category: "utilization",
      priority: gap / a.targetHours > 0.25 ? 1 : 2,
      title: `Add ${add} hours, but make them revenue hours`,
      detail: `At ${Math.round(a.annualizedHours)} hrs you're at ${a.utilizationPct}% of target. ${add} more hours drops all-in cost/hr from ${usd(a.allInCostPerHour)} to ${usd(asOwner.allInCostPerHour)}, but if they're owner hours your total spend rises ${usd(asOwner.addedCost)}. Flown as charter they net ${usd(-asCharter.netCostDelta)} back to you.`,
      impactAnnual: Math.max(0, -asCharter.netCostDelta),
      impactLabel: `${usd(Math.max(0, -asCharter.netCostDelta))}/yr if flown as charter`,
      actions: [
        "Shift reimbursable business travel onto the aircraft",
        p.charterEnabled ? "Open more calendar days to your charter desk" : "Pair with a 135 operator to fill idle weeks",
      ],
    });
  }

  // --- Cost reduction ---
  if (a.avgFuelPrice > FUEL_MARKET_PRICE + 0.15) {
    const line = a.improvement.lines.find((l) => l.key === "fuel");
    recs.push({
      id: "fuel",
      category: "cost",
      priority: 2,
      title: "Switch to a contract fuel program",
      detail: `You're averaging $${a.avgFuelPrice.toFixed(2)}/gal against ~$${FUEL_MARKET_PRICE.toFixed(2)} available through contract fuel cards at most FBOs on your routes.`,
      impactAnnual: line?.annual ?? 0,
      impactLabel: `${usd(line?.annual ?? 0)}/yr`,
      actions: ["Enroll in a contract fuel card", "Tanker fuel out of your home base where the price spread exceeds $0.75/gal"],
    });
  }
  const crewLine = a.improvement.lines.find((l) => l.key === "crew");
  if (crewLine) {
    recs.push({
      id: "crew",
      category: "cost",
      priority: 3,
      title: "Right-size the crew model for your hours",
      detail: `Crew is your largest cash cost at ${usd(a.costBreakdown.find((c) => c.category === "crew")?.annual ?? 0)}/yr for ${Math.round(a.annualizedHours)} hrs. A full-time captain plus contract SIC is common under 200 hrs/yr.`,
      impactAnnual: crewLine.annual,
      impactLabel: `${usd(crewLine.annual)}/yr`,
      actions: ["Benchmark crew comp against your class", "Keep one full-time captain for continuity and insurance"],
    });
  }
  const hasEngineProgram = a.costBreakdown.some((c) => c.category === "engine_reserve" && c.annual > 0);
  if (!hasEngineProgram && a.annualizedHours > 0) {
    recs.push({
      id: "engine-program",
      category: "cost",
      priority: 2,
      title: "Price an hourly engine program before the next event",
      detail: `No engine program payments found. Your cost/hr looks lower than it is: unscheduled engine events and hot sections land as six-figure invoices, and unenrolled engines also cut resale value.`,
      impactAnnual: 0,
      impactLabel: "Risk reduction + resale value",
      actions: ["Get a buy-in quote for MSP/JSSI coverage", "Compare buy-in cost to the next hot section estimate"],
    });
  }
  const hangar = a.costBreakdown.find((c) => c.category === "hangar");
  if (hangar && hangar.annual > 150_000) {
    recs.push({
      id: "hangar",
      category: "cost",
      priority: 3,
      title: "Review hangar strategy",
      detail: `Hangar runs ${usd(hangar.annual)}/yr (${usd(hangar.perHour)}/hr). Nearby fields can cost 30–40% less if the trade-off in drive time works for your passengers.`,
      impactAnnual: Math.round(hangar.annual * 0.3),
      impactLabel: `Up to ${usd(hangar.annual * 0.3)}/yr`,
      actions: ["Quote a secondary-field hangar", "Negotiate a multi-year rate at renewal"],
    });
  }

  // --- Maintenance ---
  for (const m of a.maintenanceAlerts.filter((m) => m.severity !== "info").slice(0, 2)) {
    recs.push({
      id: `mx-${m.id}`,
      category: "maintenance",
      priority: m.severity === "critical" ? 1 : 2,
      title: m.item,
      detail: `${m.dueLabel}. ${m.advice}`,
      impactAnnual: 0,
      impactLabel: m.estimatedCost > 0 ? `Budget ${usd(m.estimatedCost)}` : "Downtime planning",
      actions: [
        m.downtimeDays > 0 ? `Block ${m.downtimeDays} days on the calendar now` : "Complete before the due date",
        "Bundle any items due in the next 90 days into the same visit",
      ],
    });
  }

  return recs.sort((x, y) => x.priority - y.priority || y.impactAnnual - x.impactAnnual);
}
