import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import CountUp from "./CountUp";
import { useFactoryStore } from "../../store/useFactoryStore";
import { formatInr, confidenceLabel, severityColor } from "../../lib/severity";
import type { Factory } from "../../types";

function Stat({ label, before, after, unit, better = "lower" }: { label: string; before: number; after: number; unit: string; better?: "lower" | "higher" }) {
  const delta = after - before;
  const improved = better === "lower" ? delta < 0 : delta > 0;
  const pct = before !== 0 ? Math.round((delta / before) * 100) : 0;
  return (
    <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-panel-2)] p-3">
      <div className="text-[10px] uppercase tracking-wide text-[color:var(--color-muted)]">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-2">
        <CountUp value={after} className="text-xl font-semibold" />
        <span className="text-[11px] text-[color:var(--color-muted)]">{unit}</span>
      </div>
      <div className="mt-0.5 flex items-center gap-2 text-[11px]">
        <span className="text-[color:var(--color-muted)] line-through">{before.toLocaleString("en-IN")}</span>
        {delta !== 0 && (
          <span className={improved ? "text-[color:var(--color-ok)]" : "text-[color:var(--color-crit)]"}>
            {delta > 0 ? "+" : ""}
            {pct}%
          </span>
        )}
      </div>
    </div>
  );
}

export default function ImpactPanel({ baseline }: { baseline: Factory }) {
  const sim = useFactoryStore((s) => s.simulation);
  const after = sim.factory;
  const t = sim.totals;

  const chart = baseline.nodes.map((n) => {
    const a = after.nodes.find((x) => x.id === n.id)!;
    return { name: n.label.replace(" Line 1", "").replace("Effluent Treatment Plant", "ETP"), before: n.co2eTpy, after: a.co2eTpy, sev: a.severity };
  });

  return (
    <div className="glass flex h-full flex-col overflow-y-auto rounded-xl p-4">
      <h3 className="text-sm font-semibold">Combined impact</h3>
      <p className="text-[11px] text-[color:var(--color-muted)]">
        {sim.applied.length === 0 ? "No interventions selected — showing baseline" : `${sim.applied.length} intervention${sim.applied.length > 1 ? "s" : ""} applied sequentially on residual`}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stat label="Annual CO₂e" before={baseline.totalCo2eTpy} after={after.totalCo2eTpy} unit="t/yr" />
        <Stat label="Energy" before={baseline.totalEnergyMwhPerYear} after={after.totalEnergyMwhPerYear} unit="MWh/yr" />
        <Stat label="Waste" before={baseline.totalWasteTpy} after={after.totalWasteTpy} unit="t/yr" />
        <Stat label="Circularity" before={Math.round(baseline.circularityRatio * 100)} after={Math.round(after.circularityRatio * 100)} unit="%" better="higher" />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-[color:var(--color-border)] p-2.5 text-center">
          <div className="text-[10px] text-[color:var(--color-muted)]">Total CAPEX</div>
          <div className="text-sm font-semibold">
            <CountUp value={t.capexInr} format={formatInr} />
          </div>
        </div>
        <div className="rounded-lg border border-[color:var(--color-border)] p-2.5 text-center">
          <div className="text-[10px] text-[color:var(--color-muted)]">Saving / yr</div>
          <div className="text-sm font-semibold text-[color:var(--color-ok)]">
            <CountUp value={t.annualSavingInr} format={formatInr} />
          </div>
        </div>
        <div className="rounded-lg border border-[color:var(--color-border)] p-2.5 text-center">
          <div className="text-[10px] text-[color:var(--color-muted)]">Blended payback</div>
          <div className="text-sm font-semibold">{t.blendedPaybackMonths === null ? "—" : `${t.blendedPaybackMonths} mo`}</div>
        </div>
      </div>

      <div className="mt-4">
        <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">CO₂e by process — before vs after</h4>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 4, right: 4, left: -18, bottom: 0 }} barGap={2}>
              <XAxis dataKey="name" tick={{ fill: "#8590a8", fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
              <YAxis tick={{ fill: "#8590a8", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                contentStyle={{ background: "#10151f", border: "1px solid #232b3d", borderRadius: 8, fontSize: 11 }}
                formatter={(v, k) => [`${Number(v ?? 0).toLocaleString("en-IN")} t`, k === "before" ? "Baseline" : "Simulated"]}
              />
              <Bar dataKey="before" fill="#2a3550" radius={[3, 3, 0, 0]} />
              <Bar dataKey="after" radius={[3, 3, 0, 0]}>
                {chart.map((d) => (
                  <Cell key={d.name} fill={severityColor[d.sev]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-dashed border-[color:var(--color-border)] p-2.5 text-[11px] text-[color:var(--color-muted)]">
        <span className="font-medium text-[color:var(--color-text)]">Modelled scenario.</span> Result confidence = lowest input:{" "}
        {confidenceLabel[t.confidence]}. Savings apply sequentially on the residual, never additively.
      </div>
    </div>
  );
}
