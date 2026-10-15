import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "@/api/apiClient";
import pt from "./locales/pt";
import en from "./locales/en";
import fr from "./locales/fr";
import es from "./locales/es";

const LOCALES = { pt, en, fr, es };

// Idiomas disponíveis no seletor. Novos idiomas: adicionar aqui + locale.
export const LANGUAGES = [
  { code: "pt", label: "Português" },
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
];

export const DEFAULT_LANGUAGE = "pt";

const LanguageContext = createContext(null);

/**
 * Provedor de idioma. Persiste a escolha na conta do usuário
 * (api.auth.updateMe) e em localStorage. Português é o padrão.
 * Não altera permissões, dados ou isolamento — apenas textos da interface.
 */
export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(
    () => localStorage.getItem("app_language") || DEFAULT_LANGUAGE
  );

  // Sincroniza com o idioma salvo na conta do usuário quando disponível.
  useEffect(() => {
    let mounted = true;
    api.auth.me().then((u) => {
      if (mounted && u?.language && LOCALES[u.language] && u.language !== language) {
        setLanguage(u.language);
        localStorage.setItem("app_language", u.language);
      }
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  const t = useCallback((key, vars) => {
    let str = LOCALES[language]?.[key] ?? pt[key] ?? key;
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        str = str.replace(new RegExp(`\\{${k}\\}`, "g"), v);
      });
    }
    return str;
  }, [language]);

  const changeLanguage = useCallback(async (code) => {
    if (!LOCALES[code]) return;
    setLanguage(code);
    localStorage.setItem("app_language", code);
    try {
      await api.auth.updateMe({ language: code });
    } catch {
      // Silencioso: a preferência local já foi aplicada.
    }
  }, []);

  return (
    <LanguageContext.Provider value={{ language, t, changeLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(LanguageContext);
  return {
    t: ctx?.t ?? ((k) => k),
    language: ctx?.language ?? DEFAULT_LANGUAGE,
    changeLanguage: ctx?.changeLanguage ?? (async () => {}),
  };
}