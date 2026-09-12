import type { Factory } from "../../types";
import { formatTonnes, formatInr } from "../../lib/severity";
import { useTranslation } from "../../store/useLanguageStore";

function Kpi({ label, value, sub, badge }: { label: string; value: string; sub?: string; badge?: string }) {
  return (
    <div className="glass flex flex-col gap-0.5 rounded-xl px-4 py-3">
      <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-[color:var(--color-muted)]">
        {label}
        {badge && <span className="rounded-full border border-[color:var(--color-warn)]/50 px-1 text-[8px] normal-case text-[color:var(--color-warn)]">{badge}</span>}
      </span>
      <span className="text-lg font-semibold text-[color:var(--color-text)]">{value}</span>
      {sub && <span className="text-[11px] text-[color:var(--color-muted)]">{sub}</span>}
    </div>
  );
}

export default function KpiBar({ factory }: { factory: Factory }) {
  const { t } = useTranslation();
  const critCount = factory.nodes.filter((n) => n.severity === "crit").length;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Kpi label={t("kpiAnnualCo2")} value={formatTonnes(factory.totalCo2eTpy)} sub={`${factory.sector}`} />
      <Kpi label={t("kpiEnergyPerYear")} value={`${factory.totalEnergyMwhPerYear.toLocaleString("en-IN")} MWh`} />
      <Kpi label={t("kpiWastePerYear")} value={formatTonnes(factory.totalWasteTpy)} />
      <Kpi label={t("kpiCircularityRatio")} value={`${Math.round(factory.circularityRatio * 100)}%`} sub={t("kpiRecoveredRatioSub")} />
      <Kpi
        label={t("kpiHotspotsDetected")}
        value={`${critCount} of ${factory.nodes.length}`}
        sub={critCount > 0 ? t("kpiAboveBenchmark") : t("kpiWithinBenchmark")}
      />
      <Kpi
        label="Carbon-credit value"
        value={formatInr(factory.carbonCreditValueInrPerYear ?? 0)}
        sub={`${(factory.avoidableCo2eTpy ?? 0).toLocaleString("en-IN")} t avoidable/yr`}
        badge="screening"
      />
    </div>
  );
}
