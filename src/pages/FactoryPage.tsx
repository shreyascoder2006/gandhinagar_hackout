import KpiBar from "../components/dashboard/KpiBar";
import ProcessList from "../components/dashboard/ProcessList";
import HotspotPanel from "../components/dashboard/HotspotPanel";
import FactoryTwin from "../components/twin/FactoryTwin";
import { useFactoryStore } from "../store/useFactoryStore";
import { Link } from "react-router-dom";

export default function FactoryPage() {
  const factory = useFactoryStore((s) => s.baseline);

  return (
    <main className="flex flex-1 flex-col gap-3 overflow-hidden p-4">
      <div className="flex items-start justify-between gap-3">
        <KpiBar factory={factory} />
        {factory.dataSource !== "synthetic" && (
          <Link to={`/intake/${factory.id}`} className="shrink-0 rounded-lg border border-[color:var(--color-accent)]/60 bg-[color:var(--color-accent)]/10 px-3 py-2 text-xs font-semibold text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)]/20">
            Edit layout & components
          </Link>
        )}
      </div>

      <div className="grid flex-1 grid-cols-1 gap-3 overflow-hidden lg:grid-cols-[260px_1fr_360px]">
        <div className="hidden overflow-hidden lg:block">
          <ProcessList factory={factory} />
        </div>

        <div className="glass overflow-hidden rounded-xl">
          <FactoryTwin factory={factory} />
        </div>

        <div className="overflow-hidden">
          <HotspotPanel factory={factory} />
        </div>
      </div>

      <div className="block overflow-hidden lg:hidden" style={{ height: 220 }}>
        <ProcessList factory={factory} />
      </div>
    </main>
  );
}
