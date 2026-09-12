// Maps the Intake page's local IntakeProfile/Activity shape (src/lib/engine.ts)
// onto the real backend onboarding payload (backend/app/schemas.py OnboardFactoryIn),
// so submitting a new factory runs through the actual engine/recommender in
// backend/app/engine + backend/app/intelligence — the same code path every
// seeded factory goes through — instead of only ever existing in local
// browser state (Phase 5 tail: this was the one remaining "same functionality
// as before, not yet backed by the database" gap from the frontend rewire).
import type { Activity, IntakeProfile } from "./engine";
import { sectorTemplates } from "../data/factories";

// The guided form collects one ANNUAL total per process/fuel line (see the
// "2 · Energy by process (annual)" label in IntakePage), not a real monthly
// series, so there is no real month to attach to those rows. A fixed
// placeholder month is used for them — this is a disclosed simplification,
// not fabricated data: the CSV/bill-upload path (which does carry real
// per-row months) passes its own months through unchanged.
const ANNUAL_SUBMISSION_MONTH = "2026-01";

export interface OnboardPayload {
  name: string;
  cluster_id: string;
  sector: string;
  output_tonnes_total: number;
  processes: {
    process_id: string;
    label: string;
    kind: string;
    share_of_energy: number;
    activities: { fuel_key: string; unit: string; quantity: number; month: string }[];
  }[];
}

export function buildOnboardPayload(profile: IntakeProfile, activities: Activity[]): OnboardPayload {
  const tpl = sectorTemplates[profile.sector];
  const byProcess = new Map<string, Activity[]>();
  for (const a of activities) {
    if (!byProcess.has(a.process)) byProcess.set(a.process, []);
    byProcess.get(a.process)!.push(a);
  }

  const processes = [...byProcess.entries()].flatMap(([processId, acts]) => {
    const t = tpl.find((x) => x.id === processId);
    if (!t) return []; // unknown process id — already surfaced as a validation issue elsewhere
    return [{
      process_id: t.id,
      label: t.label,
      kind: t.kind,
      share_of_energy: t.share,
      activities: acts.map((a) => ({
        fuel_key: a.fuel,
        unit: a.unit,
        quantity: a.quantity,
        month: a.month ?? ANNUAL_SUBMISSION_MONTH,
      })),
    }];
  });

  return {
    name: profile.name,
    cluster_id: profile.clusterId,
    sector: profile.sector,
    output_tonnes_total: profile.outputTonnesPerMonth * 12,
    processes,
  };
}
