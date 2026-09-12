import { NavLink } from "react-router-dom";
import { useFactoryStore } from "../../store/useFactoryStore";
import { useTranslation } from "../../store/useLanguageStore";
import { languageNames, type Language, type Translations } from "../../lib/i18n";

const linkConfigs: { to: string; labelKey: keyof Translations }[] = [
  { to: "/", labelKey: "navDiagnose" },
  { to: "/simulate", labelKey: "navSimulate" },
  { to: "/plan", labelKey: "navActionPlan" },
  { to: "/regulator", labelKey: "navRegulator" },
  { to: "/portfolio", labelKey: "navPortfolio" },
  { to: "/co2-exchange", labelKey: "navCo2Exchange" },
  { to: "/intake", labelKey: "navIntake" },
];

export default function Header() {
  const factory = useFactoryStore((s) => s.baseline);
  const factories = useFactoryStore((s) => s.factories);
  const setFactory = useFactoryStore((s) => s.setFactory);
  const { lang, setLanguage, t } = useTranslation();

  return (
    <header className="flex items-center justify-between border-b border-[color:var(--color-border)] px-4 md:px-6 py-2.5">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[color:var(--color-accent)]/15 text-[color:var(--color-accent)]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2 L21 7 V17 L12 22 L3 17 V7 Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="3" fill="currentColor" />
          </svg>
        </div>
        <div>
          <div className="text-sm font-semibold leading-tight">{t("brandTitle")}</div>
          <div className="text-[11px] leading-tight text-[color:var(--color-muted)]">{t("brandSubtitle")}</div>
        </div>
      </div>

      <nav className="hidden items-center gap-1 md:flex">
        {linkConfigs.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === "/"}
            className={({ isActive }) =>
              `rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive ? "bg-[color:var(--color-panel-2)] text-[color:var(--color-text)]" : "text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]"
              }`
            }
          >
            {t(l.labelKey)}
          </NavLink>
        ))}
      </nav>

      <div className="flex items-center gap-3 text-right">
        {/* Language Switcher */}
        <div className="flex items-center rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-0.5 text-xs font-medium shadow-sm">
          {(["en", "gu", "hi"] as Language[]).map((l) => (
            <button
              key={l}
              onClick={() => setLanguage(l)}
              className={`rounded-md px-2 py-1 transition-all text-[11px] ${
                lang === l
                  ? "bg-[color:var(--color-accent)] text-[#07101c] font-bold shadow-sm"
                  : "text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]"
              }`}
              title={languageNames[l].label}
            >
              {languageNames[l].native}
            </button>
          ))}
        </div>

        <div>
          <select
            value={factory.id}
            onChange={(e) => setFactory(e.target.value)}
            className="max-w-[220px] cursor-pointer rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-panel)] px-2 py-1 text-sm font-medium text-[color:var(--color-text)] outline-none hover:bg-[color:var(--color-panel-2)]"
            title={t("switchFactory")}
          >
            {factories.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <div className="mt-0.5 text-[11px] leading-tight text-[color:var(--color-muted)]">
            {factory.cluster} · {factory.sector}
          </div>
        </div>
        <span
          className={`hidden sm:inline-block rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide ${
            factory.dataSource === "synthetic"
              ? "border-[color:var(--color-warn)] text-[color:var(--color-warn)]"
              : "border-[color:var(--color-ok)] text-[color:var(--color-ok)]"
          }`}
        >
          {factory.dataSource === "synthetic" ? t("illustrativeData") : t("selfReportedData")}
        </span>
      </div>
    </header>
  );
}
