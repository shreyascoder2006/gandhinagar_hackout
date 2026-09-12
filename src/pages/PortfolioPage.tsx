import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFactoryStore } from "../store/useFactoryStore";
import { severityColor } from "../lib/severity";
import type { Factory, Severity } from "../types";

type SortKey = "co2" | "deviation" | "hotspots" | "avoidable";

function deviationPct(f: Factory): number {
  const w = f.nodes.reduce((a, n) => a + n.co2eTpy, 0) || 1;
  return Math.round((f.nodes.reduce((a, n) => a + ((n.actualIntensity - n.benchmarkIntensity) / n.benchmarkIntensity) * n.co2eTpy, 0) / w) * 100);
}
function avoidable(f: Factory): number {
  return f.nodes.reduce((a, n) => a + ([...n.interventions].sort((x, y) => y.co2ReductionTpy - x.co2ReductionTpy)[0]?.co2ReductionTpy ?? 0), 0);
}
function worst(f: Factory): Severity {
  if (f.nodes.some((n) => n.severity === "crit")) return "crit";
  if (f.nodes.some((n) => n.severity === "warn")) return "warn";
  return "ok";
}

export default function PortfolioPage() {
  const factories = useFactoryStore((s) => s.factories);
  const current = useFactoryStore((s) => s.baseline);
  const setFactory = useFactoryStore((s) => s.setFactory);
  const navigate = useNavigate();
  const [sort, setSort] = useState<SortKey>("avoidable");
  const [cluster, setCluster] = useState<string>("all");

  const rows = useMemo(() => {
    const r = factories
      .filter((f) => cluster === "all" || f.cluster.startsWith(cluster))
      .map((f) => ({ f, dev: deviationPct(f), hot: f.nodes.filter((n) => n.severity === "crit").length, avoid: avoidable(f), sev: worst(f) }));
    const key = { co2: (x: (typeof r)[0]) => x.f.totalCo2eTpy, deviation: (x: (typeof r)[0]) => x.dev, hotspots: (x: (typeof r)[0]) => x.hot, avoidable: (x: (typeof r)[0]) => x.avoid }[sort];
    return r.sort((a, b) => key(b) - key(a));
  }, [factories, sort, cluster]);

  const clusters = [...new Set(factories.map((f) => f.cluster.split(",")[0]))];
  const totalAvoid = rows.reduce((a, r) => a + r.avoid, 0);

  const open = (id: string) => {
    setFactory(id);
    navigate("/");
  };

  return (
    <main className="flex flex-1 flex-col gap-3 overflow-hidden p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Consultant portfolio</h2>
          <p className="text-[12px] text-[color:var(--color-muted)]">Every client factory through the same diagnostic engine. Click a row to open its twin.</p>
        </div>
        <div className="flex gap-2 text-[12px]">
          <select value={cluster} onChange={(e) => setCluster(e.target.value)} className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-panel)] px-2 py-1">
            <option value="all">All clusters</option>
            {clusters.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-panel)] px-2 py-1">
            <option value="avoidable">Sort: avoidable CO₂e</option>
            <option value="deviation">Sort: deviation</option>
            <option value="hotspots">Sort: hotspots</option>
            <option value="co2">Sort: total CO₂e</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Factories", String(rows.length)],
          ["Portfolio CO₂e / yr", `${rows.reduce((a, r) => a + r.f.totalCo2eTpy, 0).toLocaleString("en-IN")} t`],
          ["Avoidable CO₂e / yr", `${totalAvoid.toLocaleString("en-IN")} t`],
          ["Hotspot processes", String(rows.reduce((a, r) => a + r.hot, 0))],
        ].map(([k, v]) => (
          <div key={k} className="glass rounded-xl px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide text-[color:var(--color-muted)]">{k}</div>
            <div className="text-lg font-semibold">{v}</div>
          </div>
        ))}
      </div>

      <div className="glass flex-1 overflow-auto rounded-xl">
        <table className="w-full text-[12px]">
          <thead className="sticky top-0 bg-[color:var(--color-panel)] text-[11px] uppercase tracking-wide text-[color:var(--color-muted)]">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Factory</th>
              <th className="px-3 py-2.5 text-left font-medium">Cluster · sector</th>
              <th className="px-3 py-2.5 text-right font-medium">CO₂e / yr</th>
              <th className="px-3 py-2.5 text-right font-medium">vs benchmark</th>
              <th className="px-3 py-2.5 text-right font-medium">Hotspots</th>
              <th className="px-3 py-2.5 text-right font-medium">Avoidable</th>
              <th className="px-3 py-2.5 text-right font-medium">Circularity</th>
              <th className="px-3 py-2.5 text-right font-medium">Implemented</th>
              <th className="px-3 py-2.5 text-left font-medium">Data</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ f, dev, hot, avoid, sev }) => (
              <tr
                key={f.id}
                onClick={() => open(f.id)}
                className={`cursor-pointer border-t border-[color:var(--color-border)] hover:bg-[color:var(--color-panel-2)]/60 ${f.id === current.id ? "bg-[color:var(--color-panel-2)]/80" : ""}`}
              >
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: severityColor[sev], boxShadow: `0 0 6px ${severityColor[sev]}` }} />
                    <span className="font-medium">{f.name}</span>
                    {f.id === current.id && <span className="rounded border border-[color:var(--color-accent)]/50 px-1 text-[9px] uppercase text-[color:var(--color-accent)]">active</span>}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-[color:var(--color-muted)]">{f.cluster.split(",")[0]} · {f.sector}</td>
                <td className="px-3 py-2.5 text-right">{f.totalCo2eTpy.toLocaleString("en-IN")} t</td>
                <td className="px-3 py-2.5 text-right" style={{ color: severityColor[dev < 10 ? "ok" : dev < 30 ? "warn" : "crit"] }}>{dev > 0 ? "+" : ""}{dev}%</td>
                <td className="px-3 py-2.5 text-right">{hot} / {f.nodes.length}</td>
                <td className="px-3 py-2.5 text-right font-semibold">{avoid.toLocaleString("en-IN")} t</td>
                <td className="px-3 py-2.5 text-right">{Math.round(f.circularityRatio * 100)}%</td>
                <td className="px-3 py-2.5 text-right">{f.implementedInterventionIds.length}</td>
                <td className="px-3 py-2.5">
                  <span className="rounded-full border border-[color:var(--color-warn)]/50 px-1.5 py-0.5 text-[10px] text-[color:var(--color-warn)]">{f.dataSource}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
