import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useFactoryStore } from "../store/useFactoryStore";
import { co2Deals } from "../lib/co2exchange";
import { formatInr } from "../lib/severity";

const TRUCK_CAPACITY_T = 20;
const CAPTURE_COST_PER_T = 360;
const FREIGHT_PER_KM = 72;

export default function Co2DealPage() {
  const { providerId, recipientId } = useParams();
  const factories = useFactoryStore((s) => s.factories);
  const provider = factories.find((f) => f.id === providerId);
  const recipient = factories.find((f) => f.id === recipientId);
  const deal = useMemo(() => provider ? co2Deals(provider, factories).find((d) => d.recipientId === recipientId) : undefined, [provider, factories, recipientId]);
  const [accepted, setAccepted] = useState(false);
  const [startDate, setStartDate] = useState(() => new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
  const [trucks, setTrucks] = useState(2);
  const [price, setPrice] = useState(deal?.estimatedValueInr ? Math.round(deal.estimatedValueInr / deal.matchedTpy) : 1450);
  const [frequency, setFrequency] = useState<"weekly" | "fortnightly" | "monthly">("monthly");
  if (!provider || !recipient || !deal) return <main className="p-6"><p>That CO₂ exchange proposal is no longer available.</p><Link className="mt-3 inline-block text-[color:var(--color-accent)]" to="/co2-exchange">← Return to CO₂ Exchange</Link></main>;

  const payload = Math.max(1, trucks) * TRUCK_CAPACITY_T;
  const deliveries = Math.ceil(deal.matchedTpy / payload);
  const roundTrips = deliveries * deal.distanceKm * 2;
  const freight = Math.round(roundTrips * FREIGHT_PER_KM);
  const materialValue = deal.matchedTpy * price;
  const captureCost = deal.matchedTpy * CAPTURE_COST_PER_T;
  const buyerTotal = materialValue + freight;
  const supplierNet = materialValue - captureCost - freight;
  const frequencyLabel = { weekly: "weekly", fortnightly: "every two weeks", monthly: "monthly" }[frequency];

  return <main className="flex flex-1 flex-col gap-4 overflow-auto p-4 lg:p-6">
    <div className="flex items-start justify-between gap-3"><div><Link to="/co2-exchange" className="text-xs text-[color:var(--color-accent)]">← CO₂ Exchange network</Link><h2 className="mt-1 text-xl font-semibold">CO₂ offtake deal workspace</h2><p className="text-[12px] text-[color:var(--color-muted)]">Non-binding commercial screening proposal. Confirm process purity, permits and specifications before issuing an order.</p></div><span className={`rounded-full border px-3 py-1 text-xs ${accepted ? "border-[color:var(--color-ok)] text-[color:var(--color-ok)]" : "border-[color:var(--color-warn)] text-[color:var(--color-warn)]"}`}>{accepted ? "Accepted for configuration" : "Awaiting decision"}</span></div>

    <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr]"><Party title="Supplier" name={provider.consentToShare ? provider.name : "Anonymous CO₂ supplier"} detail={`${deal.captureSource} · ${deal.availableTpy.toLocaleString("en-IN")} t/yr available`} /><div className="flex items-center justify-center text-2xl text-[color:var(--color-accent)]">→</div><Party title="Offtaker" name={recipient.consentToShare ? recipient.name : "Anonymous potential user"} detail={`${deal.useCase} · ${deal.requestedTpy.toLocaleString("en-IN")} t/yr requested`} /></div>

    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="glass rounded-xl p-4"><h3 className="text-sm font-semibold">Proposed exchange</h3><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"><Stat label="Annual CO₂" value={`${deal.matchedTpy.toLocaleString("en-IN")} t`} /><Stat label="Route" value={`${deal.distanceKm} km`} /><Stat label="Load capacity" value={`${payload.toLocaleString("en-IN")} t/run`} /><Stat label="Projected runs" value={`${deliveries}/yr`} /></div><div className="mt-4 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-panel-2)] p-3 text-[11px]"><div className="font-semibold">Technical review checklist</div><div className="mt-2 grid gap-2 sm:grid-cols-2 text-[color:var(--color-muted)]"><span>□ Flue-gas composition and purity test</span><span>□ Capture / liquefaction suitability</span><span>□ Tanker, cylinder and unloading protocol</span><span>□ GPCB consent and site safety review</span></div></div></section>
      <section className="glass rounded-xl p-4"><h3 className="text-sm font-semibold">Deal economics</h3><FinanceRow label={`CO₂ product: ${deal.matchedTpy.toLocaleString("en-IN")} t × ${formatInr(price)}/t`} value={materialValue} /><FinanceRow label={`Capture & conditioning: ${formatInr(CAPTURE_COST_PER_T)}/t`} value={-captureCost} /><FinanceRow label={`${deliveries} round trips · ${roundTrips.toLocaleString("en-IN")} vehicle-km`} value={-freight} /><div className="mt-3 grid grid-cols-2 gap-2 border-t border-[color:var(--color-border)] pt-3"><div><div className="text-[10px] text-[color:var(--color-muted)]">Supplier net estimate</div><div className={`text-lg font-semibold ${supplierNet >= 0 ? "text-[color:var(--color-ok)]" : "text-[color:var(--color-crit)]"}`}>{formatInr(supplierNet)}/yr</div></div><div><div className="text-[10px] text-[color:var(--color-muted)]">Offtaker delivered cost</div><div className="text-lg font-semibold">{formatInr(buyerTotal)}/yr</div></div></div></section>
    </div>

    {!accepted ? <section className="glass rounded-xl p-5 text-center"><h3 className="text-base font-semibold">Ready to take this proposal forward?</h3><p className="mx-auto mt-1 max-w-xl text-[12px] text-[color:var(--color-muted)]">Accepting opens the commercial specification workspace. It does not place an order or send information to another party.</p><div className="mt-4 flex justify-center gap-2"><Link to="/co2-exchange" className="rounded-lg border border-[color:var(--color-border)] px-4 py-2 text-sm">Return to network</Link><button onClick={() => setAccepted(true)} className="rounded-lg bg-[color:var(--color-ok)] px-4 py-2 text-sm font-semibold text-black">Accept & configure deal</button></div></section> :
      <section className="glass rounded-xl p-4"><div className="flex flex-wrap items-baseline justify-between gap-2"><div><h3 className="text-sm font-semibold">Commercial specification</h3><p className="text-[11px] text-[color:var(--color-muted)]">Adjust the draft operating assumptions; all financials refresh immediately.</p></div><span className="text-[11px] text-[color:var(--color-ok)]">Draft configuration</span></div><div className="mt-4 grid gap-3 md:grid-cols-4"><Field label="First delivery"><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field><Field label="Delivery cadence"><select value={frequency} onChange={(e) => setFrequency(e.target.value as typeof frequency)}><option value="weekly">Weekly</option><option value="fortnightly">Fortnightly</option><option value="monthly">Monthly</option></select></Field><Field label="Trucks per run"><input type="number" min={1} max={20} value={trucks} onChange={(e) => setTrucks(Math.max(1, Number(e.target.value)))} /></Field><Field label="CO₂ price (₹ / t)"><input type="number" min={0} value={price} onChange={(e) => setPrice(Math.max(0, Number(e.target.value)))} /></Field></div><div className="mt-4 rounded-lg border border-[color:var(--color-accent)]/35 bg-[color:var(--color-accent)]/5 p-3 text-[12px]"><b>Draft dispatch plan:</b> first delivery on {startDate}; {trucks} truck{trucks === 1 ? "" : "s"} ({payload} t) {frequencyLabel}; approximately {deliveries} loaded runs per year. <span className="text-[color:var(--color-muted)]">This is a planning record only.</span></div></section>}
  </main>;
}
function Party({ title, name, detail }: { title: string; name: string; detail: string }) { return <div className="glass rounded-xl p-3"><div className="text-[10px] uppercase tracking-wide text-[color:var(--color-muted)]">{title}</div><div className="mt-1 text-sm font-semibold">{name}</div><div className="mt-1 text-[11px] text-[color:var(--color-muted)]">{detail}</div></div>; }
function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-[color:var(--color-border)] p-2.5"><div className="text-[9px] text-[color:var(--color-muted)]">{label}</div><div className="text-sm font-semibold">{value}</div></div>; }
function FinanceRow({ label, value }: { label: string; value: number }) { return <div className="mt-2 flex justify-between text-[12px]"><span className="text-[color:var(--color-muted)]">{label}</span><span className={value < 0 ? "text-[color:var(--color-crit)]" : ""}>{value < 0 ? "−" : ""}{formatInr(Math.abs(value))}</span></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="text-[10px] uppercase tracking-wide text-[color:var(--color-muted)]">{label}<span className="mt-1 block [&_input]:w-full [&_input]:rounded-md [&_input]:border [&_input]:border-[color:var(--color-border)] [&_input]:bg-[color:var(--color-panel-2)] [&_input]:p-2 [&_input]:text-sm [&_input]:text-[color:var(--color-text)] [&_select]:w-full [&_select]:rounded-md [&_select]:border [&_select]:border-[color:var(--color-border)] [&_select]:bg-[color:var(--color-panel-2)] [&_select]:p-2 [&_select]:text-sm [&_select]:text-[color:var(--color-text)]">{children}</span></label>; }
