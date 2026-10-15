import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Phone, User, Home, Clock, HandMetal } from "lucide-react";
import { coordDistance, LEVEL_STYLES } from "@/lib/duplicateDetect";
import { useTranslation } from "@/lib/i18n";

function FieldRow({ label, valueA, valueB, highlight }) {
  const empty = (v) => v === undefined || v === null || v === "";
  const diff = !empty(valueA) && !empty(valueB) && String(valueA) !== String(valueB);
  const showHighlight = highlight || diff;
  return (
    <div className={`grid grid-cols-3 gap-2 items-start py-2 border-b border-border/60 ${showHighlight ? "bg-amber-50 dark:bg-amber-950/20 -mx-2 px-2 rounded" : ""}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium break-words">{empty(valueA) ? <span className="text-muted-foreground">—</span> : String(valueA)}</div>
      <div className="text-sm font-medium break-words">{empty(valueB) ? <span className="text-muted-foreground">—</span> : String(valueB)}</div>
    </div>
  );
}

export default function CompareAddressesDialog({ open, onOpenChange, a, b, level, matchedFields = [], distance, footer }) {
  const { t } = useTranslation();
  if (!a || !b) return null;
  const dist = distance != null ? distance : coordDistance(a, b);
  const levelStyle = LEVEL_STYLES[level] || LEVEL_STYLES.baixa;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><User className="h-5 w-5 text-primary" /> {t("dup.compare_title")}</DialogTitle>
          <DialogDescription>
            {level ? t("dup.possible_dup") : t("dup.compare_two")}
          </DialogDescription>
        </DialogHeader>

        {level && (
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={levelStyle.className}>{levelStyle.label}</Badge>
            {matchedFields.map((f) => (
              <Badge key={f} variant="outline" className="bg-primary/5 text-primary border-primary/20">{f}</Badge>
            ))}
            {dist != null && (
              <Badge variant="outline" className="bg-muted text-muted-foreground">
                <MapPin className="h-3 w-3 mr-1" /> {dist < 1000 ? `${dist} m` : `${(dist / 1000).toFixed(1)} km`}
              </Badge>
            )}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-muted-foreground pb-1">
          <div>{t("dup.field")}</div>
          <div className="flex items-center gap-1"><User className="h-3 w-3" /> {t("dup.register_a")}</div>
          <div className="flex items-center gap-1"><User className="h-3 w-3" /> {t("dup.register_b")}</div>
        </div>
        <div className="max-h-[40vh] overflow-y-auto">
          <FieldRow label={t("dup.name")} valueA={a.name} valueB={b.name} highlight={matchedFields.includes("nome") || matchedFields.includes("nome semelhante") || matchedFields.includes("nome parecido")} />
          <FieldRow label={t("dup.phone")} valueA={a.phone} valueB={b.phone} highlight={matchedFields.includes("telefone")} />
          <FieldRow label={t("dup.gender")} valueA={a.gender} valueB={b.gender} />
          <FieldRow label={t("dup.age")} valueA={a.age} valueB={b.age} />
          <FieldRow label={t("dup.street")} valueA={a.street} valueB={b.street} highlight={matchedFields.includes("rua")} />
          <FieldRow label={t("dup.neighborhood")} valueA={a.neighborhood} valueB={b.neighborhood} highlight={matchedFields.includes("bairro")} />
          <FieldRow label={t("dup.city")} valueA={a.city} valueB={b.city} />
          <FieldRow label={t("dup.coordinates")} valueA={a.lat != null ? `${a.lat}, ${a.lng}` : ""} valueB={b.lat != null ? `${b.lat}, ${b.lng}` : ""} highlight={matchedFields.some((f) => f.startsWith("coordenadas"))} />
          <FieldRow label={t("dup.congregation")} valueA={a.congregation} valueB={b.congregation} highlight={matchedFields.includes("congregação")} />
          <FieldRow label={t("dup.card_number")} valueA={a.card_number} valueB={b.card_number} />
          <FieldRow label={t("dup.language_level")} valueA={a.sign_language_level} valueB={b.sign_language_level} />
          <FieldRow label={t("dup.observations")} valueA={a.observations} valueB={b.observations} />
        </div>

        {footer}
      </DialogContent>
    </Dialog>
  );
}