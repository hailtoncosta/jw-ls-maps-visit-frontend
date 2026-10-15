import { User, Hand, MapPin, House, Clock, FileText } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

// Coluna de informações do cartão — réplica visual aprovada do cartão digital,
// usada pelo cartão impresso (PrintCard) e pela prévia do editor.
// Não altera o cartão digital (que tem sua própria implementação).
function InfoRow({ icon: Icon, label, value, fallback = "—" }) {
  const hasValue = value !== undefined && value !== null && value !== "";
  return (
    <div className="flex items-start gap-1.5">
      <Icon className="h-3 w-3 text-accent mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[7px] uppercase tracking-wide text-muted-foreground leading-none mb-0.5">{label}</p>
        <p className="text-[10px] font-medium leading-tight line-clamp-2">{hasValue ? value : fallback}</p>
      </div>
    </div>
  );
}

export default function CardInfoColumn({ address }) {
  const { t } = useTranslation();
  const addr = address || {};
  const addrLine = [addr.street, addr.neighborhood, addr.city, addr.state].filter(Boolean).join(", ");
  const lastVisit = [addr.last_visit_date, addr.last_visit_time].filter(Boolean).join(" ");
  return (
    <div className="flex flex-col h-full bg-card">
      {/* Cabeçalho verde */}
      <div className="bg-accent text-accent-foreground px-3 py-2 flex items-center gap-2">
        <div className="h-7 w-7 rounded-md bg-white flex items-center justify-center shrink-0">
          <span className="font-heading font-extrabold text-accent text-[10px]">JW</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-heading font-bold text-[11px] leading-tight truncate">{addr.congregation || t("card.congregation")}</p>
          <p className="text-[8px] opacity-90 leading-none mt-0.5">{t("card.number", { n: addr.card_number != null ? String(addr.card_number).padStart(4, "0") : "—" })}</p>
        </div>
      </div>

      {/* Corpo — informações */}
      <div className="flex-1 p-2.5 space-y-2 overflow-hidden bg-card">
        <InfoRow icon={User} label={t("card.person")} value={`${addr.name || ""}${addr.gender ? ` (${addr.gender})` : ""}`.trim()} />
        <InfoRow icon={Hand} label={t("card.language")} value={addr.sign_language_level} />
        <InfoRow icon={MapPin} label={t("card.address")} value={addrLine} />
        <InfoRow icon={House} label={t("card.congregation")} value={addr.congregation} />
        <InfoRow icon={Clock} label={t("card.last_visit")} value={lastVisit} />
        <InfoRow icon={User} label={t("card.visited_by")} value={addr.last_visited_by} fallback={t("card.not_visited")} />
        <InfoRow icon={FileText} label={t("card.observations")} value={addr.observations} />
      </div>

      {/* Rodapé — escritura */}
      <div className="bg-secondary/60 px-2.5 py-1.5">
        <p className="text-[7px] italic text-muted-foreground leading-tight">
          {t("card.scripture")}
        </p>
        {addr.last_visit_date && (
          <p className="text-[7px] text-muted-foreground/80 mt-0.5">{t("card.updated", { date: addr.last_visit_date })}</p>
        )}
      </div>
    </div>
  );
}