import type { Factory, ProcessNode, MonthlyPoint } from "../types";
import { factorByKey, emissionFactors } from "../data/emissionFactors";
import { sectorTemplates, severityFromRatio } from "../data/factories";
import { interventionsFor } from "../data/interventionLibrary";
import { clusterById } from "../data/clusters";

// Layer 3 — deterministic calculation engine (mirrors backend/app/engine/*).
// Pure functions. Every number is activity × sourced emission factor.

export interface Activity {
  process: string; // template process id, e.g. "kiln"
  fuel: string; // emission-factor key
  quantity: number;
  unit: string;
  month?: string; // YYYY-MM (optional; enables anomaly detection)
}

export interface IntakeProfile {
  name: string;
  clusterId: string;
  sector: keyof typeof sectorTemplates;
  subSector: string;
  outputTonnesPerMonth: number;
  wasteTpy: number;
  recoveredTpy: number;
  consentToShare: boolean;
}

export interface Issue {
  row: number;
  level: "error" | "warn";
  message: string;
}

export interface NormalisedActivity extends Activity {
  canonicalQty: number;
  canonicalUnit: string;
  tco2e: number;
  gj: number;
  source: string;
}

export function normalise(a: Activity, row = 0): { value?: NormalisedActivity; issue?: Issue } {
  const ef = factorByKey[a.fuel];
  if (!ef) return { issue: { row, level: "error", message: `Unknown fuel/energy key "${a.fuel}". Accepted: ${emissionFactors.map((e) => e.key).join(", ")}` } };
  const mult = ef.units[a.unit];
  if (mult === undefined) return { issue: { row, level: "error", message: `Unit "${a.unit}" not valid for ${ef.label}. Accepted: ${Object.keys(ef.units).join(", ")}` } };
  if (!(a.quantity >= 0)) return { issue: { row, level: "error", message: `Quantity must be a non-negative number (got "${a.quantity}")` } };
  const canonicalQty = a.quantity * mult;
  return {
    value: {
      ...a,
      canonicalQty,
      canonicalUnit: ef.canonicalUnit,
      tco2e: (canonicalQty * ef.kgco2ePerUnit) / 1000,
      gj: canonicalQty * ef.gjPerUnit,
      source: ef.source,
    },
  };
}

/**
 * z-score control limits on a monthly series: |z| > 2 against the other months
 * AND a practical-significance guard (≥ 8% from their mean) so near-flat series
 * with tiny variance are not flagged on noise.
 */
export function detectAnomalies(series: { month: string; co2eT: number }[]): MonthlyPoint[] {
  if (series.length < 4) return series.map((s) => ({ ...s, z: 0, anomaly: false }));
  return series.map((s, i) => {
    const others = series.filter((_, j) => j !== i).map((x) => x.co2eT);
    const mean = others.reduce((a, b) => a + b, 0) / others.length;
    const sd = Math.sqrt(others.reduce((a, b) => a + (b - mean) ** 2, 0) / others.length) || 1e-9;
    const z = (s.co2eT - mean) / sd;
    const rel = mean > 0 ? Math.abs(s.co2eT - mean) / mean : 0;
    return { ...s, z: Math.round(z * 100) / 100, anomaly: Math.abs(z) > 2 && rel >= 0.08 };
  });
}

export interface EngineResult {
  factory: Factory;
  issues: Issue[];
  activities: NormalisedActivity[];
}

export function buildFactory(profile: IntakeProfile, activities: Activity[], id = `intake-${Date.now()}`, layoutOverrides: Record<string, [number, number, number]> = {}): EngineResult {
  const tpl = sectorTemplates[profile.sector];
  const issues: Issue[] = [];
  const norm: NormalisedActivity[] = [];
  activities.forEach((a, i) => {
    if (!tpl.some((t) => t.id === a.process)) {
      issues.push({ row: i + 1, level: "error", message: `Unknown process "${a.process}" for ${profile.sector}. Accepted: ${tpl.map((t) => t.id).join(", ")}` });
      return;
    }
    const r = normalise(a, i + 1);
    if (r.issue) issues.push(r.issue);
    if (r.value) norm.push(r.value);
  });

  // if the data carries months, scale to an annual basis from the months present
  const months = [...new Set(norm.map((a) => a.month).filter(Boolean))] as string[];
  const annualise = months.length > 0 ? 12 / months.length : 1;
  if (months.length > 0 && months.length < 12) issues.push({ row: 0, level: "warn", message: `${months.length} month(s) of data — annualised ×${annualise.toFixed(2)}. Confidence downgraded to medium.` });

  const outputTpy = profile.outputTonnesPerMonth * 12;
  const c = clusterById[profile.clusterId];

  const nodes: ProcessNode[] = tpl.map((t) => {
    const mine = norm.filter((a) => a.process === t.id);
    const co2e = Math.round(mine.reduce((a, x) => a + x.tco2e, 0) * annualise);
    const actualIntensity = outputTpy > 0 ? Math.round((co2e * 1000) / outputTpy) : 0;
    const ratio = t.benchmark > 0 ? actualIntensity / t.benchmark : 1;
    if (mine.length === 0) issues.push({ row: 0, level: "warn", message: `No activity data for "${t.label}" — reported as zero; benchmark comparison skipped.` });

    let monthly: MonthlyPoint[] | undefined;
    if (months.length >= 4) {
      const byMonth = months.sort().map((m) => ({ month: m, co2eT: Math.round(mine.filter((a) => a.month === m).reduce((a, x) => a + x.tco2e, 0)) }));
      monthly = detectAnomalies(byMonth);
    }

    const node: ProcessNode = {
      id: `${id}:${t.id}`,
      label: t.label,
      kind: t.kind,
      position: layoutOverrides[t.id] ?? t.position,
      scale: t.scale,
      co2eTpy: co2e,
      shareOfTotal: 0,
      benchmarkIntensity: t.benchmark,
      actualIntensity,
      severity: mine.length === 0 ? "ok" : severityFromRatio(ratio),
      confidence: months.length > 0 && months.length < 12 ? "medium" : "high",
      rootCause: mine.length === 0 ? "No data submitted for this process." : ratio > 1.1 ? t.rootCause(ratio) : "Within 10% of the sub-sector benchmark.",
      interventions: [],
      monthly,
    };
    if (monthly?.some((m) => m.anomaly)) {
      const flagged = monthly.filter((m) => m.anomaly).map((m) => `${m.month} (z=${m.z > 0 ? "+" : ""}${m.z})`).join(", ");
      node.rootCause += ` Anomaly flagged: ${flagged} — step change vs the other months (statistical inference, not fact).`;
    }
    node.interventions = co2e > 0 ? interventionsFor(node, profile.sector) : [];
    return node;
  });

  const total = nodes.reduce((a, n) => a + n.co2eTpy, 0);
  for (const n of nodes) n.shareOfTotal = total > 0 ? n.co2eTpy / total : 0;
  const energyMwh = Math.round((norm.reduce((a, x) => a + x.gj, 0) * annualise) / 3.6);
  const circ = profile.wasteTpy > 0 ? Math.min(0.95, profile.recoveredTpy / profile.wasteTpy) : 0;

  const factory: Factory = {
    id,
    name: profile.name,
    sector: `${profile.sector} — ${profile.subSector}`,
    cluster: `${c.name}, Gujarat`,
    outputTonnesPerMonth: profile.outputTonnesPerMonth,
    totalCo2eTpy: total,
    totalEnergyMwhPerYear: energyMwh,
    totalWasteTpy: profile.wasteTpy,
    circularityRatio: Number(circ.toFixed(2)),
    dataSource: "self-reported",
    nodes,
    lat: c.lat + (Math.random() - 0.5) * 0.04,
    lon: c.lon + (Math.random() - 0.5) * 0.04,
    wasteStreams: [],
    acceptedInputs: [],
    implementedInterventionIds: [],
    consentToShare: profile.consentToShare,
    intakeProfile: {
      clusterId: profile.clusterId,
      sector: profile.sector,
      subSector: profile.subSector,
      outputTonnesPerMonth: profile.outputTonnesPerMonth,
      wasteTpy: profile.wasteTpy,
      recoveredTpy: profile.recoveredTpy,
    },
    sourceActivities: activities,
    layoutOverrides,
  };
  return { factory, issues, activities: norm };
}

/** Minimal RFC-4180-ish CSV parser (quotes, commas, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export const CSV_TEMPLATE = `process,fuel,quantity,unit,month
kiln,natural_gas,412000,SCM,2025-01
kiln,natural_gas,398000,SCM,2025-02
kiln,natural_gas,405000,SCM,2025-03
kiln,natural_gas,520000,SCM,2025-04
kiln,natural_gas,401000,SCM,2025-05
kiln,natural_gas,396000,SCM,2025-06
dryer,natural_gas,168000,SCM,2025-01
dryer,natural_gas,171000,SCM,2025-02
dryer,natural_gas,165000,SCM,2025-03
dryer,natural_gas,170000,SCM,2025-04
dryer,natural_gas,169000,SCM,2025-05
dryer,natural_gas,166000,SCM,2025-06
compressor,grid_electricity,205,MWh,2025-01
compressor,grid_electricity,201,MWh,2025-02
compressor,grid_electricity,208,MWh,2025-03
compressor,grid_electricity,204,MWh,2025-04
compressor,grid_electricity,199,MWh,2025-05
compressor,grid_electricity,203,MWh,2025-06
glaze,grid_electricity,160,MWh,2025-01
glaze,grid_electricity,158,MWh,2025-02
glaze,grid_electricity,163,MWh,2025-03
glaze,grid_electricity,161,MWh,2025-04
glaze,grid_electricity,159,MWh,2025-05
glaze,grid_electricity,162,MWh,2025-06
etp,grid_electricity,190,MWh,2025-01
etp,grid_electricity,188,MWh,2025-02
etp,grid_electricity,192,MWh,2025-03
etp,grid_electricity,189,MWh,2025-04
etp,grid_electricity,191,MWh,2025-05
etp,grid_electricity,187,MWh,2025-06
`;
