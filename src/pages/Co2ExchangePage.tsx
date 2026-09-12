import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import { divIcon } from "leaflet";
import "leaflet/dist/leaflet.css";
import { useFactoryStore } from "../store/useFactoryStore";
import { co2Availability, co2Deals, co2Providers, type Co2ExchangeDeal } from "../lib/co2exchange";
import type { Factory } from "../types";
import { formatInr } from "../lib/severity";

type Decision = "accepted" | "declined";

function Focus({ factory }: { factory: Factory }) {
  const map = useMap();
  useEffect(() => { map.flyTo([factory.lat, factory.lon], 10.5, { duration: 0.8 }); }, [factory.id]);
  return null;
}

function nodeIcon(kind: "provider" | "recipient", index: number) {
  return divIcon({ className: "co2-node-wrap", iconSize: [42, 42], iconAnchor: [21, 21], html: `<div class="co2-node ${kind}" style="--node-delay:${index * 90}ms"><span>${kind === "provider" ? "CO₂" : "↗"}</span></div>` });
}

export default function Co2ExchangePage() {
  const factories = useFactoryStore((s) => s.factories);
  const providers = useMemo(() => co2Providers(factories), [factories]);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const provider = providers.find((p) => p.id === providerId) ?? providers[0] ?? null;
  const deals = useMemo(() => provider ? co2Deals(provider, factories) : [], [provider, factories]);
  const selected = deals.find((d) => d.id === selectedDealId) ?? deals[0] ?? null;

  useEffect(() => { if (provider && provider.id !== providerId) setProviderId(provider.id); }, [provider, providerId]);
  useEffect(() => { if (selected && selected.id !== selectedDealId) setSelectedDealId(selected.id); }, [selected, selectedDealId]);
  if (!provider) return <main className="p-4">No capture-ready CO₂ providers are currently available.</main>;

  const recipientById = Object.fromEntries(factories.map((f) => [f.id, f]));
  const decision = selected ? decisions[selected.id] : undefined;
  const value = (n: number) => `${n.toLocaleString("en-IN")} t/yr`;

  return <main className="flex flex-1 flex-col gap-3 overflow-hidden p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold">CO₂ Exchange</h2>
        <p className="text-[12px] text-[color:var(--color-muted)]">A visual marketplace for captured-process CO₂. Choose a supplier; nearby potential users appear as a live offtake network. Connection estimates require capture, purity, transport and regulatory validation.</p>
      </div>
      <div className="rounded-full border border-[color:var(--color-warn)]/60 px-3 py-1 text-[11px] text-[color:var(--color-warn)]">Screening marketplace · no deal is binding</div>
    </div>

    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Metric label="Potential suppliers" value={String(providers.length)} sub="capture-ready screening" />
      <Metric label="Selected surplus" value={value(co2Availability(provider))} sub="illustrative annual availability" />
      <Metric label="Nearby requests" value={String(deals.length)} sub="within 90 km" />
      <Metric label="Proposed offtake" value={value(deals.reduce((sum, d) => sum + d.matchedTpy, 0))} sub="sum of candidate links" />
    </div>

    <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden lg:grid-cols-[270px_1fr_360px]">
      <aside className="glass overflow-y-auto rounded-xl p-3">
        <h3 className="mb-1 text-sm font-semibold">CO₂ suppliers</h3>
        <p className="mb-3 text-[11px] text-[color:var(--color-muted)]">Factories with significant combustion-process CO₂ that could be assessed for capture.</p>
        <div className="space-y-2">{providers.map((p) => <button key={p.id} onClick={() => { setProviderId(p.id); setSelectedDealId(null); }} className={`w-full rounded-lg border p-2.5 text-left ${p.id === provider.id ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10" : "border-[color:var(--color-border)] hover:bg-[color:var(--color-panel-2)]"}`}>
          <div className="text-xs font-semibold">{p.consentToShare ? p.name : "Anonymous CO₂ provider"}</div>
          <div className="mt-1 flex justify-between text-[10px] text-[color:var(--color-muted)]"><span>{p.cluster.split(",")[0]}</span><span>{value(co2Availability(p))}</span></div>
        </button>)}</div>
      </aside>

      <div className="glass relative min-h-[370px] overflow-hidden rounded-xl">
        <MapContainer center={[provider.lat, provider.lon]} zoom={10.5} className="h-full w-full" zoomControl={false} attributionControl={false}><TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" /><Focus factory={provider} />
          <Marker position={[provider.lat, provider.lon]} icon={nodeIcon("provider", 0)} zIndexOffset={100}><Tooltip permanent direction="top" offset={[0, -24]}><b>{provider.consentToShare ? provider.name : "CO₂ provider"}</b><br />{value(co2Availability(provider))} surplus</Tooltip></Marker>
          {deals.map((deal, i) => { const recipient = recipientById[deal.recipientId]; const active = deal.id === selected?.id; const status = decisions[deal.id]; return <Fragment key={deal.id}>
            <Polyline positions={[[provider.lat, provider.lon], [recipient.lat, recipient.lon]]} pathOptions={{ color: status === "accepted" ? "#22c55e" : status === "declined" ? "#596174" : active ? "#3ea6ff" : "#91bde7", weight: active ? 5 : 2.5, opacity: status === "declined" ? 0.3 : 0.85, dashArray: status === "accepted" ? undefined : "8 7" }} eventHandlers={{ click: () => setSelectedDealId(deal.id) }} />
            <Marker position={[recipient.lat, recipient.lon]} icon={nodeIcon("recipient", i + 1)} eventHandlers={{ click: () => setSelectedDealId(deal.id) }}><Tooltip direction="top" offset={[0, -22]}>{recipient.consentToShare ? recipient.name : "Potential recipient"}<br />Request: {value(deal.requestedTpy)}</Tooltip></Marker>
          </Fragment>; })}
          <CircleMarker center={[provider.lat, provider.lon]} radius={44} pathOptions={{ color: "#3ea6ff", weight: 1, fillOpacity: 0.06, dashArray: "3 5" }} />
        </MapContainer>
        <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-panel)]/90 px-3 py-2 text-[11px] backdrop-blur"><span className="font-semibold">Click a string</span><br /><span className="text-[color:var(--color-muted)]">to review an exchange proposal</span></div>
      </div>

      <aside className="glass overflow-y-auto rounded-xl p-4">
        {!selected ? <p className="mt-10 text-center text-sm text-[color:var(--color-muted)]">Select a network connection to view its proposal.</p> : <DealCard deal={selected} provider={provider} recipient={recipientById[selected.recipientId]} decision={decision} onDecision={(next) => setDecisions((old) => ({ ...old, [selected.id]: next }))} />}
      </aside>
    </div>
  </main>;
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) { return <div className="glass rounded-xl px-4 py-3"><div className="text-[10px] uppercase tracking-wide text-[color:var(--color-muted)]">{label}</div><div className="text-lg font-semibold">{value}</div><div className="text-[10px] text-[color:var(--color-muted)]">{sub}</div></div>; }

function DealCard({ deal, provider, recipient, decision, onDecision }: { deal: Co2ExchangeDeal; provider: Factory; recipient: Factory; decision?: Decision; onDecision: (next: Decision) => void }) {
  const name = (f: Factory, role: string) => f.consentToShare ? f.name : `Anonymous ${role}`;
  return <><div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold">Exchange proposal</h3><p className="text-[11px] text-[color:var(--color-muted)]">Clicking this connection selected it.</p></div><span className={`rounded-full border px-2 py-1 text-[10px] ${decision === "accepted" ? "border-[color:var(--color-ok)] text-[color:var(--color-ok)]" : decision === "declined" ? "border-[color:var(--color-muted)] text-[color:var(--color-muted)]" : "border-[color:var(--color-warn)] text-[color:var(--color-warn)]"}`}>{decision ?? "pending review"}</span></div>
    <div className="my-4 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel-2)] p-3"><div className="text-xs font-semibold">{name(provider, "supplier")}</div><div className="my-2 border-l border-dashed border-[color:var(--color-accent)] pl-3 text-[11px] text-[color:var(--color-accent)]">{deal.captureSource} → capture / condition → transport</div><div className="text-xs font-semibold">{name(recipient, "recipient")}</div><div className="mt-1 text-[11px] text-[color:var(--color-muted)]">Use: {deal.useCase}</div></div>
    <div className="grid grid-cols-2 gap-2 text-center">{[["Proposed flow", `${deal.matchedTpy.toLocaleString("en-IN")} t/yr`], ["Distance", `${deal.distanceKm} km`], ["Supplier surplus", `${deal.availableTpy.toLocaleString("en-IN")} t/yr`], ["Estimated value", `${formatInr(deal.estimatedValueInr)}/yr`]].map(([k, v]) => <div key={k} className="rounded-lg border border-[color:var(--color-border)] p-2"><div className="text-[9px] text-[color:var(--color-muted)]">{k}</div><div className="text-xs font-semibold">{v}</div></div>)}</div>
    <div className="mt-4 rounded-lg border border-[color:var(--color-warn)]/35 bg-[color:var(--color-warn)]/5 p-2.5 text-[10px] text-[color:var(--color-muted)]">Screening estimate only. Before contracting, confirm flue-gas composition and purity, capture equipment, cylinder/pipeline logistics, offtaker specifications, site safety and GPCB permissions.</div>
    <Link to={`/co2-exchange/deal/${deal.providerId}/${deal.recipientId}`} className="mt-4 block w-full rounded-lg border border-[color:var(--color-accent)]/65 bg-[color:var(--color-accent)]/10 px-3 py-2 text-center text-xs font-semibold text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)]/20">Open full deal workspace</Link>
    {!decision ? <div className="mt-2 grid grid-cols-2 gap-2"><button onClick={() => onDecision("declined")} className="rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-xs hover:bg-[color:var(--color-panel-2)]">Decline</button><button onClick={() => onDecision("accepted")} className="rounded-lg bg-[color:var(--color-ok)] px-3 py-2 text-xs font-semibold text-black">Agree to explore</button></div> : <button onClick={() => onDecision(decision === "accepted" ? "declined" : "accepted")} className="mt-2 w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-xs hover:bg-[color:var(--color-panel-2)]">Change decision</button>}</>;
}
