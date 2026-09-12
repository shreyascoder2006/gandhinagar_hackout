import type { Factory } from "../types";

// Industrial-symbiosis matching — mirrors backend/app/intelligence/symbiosis.py.
// Match a factory's waste stream to another factory's accepted input by tag
// (with a small compatibility table), within MAX_KM. Score by tonnage × distance.

const MAX_KM = 60;

/** waste tag → input tags it can substitute */
const COMPAT: Record<string, string[]> = {
  ceramic_sludge: ["ceramic_sludge"],
  fly_ash: ["fly_ash"],
  spent_solvent: ["spent_solvent"],
  waste_heat_steam: ["waste_heat_steam"],
  waste_heat_air: [],
  foundry_slag: ["foundry_slag"],
  foundry_sand: ["foundry_slag"],
  cotton_waste: ["cotton_waste"],
  textile_sludge: [],
  brass_turnings: [],
};

// Emission factors for the avoided burdens (illustrative, sourced in backend seed):
// landfill/TSDF handling per tonne, and virgin-material production per tonne.
const AVOIDED_KG_PER_T: Record<string, { disposal: number; virgin: number }> = {
  ceramic_sludge: { disposal: 35, virgin: 120 },
  fly_ash: { disposal: 20, virgin: 110 },
  spent_solvent: { disposal: 1800, virgin: 2400 },
  waste_heat_steam: { disposal: 0, virgin: 180 },
  foundry_slag: { disposal: 30, virgin: 90 },
  foundry_sand: { disposal: 30, virgin: 90 },
  cotton_waste: { disposal: 60, virgin: 1900 },
};

export interface SymbiosisMatch {
  id: string;
  sourceId: string;
  targetId: string;
  sourceName: string; // "Anonymised unit" if no consent
  targetName: string;
  tag: string;
  label: string;
  distanceKm: number;
  tonnesMatched: number;
  co2AvoidedTpy: number;
  sourceSavingInr: number; // avoided disposal cost
  targetSavingInr: number; // avoided virgin purchase (assume 60% of virgin price)
  score: number;
  confidence: "low";
}

export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function findMatches(factories: Factory[]): SymbiosisMatch[] {
  const out: SymbiosisMatch[] = [];
  for (const src of factories) {
    for (const ws of src.wasteStreams) {
      if (ws.tpy <= 0) continue;
      const targets = COMPAT[ws.tag] ?? [];
      for (const dst of factories) {
        if (dst.id === src.id) continue;
        const d = haversineKm(src.lat, src.lon, dst.lat, dst.lon);
        if (d > MAX_KM) continue;
        for (const inp of dst.acceptedInputs) {
          if (!targets.includes(inp.tag)) continue;
          const tonnes = Math.min(ws.tpy, inp.maxTpy);
          const ef = AVOIDED_KG_PER_T[ws.tag] ?? { disposal: 30, virgin: 100 };
          const co2 = Math.round((tonnes * (ef.disposal + ef.virgin)) / 1000);
          const distanceFactor = 1 - d / MAX_KM;
          out.push({
            id: `${src.id}→${dst.id}:${ws.tag}`,
            sourceId: src.id,
            targetId: dst.id,
            sourceName: src.consentToShare ? src.name : "Anonymised unit (no consent)",
            targetName: dst.consentToShare ? dst.name : "Anonymised unit (no consent)",
            tag: ws.tag,
            label: `${ws.label} → ${inp.label}`,
            distanceKm: Math.round(d * 10) / 10,
            tonnesMatched: tonnes,
            co2AvoidedTpy: co2,
            sourceSavingInr: Math.round(tonnes * ws.disposalCostInrPerT),
            targetSavingInr: Math.round(tonnes * inp.virginCostInrPerT * 0.6),
            score: Math.round(tonnes * distanceFactor),
            confidence: "low",
          });
        }
      }
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

export function matchesFor(factoryId: string, all: SymbiosisMatch[]): SymbiosisMatch[] {
  return all.filter((m) => m.sourceId === factoryId || m.targetId === factoryId);
}
