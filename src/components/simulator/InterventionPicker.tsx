import { useFactoryStore } from "../../store/useFactoryStore";
import { severityColor, formatInr } from "../../lib/severity";
import type { Factory, Intervention } from "../../types";

const categoryLabel: Record<Intervention["category"], string> = {
  "material-substitution": "Material substitution",
  "waste-to-input": "Waste → input",
  "recycling-loop": "Recycling loop",
  "process-change": "Process change",
  "heat-recovery": "Heat recovery",
};

const confidenceDot: Record<Intervention["confidence"], string> = {
  high: "bg-[color:var(--color-ok)]",
  medium: "bg-[color:var(--color-warn)]",
  low: "bg-[color:var(--color-crit)]",
};

export default function InterventionPicker({ baseline }: { baseline: Factory }) {
  const selected = useFactoryStore((s) => s.selectedInterventionIds);
  const toggle = useFactoryStore((s) => s.toggleIntervention);
  const setAll = useFactoryStore((s) => s.setInterventions);
  const clear = useFactoryStore((s) => s.clearInterventions);
  const select = useFactoryStore((s) => s.select);

  const allIds = baseline.nodes.flatMap((n) => n.interventions.map((i) => i.id));
  const quickWins = baseline.nodes.flatMap((n) => n.interventions.filter((i) => i.paybackMonths <= 12).map((i) => i.id));

  return (
    <div className="glass flex h-full flex-col rounded-xl">
      <div className="border-b border-[color:var(--color-border)] px-4 py-3">
        <h3 className="text-sm font-semibold">Interventions</h3>
        <p className="text-[11px] text-[color:var(--color-muted)]">Toggle any combination — the twin and KPIs update live</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button onClick={() => setAll(quickWins)} className="rounded-md border border-[color:var(--color-border)] px-2 py-1 text-[11px] hover:bg-[color:var(--color-panel-2)]">
            Quick wins (≤12 mo)
          </button>
          <button onClick={() => setAll(allIds)} className="rounded-md border border-[color:var(--color-border)] px-2 py-1 text-[11px] hover:bg-[color:var(--color-panel-2)]">
            Select all
          </button>
          <button onClick={clear} className="rounded-md border border-[color:var(--color-border)] px-2 py-1 text-[11px] text-[color:var(--color-muted)] hover:bg-[color:var(--color-panel-2)]">
            Clear
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {[...baseline.nodes]
          .sort((a, b) => b.shareOfTotal - a.shareOfTotal)
          .map((node) => (
            <div key={node.id} className="border-b border-[color:var(--color-border)]">
              <button
                onClick={() => select(node.id)}
                className="flex w-full items-center gap-2 px-4 pt-3 pb-1 text-left"
                title="Focus this unit on the twin"
              >
                <span className="h-2 w-2 rounded-full" style={{ background: severityColor[node.severity] }} />
                <span className="text-xs font-semibold">{node.label}</span>
                <span className="ml-auto text-[10px] text-[color:var(--color-muted)]">{Math.round(node.shareOfTotal * 100)}% of CO₂e</span>
              </button>

              {node.interventions.map((iv) => {
                const on = selected.has(iv.id);
                return (
                  <label
                    key={iv.id}
                    className={`mx-2 mb-2 flex cursor-pointer gap-2.5 rounded-lg border p-2.5 transition-colors ${
                      on ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10" : "border-[color:var(--color-border)] hover:bg-[color:var(--color-panel-2)]"
                    }`}
                  >
                    <input type="checkbox" checked={on} onChange={() => toggle(iv.id)} className="mt-0.5 accent-[#3ea6ff]" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-medium leading-snug">{iv.title}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Chip>{categoryLabel[iv.category]}</Chip>
                        <Chip>{formatInr(iv.capexInr)}</Chip>
                        <Chip tone="ok">−{iv.co2ReductionTpy} t</Chip>
                        <Chip>{iv.paybackMonths} mo</Chip>
                        <span className="flex items-center gap-1 text-[10px] text-[color:var(--color-muted)]">
                          <span className={`h-1.5 w-1.5 rounded-full ${confidenceDot[iv.confidence]}`} /> {iv.confidence}
                        </span>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          ))}
      </div>
    </div>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone?: "ok" }) {
  return (
    <span
      className={`rounded border px-1.5 py-0.5 text-[10px] ${
        tone === "ok" ? "border-[color:var(--color-ok)]/40 text-[color:var(--color-ok)]" : "border-[color:var(--color-border)] text-[color:var(--color-muted)]"
      }`}
    >
      {children}
    </span>
  );
}
