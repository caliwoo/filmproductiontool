import { createContext, useContext, useMemo, useState } from 'react';
import en from './en.js';
import es from './es.js';

const DICTIONARIES = { en, es };
const STORAGE_KEY = 'omnislate_lang';

function resolvePath(dict, path) {
  return path.split('.').reduce((node, part) => (node == null ? node : node[part]), dict);
}

// Renders a {{count}}-shaped entry ({ one, other }) or a plain string,
// substituting any {{token}} placeholders from params.
function format(value, params) {
  if (value == null) return null;
  if (typeof value === 'object') {
    value = params && params.count === 1 ? value.one : value.other;
  }
  if (typeof value !== 'string') return value;
  return value.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const replacement = params ? params[key] : undefined;
    return replacement == null ? '' : replacement;
  });
}

// Looks up `key` in the active language, falling back to English when the
// active language is missing it -- this is what lets a brand-new English
// string show up immediately everywhere instead of breaking or going
// blank in Spanish before someone gets around to translating it.
function translate(lang, key, params) {
  const active = resolvePath(DICTIONARIES[lang], key);
  const fallback = resolvePath(DICTIONARIES.en, key);
  const raw = active !== undefined ? active : fallback;
  if (raw === undefined) return key;
  return format(raw, params);
}

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'en' || stored === 'es') return stored;
    } catch {
      // localStorage unavailable (private mode, etc.) -- just default below
    }
    return 'en';
  });

  function setLang(next) {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // best-effort persistence only
    }
  }

  const value = useMemo(
    () => ({
      lang,
      setLang,
      t: (key, params) => translate(lang, key, params),
    }),
    [lang]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}
