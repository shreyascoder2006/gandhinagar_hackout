import type { Factory, Intervention, ProcessNode, Severity, Confidence } from "../types";

// What-if simulator — mirrors backend/app/intelligence/simulator.py in the plan.
// Deterministic: interventions on the same process are applied sequentially on
// the residual, so two 20% measures give 36%, not 40%.

export interface SimulationTotals {
  capexInr: number;
  annualSavingInr: number;
  co2ReductionTpy: number;
  blendedPaybackMonths: number | null;
  confidence: Confidence;
}

export interface SimulationResult {
  factory: Factory;
  totals: SimulationTotals;
  applied: Intervention[];
}

const CONF_RANK: Record<Confidence, number> = { high: 3, medium: 2, low: 1 };

export function severityFromDeviation(actual: number, benchmark: number): Severity {
  const dev = (actual - benchmark) / benchmark;
  if (dev < 0.1) return "ok";
  if (dev < 0.3) return "warn";
  return "crit";
}

function applyToNode(node: ProcessNode, chosen: Intervention[]): ProcessNode {
  let residual = 1; // fraction of baseline CO2e still emitted
  for (const iv of chosen) {
    const frac = Math.min(0.95, iv.co2ReductionTpy / node.co2eTpy);
    residual *= 1 - frac;
  }
  const co2eTpy = Math.round(node.co2eTpy * residual);
  const actualIntensity = Math.round(node.actualIntensity * residual);
  return {
    ...node,
    co2eTpy,
    actualIntensity,
    severity: severityFromDeviation(actualIntensity, node.benchmarkIntensity),
  };
}

export function simulate(baseline: Factory, selectedIds: ReadonlySet<string>): SimulationResult {
  if (selectedIds.size === 0) {
    return {
      factory: baseline,
      totals: { capexInr: 0, annualSavingInr: 0, co2ReductionTpy: 0, blendedPaybackMonths: null, confidence: "high" },
      applied: [],
    };
  }

  const applied: Intervention[] = [];
  let capex = 0;
  let saving = 0;
  let circularity = baseline.circularityRatio;
  let worst: Confidence = "high";

  const nodes = baseline.nodes.map((node) => {
    const chosen = node.interventions.filter((iv) => selectedIds.has(iv.id));
    if (chosen.length === 0) return node;
    // financial effect of later measures shrinks with the residual the same way
    let residual = 1;
    for (const iv of chosen) {
      applied.push(iv);
      capex += iv.capexInr;
      saving += Math.round(iv.annualSavingInr * residual);
      residual *= 1 - Math.min(0.95, iv.co2ReductionTpy / node.co2eTpy);
      circularity = Math.min(0.95, circularity + (iv.circularityGainPct ?? 0));
      if (CONF_RANK[iv.confidence] < CONF_RANK[worst]) worst = iv.confidence;
    }
    return applyToNode(node, chosen);
  });

  const total = nodes.reduce((s, n) => s + n.co2eTpy, 0);
  const withShares = nodes.map((n) => ({ ...n, shareOfTotal: total > 0 ? n.co2eTpy / total : 0 }));
  const co2Reduction = baseline.totalCo2eTpy - total;
  const energyScale = total / baseline.totalCo2eTpy;

  const factory: Factory = {
    ...baseline,
    nodes: withShares,
    totalCo2eTpy: total,
    totalEnergyMwhPerYear: Math.round(baseline.totalEnergyMwhPerYear * (0.6 + 0.4 * energyScale)),
    totalWasteTpy: Math.round(baseline.totalWasteTpy * (1 - (circularity - baseline.circularityRatio))),
    circularityRatio: Number(circularity.toFixed(2)),
  };

  return {
    factory,
    applied,
    totals: {
      capexInr: capex,
      annualSavingInr: saving,
      co2ReductionTpy: co2Reduction,
      blendedPaybackMonths: saving > 0 ? Math.round((capex / saving) * 12) : null,
      confidence: worst,
    },
  };
}
