import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Factory } from "../types";
import { simulate, type SimulationResult } from "../lib/simulator";
import type { SymbiosisMatch } from "../lib/symbiosis";
import { api } from "../lib/api";
import { adaptFactory, adaptClusterNameMap, adaptSymbiosisMatch } from "../lib/apiAdapter";

interface FactoryState {
  factories: Factory[];
  baseline: Factory;
  symbiosisMatches: SymbiosisMatch[];
  clusterNameById: Record<string, string>;
  loading: boolean;
  loadError: string | null;
  hydrated: boolean;
  load: () => Promise<void>;

  // Persisted (localStorage) so a page refresh mid-demo re-selects the same
  // factory once `factories` re-loads from the API — see `load()` below,
  // which is the only place this drives `baseline` back to life.
  selectedFactoryId: string | null;

  setFactory: (id: string) => void;
  addFactory: (f: Factory) => void;
  updateFactory: (f: Factory) => void;
  refreshFactoryFromApi: (id: string) => Promise<void>;

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

interface PersistedSlice {
  selectedFactoryId: string | null;
  selectedNodeId: string | null;
  selectedInterventionIds: string[];
}

export const useFactoryStore = create<FactoryState>()(
  persist(
    (set, get) => ({
      factories: [],
      baseline: EMPTY_FACTORY,
      symbiosisMatches: [],
      clusterNameById: {},
      loading: false,
      loadError: null,
      hydrated: false,
      selectedFactoryId: null,

      load: async () => {
        if (get().loading || get().hydrated) return;
        set({ loading: true, loadError: null });
        try {
          const [clusters, apiFactories, apiMatches] = await Promise.all([
            api.clusters(), api.factories(), api.symbiosisNetwork(),
          ]);
          const clusterNameById = adaptClusterNameMap(clusters);
          const factories = apiFactories.map((f) => adaptFactory(f, clusterNameById));
          const consentById = Object.fromEntries(factories.map((f) => [f.id, f.consentToShare]));
          const symbiosisMatches = apiMatches.map((m) => adaptSymbiosisMatch(m, consentById));

          // Re-select whatever factory localStorage remembered from before the
          // refresh, if it still exists in this fresh fetch — otherwise fall
          // back to the first factory, same as a first-ever load.
          const restoredId = get().selectedFactoryId;
          const initial = (restoredId && factories.find((f) => f.id === restoredId)) || factories[0] || EMPTY_FACTORY;

          // Persisted intervention ids may reference nodes that belonged to a
          // *different* factory (or a node that no longer exists) — simulate()
          // silently no-ops on unknown ids, so this is safe even when stale.
          const restoredInterventionIds = get().selectedInterventionIds;

          set({
            factories, baseline: initial, symbiosisMatches, clusterNameById, loading: false, hydrated: true,
            selectedFactoryId: initial.id,
            simulation: simulate(initial, restoredInterventionIds),
          });
        } catch (err) {
          set({ loading: false, loadError: err instanceof Error ? err.message : String(err) });
        }
      },

      // Fetches one factory fresh from the backend (used right after a real
      // POST /api/factories onboarding call) and merges it into local state —
      // avoids re-fetching the whole 120-factory list for one new/changed row.
      refreshFactoryFromApi: async (id: string) => {
        const apiFactory = await api.factory(id);
        const f = adaptFactory(apiFactory, get().clusterNameById);
        const exists = get().factories.some((x) => x.id === f.id);
        set({
          factories: exists ? get().factories.map((x) => (x.id === f.id ? f : x)) : [...get().factories, f],
          baseline: f, selectedFactoryId: f.id, selectedNodeId: null, selectedInterventionIds: new Set(),
          simulation: simulate(f, new Set()),
        });
      },

      setFactory: (id) => {
        const f = get().factories.find((x) => x.id === id);
        if (!f || f.id === get().baseline.id) return;
        set({ baseline: f, selectedFactoryId: f.id, selectedNodeId: null, selectedInterventionIds: new Set(), simulation: simulate(f, new Set()) });
      },

      // Creating a NEW factory now goes through the real backend (see
      // src/lib/onboardingAdapter.ts + refreshFactoryFromApi above) — IntakePage
      // calls api.onboardFactory() then refreshFactoryFromApi(), not addFactory().
      // addFactory/updateFactory remain for EDITING an already-onboarded factory,
      // which still runs the local client-side engine (src/lib/engine.ts) only —
      // there is no PATCH /api/factories/{id} endpoint yet to persist an edit,
      // so this one gap remains local-only. Tracked in induscope_build_plan memory.
      addFactory: (f) => set({ factories: [...get().factories, f], baseline: f, selectedFactoryId: f.id, selectedNodeId: null, selectedInterventionIds: new Set(), simulation: simulate(f, new Set()) }),
      updateFactory: (f) => set({
        factories: get().factories.map((x) => x.id === f.id ? f : x),
        baseline: f,
        selectedFactoryId: f.id,
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
    }),
    {
      name: "induscope-factory-store",
      storage: createJSONStorage(() => localStorage),
      // Only the demo-continuity slice persists — `factories`/`baseline`/
      // `symbiosisMatches` stay API-sourced every load() so a refresh never
      // shows stale data, just the same *selection* the user had before.
      partialize: (state): PersistedSlice => ({
        selectedFactoryId: state.selectedFactoryId,
        selectedNodeId: state.selectedNodeId,
        selectedInterventionIds: Array.from(state.selectedInterventionIds),
      }),
      merge: (persisted, current) => {
        const p = persisted as PersistedSlice | undefined;
        return {
          ...current,
          selectedFactoryId: p?.selectedFactoryId ?? current.selectedFactoryId,
          selectedNodeId: p?.selectedNodeId ?? current.selectedNodeId,
          selectedInterventionIds: new Set(p?.selectedInterventionIds ?? []),
        };
      },
    }
  )
);
