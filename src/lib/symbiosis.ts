// Industrial-symbiosis types + geometry helper. Matching itself now runs
// server-side (ml/symbiosis_model.py — MiniLM semantic similarity + quantity
// fit + proximity, real waste-stream data), computed once and served via
// GET /api/symbiosis/network. This used to also contain a client-side
// findMatches() over a small hardcoded tag-compatibility table, but that
// only ever ran against empty wasteStreams/acceptedInputs once the frontend
// moved to live API data (Phase 5) — removed in favour of the real matcher's
// output (see src/lib/apiAdapter.ts adaptSymbiosisMatch, src/store/useFactoryStore.ts).

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

export function matchesFor(factoryId: string, all: SymbiosisMatch[]): SymbiosisMatch[] {
  return all.filter((m) => m.sourceId === factoryId || m.targetId === factoryId);
}
