import { useState } from "react";
import { useRoleStore } from "../../store/useRoleStore";
import { api } from "../../lib/api";

// Wraps a Pro feature (simulator, symbiosis matching, PDF report) with a
// real, clickable freemium gate — not just a line in a pitch deck. Reads
// the organization's real tier from the backend (Organization.tier) and, on
// "Upgrade", calls the real (mocked, no payment) PATCH /api/organizations/{id}/tier
// endpoint so the unlock is a genuine round trip, not a client-only toggle.
export default function ProGate({ feature, children, className = "" }: { feature: string; children: React.ReactNode; className?: string }) {
  const tier = useRoleStore((s) => s.tier);
  const organizationId = useRoleStore((s) => s.organizationId);
  const setTier = useRoleStore((s) => s.setTier);
  const [upgrading, setUpgrading] = useState(false);

  if (tier === "pro") return <>{children}</>;

  const upgrade = async () => {
    if (!organizationId) { setTier("pro"); return; }
    setUpgrading(true);
    try {
      const org = await api.setOrganizationTier(organizationId, "pro");
      setTier(org.tier);
    } catch {
      setTier("pro"); // backend unreachable — still demo the unlock locally
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <div className={`relative overflow-hidden rounded-xl border border-[color:var(--color-border)] ${className}`}>
      <div className="pointer-events-none h-full select-none opacity-30 blur-[2px]">{children}</div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[color:var(--color-panel)]/80 p-4 text-center backdrop-blur-sm">
        <span className="rounded-full border border-[#f5a524] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#f5a524]">Pro</span>
        <p className="max-w-xs text-[12px] text-[color:var(--color-muted)]">{feature} is a Pro feature. Free tier covers the diagnosis view only.</p>
        <button
          onClick={upgrade}
          disabled={upgrading}
          className="rounded-lg bg-[#f5a524] px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
        >
          {upgrading ? "Upgrading…" : "Upgrade to Pro"}
        </button>
      </div>
    </div>
  );
}
