import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import UserFormDialog from "./UserFormDialog";
import { useTranslation } from "@/lib/i18n";

// Convite restrito ao circuito aberto: abre o formulário hierárquico com o circuito fixado.
export default function CircuitInvite({ circuito, congObjects, circuitos, isAdmin, currentUser, onReload }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-card rounded-2xl border border-border p-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <UserPlus className="h-5 w-5 text-primary" />
            <h2 className="font-heading font-semibold">{t("admin.invite_in_circuit")}</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("admin.invite_in_circuit_desc")} ({circuito.name}).
          </p>
        </div>
        <Button className="gap-2 rounded-xl shrink-0" onClick={() => setOpen(true)}>
          <UserPlus className="h-4 w-4" />
          {t("admin.invite_btn")}
        </Button>
      </div>

      <UserFormDialog
        open={open}
        onOpenChange={setOpen}
        mode="invite"
        lockedCircuito={circuito}
        circuitos={circuitos}
        congObjects={congObjects}
        currentUser={currentUser}
        onSaved={onReload}
      />
    </div>
  );
}