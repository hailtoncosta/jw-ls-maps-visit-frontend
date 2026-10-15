import { useState, useRef, useEffect } from "react";
import { Globe, Check, ChevronDown } from "lucide-react";
import { LANGUAGES, useTranslation } from "@/lib/i18n";

// Seletor compacto de idioma da interface para o canto superior direito.
// Usa a mesma preferência do LanguageSelector em Configurações — não
// cria um segundo sistema de idioma.
export default function LanguageSwitcher() {
  const { language, changeLanguage, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-full border border-border bg-card/80 backdrop-blur px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors select-none"
        title={t("language.label")}
      >
        <Globe className="h-4 w-4 text-primary" />
        <span className="hidden sm:inline uppercase">{language}</span>
        <ChevronDown className="h-3 w-3 hidden sm:inline" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-40 rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => { changeLanguage(l.code); setOpen(false); }}
              className={`flex items-center justify-between w-full px-3 py-2 text-sm transition-colors ${
                l.code === language
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-foreground hover:bg-accent/10"
              }`}
            >
              {l.label}
              {l.code === language && <Check className="h-4 w-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}