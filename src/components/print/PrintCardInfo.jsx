const GENDER_EMOJI = { Masculino: "👨", Feminino: "👩", Casal: "👫" };

const STATUS_BADGE = {
  Ativo: "bg-teal-100 text-teal-700",
  Inativo: "bg-gray-100 text-gray-600",
  "Mudou-se": "bg-yellow-100 text-yellow-700",
  "Não Interessado": "bg-red-100 text-red-700",
};

// Painel de informações do cartão de impressão (lado esquerdo).
// Compartilhado entre o PrintCard (impressão final) e a prévia do editor,
// garantindo que a prévia corresponda à impressão.
import { useTranslation } from "@/lib/i18n";

export default function PrintCardInfo({ addresses }) {
  const { t } = useTranslation();
  const list = Array.isArray(addresses) ? addresses : [addresses];
  return (
    <div className="h-full w-full bg-white border-r border-border p-2 flex flex-col gap-1.5 overflow-hidden">
      {list.map((address, i) => {
        const neverVisited = !address.last_visit_date && !(address.visit_count > 0);
        return (
          <div key={address.id || i} className="space-y-0.5">
            <div className="flex items-start gap-1">
              <span className="text-sm leading-none shrink-0">{GENDER_EMOJI[address.gender] || "👤"}</span>
              <h3 className="font-bold text-[11px] leading-tight break-words">{address.name}</h3>
            </div>
            {(address.sign_language_level || address.congregation) && (
              <p className="text-[8px] text-muted-foreground leading-tight truncate">
                {address.sign_language_level ? `${t("card.language")}: ${address.sign_language_level}` : address.congregation}
              </p>
            )}
            <p className="text-[8px] leading-tight break-words">
              {address.street}{address.neighborhood ? `, ${address.neighborhood}` : ""}
              {address.city ? ` - ${address.city}` : ""}
            </p>
            <div className="flex flex-wrap gap-0.5">
              {neverVisited && (
                <span className="text-[7px] px-1 py-px rounded-full bg-purple-100 text-purple-700 font-semibold whitespace-nowrap">
                  {t("card.not_visited").toUpperCase()}
                </span>
              )}
              {address.status && (
                <span className={`text-[7px] px-1 py-px rounded-full font-medium whitespace-nowrap ${STATUS_BADGE[address.status] || ""}`}>
                  {address.status}
                </span>
              )}
            </div>
          </div>
        );
      })}
      <div className="mt-auto pt-1">
        <p className="text-[7px] text-muted-foreground italic leading-tight">
          {t("card.footer_note")}
        </p>
      </div>
    </div>
  );
}