import { formatDate } from "@/lib/dates";
import { runScenario } from "@/lib/engine/analytics";
import type { AIInput, ChatEvent, ChatTurn, RecommendResult, YieldAdvisor } from "./types";

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Deterministic advisor used when no ANTHROPIC_API_KEY is configured.
// It answers the common questions from the same engine the Claude agent uses,
// so the public demo never breaks and never spends API credits.
export class DemoAdvisor implements YieldAdvisor {
  readonly mode = "demo" as const;

  async recommend(input: AIInput): Promise<RecommendResult> {
    return { mode: "demo", summary: summarize(input), recommendations: input.baseline };
  }

  async *chat(input: AIInput & { messages: ChatTurn[] }): AsyncGenerator<ChatEvent> {
    const question = input.messages.filter((m) => m.role === "user").at(-1)?.content ?? "";
    const { answer, tool } = answerQuestion(question, input);
    if (tool) {
      yield { type: "tool", name: tool, label: tool === "run_scenario" ? "Running what-if scenario" : "Reading flight log" };
      await sleep(350);
    }
    // Stream in small chunks so the UI behaves like the live model.
    const parts = answer.match(/\S+\s*/g) ?? [answer];
    for (let i = 0; i < parts.length; i += 3) {
      yield { type: "text", text: parts.slice(i, i + 3).join("") };
      await sleep(18);
    }
  }
}

function summarize({ dataset, analytics: a }: AIInput): string {
  const p = dataset.profile;
  if (a.utilizationPct < 80) {
    return `${p.tail} is flying ${Math.round(a.annualizedHours)} of ${a.targetHours} target hours, so fixed costs push all-in cost to ${usd(a.allInCostPerHour)}/hr. ${Math.round(a.emptyLegShare * 100)}% of hours fly empty and unsold.`;
  }
  return `${p.tail} is near its utilization target, but ${a.emptyHours} hours flew empty and unsold last year, the biggest remaining lever at roughly ${usd(a.improvement.lines.find((l) => l.key === "empty_legs")?.annual ?? 0)}/yr.`;
}

export function answerQuestion(q: string, { dataset, analytics: a, baseline }: AIInput): { answer: string; tool?: string } {
  const p = dataset.profile;
  const text = q.toLowerCase();
  const hoursMatch = text.match(/(-?\d{1,4})\s*(more|additional|extra|fewer|less)?\s*(hours|hrs|hr|hour)/);

  if (hoursMatch || /fly more|more hours|utiliz/.test(text)) {
    let add = hoursMatch ? Number(hoursMatch[1]) : 50;
    if (hoursMatch && /fewer|less/.test(hoursMatch[2] ?? "")) add = -Math.abs(add);
    const owner = runScenario(a, p, { additionalHours: add, charterShare: 0 });
    const charter = runScenario(a, p, { additionalHours: add, charterShare: 1 });
    const direction = add >= 0 ? "more" : "fewer";
    return {
      tool: "run_scenario",
      answer: [
        `Flying **${Math.abs(add)} ${direction} hours** (${Math.round(a.annualizedHours)} → ${owner.hours}) changes all-in cost per hour from ${usd(a.allInCostPerHour)} to **${usd(owner.allInCostPerHour)}**, because the same ${usd(a.fixedAnnual)} of fixed cost is spread over more hours.`,
        ``,
        `But a lower hourly rate isn't savings:`,
        `- **As owner flying:** total annual spend ${add >= 0 ? "rises" : "falls"} by **${usd(Math.abs(owner.addedCost))}** (variable cost of ${usd(a.variablePerHour)}/hr).`,
        add > 0
          ? `- **As charter:** those hours earn ${usd(charter.addedRevenue)} after commission, so your net cost ${charter.netCostDelta < 0 ? "drops" : "still rises"} by **${usd(Math.abs(charter.netCostDelta))}**.${p.charterEnabled ? "" : " This needs a Part 135 certificate holder."}`
          : `- Fewer hours mean each remaining owner hour carries more fixed cost.`,
        ``,
        `Bottom line: extra hours only save money when someone else pays for them.`,
      ].join("\n"),
    };
  }

  if (/empty|reposition|list|ferry|dead ?head/.test(text)) {
    if (a.emptyLegs.length === 0) {
      return { answer: `There are no one-way trips on the upcoming schedule, so no empty legs to list right now. Last year ${a.emptyHours} hours flew empty and unsold.` };
    }
    const lines = a.emptyLegs.slice(0, 4).map(
      (l) =>
        `- **${l.from} → ${l.to}** on ${formatDate(l.date)} · ${l.blockHours} hr · list at ${usd(l.listPrice)} · ${Math.round(l.sellProbability * 100)}% likely to sell · ~${usd(l.expectedNet)} expected net. ${l.rationale}`,
    );
    const total = a.emptyLegs.reduce((s, l) => s + l.expectedNet, 0);
    return {
      answer: [
        `List these, ranked by expected net to you:`,
        ...lines,
        ``,
        `Together the schedule's empty legs are worth about **${usd(total)}** in expected net revenue.${p.charterEnabled ? " Push them to your charter desk today: sell-through falls sharply inside 4 days." : " Under Part 91 you can't sell these yourself; they'd need to be listed by a Part 135 operator."}`,
      ].join("\n"),
    };
  }

  if (/maint|inspection|due|downtime|hot section|phase/.test(text)) {
    const items = a.maintenanceAlerts.slice(0, 4).map(
      (m) => `- **${m.item}** (${m.severity}): ${m.dueLabel}${m.estimatedCost ? `, budget ${usd(m.estimatedCost)}` : ""}${m.downtimeDays ? `, ${m.downtimeDays} days down` : ""}.`,
    );
    const budget = a.maintenanceAlerts.filter((m) => m.daysUntilDue <= 90).reduce((s, m) => s + m.estimatedCost, 0);
    return {
      answer: [`Coming due:`, ...items, ``, `Budget **${usd(budget)}** for items due in the next 90 days. Bundle anything due within that window into one visit to avoid paying for downtime twice.`].join("\n"),
    };
  }

  if (/score|yield|grade/.test(text)) {
    const parts = a.yieldScore.components.map((c) => `- **${c.label}** ${Math.round(c.score * 100)}/100 (weight ${Math.round(c.weight * 100)}%): ${c.detail}`);
    return { answer: [`Your Yield Score is **${a.yieldScore.score} (${a.yieldScore.grade})**:`, ...parts].join("\n") };
  }

  if (/save|reduc|cut|cheaper|lower (my )?cost|improve/.test(text)) {
    const lines = a.improvement.lines.map((l) => `- **${l.label}:** ${usd(l.annual)}/yr. ${l.detail}`);
    return {
      answer: lines.length
        ? [`The biggest levers, worth about **${usd(a.improvement.total)}/yr** combined:`, ...lines].join("\n")
        : `Costs are in line with class benchmarks. The remaining lever is utilization: see the what-if panel.`,
    };
  }

  if (/cost|per hour|cph|hourly|spend|expens/.test(text)) {
    const top = a.costBreakdown.slice(0, 3).map((c) => `${c.label} ${usd(c.annual)}`).join(", ");
    return {
      answer: [
        `Your **true all-in cost is ${usd(a.allInCostPerHour)}/hr** over ${Math.round(a.annualizedHours)} annualized hours (${usd(a.totalAnnual)}/yr).`,
        ``,
        `- **Cash cost:** ${usd(a.cashCostPerHour)}/hr, excluding ${usd(a.capitalAnnual)}/yr of depreciation and cost of capital.`,
        `- **Fixed:** ${usd(a.fixedAnnual)}/yr, which is ${usd(a.fixedAnnual / Math.max(a.annualizedHours, 1))} of every hour. **Variable:** ${usd(a.variablePerHour)}/hr.`,
        a.revenueAnnual > 0 ? `- **Net of ${usd(a.revenueAnnual)} revenue:** ${usd(a.netCostPerHour)}/hr.` : `- No revenue offsets these costs today.`,
        ``,
        `Largest lines: ${top}. Most operators quote only the variable rate, which understates your real cost by ${Math.round((1 - a.variablePerHour / a.allInCostPerHour) * 100)}%.`,
      ].join("\n"),
    };
  }

  const top = baseline[0];
  return {
    answer: [
      summarize({ dataset, analytics: a, baseline }),
      ``,
      top ? `Top priority: **${top.title}** (${top.impactLabel}).` : "",
      ``,
      `Try asking: "What is my true cost per hour?", "How much would I save if I flew 50 more hours?", or "Which empty legs should I list this month?"`,
      ``,
      `_Demo mode: answers come from the JetYield engine. Add an ANTHROPIC_API_KEY to enable the Claude agent._`,
    ].join("\n"),
  };
}
