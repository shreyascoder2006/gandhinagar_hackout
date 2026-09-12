import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, type ApiBrsrReport } from "../lib/api";

// A second report template over the same real numbers ReportPage.tsx shows —
// reformatted into India's mandatory Business Responsibility and Sustainability
// Report (BRSR) principle-wise disclosure structure. Mostly templating, not
// new computation: see backend/app/routers/business.py's brsr_report() for
// exactly which real DB rows each value traces to, and which disclosures are
// honestly marked unavailable rather than guessed.
export default function BrsrReportPage() {
  const { factoryId } = useParams();
  const [report, setReport] = useState<ApiBrsrReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!factoryId) return;
    api.brsrReport(factoryId).then(setReport).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [factoryId]);

  if (error) {
    return <main className="p-6 text-center text-sm text-[color:var(--color-crit)]">{error}</main>;
  }
  if (!report) {
    return <main className="p-6 text-center text-sm text-[color:var(--color-muted)]">Loading BRSR-format report…</main>;
  }

  return (
    <main className="flex flex-1 flex-col gap-4 overflow-y-auto p-6 print:overflow-visible print:p-0">
      <div className="flex items-start justify-between gap-3 print:hidden">
        <Link to={`/report/${report.factory_id}`} className="text-xs text-[color:var(--color-muted)] hover:underline">← Back to decarbonization report</Link>
        <button onClick={() => window.print()} className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-accent)]/15 px-3 py-1.5 text-xs text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)]/25">
          Download / Print PDF
        </button>
      </div>

      <header className="glass rounded-xl p-5 print:border print:border-black/20">
        <div className="text-[10px] uppercase tracking-wide text-[color:var(--color-muted)]">
          BRSR-format disclosure · Reporting period {report.reporting_period}
        </div>
        <h1 className="mt-1 text-xl font-bold">{report.factory_name}</h1>
        <p className="mt-1 text-[12px] text-[color:var(--color-muted)]">
          Reformats real, already-computed numbers into India's Business Responsibility and
          Sustainability Report principle-wise structure. Not a submittable regulatory filing —
          see the methodology note below for exactly what this covers and what it honestly does not.
        </p>
      </header>

      {report.principles.map((p) => (
        <section key={p.principle} className="glass rounded-xl p-4 print:border print:border-black/20">
          <h2 className="text-sm font-semibold">{p.principle} — {p.title}</h2>
          <table className="mt-3 w-full text-[12px]">
            <thead className="text-[11px] uppercase tracking-wide text-[color:var(--color-muted)]">
              <tr><th className="py-1 text-left font-medium">Disclosure</th><th className="text-right font-medium">Value</th><th className="pl-4 text-left font-medium">Source</th></tr>
            </thead>
            <tbody>
              {p.disclosures.map((d) => (
                <tr key={d.disclosure} className="border-t border-[color:var(--color-border)]">
                  <td className="py-1.5">{d.disclosure}</td>
                  <td className="text-right font-semibold">
                    {d.value === null ? <span className="italic text-[color:var(--color-muted)]">not available</span> : d.value}
                  </td>
                  <td className="pl-4 text-[11px] text-[color:var(--color-muted)]">{d.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      <footer className="text-[10px] leading-relaxed text-[color:var(--color-muted)]">
        {report.methodology_note}
      </footer>
    </main>
  );
}
