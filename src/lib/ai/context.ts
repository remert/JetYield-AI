import type { AircraftDataset, Analytics, Recommendation } from "@/lib/types";

// Compact, structured snapshot of an aircraft for the model. Every number the
// model may quote is in here, computed by the deterministic engine.
export function buildAircraftContext(ds: AircraftDataset, a: Analytics, recs: Recommendation[]) {
  const p = ds.profile;
  return {
    aircraft: {
      name: p.name,
      tail: p.tail,
      year: p.year,
      class: p.aircraftClass,
      homeBase: p.homeBase,
      operation: p.operation,
      canSellCharterOrEmptyLegs: p.charterEnabled,
      retailCharterRatePerHour: p.charterRatePerHour,
      airframeHours: ds.airframeHours,
      dataSource: ds.source,
    },
    period: { asOf: a.asOf, days: a.periodDays, note: "Trailing 12 months, annualized if shorter." },
    utilization: {
      hoursFlown: a.hoursFlown,
      annualizedHours: a.annualizedHours,
      targetHours: a.targetHours,
      utilizationPct: a.utilizationPct,
      hoursByPurpose: a.hoursByPurpose,
      legs: a.legs,
      emptyUnsoldHours: a.emptyHours,
      emptyUnsoldShareOfHours: a.emptyLegShare,
      monthlyHours: a.monthly.map((m) => ({ month: m.month, total: m.total, owner: m.owner, charter: m.charter, positioning: m.positioning })),
    },
    costs: {
      totalAnnual: a.totalAnnual,
      fixedAnnual: a.fixedAnnual,
      fixedCashAnnual: a.fixedCashAnnual,
      capitalAnnual_depreciationAndCostOfCapital: a.capitalAnnual,
      variableAnnual: a.variableAnnual,
      variablePerHour: a.variablePerHour,
      allInCostPerHour: a.allInCostPerHour,
      cashCostPerHour_excludesCapital: a.cashCostPerHour,
      revenueAnnual: a.revenueAnnual,
      netCostAnnual: a.netCostAnnual,
      netCostPerHour: a.netCostPerHour,
      avgFuelPricePerGallon: a.avgFuelPrice,
      classBenchmarkCashCostPerHour: a.benchmarkCostPerHour,
      breakdown: a.costBreakdown.map((c) => ({ category: c.label, kind: c.kind, annual: c.annual, perHour: c.perHour })),
    },
    upcomingEmptyLegs: a.emptyLegs.map((l) => ({
      date: l.date,
      route: `${l.from} (${l.fromCity}) → ${l.to} (${l.toCity})`,
      blockHours: l.blockHours,
      listPrice: l.listPrice,
      sellProbability: l.sellProbability,
      expectedNetToOwner: l.expectedNet,
      demand: l.demand,
    })),
    maintenance: a.maintenanceAlerts.map((m) => ({
      item: m.item,
      severity: m.severity,
      due: m.dueLabel,
      daysUntilDue: m.daysUntilDue,
      estimatedCost: m.estimatedCost,
      downtimeDays: m.downtimeDays,
    })),
    yieldScore: {
      score: a.yieldScore.score,
      grade: a.yieldScore.grade,
      components: a.yieldScore.components.map((c) => ({ label: c.label, score: Math.round(c.score * 100), weight: c.weight, detail: c.detail })),
    },
    improvementPotential: a.improvement,
    engineRecommendations: recs.map((r) => ({
      id: r.id,
      category: r.category,
      priority: r.priority,
      title: r.title,
      detail: r.detail,
      impactAnnual: r.impactAnnual,
      impactLabel: r.impactLabel,
    })),
  };
}
