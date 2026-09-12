import type { Factory } from "../types";

// SYNTHETIC / ILLUSTRATIVE DATA — calibrated to public ASI/BEE sector averages
// for the Morbi ceramics cluster. Not measured plant data. See confidence
// field on every node/intervention.

export const morbiCeramicsFactory: Factory = {
  lat: 22.81,
  lon: 70.85,
  wasteStreams: [],
  acceptedInputs: [],
  implementedInterventionIds: [],
  consentToShare: true,
  id: "demo-morbi-01",
  name: "Shreeji Ceramics Pvt. Ltd. (Demo)",
  sector: "Ceramics — Vitrified Tiles",
  cluster: "Morbi, Gujarat",
  outputTonnesPerMonth: 4200,
  totalCo2eTpy: 18650,
  totalEnergyMwhPerYear: 31200,
  totalWasteTpy: 2140,
  circularityRatio: 0.22,
  dataSource: "synthetic",
  nodes: [
    {
      id: "kiln-1",
      label: "Roller Kiln Line 1",
      kind: "kiln",
      position: [-1.5, 0, -3.2],
      scale: [8.0, 2.2, 2.4],
      co2eTpy: 9840,
      shareOfTotal: 0.528,
      benchmarkIntensity: 185, // kgCO2e/tonne tile
      actualIntensity: 268,
      severity: "crit",
      confidence: "high",
      rootCause:
        "Firing temperature profile runs ~9% above the sub-sector benchmark, and kiln car loading density is below optimal, both increasing specific fuel consumption per tonne fired.",
      interventions: [
        {
          id: "int-kiln1-1",
          title: "Waste-heat recovery from kiln cooling zone to dryer preheat",
          category: "heat-recovery",
          capexInr: 6800000,
          annualSavingInr: 3120000,
          co2ReductionTpy: 1380,
          paybackMonths: 26,
          confidence: "high",
          description:
            "Recover hot air from the kiln cooling zone (typically 180-250°C) to preheat the spray dryer or vertical dryer intake, cutting natural gas use in the drying stage.",
        },
        {
          id: "int-kiln1-2",
          title: "Kiln car loading optimization + firing curve retune",
          category: "process-change",
          capexInr: 450000,
          annualSavingInr: 1860000,
          co2ReductionTpy: 640,
          paybackMonths: 3,
          confidence: "medium",
          description:
            "Increase kiln car loading density toward sub-sector benchmark and retune the firing curve to reduce peak-zone dwell time without compromising tile quality.",
        },
      ],
    },
    {
      id: "spray-dryer",
      label: "Spray Dryer",
      kind: "dryer",
      position: [4.8, 0, -2.6],
      scale: [2.4, 5.2, 2.4],
      co2eTpy: 4120,
      shareOfTotal: 0.221,
      benchmarkIntensity: 96,
      actualIntensity: 112,
      severity: "warn",
      confidence: "high",
      rootCause:
        "Moisture content of incoming slip is slightly above optimal, requiring longer residence time and higher fuel draw per tonne of powder produced.",
      interventions: [
        {
          id: "int-dryer-1",
          title: "Slip moisture control via inline density monitoring",
          category: "process-change",
          capexInr: 920000,
          annualSavingInr: 640000,
          co2ReductionTpy: 210,
          paybackMonths: 17,
          confidence: "medium",
          description:
            "Install inline slip density/moisture sensors to tighten feed consistency and cut excess evaporation load on the spray dryer.",
        },
      ],
    },
    {
      id: "compressor-house",
      label: "Compressor House",
      kind: "compressor",
      position: [5.0, 0, 2.6],
      scale: [3.0, 1.6, 2.6],
      co2eTpy: 1720,
      shareOfTotal: 0.092,
      benchmarkIntensity: 34,
      actualIntensity: 33,
      severity: "ok",
      confidence: "high",
      rootCause: "Compressed-air specific energy is within 3% of sub-sector benchmark; no significant leak signature detected in current usage pattern.",
      interventions: [
        {
          id: "int-comp-1",
          title: "Ultrasonic leak audit (routine)",
          category: "process-change",
          capexInr: 120000,
          annualSavingInr: 260000,
          co2ReductionTpy: 70,
          paybackMonths: 6,
          confidence: "medium",
          description:
            "Quarterly ultrasonic leak detection typically recovers 5-8% of compressed-air losses even in well-run systems.",
        },
      ],
    },
    {
      id: "glaze-line",
      label: "Glazing Line",
      kind: "generic",
      position: [-0.8, 0, 1.4],
      scale: [7.0, 1.4, 1.6],
      co2eTpy: 1380,
      shareOfTotal: 0.074,
      benchmarkIntensity: 22,
      actualIntensity: 27,
      severity: "warn",
      confidence: "medium",
      rootCause: "Glaze slip rework/rejection rate slightly above benchmark, increasing re-processing energy per tonne of finished tile.",
      interventions: [
        {
          id: "int-glaze-1",
          title: "Recycle glaze overspray into base slip (closed loop)",
          category: "recycling-loop",
          circularityGainPct: 0.05,
          capexInr: 380000,
          annualSavingInr: 510000,
          co2ReductionTpy: 95,
          paybackMonths: 9,
          confidence: "medium",
          description:
            "Capture and reintroduce glaze overspray into the base slip line instead of disposing as waste, cutting both material cost and waste-treatment load.",
        },
      ],
    },
    {
      id: "effluent-etp",
      label: "Effluent Treatment Plant",
      kind: "effluent",
      position: [-5.4, 0, 3.4],
      scale: [3.6, 1.4, 3.2],
      co2eTpy: 1590,
      shareOfTotal: 0.085,
      benchmarkIntensity: 28,
      actualIntensity: 41,
      severity: "crit",
      confidence: "medium",
      rootCause:
        "Sludge from the ETP is currently landfilled rather than reused; body-preparation waste feed could substitute a portion of raw material input at nearby brick units (industrial symbiosis candidate).",
      interventions: [
        {
          id: "int-etp-1",
          title: "Waste-to-input match: ETP sludge → nearby brick/block units",
          category: "waste-to-input",
          circularityGainPct: 0.09,
          capexInr: 260000,
          annualSavingInr: 780000,
          co2ReductionTpy: 310,
          paybackMonths: 4,
          confidence: "low",
          description:
            "Two brick/block manufacturing units within 12km of this cluster can use dewatered ceramic sludge as a partial raw-material substitute — flagged as an industrial-symbiosis match by the state aggregation layer.",
        },
      ],
    },
  ],
};

export const demoFactories: Factory[] = [morbiCeramicsFactory];
