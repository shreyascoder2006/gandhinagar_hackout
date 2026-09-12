import { create } from "zustand";
import { translations, type Language, type Translations } from "../lib/i18n";

interface LanguageState {
  lang: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof Translations) => string;
}

const STORAGE_KEY = "cci_language";

function getInitialLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "gu" || saved === "hi") {
      return saved;
    }
  } catch {
    // Ignore storage errors in private browsing
  }
  return "en";
}

export const useLanguageStore = create<LanguageState>((set, get) => ({
  lang: getInitialLanguage(),
  setLanguage: (lang: Language) => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
      // Dispatch an event so other listeners (e.g. index.html) can react
      window.dispatchEvent(new CustomEvent("cci_language_change", { detail: { lang } }));
    } catch {
      // Ignore
    }
    set({ lang });
  },
  t: (key: keyof Translations) => {
    const activeLang = get().lang;
    return translations[activeLang]?.[key] ?? translations.en[key] ?? String(key);
  },
}));

export function useTranslation() {
  const lang = useLanguageStore((s) => s.lang);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const t = useLanguageStore((s) => s.t);
  return { lang, setLanguage, t };
}
