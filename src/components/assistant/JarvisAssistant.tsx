import { useRef, useState } from "react";
import { useFactoryStore } from "../../store/useFactoryStore";
import { useTranslation } from "../../store/useLanguageStore";

type Message = { role: "jarvis" | "user"; text: string };
type Recognition = { continuous: boolean; interimResults: boolean; lang: string; start: () => void; stop: () => void; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
type RecognitionCtor = new () => Recognition;

function response(query: string, f: ReturnType<typeof useFactoryStore.getState>["baseline"]) {
  const q = query.toLowerCase();
  const hotspots = f.nodes.filter((n) => n.severity === "crit");
  if (/hello|hi\b|help|what can you do|નમસ્તે|नमस्ते/.test(q)) return `I am JARVIS, your Carbon Intelligence guide. Ask about ${f.name}, process hotspots, the regulator scene, CO₂ Exchange, or how to update factory data.`;
  if (/hotspot|problem|priority|emission|હોટસ્પોટ|हॉटस्पॉट/.test(q)) return `${f.name} has ${hotspots.length} hotspot process${hotspots.length === 1 ? "" : "es"}. ${hotspots.slice(0, 2).map((n) => `${n.label}: ${n.co2eTpy.toLocaleString("en-IN")} tCO₂e per year`).join("; ") || "No critical processes are currently flagged"}. Open Diagnose and click a machine for its root cause and interventions.`;
  if (/co2|carbon|emission total|કાર્બન|कार्बन/.test(q)) return `${f.name}'s current modelled footprint is ${f.totalCo2eTpy.toLocaleString("en-IN")} tCO₂e per year. CO₂ Exchange estimates capture-ready surplus from combustion process emissions; it is a screening tool, not a verified inventory.`;
  if (/exchange|market|deal|borrow|lend|supplier|એક્સચેન્જ|एक्सचेंज/.test(q)) return `In CO₂ Exchange, select a supplier and then a network string. The full deal workspace lets you accept a non-binding proposal, set delivery date, cadence, truck count and CO₂ price, then see material, capture, freight and delivered-cost estimates update instantly.`;
  if (/regulator|morbi|cluster|map|નિયમનકાર|नियामक/.test(q)) return `The Regulator view aggregates factories by industrial cluster. Select Morbi or another cluster to zoom in; factory buildings rise from the map and their cards show each unit's contribution. Private participants remain anonymised.`;
  if (/edit|intake|layout|component|data|લેઆઉટ|ડેટા|डेटा/.test(q)) return `For a self-reported factory, open Diagnose and choose “Edit layout & components.” You can revise process energy data, output and waste figures, then reposition 3D process components. Saving refreshes diagnosis, the twin and regulator rollups.`;
  if (/circular|waste|reuse|કચરો|कचरा/.test(q)) return `${f.name}'s circularity ratio is ${Math.round(f.circularityRatio * 100)}%. The platform uses waste-to-input matches to identify nearby industrial symbiosis opportunities; those matches need commercial and regulatory validation.`;
  return `I can help with this prototype’s live data and workflows. Try “What are the hotspots?”, “How does CO₂ Exchange work?”, “How do I edit this factory?”, or “Explain the regulator map.”`;
}

export default function JarvisAssistant() {
  const factory = useFactoryStore((s) => s.baseline);
  const { lang, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [voice, setVoice] = useState(true);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([{ role: "jarvis", text: t("jarvisGreeting") }]);
  const recognition = useRef<Recognition | null>(null);

  const speechLang = lang === "gu" ? "gu-IN" : lang === "hi" ? "hi-IN" : "en-IN";

  const speak = (text: string) => {
    if (voice && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = speechLang;
      window.speechSynthesis.speak(u);
    }
  };

  const ask = (query: string) => {
    const clean = query.trim();
    if (!clean) return;
    const answer = response(clean, factory);
    setMessages((all) => [...all, { role: "user", text: clean }, { role: "jarvis", text: answer }]);
    setDraft("");
    speak(answer);
  };

  const startVoice = () => {
    const ctor = (window as Window & { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }).SpeechRecognition ?? (window as Window & { webkitSpeechRecognition?: RecognitionCtor }).webkitSpeechRecognition;
    if (!ctor) {
      setMessages((all) => [...all, { role: "jarvis", text: "Voice input is not available in this browser. You can still type any question below." }]);
      return;
    }
    const rec = new ctor();
    rec.lang = speechLang;
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (event) => {
      const heard = event.results[0]?.[0]?.transcript ?? "";
      setListening(false);
      ask(heard);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognition.current = rec;
    setListening(true);
    rec.start();
  };

  const samplePrompts = [t("jarvisPrompt1"), t("jarvisPrompt2"), t("jarvisPrompt3")];

  return (
    <div className="fixed bottom-4 right-4 z-[1000]">
      {open && (
        <section className="jarvis-panel mb-3 flex h-[470px] w-[350px] flex-col overflow-hidden rounded-2xl border border-[#3ea6ff]/45 bg-[#0d1420]/95 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-[color:var(--color-border)] bg-[#3ea6ff]/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="jarvis-orb" />
              <div>
                <div className="text-sm font-semibold">{t("jarvisTitle")}</div>
                <div className="text-[10px] text-[#92caff]">{t("jarvisSub")}</div>
              </div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setVoice((v) => !v)} title="Toggle spoken answers" className={`rounded p-1.5 text-xs ${voice ? "text-[#3ea6ff]" : "text-[color:var(--color-muted)]"}`}>
                {voice ? "◖))" : "◖×"}
              </button>
              <button onClick={() => setOpen(false)} className="rounded p-1.5 text-[color:var(--color-muted)]">×</button>
            </div>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.map((m, i) => (
              <div key={i} className={`max-w-[90%] rounded-xl px-3 py-2 text-[12px] leading-relaxed ${m.role === "jarvis" ? "bg-[#172335] text-[color:var(--color-text)]" : "ml-auto bg-[#3ea6ff] text-[#07101c]"}`}>
                {m.text}
              </div>
            ))}
          </div>
          <div className="border-t border-[color:var(--color-border)] p-3">
            <div className="mb-2 flex flex-wrap gap-1">
              {samplePrompts.map((prompt) => (
                <button key={prompt} onClick={() => ask(prompt)} className="rounded-full border border-[color:var(--color-border)] px-2 py-1 text-[10px] text-[color:var(--color-muted)] hover:border-[#3ea6ff]/60 hover:text-[#b9dcff]">
                  {prompt}
                </button>
              ))}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); ask(draft); }} className="flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t("jarvisAskPlaceholder")}
                className="min-w-0 flex-1 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-panel-2)] px-3 py-2 text-xs outline-none focus:border-[#3ea6ff]"
              />
              <button
                type="button"
                onClick={startVoice}
                className={`rounded-lg border px-2.5 text-xs ${listening ? "border-[color:var(--color-crit)] bg-[color:var(--color-crit)]/15 text-[color:var(--color-crit)]" : "border-[color:var(--color-border)] text-[#9fd3ff]"}`}
              >
                {listening ? "●" : "◉"}
              </button>
              <button className="rounded-lg bg-[#3ea6ff] px-3 text-xs font-bold text-[#07101c]">↑</button>
            </form>
          </div>
        </section>
      )}
      <button
        onClick={() => setOpen((x) => !x)}
        className="flex items-center gap-2 rounded-full border border-[#3ea6ff]/60 bg-[#101b2b] px-4 py-3 text-sm font-semibold text-[#d9ecff] shadow-lg shadow-[#3ea6ff]/15 hover:bg-[#16283f]"
      >
        <span className="jarvis-orb" /> {t("jarvisButton")}
      </button>
    </div>
  );
}
