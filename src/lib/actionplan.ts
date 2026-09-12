import type { Factory, Intervention, ProcessNode } from "../types";

// Action-plan phasing — mirrors backend/app/intelligence/actionplan.py in the plan.
//   30-day  : operational fixes — payback ≤ 6 mo OR CAPEX < ₹5 L
//   90-day  : payback ≤ 18 mo
//   365-day : everything else (capital projects)
// Priority within a phase = tCO₂e avoided per ₹ lakh CAPEX (tie-break: payback).

export type Phase = "30" | "90" | "365";

export interface PlanItem {
  phase: Phase;
  priority: number; // 1 = first within the whole plan
  intervention: Intervention;
  process: ProcessNode;
  owner: string;
  prerequisite: string | null;
  co2PerLakh: number;
}

export interface PhaseSummary {
  phase: Phase;
  label: string;
  window: string;
  items: PlanItem[];
  capexInr: number;
  annualSavingInr: number;
  co2ReductionTpy: number;
}

export interface ActionPlan {
  phases: PhaseSummary[];
  totals: { capexInr: number; annualSavingInr: number; co2ReductionTpy: number; paybackMonths: number | null };
  cumulative: { phase: Phase; co2ReductionTpy: number; annualSavingInr: number; capexInr: number }[];
  usingAllRecommended: boolean;
}

const OWNER: Record<Intervention["category"], string> = {
  "process-change": "Production head",
  "heat-recovery": "Plant engineer + EPC vendor",
  "recycling-loop": "Quality + production",
  "waste-to-input": "EHS officer + commercial",
  "material-substitution": "Purchase + quality",
};

const PREREQ: Record<Intervention["category"], string | null> = {
  "process-change": null,
  "heat-recovery": "Baseline energy audit of the source and sink streams",
  "recycling-loop": "Quality trial on the recycled stream (2–3 batches)",
  "waste-to-input": "Offtake MoU with receiving unit + GPCB consent amendment",
  "material-substitution": "Supplier qualification and lab trial",
};

export function phaseFor(iv: Intervention): Phase {
  if (iv.paybackMonths <= 6 || iv.capexInr < 500000) return "30";
  if (iv.paybackMonths <= 18) return "90";
  return "365";
}

const PHASE_META: Record<Phase, { label: string; window: string }> = {
  "30": { label: "30-day", window: "Operational quick wins" },
  "90": { label: "90-day", window: "Low-CAPEX upgrades" },
  "365": { label: "6–12 month", window: "Capital projects" },
};

export function buildActionPlan(factory: Factory, selectedIds: ReadonlySet<string>): ActionPlan {
  const usingAllRecommended = selectedIds.size === 0;

  const candidates: { iv: Intervention; node: ProcessNode }[] = [];
  for (const node of factory.nodes) {
    for (const iv of node.interventions) {
      if (usingAllRecommended || selectedIds.has(iv.id)) candidates.push({ iv, node });
    }
  }

  const scored = candidates
    .map(({ iv, node }) => ({
      iv,
      node,
      phase: phaseFor(iv),
      co2PerLakh: iv.co2ReductionTpy / Math.max(iv.capexInr / 100000, 0.1),
    }))
    .sort((a, b) => b.co2PerLakh - a.co2PerLakh || a.iv.paybackMonths - b.iv.paybackMonths);

  // global priority follows phase order first, then score within phase
  const order: Phase[] = ["30", "90", "365"];
  let priority = 1;
  const phases: PhaseSummary[] = order.map((phase) => {
    const items: PlanItem[] = scored
      .filter((s) => s.phase === phase)
      .map((s) => ({
        phase,
        priority: priority++,
        intervention: s.iv,
        process: s.node,
        owner: OWNER[s.iv.category],
        prerequisite: PREREQ[s.iv.category],
        co2PerLakh: s.co2PerLakh,
      }));
    return {
      phase,
      ...PHASE_META[phase],
      items,
      capexInr: items.reduce((a, i) => a + i.intervention.capexInr, 0),
      annualSavingInr: items.reduce((a, i) => a + i.intervention.annualSavingInr, 0),
      co2ReductionTpy: items.reduce((a, i) => a + i.intervention.co2ReductionTpy, 0),
    };
  });

  const capexInr = phases.reduce((a, p) => a + p.capexInr, 0);
  const annualSavingInr = phases.reduce((a, p) => a + p.annualSavingInr, 0);
  const co2ReductionTpy = phases.reduce((a, p) => a + p.co2ReductionTpy, 0);

  let c = 0, s = 0, x = 0;
  const cumulative = phases.map((p) => {
    c += p.co2ReductionTpy; s += p.annualSavingInr; x += p.capexInr;
    return { phase: p.phase, co2ReductionTpy: c, annualSavingInr: s, capexInr: x };
  });

  return {
    phases,
    totals: { capexInr, annualSavingInr, co2ReductionTpy, paybackMonths: annualSavingInr > 0 ? Math.round((capexInr / annualSavingInr) * 12) : null },
    cumulative,
    usingAllRecommended,
  };
}

export function planToMarkdown(factory: Factory, plan: ActionPlan): string {
  const inr = (n: number) => `₹${(n / 100000).toFixed(1)} L`;
  const lines: string[] = [];
  lines.push(`# Circular Action Plan — ${factory.name}`);
  lines.push(`${factory.cluster} · ${factory.sector} · data: ${factory.dataSource}`);
  lines.push("");
  lines.push(`**Totals:** CAPEX ${inr(plan.totals.capexInr)} · saving ${inr(plan.totals.annualSavingInr)}/yr · ${plan.totals.co2ReductionTpy.toLocaleString("en-IN")} tCO₂e/yr · payback ${plan.totals.paybackMonths ?? "—"} mo`);
  lines.push("");
  for (const p of plan.phases) {
    lines.push(`## ${p.label} — ${p.window}`);
    lines.push(`CAPEX ${inr(p.capexInr)} · saving ${inr(p.annualSavingInr)}/yr · ${p.co2ReductionTpy} tCO₂e/yr`);
    lines.push("");
    lines.push("| # | Action | Process | Owner | CAPEX | Saving/yr | CO₂ cut | Payback | Confidence | Prerequisite |");
    lines.push("|---|---|---|---|---|---|---|---|---|---|");
    for (const it of p.items) {
      const iv = it.intervention;
      lines.push(`| ${it.priority} | ${iv.title} | ${it.process.label} | ${it.owner} | ${inr(iv.capexInr)} | ${inr(iv.annualSavingInr)} | ${iv.co2ReductionTpy} t | ${iv.paybackMonths} mo | ${iv.confidence} | ${it.prerequisite ?? "—"} |`);
    }
    lines.push("");
  }
  lines.push("_All figures are modelled estimates calibrated to public sector statistics and Indian emission factors; confidence per action as labelled._");
  return lines.join("\n");
}
