import { AnimatePresence, motion } from "framer-motion";
import { useFactoryStore } from "../../store/useFactoryStore";
import { useTranslation } from "../../store/useLanguageStore";
import { severityColor, severityLabel, confidenceLabel, formatInr, pctVsBenchmark } from "../../lib/severity";
import type { Intervention, Factory } from "../../types";
import SymbiosisPanel from "./SymbiosisPanel";
import type { MonthlyPoint } from "../../types";

function Sparkline({ points }: { points: MonthlyPoint[] }) {
  const W = 300, H = 56, pad = 4;
  const max = Math.max(...points.map((p) => p.co2eT), 1);
  const min = Math.min(...points.map((p) => p.co2eT), 0);
  const x = (i: number) => pad + (i / (points.length - 1)) * (W - pad * 2);
  const y = (v: number) => H - pad - ((v - min) / (max - min || 1)) * (H - pad * 2);
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.co2eT)}`).join(" ");
  const anomalies = points.filter((p) => p.anomaly);
  return (
    <div className="mt-3 rounded-lg border border-[color:var(--color-border)] p-2.5">
      <div className="flex items-center justify-between text-[10px] text-[color:var(--color-muted)]">
        <span>Monthly CO₂e · z-score control limits (|z| &gt; 2)</span>
        <span className={anomalies.length ? "text-[color:var(--color-crit)]" : "text-[color:var(--color-ok)]"}>{anomalies.length ? `${anomalies.length} anomaly` : "no anomalies"}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 h-14 w-full">
        <path d={d} fill="none" stroke="#3ea6ff" strokeWidth="1.5" />
        {points.map((p, i) => (
          <circle key={p.month} cx={x(i)} cy={y(p.co2eT)} r={p.anomaly ? 4 : 2} fill={p.anomaly ? "#ef4444" : "#3ea6ff"}>
            <title>{p.month}: {p.co2eT} t (z={p.z})</title>
          </circle>
        ))}
      </svg>
      <div className="flex justify-between text-[9px] text-[color:var(--color-muted)]"><span>{points[0].month}</span><span>{points[points.length - 1].month}</span></div>
    </div>
  );
}

function InterventionCard({ intervention }: { intervention: Intervention }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-panel-2)] p-3">
      <div className="flex items-start justify-between gap-2">
        <h5 className="text-sm font-medium leading-snug">{intervention.title}</h5>
        <span className="flex-shrink-0 rounded-full border border-[color:var(--color-border)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[color:var(--color-muted)]">
          {intervention.category.replace(/-/g, " ")}
        </span>
      </div>
      <p className="mt-1 text-[12px] text-[color:var(--color-muted)]">{intervention.description}</p>
      <div className="mt-2 grid grid-cols-4 gap-2 text-center">
        <div>
          <div className="text-[10px] text-[color:var(--color-muted)]">{t("capex")}</div>
          <div className="text-xs font-semibold">{formatInr(intervention.capexInr)}</div>
        </div>
        <div>
          <div className="text-[10px] text-[color:var(--color-muted)]">{t("annualSaving")}</div>
          <div className="text-xs font-semibold text-[color:var(--color-ok)]">{formatInr(intervention.annualSavingInr)}</div>
        </div>
        <div>
          <div className="text-[10px] text-[color:var(--color-muted)]">{t("co2Reduction")}</div>
          <div className="text-xs font-semibold">{intervention.co2ReductionTpy} {t("tonnesPerYear")}</div>
        </div>
        <div>
          <div className="text-[10px] text-[color:var(--color-muted)]">{t("payback")}</div>
          <div className="text-xs font-semibold">{intervention.paybackMonths} {t("months")}</div>
        </div>
      </div>
      <div className="mt-2 text-[10px] italic text-[color:var(--color-muted)]">{confidenceLabel[intervention.confidence]}</div>
    </div>
  );
}

export default function HotspotPanel({ factory }: { factory: Factory }) {
  const selectedNodeId = useFactoryStore((s) => s.selectedNodeId);
  const { t } = useTranslation();
  const node = factory.nodes.find((n) => n.id === selectedNodeId) ?? null;

  return (
    <div className="glass flex h-full flex-col rounded-xl overflow-hidden">
      <AnimatePresence mode="wait">
        {!node ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex h-full flex-col overflow-hidden"
          >
            <SymbiosisPanel factory={factory} />
          </motion.div>
        ) : (
          <motion.div
            key={node.id}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
            className="flex h-full flex-col overflow-y-auto p-4"
          >
            <div className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full"
                style={{ background: severityColor[node.severity], boxShadow: `0 0 10px ${severityColor[node.severity]}` }}
              />
              <h3 className="text-base font-semibold">{node.label}</h3>
            </div>
            <div className="mt-0.5 text-xs text-[color:var(--color-muted)]">{severityLabel[node.severity]} · {confidenceLabel[node.confidence]}</div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-[color:var(--color-border)] p-2.5">
                <div className="text-[10px] text-[color:var(--color-muted)]">Actual intensity</div>
                <div className="text-sm font-semibold">{node.actualIntensity} kgCO2e/t</div>
              </div>
              <div className="rounded-lg border border-[color:var(--color-border)] p-2.5">
                <div className="text-[10px] text-[color:var(--color-muted)]">Sub-sector benchmark</div>
                <div className="text-sm font-semibold">{node.benchmarkIntensity} kgCO2e/t</div>
              </div>
            </div>
            <div
              className="mt-2 rounded-lg border px-2.5 py-1.5 text-center text-xs font-semibold"
              style={{
                borderColor: severityColor[node.severity],
                color: severityColor[node.severity],
              }}
            >
              {pctVsBenchmark(node.actualIntensity, node.benchmarkIntensity) > 0 ? "+" : ""}
              {pctVsBenchmark(node.actualIntensity, node.benchmarkIntensity)}% vs. benchmark
            </div>

            {node.monthly && node.monthly.length >= 4 && <Sparkline points={node.monthly} />}

            <div className="mt-4">
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">{t("rootCauseTitle")}</h4>
              <p className="text-[13px] leading-relaxed text-[color:var(--color-text)]">{node.rootCause}</p>
            </div>

            <div className="mt-4">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
                {t("interventionsTitle")} ({node.interventions.length})
              </h4>
              <div className="flex flex-col gap-2">
                {[...node.interventions]
                  .sort((a, b) => b.co2ReductionTpy / a.paybackMonths - a.co2ReductionTpy / b.paybackMonths)
                  .map((iv) => (
                    <InterventionCard key={iv.id} intervention={iv} />
                  ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
