import { Link } from "react-router-dom";
import { MapPin, Clock, User, ExternalLink, ChevronRight, AlertTriangle, Flame, Users, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { buildGoogleMapsUrl, getMapsLink } from "@/lib/maps";
import { useTranslation } from "@/lib/i18n";

import ShareAddressButton from "./ShareAddressButton";

const statusColors = {
  "Ativo": "bg-accent/10 text-accent border-accent/20",
  "Inativo": "bg-muted text-muted-foreground border-border",
  "Mudou-se": "bg-chart-3/10 text-chart-3 border-chart-3/20",
  "Não Interessado": "bg-destructive/10 text-destructive border-destructive/20",
};

const genderIcons = {
  "Masculino": "👨",
  "Feminino": "👩",
  "Casal": "👫",
};

export default function AddressCard({ address, sharedWith, onShared, onFinishVisit, finishing, finishDisabled }) {
  const { t } = useTranslation();
  const getDaysSinceVisit = () => {
    if (!address.last_visit_date) return Infinity;
    const visitDate = new Date(address.last_visit_date);
    if (isNaN(visitDate)) return Infinity;
    return Math.floor((Date.now() - visitDate.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getPriorityLevel = () => {
    if (address.status === "Mudou-se" || address.status === "Não Interessado") return null;
    const days = getDaysSinceVisit();
    if (days === Infinity) return { level: "never", label: t("addr.never_visited"), color: "bg-chart-4/10 text-chart-4 border-chart-4/20", icon: AlertTriangle };
    if (days >= 60) return { level: "urgent", label: t("addr.urgent"), color: "bg-destructive/10 text-destructive border-destructive/20", icon: Flame };
    if (days >= 30) return { level: "high", label: t("addr.high_priority"), color: "bg-chart-5/10 text-chart-5 border-chart-5/20", icon: AlertTriangle };
    return null;
  };

  const priority = getPriorityLevel();
  const PriorityIcon = priority?.icon;
  const mapsLink = getMapsLink(address);

  return (
    <div className="bg-card rounded-2xl border border-border hover:shadow-lg hover:border-primary/30 transition-all duration-300 animate-fade-in relative">
    <Link
      to={`/addresses/${address.id}`}
      className="group p-5 block relative"
    >
      {priority && (
        <div className={`absolute top-0 right-0 rounded-tr-2xl rounded-bl-xl px-3 py-1 flex items-center gap-1.5 border-l border-b ${priority.color}`}>
          {PriorityIcon && <PriorityIcon className="h-3 w-3" />}
          <span className="text-[10px] font-bold uppercase tracking-wide">{priority.label}</span>
        </div>
      )}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{genderIcons[address.gender] || "👤"}</span>
          <div>
            <h3 className="font-heading font-semibold text-foreground group-hover:text-primary transition-colors">
              {address.name}
            </h3>
            <p className="text-sm text-muted-foreground">{address.congregation}</p>
          </div>
        </div>
        <Badge variant="outline" className={statusColors[address.status] || statusColors["Ativo"]}>
          {address.status || "Ativo"}
        </Badge>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
          <span className="line-clamp-2">{address.street}{address.neighborhood ? `, ${address.neighborhood}` : ""}{address.city ? ` - ${address.city}` : ""}</span>
        </div>
        {address.last_visit_date && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 shrink-0" />
            <span>{t("addr.last_visit_label")} {address.last_visit_date}</span>
          </div>
        )}
        {address.last_visited_by && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4 shrink-0" />
            <span>{address.last_visited_by}</span>
          </div>
        )}
      </div>

      {sharedWith && (
        <div className="flex items-center gap-1.5 mb-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 px-2.5 py-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">{t("detail.in_use")}</span>
          <Users className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="text-xs text-amber-700 dark:text-amber-300 truncate">{t("detail.shared_with")} {sharedWith.name || "—"}</span>
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-border">
        {mapsLink ? (
          <a
            href={buildGoogleMapsUrl(mapsLink)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => { e.stopPropagation(); }}
            className="flex items-center gap-1.5 text-sm text-primary font-medium hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t("addr.view_maps")}
          </a>
        ) : (
          <span className="text-sm text-muted-foreground">{t("addr.no_coords")}</span>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
    </Link>
    <div className="px-5 pb-4 flex flex-wrap gap-2 empty:hidden">
      <ShareAddressButton address={address} onShared={onShared} />
      {onFinishVisit && (
        <Button variant="outline" className="gap-2 rounded-xl" disabled={finishDisabled || finishing} onClick={onFinishVisit}>
          {finishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          {t("territories.finish_visit")}
        </Button>
      )}
    </div>
    </div>
  );
}