import { create } from "zustand";
import type { Factory } from "../types";
import { simulate, type SimulationResult } from "../lib/simulator";
import { api } from "../lib/api";
import { adaptFactory, adaptClusterNameMap } from "../lib/apiAdapter";

interface FactoryState {
  factories: Factory[];
  baseline: Factory;
  loading: boolean;
  loadError: string | null;
  hydrated: boolean;
  load: () => Promise<void>;

  setFactory: (id: string) => void;
  addFactory: (f: Factory) => void;
  updateFactory: (f: Factory) => void;

  selectedNodeId: string | null;
  select: (id: string | null) => void;

  // what-if simulator
  selectedInterventionIds: Set<string>;
  simulation: SimulationResult;
  toggleIntervention: (id: string) => void;
  setInterventions: (ids: string[]) => void;
  clearInterventions: () => void;
}

const EMPTY_FACTORY: Factory = {
  id: "", name: "", sector: "", cluster: "", outputTonnesPerMonth: 0, totalCo2eTpy: 0,
  totalEnergyMwhPerYear: 0, totalWasteTpy: 0, circularityRatio: 0, dataSource: "synthetic",
  nodes: [], lat: 0, lon: 0, wasteStreams: [], acceptedInputs: [], implementedInterventionIds: [],
  consentToShare: true,
};

export const useFactoryStore = create<FactoryState>((set, get) => ({
  factories: [],
  baseline: EMPTY_FACTORY,
  loading: false,
  loadError: null,
  hydrated: false,

  load: async () => {
    if (get().loading || get().hydrated) return;
    set({ loading: true, loadError: null });
    try {
      const [clusters, apiFactories] = await Promise.all([api.clusters(), api.factories()]);
      const clusterNameById = adaptClusterNameMap(clusters);
      const factories = apiFactories.map((f) => adaptFactory(f, clusterNameById));
      const initial = factories[0] ?? EMPTY_FACTORY;
      set({
        factories, baseline: initial, loading: false, hydrated: true,
        simulation: simulate(initial, new Set()),
      });
    } catch (err) {
      set({ loading: false, loadError: err instanceof Error ? err.message : String(err) });
    }
  },

  setFactory: (id) => {
    const f = get().factories.find((x) => x.id === id);
    if (!f || f.id === get().baseline.id) return;
    set({ baseline: f, selectedNodeId: null, selectedInterventionIds: new Set(), simulation: simulate(f, new Set()) });
  },

  // Onboarding a factory through the Intake page still runs the deterministic
  // client-side engine (src/lib/engine.ts) and keeps it in local store state
  // only — it is not yet persisted to the backend. Wiring IntakePage to
  // POST /api/factories (backend/app/routers/onboarding.py, already built and
  // tested) is the next step; tracked in the induscope_build_plan memory.
  addFactory: (f) => set({ factories: [...get().factories, f], baseline: f, selectedNodeId: null, selectedInterventionIds: new Set(), simulation: simulate(f, new Set()) }),
  updateFactory: (f) => set({
    factories: get().factories.map((x) => x.id === f.id ? f : x),
    baseline: f,
    selectedNodeId: null,
    selectedInterventionIds: new Set(),
    simulation: simulate(f, new Set()),
  }),

  selectedNodeId: null,
  select: (id) => set({ selectedNodeId: id }),

  selectedInterventionIds: new Set(),
  simulation: simulate(EMPTY_FACTORY, new Set()),
  toggleIntervention: (id) => {
    const next = new Set(get().selectedInterventionIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    set({ selectedInterventionIds: next, simulation: simulate(get().baseline, next) });
  },
  setInterventions: (ids) => {
    const next = new Set(ids);
    set({ selectedInterventionIds: next, simulation: simulate(get().baseline, next) });
  },
  clearInterventions: () => set({ selectedInterventionIds: new Set(), simulation: simulate(get().baseline, new Set()) }),
}));
