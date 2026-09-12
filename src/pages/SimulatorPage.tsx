import FactoryTwin from "../components/twin/FactoryTwin";
import InterventionPicker from "../components/simulator/InterventionPicker";
import ImpactPanel from "../components/simulator/ImpactPanel";
import { useFactoryStore } from "../store/useFactoryStore";

export default function SimulatorPage() {
  const baseline = useFactoryStore((s) => s.baseline);
  const simulated = useFactoryStore((s) => s.simulation.factory);
  const count = useFactoryStore((s) => s.selectedInterventionIds.size);

  return (
    <main className="flex flex-1 flex-col gap-3 overflow-hidden p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">What-if simulator</h2>
          <p className="text-[12px] text-[color:var(--color-muted)]">
            Combine circular interventions and watch the plant respond — smoke thins, hotspots cool, KPIs recompute.
          </p>
        </div>
        <span className="rounded-full border border-[color:var(--color-border)] px-3 py-1 text-[11px] text-[color:var(--color-muted)]">
          {count === 0 ? "Baseline" : `Scenario · ${count} selected`}
        </span>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-3 overflow-hidden lg:grid-cols-[330px_1fr_380px]">
        <div className="overflow-hidden">
          <InterventionPicker baseline={baseline} />
        </div>
        <div className="glass overflow-hidden rounded-xl">
          <FactoryTwin factory={simulated} />
        </div>
        <div className="overflow-hidden">
          <ImpactPanel baseline={baseline} />
        </div>
      </div>
    </main>
  );
}
