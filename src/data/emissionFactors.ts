// Emission factors — Layer 3 seed. Every row carries its source and the
// confidence tier from the PDF (§05). Values are India-specific where a
// published national factor exists, IPCC 2006 defaults otherwise.

export interface EmissionFactor {
  key: string;
  label: string;
  canonicalUnit: string; // unit the factor is expressed per
  kgco2ePerUnit: number;
  gjPerUnit: number; // energy content, for MWh totals
  source: string;
  confidence: "high" | "medium";
  /** accepted input units → multiplier to canonical */
  units: Record<string, number>;
}

export const emissionFactors: EmissionFactor[] = [
  { key: "grid_electricity", label: "Grid electricity (Gujarat)", canonicalUnit: "kWh", kgco2ePerUnit: 0.71, gjPerUnit: 0.0036, source: "CEA CO₂ Baseline Database v19 (weighted average, 2023-24)", confidence: "high", units: { kWh: 1, MWh: 1000, units: 1 } },
  { key: "natural_gas", label: "Natural gas (PNG)", canonicalUnit: "SCM", kgco2ePerUnit: 2.04, gjPerUnit: 0.0364, source: "IPCC 2006 Vol.2 Table 2.2 (56.1 kgCO₂/GJ) × NCV 36.4 MJ/SCM", confidence: "high", units: { SCM: 1, "m³": 1, MMBTU: 28.3, kSCM: 1000 } },
  { key: "coal", label: "Indian non-coking coal", canonicalUnit: "t", kgco2ePerUnit: 1700, gjPerUnit: 18.0, source: "IPCC 94.6 kgCO₂/GJ × India NCV ~18 GJ/t (MoEFCC BUR-3)", confidence: "high", units: { t: 1, tonne: 1, kg: 0.001 } },
  { key: "pet_coke", label: "Petroleum coke", canonicalUnit: "t", kgco2ePerUnit: 3200, gjPerUnit: 32.5, source: "IPCC 97.5 kgCO₂/GJ × NCV 32.5 GJ/t", confidence: "high", units: { t: 1, tonne: 1, kg: 0.001 } },
  { key: "furnace_oil", label: "Furnace oil / HFO", canonicalUnit: "L", kgco2ePerUnit: 3.11, gjPerUnit: 0.0402, source: "IPCC 77.4 kgCO₂/GJ × NCV 40.2 MJ/L", confidence: "high", units: { L: 1, kL: 1000, litre: 1 } },
  { key: "diesel", label: "Diesel (HSD)", canonicalUnit: "L", kgco2ePerUnit: 2.68, gjPerUnit: 0.0363, source: "IPCC 74.1 kgCO₂/GJ × NCV 36.3 MJ/L", confidence: "high", units: { L: 1, kL: 1000, litre: 1 } },
  { key: "lpg", label: "LPG", canonicalUnit: "kg", kgco2ePerUnit: 2.98, gjPerUnit: 0.0473, source: "IPCC 63.1 kgCO₂/GJ × NCV 47.3 MJ/kg", confidence: "high", units: { kg: 1, t: 1000, cylinder19kg: 19 } },
  { key: "biomass", label: "Biomass / agri-residue briquettes", canonicalUnit: "t", kgco2ePerUnit: 40, gjPerUnit: 15.0, source: "Biogenic CO₂ excluded; 40 kg/t for processing & transport (CEA/MNRE guidance)", confidence: "medium", units: { t: 1, tonne: 1, kg: 0.001 } },
];

export const factorByKey = Object.fromEntries(emissionFactors.map((f) => [f.key, f])) as Record<string, EmissionFactor>;
