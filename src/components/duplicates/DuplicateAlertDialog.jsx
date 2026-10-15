import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import CompareAddressesDialog from "./CompareAddressesDialog";
import { useTranslation } from "@/lib/i18n";

// Alerta exibido ANTES de salvar um novo cadastro quando há possíveis duplicados.
// Usuário comum: [Voltar e verificar] / [Salvar mesmo assim]. Não funde.
// Autorizados (ancião/superintendente/admin): botão extra para fundir/abrir existente.
export default function DuplicateAlertDialog({ open, onOpenChange, duplicates = [], candidate, onSaveAnyway, onOpenExisting, offline }) {
  const { t } = useTranslation();
  if (!duplicates.length) return null;
  const top = duplicates[0];
  const rest = duplicates.slice(1);
  const newAddr = candidate || { name: t("dup.new_register") };

  const footer = (
    <div className="flex flex-col gap-2 pt-3">
      {offline && (
        <p className="text-xs text-muted-foreground">{t("dup.offline_note")}</p>
      )}
      {rest.length > 0 && (
        <p className="text-xs text-muted-foreground">{t("dup.other_dups", { n: rest.length })}</p>
      )}
      <div className="flex flex-wrap gap-2 justify-end">
        <Button variant="outline" onClick={() => onOpenChange(false)}>{t("dup.back_verify")}</Button>
        {onOpenExisting && (
          <Button variant="outline" onClick={() => onOpenExisting(top.existing)}>{t("dup.open_existing")}</Button>
        )}
        <Button onClick={() => { onOpenChange(false); onSaveAnyway?.(); }}>
          {offline ? t("dup.continue_offline") : t("dup.save_anyway")}
        </Button>
      </div>
    </div>
  );

  return (
    <CompareAddressesDialog
      open={open}
      onOpenChange={onOpenChange}
      a={newAddr}
      b={top.existing}
      level={top.level}
      matchedFields={top.matchedFields}
      distance={top.distance}
      footer={footer}
    />
  );
}