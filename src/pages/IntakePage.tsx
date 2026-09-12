import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useFactoryStore } from "../store/useFactoryStore";
import { clusters } from "../data/clusters";
import { sectorTemplates } from "../data/factories";
import { emissionFactors } from "../data/emissionFactors";
import { buildFactory, parseCsv, CSV_TEMPLATE, type Activity, type IntakeProfile, type Issue } from "../lib/engine";
import { severityColor, severityLabel } from "../lib/severity";

type Tab = "form" | "csv";
type Row = { process: string; fuel: string; quantity: string; unit: string };

const inputCls = "w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-panel-2)] px-2.5 py-1.5 text-sm outline-none focus:border-[color:var(--color-accent)]";
const labelCls = "mb-1 block text-[11px] uppercase tracking-wide text-[color:var(--color-muted)]";

const EXAMPLE: IntakeProfile = { name: "Kalash Vitrified (new)", clusterId: "morbi", sector: "Ceramics", subSector: "Vitrified tiles", outputTonnesPerMonth: 3600, wasteTpy: 1800, recoveredTpy: 380, consentToShare: true };
const EXAMPLE_ROWS: Row[] = [
  { process: "kiln", fuel: "natural_gas", quantity: "4900000", unit: "SCM" },
  { process: "dryer", fuel: "natural_gas", quantity: "2000000", unit: "SCM" },
  { process: "compressor", fuel: "grid_electricity", quantity: "2450", unit: "MWh" },
  { process: "glaze", fuel: "grid_electricity", quantity: "1900", unit: "MWh" },
  { process: "etp", fuel: "grid_electricity", quantity: "2250", unit: "MWh" },
];

export default function IntakePage() {
  const addFactory = useFactoryStore((s) => s.addFactory);
  const updateFactory = useFactoryStore((s) => s.updateFactory);
  const factories = useFactoryStore((s) => s.factories);
  const navigate = useNavigate();
  const { factoryId } = useParams();
  const editing = factories.find((f) => f.id === factoryId && f.dataSource !== "synthetic");
  const [tab, setTab] = useState<Tab>("form");
  const [profile, setProfile] = useState<IntakeProfile>({ name: "", clusterId: "morbi", sector: "Ceramics", subSector: "", outputTonnesPerMonth: 0, wasteTpy: 0, recoveredTpy: 0, consentToShare: true });
  const [rows, setRows] = useState<Row[]>([{ process: "", fuel: "grid_electricity", quantity: "", unit: "kWh" }]);
  const [csvText, setCsvText] = useState("");
  const [csvIssues, setCsvIssues] = useState<Issue[]>([]);
  const [csvActs, setCsvActs] = useState<Activity[] | null>(null);
  const [layout, setLayout] = useState<Record<string, [number, number, number]>>({});

  // Submitted factory inputs are kept with the model, so this editor always starts
  // from the values that produced the currently displayed carbon baseline.
  useEffect(() => {
    if (!editing?.intakeProfile || !editing.sourceActivities) return;
    setProfile({
      name: editing.name,
      clusterId: editing.intakeProfile.clusterId,
      sector: editing.intakeProfile.sector as IntakeProfile["sector"],
      subSector: editing.intakeProfile.subSector,
      outputTonnesPerMonth: editing.intakeProfile.outputTonnesPerMonth,
      wasteTpy: editing.intakeProfile.wasteTpy,
      recoveredTpy: editing.intakeProfile.recoveredTpy,
      consentToShare: editing.consentToShare,
    });
    setRows(editing.sourceActivities.map((a) => ({ process: a.process, fuel: a.fuel, quantity: String(a.quantity), unit: a.unit })));
    setLayout(editing.layoutOverrides ?? Object.fromEntries(editing.nodes.map((n) => [n.id.split(":").pop()!, n.position])));
    setTab("form");
  }, [editing?.id]);

  const tpl = sectorTemplates[profile.sector];
  const set = <K extends keyof IntakeProfile>(k: K, v: IntakeProfile[K]) => setProfile((p) => ({ ...p, [k]: v }));

  const formActivities: Activity[] = rows.filter((r) => r.process && r.quantity !== "").map((r) => ({ process: r.process, fuel: r.fuel, quantity: Number(r.quantity), unit: r.unit }));
  const activities = tab === "csv" ? csvActs ?? [] : formActivities;

  const preview = useMemo(() => {
    if (!profile.name || profile.outputTonnesPerMonth <= 0 || activities.length === 0) return null;
    return buildFactory(profile, activities, "preview", layout);
  }, [profile, activities, layout]);

  const profileErrors: string[] = [];
  if (!profile.name.trim()) profileErrors.push("Factory name is required");
  if (profile.outputTonnesPerMonth <= 0) profileErrors.push("Monthly output must be > 0 (intensity metrics need it)");
  if (profile.recoveredTpy > profile.wasteTpy) profileErrors.push("Recovered material cannot exceed total waste");
  const blocking = profileErrors.length > 0 || activities.length === 0 || (preview?.issues.some((i) => i.level === "error") ?? false);

  const parseCsvNow = (text: string) => {
    setCsvText(text);
    const grid = parseCsv(text);
    if (grid.length < 2) { setCsvIssues([{ row: 0, level: "error", message: "Need a header row and at least one data row." }]); setCsvActs(null); return; }
    const header = grid[0].map((h) => h.trim().toLowerCase());
    const col = (n: string) => header.indexOf(n);
    const need = ["process", "fuel", "quantity", "unit"];
    const missing = need.filter((n) => col(n) < 0);
    if (missing.length) { setCsvIssues([{ row: 0, level: "error", message: `Missing column(s): ${missing.join(", ")}. Expected header: process,fuel,quantity,unit[,month]` }]); setCsvActs(null); return; }
    const acts: Activity[] = grid.slice(1).map((r) => ({
      process: (r[col("process")] ?? "").trim().toLowerCase(),
      fuel: (r[col("fuel")] ?? "").trim().toLowerCase(),
      quantity: Number((r[col("quantity")] ?? "").replace(/[, ]/g, "")),
      unit: (r[col("unit")] ?? "").trim(),
      month: col("month") >= 0 ? (r[col("month")] ?? "").trim() || undefined : undefined,
    }));
    setCsvActs(acts);
    setCsvIssues([{ row: 0, level: "warn", message: `Parsed ${acts.length} rows · columns detected: ${header.join(", ")}` }]);
  };

  const submit = () => {
    if (!preview || blocking) return;
    const { factory } = buildFactory(profile, activities, editing?.id, layout);
    if (editing) updateFactory(factory);
    else addFactory(factory);
    navigate("/");
  };

  const issues = [...csvIssues, ...(preview?.issues ?? [])];

  return (
    <main className="flex flex-1 flex-col gap-3 overflow-hidden p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{editing ? `Edit ${editing.name}` : "Factory intake"}</h2>
          <p className="text-[12px] text-[color:var(--color-muted)]">{editing ? "Change components, energy lines or production details. Every edit recalculates the factory twin, diagnosis and regulator rollup." : "Enter energy by process or upload a bill/ERP export — the deterministic engine computes CO₂e, intensity and benchmark gaps on submit."}</p>
        </div>
        <button onClick={() => { setProfile(EXAMPLE); setRows(EXAMPLE_ROWS); setTab("form"); }} className="rounded-lg border border-[color:var(--color-border)] px-3 py-1.5 text-xs hover:bg-[color:var(--color-panel-2)]">
          Load example factory
        </button>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-3 overflow-hidden lg:grid-cols-[1fr_380px]">
        <div className="glass flex flex-col overflow-y-auto rounded-xl p-4">
          {/* Step 1 — profile */}
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">1 · Profile</h3>
          <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-3">
            <div className="col-span-2 md:col-span-1"><label className={labelCls}>Factory name</label><input className={inputCls} value={profile.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Kalash Vitrified" /></div>
            <div><label className={labelCls}>Cluster</label><select className={inputCls} value={profile.clusterId} onChange={(e) => set("clusterId", e.target.value)}>{clusters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><label className={labelCls}>Sector</label><select className={inputCls} value={profile.sector} onChange={(e) => { set("sector", e.target.value as IntakeProfile["sector"]); setRows([{ process: "", fuel: "grid_electricity", quantity: "", unit: "kWh" }]); setLayout({}); }}>{Object.keys(sectorTemplates).map((s) => <option key={s}>{s}</option>)}</select></div>
            <div><label className={labelCls}>Sub-sector / product</label><input className={inputCls} value={profile.subSector} onChange={(e) => set("subSector", e.target.value)} placeholder="Vitrified tiles" /></div>
            <div><label className={labelCls}>Output (t / month)</label><input type="number" className={inputCls} value={profile.outputTonnesPerMonth || ""} onChange={(e) => set("outputTonnesPerMonth", Number(e.target.value))} /></div>
            <div><label className={labelCls}>Waste generated (t / yr)</label><input type="number" className={inputCls} value={profile.wasteTpy || ""} onChange={(e) => set("wasteTpy", Number(e.target.value))} /></div>
            <div><label className={labelCls}>Of which recovered / reused (t / yr)</label><input type="number" className={inputCls} value={profile.recoveredTpy || ""} onChange={(e) => set("recoveredTpy", Number(e.target.value))} /></div>
            <label className="col-span-2 flex items-center gap-2 text-[12px] md:col-span-1"><input type="checkbox" checked={profile.consentToShare} onChange={(e) => set("consentToShare", e.target.checked)} className="accent-[#3ea6ff]" /> Consent to be named in symbiosis matches</label>
          </div>
          {profileErrors.length > 0 && <ul className="mt-2 text-[11px] text-[color:var(--color-crit)]">{profileErrors.map((e) => <li key={e}>• {e}</li>)}</ul>}

          {/* Step 2 — energy */}
          <div className="mt-5 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">2 · Energy by process (annual)</h3>
            <div className="flex gap-1 rounded-md border border-[color:var(--color-border)] p-0.5 text-[11px]">
              {(["form", "csv"] as Tab[]).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={`rounded px-2 py-1 ${tab === t ? "bg-[color:var(--color-panel-2)]" : "text-[color:var(--color-muted)]"}`}>{t === "form" ? "Guided form" : "CSV / bill upload"}</button>
              ))}
            </div>
          </div>

          {tab === "form" ? (
            <div className="mt-2">
              {rows.map((r, i) => (
                <div key={i} className="mb-2 grid grid-cols-[1.4fr_1.4fr_1fr_0.8fr_auto] gap-2">
                  <select className={inputCls} value={r.process} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, process: e.target.value } : x)))}>
                    <option value="">Process…</option>
                    {tpl.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                  <select className={inputCls} value={r.fuel} onChange={(e) => { const ef = emissionFactors.find((f) => f.key === e.target.value)!; setRows((rs) => rs.map((x, j) => (j === i ? { ...x, fuel: ef.key, unit: ef.canonicalUnit } : x))); }}>
                    {emissionFactors.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                  <input type="number" className={inputCls} placeholder="Quantity" value={r.quantity} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} />
                  <select className={inputCls} value={r.unit} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))}>
                    {Object.keys(emissionFactors.find((f) => f.key === r.fuel)!.units).map((u) => <option key={u}>{u}</option>)}
                  </select>
                  <button onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} className="rounded-md border border-[color:var(--color-border)] px-2 text-[color:var(--color-muted)] hover:text-[color:var(--color-crit)]">×</button>
                </div>
              ))}
              <button onClick={() => setRows((rs) => [...rs, { process: "", fuel: "grid_electricity", quantity: "", unit: "kWh" }])} className="rounded-md border border-dashed border-[color:var(--color-border)] px-3 py-1.5 text-[11px] text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]">+ Add energy line</button>
            </div>
          ) : (
            <div className="mt-2">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <label className="cursor-pointer rounded-md border border-[color:var(--color-border)] px-3 py-1.5 hover:bg-[color:var(--color-panel-2)]">
                  Choose CSV file
                  <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) f.text().then(parseCsvNow); }} />
                </label>
                <button onClick={() => parseCsvNow(CSV_TEMPLATE)} className="rounded-md border border-[color:var(--color-border)] px-3 py-1.5 hover:bg-[color:var(--color-panel-2)]">Use sample (6 months, with an April spike)</button>
                <span className="text-[color:var(--color-muted)]">Columns: <code>process, fuel, quantity, unit[, month]</code> · process ids for {profile.sector}: {tpl.map((t) => t.id).join(", ")}</span>
              </div>
              <textarea className={`${inputCls} mt-2 h-40 font-mono text-[11px]`} placeholder="…or paste CSV here" value={csvText} onChange={(e) => parseCsvNow(e.target.value)} />
            </div>
          )}

          {issues.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Validation report</h3>
              <ul className="mt-1 space-y-0.5 text-[11px]">
                {issues.map((i, k) => (
                  <li key={k} className={i.level === "error" ? "text-[color:var(--color-crit)]" : "text-[color:var(--color-warn)]"}>
                    {i.row > 0 ? `Row ${i.row}: ` : ""}{i.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {editing && (
            <div className="mt-5 border-t border-[color:var(--color-border)] pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">3 · Schematic layout</h3>
              <p className="mt-1 text-[11px] text-[color:var(--color-muted)]">Reposition each process component in the 3D twin. Energy lines above control whether the component contributes emissions; positions control only the visual layout.</p>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {tpl.map((component) => {
                  const position = layout[component.id] ?? component.position;
                  const updatePosition = (axis: 0 | 2, value: number) => setLayout((old) => ({ ...old, [component.id]: [axis === 0 ? value : position[0], 0, axis === 2 ? value : position[2]] }));
                  return <div key={component.id} className="rounded-lg border border-[color:var(--color-border)] p-2.5">
                    <div className="mb-2 text-xs font-medium">{component.label}</div>
                    <label className="flex items-center gap-2 text-[10px] text-[color:var(--color-muted)]">Left / right <input className="flex-1 accent-[#3ea6ff]" type="range" min={-8} max={8} step={0.5} value={position[0]} onChange={(e) => updatePosition(0, Number(e.target.value))} /><span className="w-7 text-right">{position[0]}</span></label>
                    <label className="mt-1 flex items-center gap-2 text-[10px] text-[color:var(--color-muted)]">Front / back <input className="flex-1 accent-[#3ea6ff]" type="range" min={-6} max={6} step={0.5} value={position[2]} onChange={(e) => updatePosition(2, Number(e.target.value))} /><span className="w-7 text-right">{position[2]}</span></label>
                  </div>;
                })}
              </div>
            </div>
          )}
        </div>

        {/* live preview */}
        <div className="glass flex flex-col overflow-y-auto rounded-xl p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Live diagnosis preview</h3>
          {!preview ? (
            <p className="mt-6 text-center text-[12px] text-[color:var(--color-muted)]">Fill the profile and at least one energy line to see the computed baseline.</p>
          ) : (
            <>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {[
                  ["CO₂e / yr", `${preview.factory.totalCo2eTpy.toLocaleString("en-IN")} t`],
                  ["Energy / yr", `${preview.factory.totalEnergyMwhPerYear.toLocaleString("en-IN")} MWh`],
                  ["Circularity", `${Math.round(preview.factory.circularityRatio * 100)}%`],
                  ["Hotspots", `${preview.factory.nodes.filter((n) => n.severity === "crit").length} of ${preview.factory.nodes.length}`],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg border border-[color:var(--color-border)] p-2.5"><div className="text-[10px] text-[color:var(--color-muted)]">{k}</div><div className="text-sm font-semibold">{v}</div></div>
                ))}
              </div>
              <div className="mt-3 space-y-1.5">
                {preview.factory.nodes.map((n) => (
                  <div key={n.id} className="flex items-center justify-between rounded-lg border border-[color:var(--color-border)] px-2.5 py-1.5 text-[11px]">
                    <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: severityColor[n.severity] }} />{n.label}</span>
                    <span className="text-[color:var(--color-muted)]">{n.actualIntensity} vs {n.benchmarkIntensity} kg/t · {severityLabel[n.severity]}{n.monthly?.some((m) => m.anomaly) ? " · ⚠ anomaly" : ""}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-[10px] text-[color:var(--color-muted)]">
                Method: quantity × emission factor (CEA / IPCC / MoEFCC, see Methodology) → kgCO₂e per tonne of output → vs ASI/BEE sub-sector benchmark. Self-reported data: high confidence (85–95%).
              </div>
              <button onClick={submit} disabled={blocking} className="mt-4 rounded-lg bg-[color:var(--color-accent)] px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40">
                {editing ? "Save changes & refresh diagnosis" : "Create factory & open diagnosis"}
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
