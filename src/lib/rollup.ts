import type { Factory, Intervention } from "../types";
import { clusters, type Cluster } from "../data/clusters";
import { findMatches, type SymbiosisMatch } from "./symbiosis";

// Regulator rollup — mirrors backend/app/aggregation. Anonymised: no factory
// ids or names leave this module; any cell with fewer than MIN_CELL factories
// is suppressed (counts shown, metrics withheld).

export const MIN_CELL = 3;

export interface SectorCell {
  sector: string;
  factories: number;
  suppressed: boolean;
  co2eTpy: number | null;
  avoidableCo2eTpy: number | null;
  avgDeviationPct: number | null;
  uptakePct: number | null;
}

export interface ClusterRollup {
  cluster: Cluster;
  factories: number;
  co2eTpy: number;
  avoidableCo2eTpy: number;
  avoidableSavingInr: number;
  avgDeviationPct: number;
  hotspotProcesses: number;
  uptakePct: number;
  symbiosisMatches: number;
  symbiosisCo2Tpy: number;
  sectors: SectorCell[];
  topCategories: { category: Intervention["category"]; co2eTpy: number }[];
  topProcessKinds: { kind: string; co2eTpy: number; share: number }[];
}

export interface StateRollup {
  factories: number;
  co2eTpy: number;
  avoidableCo2eTpy: number;
  avoidableSavingInr: number;
  avgDeviationPct: number;
  uptakePct: number;
  symbiosisMatches: number;
  clusters: ClusterRollup[];
  matches: SymbiosisMatch[];
  /** factory id → cluster id (ids only; no names) */
  clusterOf: Record<string, string>;
}

function deviation(f: Factory): number {
  // emission-weighted deviation of each process vs its benchmark
  const w = f.nodes.reduce((a, n) => a + n.co2eTpy, 0) || 1;
  return f.nodes.reduce((a, n) => a + ((n.actualIntensity - n.benchmarkIntensity) / n.benchmarkIntensity) * n.co2eTpy, 0) / w;
}

function avoidable(f: Factory): { co2: number; inr: number } {
  // best single intervention per process (avoid double counting on one unit)
  let co2 = 0, inr = 0;
  for (const n of f.nodes) {
    const best = [...n.interventions].sort((a, b) => b.co2ReductionTpy - a.co2ReductionTpy)[0];
    if (best) { co2 += best.co2ReductionTpy; inr += best.annualSavingInr; }
  }
  return { co2, inr };
}

function uptake(f: Factory): number {
  const total = f.nodes.reduce((a, n) => a + n.interventions.length, 0) || 1;
  return f.implementedInterventionIds.length / total;
}

function sectorKey(f: Factory): string {
  return f.sector.split(" — ")[0];
}

export function rollup(factories: Factory[]): StateRollup {
  const matches = findMatches(factories);

  const clusterRollups: ClusterRollup[] = clusters
    .map((c) => {
      const fs = factories.filter((f) => f.cluster.startsWith(c.name));
      if (fs.length === 0) return null;
      const co2 = fs.reduce((a, f) => a + f.totalCo2eTpy, 0);
      const av = fs.map(avoidable);
      const avoidableCo2 = av.reduce((a, x) => a + x.co2, 0);
      const avoidableInr = av.reduce((a, x) => a + x.inr, 0);
      const dev = fs.reduce((a, f) => a + deviation(f) * f.totalCo2eTpy, 0) / (co2 || 1);
      const ids = new Set(fs.map((f) => f.id));
      const cm = matches.filter((m) => ids.has(m.sourceId) || ids.has(m.targetId));

      const bySector = new Map<string, Factory[]>();
      for (const f of fs) bySector.set(sectorKey(f), [...(bySector.get(sectorKey(f)) ?? []), f]);
      const sectors: SectorCell[] = [...bySector.entries()].map(([sector, sf]) => {
        const suppressed = sf.length < MIN_CELL;
        const sco2 = sf.reduce((a, f) => a + f.totalCo2eTpy, 0);
        return {
          sector,
          factories: sf.length,
          suppressed,
          co2eTpy: suppressed ? null : sco2,
          avoidableCo2eTpy: suppressed ? null : sf.reduce((a, f) => a + avoidable(f).co2, 0),
          avgDeviationPct: suppressed ? null : Math.round((sf.reduce((a, f) => a + deviation(f) * f.totalCo2eTpy, 0) / (sco2 || 1)) * 100),
          uptakePct: suppressed ? null : Math.round((sf.reduce((a, f) => a + uptake(f), 0) / sf.length) * 100),
        };
      });

      const cat = new Map<Intervention["category"], number>();
      const kind = new Map<string, number>();
      for (const f of fs) {
        for (const n of f.nodes) {
          kind.set(n.kind, (kind.get(n.kind) ?? 0) + n.co2eTpy);
          const best = [...n.interventions].sort((a, b) => b.co2ReductionTpy - a.co2ReductionTpy)[0];
          if (best) cat.set(best.category, (cat.get(best.category) ?? 0) + best.co2ReductionTpy);
        }
      }

      return {
        cluster: c,
        factories: fs.length,
        co2eTpy: co2,
        avoidableCo2eTpy: avoidableCo2,
        avoidableSavingInr: avoidableInr,
        avgDeviationPct: Math.round(dev * 100),
        hotspotProcesses: fs.reduce((a, f) => a + f.nodes.filter((n) => n.severity === "crit").length, 0),
        uptakePct: Math.round((fs.reduce((a, f) => a + uptake(f), 0) / fs.length) * 100),
        symbiosisMatches: cm.length,
        symbiosisCo2Tpy: cm.reduce((a, m) => a + m.co2AvoidedTpy, 0),
        sectors,
        topCategories: [...cat.entries()].map(([category, co2eTpy]) => ({ category, co2eTpy })).sort((a, b) => b.co2eTpy - a.co2eTpy),
        topProcessKinds: [...kind.entries()].map(([k, v]) => ({ kind: k, co2eTpy: v, share: v / (co2 || 1) })).sort((a, b) => b.co2eTpy - a.co2eTpy),
      } satisfies ClusterRollup;
    })
    .filter((x): x is ClusterRollup => x !== null);

  const clusterOf: Record<string, string> = {};
  for (const f of factories) {
    const c = clusters.find((x) => f.cluster.startsWith(x.name));
    if (c) clusterOf[f.id] = c.id;
  }

  const total = factories.reduce((a, f) => a + f.totalCo2eTpy, 0);
  return {
    clusterOf,
    factories: factories.length,
    co2eTpy: total,
    avoidableCo2eTpy: clusterRollups.reduce((a, c) => a + c.avoidableCo2eTpy, 0),
    avoidableSavingInr: clusterRollups.reduce((a, c) => a + c.avoidableSavingInr, 0),
    avgDeviationPct: Math.round((factories.reduce((a, f) => a + deviation(f) * f.totalCo2eTpy, 0) / (total || 1)) * 100),
    uptakePct: Math.round((factories.reduce((a, f) => a + uptake(f), 0) / (factories.length || 1)) * 100),
    symbiosisMatches: matches.length,
    clusters: clusterRollups.sort((a, b) => b.avoidableCo2eTpy - a.avoidableCo2eTpy),
    matches,
  };
}
