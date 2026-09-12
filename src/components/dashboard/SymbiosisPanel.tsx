import { Fragment, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { findMatches, matchesFor } from "../../lib/symbiosis";
import { useFactoryStore } from "../../store/useFactoryStore";
import { formatInr } from "../../lib/severity";
import type { Factory } from "../../types";

export default function SymbiosisPanel({ factory }: { factory: Factory }) {
  const factories = useFactoryStore((s) => s.factories);
  const matches = useMemo(() => matchesFor(factory.id, findMatches(factories)), [factory.id, factories]);

  const totalCo2 = matches.reduce((a, m) => a + m.co2AvoidedTpy, 0);
  const mySaving = matches.reduce((a, m) => a + (m.sourceId === factory.id ? m.sourceSavingInr : m.targetSavingInr), 0);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[color:var(--color-border)] px-4 py-3">
        <h3 className="text-sm font-semibold">Industrial symbiosis</h3>
        <p className="text-[11px] text-[color:var(--color-muted)]">Your waste → another unit's input, within 60 km. Select a process for its own diagnostics.</p>
      </div>

      {matches.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-[12px] text-[color:var(--color-muted)]">
          No waste-to-input matches for this unit in the current cohort.
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="grid grid-cols-3 gap-2 p-3">
            {[
              ["Matches", String(matches.length)],
              ["CO₂e avoided", `${totalCo2} t/yr`],
              ["Your saving", `${formatInr(mySaving)}/yr`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-[color:var(--color-border)] p-2 text-center">
                <div className="text-[10px] text-[color:var(--color-muted)]">{k}</div>
                <div className="text-xs font-semibold">{v}</div>
              </div>
            ))}
          </div>

          <div className="mx-3 h-36 overflow-hidden rounded-lg border border-[color:var(--color-border)]">
            <MapContainer center={[factory.lat, factory.lon]} zoom={10} className="h-full w-full" zoomControl={false} attributionControl={false} dragging={false} scrollWheelZoom={false} doubleClickZoom={false}>
              <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <CircleMarker center={[factory.lat, factory.lon]} radius={7} pathOptions={{ color: "#3ea6ff", fillColor: "#3ea6ff", fillOpacity: 0.9 }} />
              {matches.map((m) => {
                const other = factories.find((f) => f.id === (m.sourceId === factory.id ? m.targetId : m.sourceId))!;
                return (
                  <Fragment key={m.id}>
                    <Polyline positions={[[factory.lat, factory.lon], [other.lat, other.lon]]} pathOptions={{ color: "#22c55e", weight: 2, dashArray: "5 5" }} />
                    <CircleMarker center={[other.lat, other.lon]} radius={5} pathOptions={{ color: "#22c55e", fillColor: "#22c55e", fillOpacity: 0.8 }} />
                  </Fragment>
                );
              })}
            </MapContainer>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {matches.map((m) => {
              const outgoing = m.sourceId === factory.id;
              return (
                <div key={m.id} className="mb-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-panel-2)] p-2.5 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full border border-[color:var(--color-ok)]/40 px-1.5 py-0.5 text-[10px] text-[color:var(--color-ok)]">{outgoing ? "You supply" : "You receive"}</span>
                    <span className="text-[color:var(--color-muted)]">{m.distanceKm} km</span>
                  </div>
                  <div className="mt-1 font-medium">{m.label}</div>
                  <div className="text-[color:var(--color-muted)]">{outgoing ? `→ ${m.targetName}` : `← ${m.sourceName}`}</div>
                  <div className="mt-1.5 grid grid-cols-3 gap-1 text-center">
                    <div><div className="text-[9px] text-[color:var(--color-muted)]">Tonnes/yr</div><b>{m.tonnesMatched.toLocaleString("en-IN")}</b></div>
                    <div><div className="text-[9px] text-[color:var(--color-muted)]">CO₂e</div><b className="text-[color:var(--color-ok)]">−{m.co2AvoidedTpy} t</b></div>
                    <div><div className="text-[9px] text-[color:var(--color-muted)]">Your ₹</div><b>{formatInr(outgoing ? m.sourceSavingInr : m.targetSavingInr)}</b></div>
                  </div>
                  <div className="mt-1.5 text-[10px] italic text-[color:var(--color-muted)]">Low confidence — modelled match; needs offtake MoU + GPCB consent amendment.</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
