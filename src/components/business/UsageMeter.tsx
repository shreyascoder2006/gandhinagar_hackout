import { useEffect, useState } from "react";
import { useRoleStore } from "../../store/useRoleStore";
import { api, type ApiUsageSummary } from "../../lib/api";

const KIND_LABEL: Record<string, string> = {
  report_generated: "reports",
  chat_question: "chat questions",
  factory_onboarded: "factories onboarded",
};

// Small "3 of 5 free reports used this month" meter, backed by a real
// UsageEvent counter (backend/app/routers/business.py) — zero payment
// integration needed to make the SaaS mechanic tangible in the demo.
export default function UsageMeter({ kind = "report_generated" }: { kind?: keyof typeof KIND_LABEL }) {
  const organizationId = useRoleStore((s) => s.organizationId);
  const tier = useRoleStore((s) => s.tier);
  const [summary, setSummary] = useState<ApiUsageSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.usageSummary(organizationId).then((s) => { if (!cancelled) setSummary(s); }).catch(() => {});
    return () => { cancelled = true; };
  }, [organizationId, tier]);

  if (!summary || tier === "pro") return null;
  const used = summary.counts[kind] ?? 0;
  const limit = summary.free_limits[kind] ?? -1;
  if (limit < 0) return null;
  const over = used >= limit;

  return (
    <span
      title={summary.note}
      className={`hidden sm:inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-medium ${
        over ? "border-[color:var(--color-crit)] text-[color:var(--color-crit)]" : "border-[color:var(--color-border)] text-[color:var(--color-muted)]"
      }`}
    >
      {used} of {limit} free {KIND_LABEL[kind]} used this month
    </span>
  );
}
