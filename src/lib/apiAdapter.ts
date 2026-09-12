// Maps the real backend's API shape (src/lib/api.ts) onto this frontend's
// existing Factory/ProcessNode types (src/types/index.ts), so every existing
// page/component (dashboard, simulator, action plan, portfolio, regulator
// rollup) keeps working completely unchanged — only the data source changes,
// from bundled mock JSON to a live computation over data-pipeline output.
//
// 3D position/scale per process is a pure rendering concern with no sourcing
// implications, so it's the one thing kept as static frontend layout data
// (reused from the original sectorTemplates) rather than sent by the API.
import type { Factory, ProcessNode, Intervention, Confidence } from "../types";
import type { ApiCluster, ApiFactory, ApiEquipment, ApiRecommendation } from "./api";
import { sectorTemplates } from "../data/factories";

const FALLBACK_LAYOUT: { position: [number, number, number]; scale: [number, number, number] } = {
  position: [0, 0, 0],
  scale: [3, 1.6, 2.4],
};

function layoutFor(sector: string, processId: string) {
  const tpl = sectorTemplates[sector]?.find((t) => t.id === processId);
  if (tpl) return { position: tpl.position, scale: tpl.scale };
  return FALLBACK_LAYOUT;
}

function toConfidence(backendConfidence: string): Confidence {
  // backend uses a richer confidence vocabulary (data-sourcing tiers: "real",
  // "medium", "documented estimate", ...) than the frontend's 3-level display
  // scale — map conservatively rather than assume "high" by default.
  const v = backendConfidence.toLowerCase();
  if (v.includes("real") || v.includes("high")) return "high";
  if (v.includes("low")) return "low";
  return "medium";
}

function adaptRecommendation(r: ApiRecommendation): Intervention {
  return {
    id: r.id,
    title: r.title,
    category: r.category as Intervention["category"],
    capexInr: r.capex_inr,
    annualSavingInr: r.annual_saving_inr,
    co2ReductionTpy: r.co2_reduction_tpy,
    paybackMonths: r.payback_months,
    confidence: r.confidence,
    description: r.description,
    circularityGainPct: r.circularity_gain_pct ?? undefined,
  };
}

function adaptEquipment(sector: string, e: ApiEquipment): ProcessNode {
  const { position, scale } = layoutFor(sector, e.process_id);
  return {
    id: e.id,
    label: e.label,
    kind: e.kind as ProcessNode["kind"],
    position,
    scale,
    co2eTpy: e.co2e_tpy ?? 0,
    shareOfTotal: e.share_of_total ?? 0,
    benchmarkIntensity: e.benchmark_kgco2e_per_t,
    actualIntensity: e.actual_intensity ?? 0,
    severity: e.severity ?? "ok",
    confidence: toConfidence(e.benchmark_confidence),
    rootCause: e.root_cause_text ?? "No rule fired — process runs close to its own historical baseline.",
    interventions: e.recommendations.map(adaptRecommendation),
  };
}

const DATA_SOURCE_MAP: Record<string, Factory["dataSource"]> = {
  synthetic: "synthetic",
  self_reported: "self-reported",
};

export function adaptFactory(f: ApiFactory, clusterNameById: Record<string, string>): Factory {
  const clusterName = clusterNameById[f.cluster_id] ?? f.cluster_id;
  return {
    id: f.id,
    name: f.name,
    sector: f.sector,
    cluster: `${clusterName}, Gujarat`,
    outputTonnesPerMonth: (f.output_tonnes_per_year ?? 0) / 12,
    totalCo2eTpy: f.total_co2e_tpy,
    totalEnergyMwhPerYear: f.total_energy_mwh_per_year,
    totalWasteTpy: f.total_waste_tpy,
    // Backend has no recovered-material/symbiosis-uptake ledger yet (Phase 3,
    // not built) — 0 is the honest value, not a placeholder guess. See
    // backend/app/routers/factories.py _to_full_out().
    circularityRatio: f.circularity_ratio,
    dataSource: DATA_SOURCE_MAP[f.data_source] ?? "synthetic",
    nodes: f.equipment.map((e) => adaptEquipment(f.sector, e)),
    lat: f.lat,
    lon: f.lon,
    // Waste-stream tagging for symbiosis matching is Phase 3 (MiniLM+FAISS
    // matcher) — not modelled in the backend yet, so these are honestly empty
    // rather than carried over from the old static mock data.
    wasteStreams: [],
    acceptedInputs: [],
    implementedInterventionIds: [],
    consentToShare: f.consent_to_share,
  };
}

export function adaptClusterNameMap(clusters: ApiCluster[]): Record<string, string> {
  return Object.fromEntries(clusters.map((c) => [c.id, c.name]));
}
