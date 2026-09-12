import type { Factory, ProcessNode, Severity, WasteStream, AcceptedInput } from "../types";
import { interventionsFor, type ProcessKind } from "./interventionLibrary";
import { clusterById } from "./clusters";
import { morbiCeramicsFactory } from "./mockFactory";

// SYNTHETIC / ILLUSTRATIVE — calibrated to ASI/BEE sub-sector averages.
// Every factory here is labelled dataSource: "synthetic".

export interface ProcessTemplate {
  id: string;
  label: string;
  kind: ProcessKind;
  share: number; // of site CO₂e
  benchmark: number; // kgCO₂e / t output
  position: [number, number, number];
  scale: [number, number, number];
  rootCause: (dev: number) => string;
}

export const sectorTemplates: Record<string, ProcessTemplate[]> = {
  Ceramics: [
    { id: "kiln", label: "Roller Kiln", kind: "kiln", share: 0.52, benchmark: 185, position: [-1.5, 0, -3.2], scale: [8, 2.2, 2.4], rootCause: (d) => `Firing profile ${Math.round(d * 20)}% above benchmark dwell; kiln-car loading below optimal.` },
    { id: "dryer", label: "Spray Dryer", kind: "dryer", share: 0.22, benchmark: 96, position: [4.8, 0, -2.6], scale: [2.4, 5.2, 2.4], rootCause: () => "Slip moisture above optimal, raising evaporation load per tonne of powder." },
    { id: "compressor", label: "Compressor House", kind: "compressor", share: 0.09, benchmark: 34, position: [5, 0, 2.6], scale: [3, 1.6, 2.6], rootCause: () => "Compressed-air specific energy near benchmark." },
    { id: "glaze", label: "Glazing Line", kind: "generic", share: 0.08, benchmark: 22, position: [-0.8, 0, 1.4], scale: [7, 1.4, 1.6], rootCause: () => "Glaze rework/rejection above benchmark." },
    { id: "etp", label: "Effluent Treatment Plant", kind: "effluent", share: 0.09, benchmark: 28, position: [-5.4, 0, 3.4], scale: [3.6, 1.4, 3.2], rootCause: () => "ETP sludge landfilled rather than reused." },
  ],
  Chemicals: [
    { id: "boiler", label: "Steam Boiler", kind: "boiler", share: 0.42, benchmark: 240, position: [-2, 0, -3], scale: [4, 3, 2.6], rootCause: (d) => `Boiler efficiency ${Math.round(d * 25)} pts below benchmark; no economiser, poor condensate return.` },
    { id: "reactor", label: "Reactor Heating", kind: "furnace", share: 0.2, benchmark: 110, position: [3.5, 0, -2.5], scale: [2.6, 2.4, 2.6], rootCause: () => "Thermic-fluid heater cycling on batch loads." },
    { id: "column", label: "Distillation Column", kind: "generic", share: 0.18, benchmark: 95, position: [-0.5, 0, 1.5], scale: [6, 1.5, 1.6], rootCause: () => "Solvent losses to incineration rather than recovery." },
    { id: "compressor", label: "Compressor House", kind: "compressor", share: 0.08, benchmark: 30, position: [5, 0, 2.6], scale: [3, 1.6, 2.6], rootCause: () => "Compressed-air near benchmark." },
    { id: "etp", label: "Effluent Treatment Plant", kind: "effluent", share: 0.12, benchmark: 60, position: [-5.4, 0, 3.4], scale: [3.6, 1.4, 3.2], rootCause: () => "High-COD effluent aerobically treated with no biogas capture." },
  ],
  Textiles: [
    { id: "boiler", label: "Thermic Fluid Heater / Boiler", kind: "boiler", share: 0.45, benchmark: 150, position: [-2, 0, -3], scale: [4, 3, 2.6], rootCause: (d) => `Coal-fired heater ${Math.round(d * 25)} pts below benchmark efficiency; no flue-gas recovery.` },
    { id: "stenter", label: "Stenter (Drying)", kind: "dryer", share: 0.25, benchmark: 80, position: [4.8, 0, -2.6], scale: [2.4, 5.2, 2.4], rootCause: () => "Stenter exhaust not recirculated; over-drying on some qualities." },
    { id: "dyeing", label: "Dyeing Line", kind: "generic", share: 0.15, benchmark: 50, position: [-0.8, 0, 1.4], scale: [7, 1.4, 1.6], rootCause: () => "Single-use dye baths; caustic not recovered." },
    { id: "compressor", label: "Compressor House", kind: "compressor", share: 0.05, benchmark: 20, position: [5, 0, 2.6], scale: [3, 1.6, 2.6], rootCause: () => "Near benchmark." },
    { id: "etp", label: "Effluent Treatment Plant", kind: "effluent", share: 0.1, benchmark: 40, position: [-5.4, 0, 3.4], scale: [3.6, 1.4, 3.2], rootCause: () => "Fresh water drawn for all process stages; no tertiary reuse." },
  ],
  Engineering: [
    { id: "furnace", label: "Induction Furnace", kind: "furnace", share: 0.55, benchmark: 320, position: [-1.5, 0, -3], scale: [5, 2.6, 2.6], rootCause: (d) => `Melt energy ${Math.round(d * 30)}% above benchmark; low scrap return, cold charge.` },
    { id: "heat-treat", label: "Heat Treatment", kind: "generic", share: 0.2, benchmark: 110, position: [-0.5, 0, 1.5], scale: [6, 1.5, 1.6], rootCause: () => "Part-loaded heat-treatment cycles." },
    { id: "compressor", label: "Compressor House", kind: "compressor", share: 0.12, benchmark: 40, position: [5, 0, 2.6], scale: [3, 1.6, 2.6], rootCause: () => "Load/unload cycling on fixed-speed compressors." },
    { id: "sand-dryer", label: "Sand Drying", kind: "dryer", share: 0.05, benchmark: 25, position: [4.8, 0, -2.6], scale: [2.4, 4, 2.4], rootCause: () => "Near benchmark." },
    { id: "etp", label: "Effluent / Slag Yard", kind: "effluent", share: 0.08, benchmark: 20, position: [-5.4, 0, 3.4], scale: [3.6, 1.4, 3.2], rootCause: () => "Slag sent to landfill; usable as aggregate." },
  ],
  "Building materials": [
    { id: "kiln", label: "Brick Kiln", kind: "kiln", share: 0.6, benchmark: 160, position: [-1.5, 0, -3.2], scale: [8, 2.2, 2.4], rootCause: (d) => `Firing ${Math.round(d * 20)}% above benchmark; clamp-style firing.` },
    { id: "dryer", label: "Green-brick Dryer", kind: "dryer", share: 0.2, benchmark: 55, position: [4.8, 0, -2.6], scale: [2.4, 4, 2.4], rootCause: () => "Open-air drying; weather-dependent throughput." },
    { id: "compressor", label: "Compressor House", kind: "compressor", share: 0.1, benchmark: 25, position: [5, 0, 2.6], scale: [3, 1.6, 2.6], rootCause: () => "Near benchmark." },
    { id: "mixing", label: "Raw-material Mixing", kind: "generic", share: 0.1, benchmark: 20, position: [-0.8, 0, 1.4], scale: [7, 1.4, 1.6], rootCause: () => "100% virgin clay; no secondary-material substitution." },
  ],
};

interface Spec {
  id: string;
  name: string;
  cluster: string;
  sector: keyof typeof sectorTemplates;
  subSector: string;
  outputTpm: number;
  totalCo2e: number;
  totalEnergyMwh: number;
  totalWasteTpy: number;
  circularity: number;
  deviations: number[]; // actual/benchmark per template process
  offset: [number, number]; // lat/lon offset from cluster centroid
  wasteStreams: WasteStream[];
  acceptedInputs: AcceptedInput[];
  implementedKeys?: string[]; // library keys already implemented (e.g. "kiln-loading")
  consentToShare: boolean;
}

export function severityFromRatio(dev: number): Severity {
  const d = dev - 1;
  if (d < 0.1) return "ok";
  if (d < 0.3) return "warn";
  return "crit";
}

function build(spec: Spec): Factory {
  const c = clusterById[spec.cluster];
  const tpl = sectorTemplates[spec.sector];
  const outputTpy = spec.outputTpm * 12;
  const nodes: ProcessNode[] = tpl.map((t, i) => {
    const dev = spec.deviations[i] ?? 1;
    const co2e = Math.round(spec.totalCo2e * t.share);
    const id = `${spec.id}:${t.id}`;
    const node: ProcessNode = {
      id,
      label: t.label,
      kind: t.kind,
      position: t.position,
      scale: t.scale,
      co2eTpy: co2e,
      shareOfTotal: t.share,
      benchmarkIntensity: t.benchmark,
      actualIntensity: Math.round(t.benchmark * dev),
      severity: severityFromRatio(dev),
      confidence: "medium",
      rootCause: t.rootCause(dev),
      interventions: [],
    };
    node.interventions = interventionsFor(node, spec.sector);
    return node;
  });
  void outputTpy;
  const implemented = (spec.implementedKeys ?? []).flatMap((k) => nodes.flatMap((n) => n.interventions.filter((iv) => iv.id.endsWith(`:${k}`)).map((iv) => iv.id)));
  return {
    id: spec.id,
    name: spec.name,
    sector: `${spec.sector} — ${spec.subSector}`,
    cluster: `${c.name}, Gujarat`,
    outputTonnesPerMonth: spec.outputTpm,
    totalCo2eTpy: spec.totalCo2e,
    totalEnergyMwhPerYear: spec.totalEnergyMwh,
    totalWasteTpy: spec.totalWasteTpy,
    circularityRatio: spec.circularity,
    dataSource: "synthetic",
    nodes,
    lat: c.lat + spec.offset[0],
    lon: c.lon + spec.offset[1],
    wasteStreams: spec.wasteStreams,
    acceptedInputs: spec.acceptedInputs,
    implementedInterventionIds: implemented,
    consentToShare: spec.consentToShare,
  };
}

const specs: Spec[] = [
  // ——— Morbi (ceramics + a building-materials receiver) ———
  { id: "morbi-02", name: "Rajshree Vitrified LLP", cluster: "morbi", sector: "Ceramics", subSector: "Vitrified tiles", outputTpm: 5100, totalCo2e: 21400, totalEnergyMwh: 35600, totalWasteTpy: 2500, circularity: 0.18, deviations: [1.31, 1.12, 1.02, 1.18, 1.35], offset: [0.02, -0.03], wasteStreams: [{ tag: "ceramic_sludge", label: "ETP ceramic sludge", tpy: 900, form: "solid", disposalCostInrPerT: 1400 }, { tag: "waste_heat_air", label: "Kiln cooling-zone hot air", tpy: 0, form: "heat", disposalCostInrPerT: 0 }], acceptedInputs: [{ tag: "fly_ash", label: "Fly ash (body filler)", maxTpy: 400, virginCostInrPerT: 2200 }], implementedKeys: ["air-leak"], consentToShare: true },
  { id: "morbi-03", name: "Sunray Wall Tiles", cluster: "morbi", sector: "Ceramics", subSector: "Wall tiles", outputTpm: 2600, totalCo2e: 10900, totalEnergyMwh: 18100, totalWasteTpy: 1300, circularity: 0.27, deviations: [1.08, 1.05, 0.98, 1.04, 1.12], offset: [-0.025, 0.02], wasteStreams: [{ tag: "ceramic_sludge", label: "ETP ceramic sludge", tpy: 420, form: "solid", disposalCostInrPerT: 1400 }], acceptedInputs: [], implementedKeys: ["kiln-loading", "glaze-recycle"], consentToShare: false },
  { id: "morbi-04", name: "Gokul Bricks & Blocks", cluster: "morbi", sector: "Building materials", subSector: "Fly-ash / clay bricks", outputTpm: 3800, totalCo2e: 6200, totalEnergyMwh: 4100, totalWasteTpy: 300, circularity: 0.31, deviations: [1.22, 1.1, 1.0, 1.0], offset: [0.035, 0.04], wasteStreams: [], acceptedInputs: [{ tag: "ceramic_sludge", label: "Ceramic sludge (clay substitute)", maxTpy: 2500, virginCostInrPerT: 900 }, { tag: "fly_ash", label: "Fly ash", maxTpy: 6000, virginCostInrPerT: 700 }, { tag: "foundry_slag", label: "Foundry slag (aggregate)", maxTpy: 1500, virginCostInrPerT: 650 }], consentToShare: true },
  // ——— Vapi (chemicals) ———
  { id: "vapi-01", name: "Arihant Dyestuffs Pvt. Ltd.", cluster: "vapi", sector: "Chemicals", subSector: "Dyes & intermediates", outputTpm: 900, totalCo2e: 14800, totalEnergyMwh: 22000, totalWasteTpy: 1900, circularity: 0.14, deviations: [1.38, 1.15, 1.42, 1.02, 1.5], offset: [0.015, 0.02], wasteStreams: [{ tag: "spent_solvent", label: "Spent solvent (mixed)", tpy: 380, form: "liquid", disposalCostInrPerT: 9000 }, { tag: "waste_heat_steam", label: "Low-pressure exhaust steam", tpy: 5200, form: "heat", disposalCostInrPerT: 0 }], acceptedInputs: [], implementedKeys: [], consentToShare: true },
  { id: "vapi-02", name: "Nirmal Organics", cluster: "vapi", sector: "Chemicals", subSector: "Specialty chemicals", outputTpm: 1400, totalCo2e: 12300, totalEnergyMwh: 19800, totalWasteTpy: 1100, circularity: 0.24, deviations: [1.12, 1.06, 1.08, 0.97, 1.2], offset: [-0.02, -0.015], wasteStreams: [{ tag: "spent_solvent", label: "Spent solvent (toluene-rich)", tpy: 210, form: "liquid", disposalCostInrPerT: 9000 }], acceptedInputs: [{ tag: "spent_solvent", label: "Solvent for recovery still", maxTpy: 800, virginCostInrPerT: 62000 }, { tag: "waste_heat_steam", label: "LP steam for reboilers", maxTpy: 9000, virginCostInrPerT: 1800 }], implementedKeys: ["boiler-economiser", "solvent-recovery"], consentToShare: true },
  { id: "vapi-03", name: "Shree Pigments", cluster: "vapi", sector: "Chemicals", subSector: "Pigments", outputTpm: 600, totalCo2e: 8900, totalEnergyMwh: 13400, totalWasteTpy: 1400, circularity: 0.11, deviations: [1.27, 1.2, 1.15, 1.05, 1.36], offset: [0.03, -0.03], wasteStreams: [{ tag: "spent_solvent", label: "Spent solvent", tpy: 150, form: "liquid", disposalCostInrPerT: 9000 }], acceptedInputs: [], implementedKeys: [], consentToShare: false },
  // ——— Ankleshwar (chemicals) ———
  { id: "ankleshwar-01", name: "Bharuch Fine Chem", cluster: "ankleshwar", sector: "Chemicals", subSector: "Agro-chem intermediates", outputTpm: 1100, totalCo2e: 13600, totalEnergyMwh: 21500, totalWasteTpy: 1600, circularity: 0.19, deviations: [1.24, 1.1, 1.3, 1.0, 1.28], offset: [0.01, 0.02], wasteStreams: [{ tag: "spent_solvent", label: "Spent solvent", tpy: 300, form: "liquid", disposalCostInrPerT: 9000 }], acceptedInputs: [{ tag: "spent_solvent", label: "Solvent for recovery", maxTpy: 500, virginCostInrPerT: 60000 }], implementedKeys: ["air-vsd"], consentToShare: true },
  // ——— Surat (textiles) ———
  { id: "surat-01", name: "Laxmi Dyeing & Printing Mills", cluster: "surat", sector: "Textiles", subSector: "Dyeing & printing", outputTpm: 1800, totalCo2e: 16200, totalEnergyMwh: 24800, totalWasteTpy: 2100, circularity: 0.16, deviations: [1.36, 1.18, 1.22, 1.0, 1.3], offset: [0.02, 0.03], wasteStreams: [{ tag: "textile_sludge", label: "ETP textile sludge", tpy: 700, form: "solid", disposalCostInrPerT: 2100 }, { tag: "cotton_waste", label: "Fibre / cutting waste", tpy: 260, form: "solid", disposalCostInrPerT: 800 }], acceptedInputs: [], implementedKeys: [], consentToShare: true },
  { id: "surat-02", name: "Ambica Processors", cluster: "surat", sector: "Textiles", subSector: "Processing house", outputTpm: 1300, totalCo2e: 10400, totalEnergyMwh: 16900, totalWasteTpy: 1500, circularity: 0.22, deviations: [1.14, 1.08, 1.1, 0.98, 1.16], offset: [-0.025, -0.02], wasteStreams: [{ tag: "textile_sludge", label: "ETP textile sludge", tpy: 480, form: "solid", disposalCostInrPerT: 2100 }], acceptedInputs: [{ tag: "cotton_waste", label: "Recycled fibre feed", maxTpy: 500, virginCostInrPerT: 5800 }], implementedKeys: ["dryer-exhaust", "dye-reuse"], consentToShare: true },
  // ——— Rajkot (engineering / foundry) ———
  { id: "rajkot-01", name: "Patel Castings & Engineering", cluster: "rajkot", sector: "Engineering", subSector: "Grey-iron foundry", outputTpm: 700, totalCo2e: 9700, totalEnergyMwh: 15200, totalWasteTpy: 1800, circularity: 0.33, deviations: [1.33, 1.12, 1.25, 1.02, 1.4], offset: [0.015, 0.025], wasteStreams: [{ tag: "foundry_slag", label: "Furnace slag", tpy: 1100, form: "solid", disposalCostInrPerT: 1100 }, { tag: "foundry_sand", label: "Spent moulding sand", tpy: 2600, form: "solid", disposalCostInrPerT: 900 }], acceptedInputs: [], implementedKeys: [], consentToShare: true },
  // ——— Jamnagar (brass parts) ———
  { id: "jamnagar-01", name: "Saurashtra Brass Components", cluster: "jamnagar", sector: "Engineering", subSector: "Brass parts", outputTpm: 400, totalCo2e: 5400, totalEnergyMwh: 8600, totalWasteTpy: 600, circularity: 0.41, deviations: [1.16, 1.05, 1.2, 1.0, 1.1], offset: [0.02, 0.02], wasteStreams: [{ tag: "brass_turnings", label: "Brass turnings / dross", tpy: 320, form: "solid", disposalCostInrPerT: 0 }], acceptedInputs: [], implementedKeys: ["furnace-scrap"], consentToShare: false },
];

const primary: Factory = {
  ...morbiCeramicsFactory,
  lat: clusterById.morbi.lat - 0.01,
  lon: clusterById.morbi.lon + 0.01,
  wasteStreams: [
    { tag: "ceramic_sludge", label: "ETP ceramic sludge", tpy: 760, form: "solid", disposalCostInrPerT: 1400 },
    { tag: "waste_heat_air", label: "Kiln cooling-zone hot air", tpy: 0, form: "heat", disposalCostInrPerT: 0 },
  ],
  acceptedInputs: [{ tag: "fly_ash", label: "Fly ash (body filler)", maxTpy: 300, virginCostInrPerT: 2200 }],
  implementedInterventionIds: [],
  consentToShare: true,
};

export const allFactories: Factory[] = [primary, ...specs.map(build)];
export const factoryById = Object.fromEntries(allFactories.map((f) => [f.id, f])) as Record<string, Factory>;
