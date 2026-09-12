import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useFactoryStore } from "../store/useFactoryStore";
import { useRoleStore } from "../store/useRoleStore";
import { buildActionPlan } from "../lib/actionplan";
import { formatInr, severityColor, severityLabel } from "../lib/severity";
import { api } from "../lib/api";

// One-click shareable decarbonization report — the artifact an SME owner
// actually takes to a bank or board, not just something they looked at on a
// dashboard. "Download" is the browser's native print-to-PDF (no server-side
// PDF dependency needed); the URL itself is shareable within this session's
// frontend+backend since the page re-fetches the factory from the store,
// which resolves the exact same data GET /api/factories/{id} would.

function PrintButton() {
  const tier = useRoleStore((s) => s.tier);
  const organizationId = useRoleStore((s) => s.organizationId);
  const setTier = useRoleStore((s) => s.setTier);
  const [upgrading, setUpgrading] = useState(false);

  if (tier === "pro") {
    return (
      <button onClick={() => window.print()} className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-accent)]/15 px-3 py-1.5 text-xs text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)]/25">
        Download / Print PDF
      </button>
    );
  }
  const upgrade = async () => {
    setUpgrading(true);
    try {
      if (organizationId) { const org = await api.setOrganizationTier(organizationId, "pro"); setTier(org.tier); }
      else setTier("pro");
    } catch { setTier("pro"); } finally { setUpgrading(false); }
  };
  return (
    <button onClick={upgrade} disabled={upgrading} className="flex items-center gap-1.5 rounded-lg border border-[#f5a524]/60 bg-[#f5a524]/10 px-3 py-1.5 text-xs text-[#f5a524] hover:bg-[#f5a524]/20 disabled:opacity-50">
      <span className="rounded border border-[#f5a524]/60 px-1 text-[8px] font-bold uppercase">Pro</span>
      {upgrading ? "Upgrading…" : "Download / Print PDF"}
    </button>
  );
}

export default function ReportPage() {
  const { factoryId } = useParams();
  const factories = useFactoryStore((s) => s.factories);
  const factory = factories.find((f) => f.id === factoryId);
  const [copied, setCopied] = useState(false);

  const plan = useMemo(() => (factory ? buildActionPlan(factory, new Set()) : null), [factory]);
  const organizationId = useRoleStore((s) => s.organizationId);

  const [org, setOrg] = useState<{ name: string; brand_color: string; logo_text: string } | null>(null);

  useEffect(() => {
    if (!factory) return;
    // Real usage-meter event — a report was actually opened/generated, not
    // just a client-side guess. See backend/app/routers/business.py's
    // UsageEvent table and Header.tsx's UsageMeter for where this is read back.
    api.trackUsage("report_generated", organizationId, factory.id).catch(() => {});
  }, [factory?.id]);

  useEffect(() => {
    if (!organizationId) { setOrg(null); return; }
    api.organizations().then((orgs) => setOrg(orgs.find((o) => o.id === organizationId) ?? null)).catch(() => {});
  }, [organizationId]);

  if (!factory || !plan) {
    return (
      <main className="flex flex-1 items-center justify-center p-6 text-center text-sm text-[color:var(--color-muted)]">
        Factory not found. <Link to="/portfolio" className="ml-1 text-[color:var(--color-accent)] hover:underline">Back to portfolio</Link>
      </main>
    );
  }

  const hotspots = [...factory.nodes].sort((a, b) => b.co2eTpy - a.co2eTpy);
  const generatedAt = new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable — ignore */
    }
  };

  return (
    <main className="flex flex-1 flex-col gap-4 overflow-y-auto p-6 print:overflow-visible print:p-0" id="report-root">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <Link to="/" className="text-xs text-[color:var(--color-muted)] hover:underline">← Back to dashboard</Link>
        <div className="flex gap-2">
          <button onClick={copyLink} className="rounded-lg border border-[color:var(--color-border)] px-3 py-1.5 text-xs hover:bg-[color:var(--color-panel-2)]">
            {copied ? "Link copied ✓" : "Copy shareable link"}
          </button>
          <Link to={`/report/${factory.id}/brsr`} className="rounded-lg border border-[color:var(--color-border)] px-3 py-1.5 text-xs hover:bg-[color:var(--color-panel-2)]">
            BRSR-format export
          </Link>
          <PrintButton />
        </div>
      </div>

      <header className="glass rounded-xl p-5 print:border print:border-black/20" style={org ? { borderTop: `3px solid ${org.brand_color}` } : undefined}>
        {org && (
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold" style={{ color: org.brand_color }}>
            <span className="flex h-6 w-6 items-center justify-center rounded" style={{ background: `${org.brand_color}22`, color: org.brand_color }}>{org.logo_text || org.name[0]}</span>
            {org.name} · white-labeled report
          </div>
        )}
        <div className="text-[10px] uppercase tracking-wide text-[color:var(--color-muted)]">Decarbonization Report · Generated {generatedAt}</div>
        <h1 className="mt-1 text-xl font-bold">{factory.name}</h1>
        <div className="text-sm text-[color:var(--color-muted)]">{factory.sector} · {factory.cluster}</div>
      </header>

      {/* KPI summary */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Annual CO₂e", `${factory.totalCo2eTpy.toLocaleString("en-IN")} t`],
          ["Energy / yr", `${factory.totalEnergyMwhPerYear.toLocaleString("en-IN")} MWh`],
          ["Avoidable CO₂e / yr", `${(factory.avoidableCo2eTpy ?? plan.totals.co2ReductionTpy).toLocaleString("en-IN")} t`],
          ["Avoidable saving / yr", formatInr(plan.totals.annualSavingInr)],
          ["Blended payback", plan.totals.paybackMonths === null ? "—" : `${plan.totals.paybackMonths} mo`],
          ["Carbon-credit value*", formatInr(factory.carbonCreditValueInrPerYear ?? 0)],
        ].map(([k, v]) => (
          <div key={k} className="glass rounded-xl px-3 py-2.5 print:border print:border-black/10">
            <div className="text-[10px] uppercase tracking-wide text-[color:var(--color-muted)]">{k}</div>
            <div className="text-base font-semibold">{v}</div>
          </div>
        ))}
      </section>
      {factory.carbonCreditNote && (
        <p className="-mt-2 text-[10px] italic text-[color:var(--color-muted)]">*{factory.carbonCreditNote}</p>
      )}

      {/* Diagnosis */}
      <section className="glass rounded-xl p-4 print:border print:border-black/20">
        <h2 className="text-sm font-semibold">Diagnosis — where emissions concentrate</h2>
        <div className="mt-2 space-y-2">
          {hotspots.map((n) => (
            <div key={n.id} className="rounded-lg border border-[color:var(--color-border)] p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: severityColor[n.severity] }} />
                  <span className="text-sm font-medium">{n.label}</span>
                  <span className="text-[10px] text-[color:var(--color-muted)]">{severityLabel[n.severity]}</span>
                </div>
                <span className="text-sm font-semibold">{n.co2eTpy.toLocaleString("en-IN")} t/yr ({Math.round(n.shareOfTotal * 100)}%)</span>
              </div>
              <p className="mt-1 text-[12px] text-[color:var(--color-muted)]">{n.rootCause}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Action plan summary */}
      <section className="glass rounded-xl p-4 print:border print:border-black/20">
        <h2 className="text-sm font-semibold">Recommended action plan</h2>
        <div className="mt-2 grid grid-cols-3 gap-3">
          {plan.phases.map((p) => (
            <div key={p.phase} className="rounded-lg border border-[color:var(--color-border)] p-2.5">
              <div className="text-xs font-semibold">{p.label} <span className="font-normal text-[color:var(--color-muted)]">({p.window})</span></div>
              <ul className="mt-1.5 space-y-1">
                {p.items.length === 0 ? (
                  <li className="text-[11px] text-[color:var(--color-muted)]">Nothing phased here.</li>
                ) : p.items.map((it) => (
                  <li key={it.intervention.id} className="text-[11px]">
                    {it.intervention.title} — <span className="text-[color:var(--color-ok)]">{formatInr(it.intervention.annualSavingInr)}/yr</span>, {it.intervention.paybackMonths} mo payback
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-[12px]">
          <div>Total CAPEX: <b>{formatInr(plan.totals.capexInr)}</b></div>
          <div>Annual saving: <b className="text-[color:var(--color-ok)]">{formatInr(plan.totals.annualSavingInr)}</b></div>
          <div>CO₂e avoided/yr: <b>{plan.totals.co2ReductionTpy.toLocaleString("en-IN")} t</b></div>
        </div>
        <Link to="/plan" className="mt-2 inline-block text-[11px] text-[color:var(--color-accent)] hover:underline print:hidden">
          Open the full interactive action plan →
        </Link>
      </section>

      <footer className="text-[10px] leading-relaxed text-[color:var(--color-muted)]">
        Modelled estimates from CEA/IPCC-sourced emission factors and sub-sector benchmarks — see the
        platform's Methodology page for full citations. This report is a decision-support artifact, not
        an audited emissions inventory or a financial guarantee. Carbon-credit value is illustrative,
        based on an analyst-estimated indicative CCTS price — not an official or mandated price.
      </footer>
    </main>
  );
}
