import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { hasPermission, normalizeRole } from "@/lib/permissions";
import CircuitInvite from "./CircuitInvite";
import CircuitCongregations from "./CircuitCongregations";
import CircuitUsers from "./CircuitUsers";
import CircuitTrash from "./CircuitTrash";
import CircuitBackup from "./CircuitBackup";
import { useTranslation } from "@/lib/i18n";

// Vista de detalhe de um circuito: todas as ações isoladas daquele circuito.
// onBack é opcional (apenas admin geral volta à lista de circuitos).
export default function CircuitDetail({ circuito, congObjects, circuitos, users, currentUser, onBack, onReload }) {
  const { t } = useTranslation();
  if (!circuito) {
    return (
      <div className="bg-card rounded-2xl border border-border p-8 text-center">
        <p className="text-muted-foreground">{t("admin.no_circuit_assigned")}</p>
      </div>
    );
  }

  const role = normalizeRole(currentUser?.role);
  const canEditUsers = role === "admin" || role === "superintendente";
  const canManageRoles = hasPermission(currentUser, "admin_change_roles");
  const canManageCongregations = hasPermission(currentUser, "admin_manage_congregations");
  const canManagePermissions = hasPermission(currentUser, "admin_manage_permissions");
  const isAdmin = role === "admin";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {onBack && (
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <div>
          <h1 className="font-heading font-bold text-2xl">{circuito.name}</h1>
          <p className="text-muted-foreground text-sm">{t("admin.circuit_mgmt_isolated")}</p>
        </div>
      </div>

      {canEditUsers && (
        <CircuitInvite circuito={circuito} congObjects={congObjects} circuitos={circuitos} isAdmin={isAdmin} currentUser={currentUser} onReload={onReload} />
      )}
      {canManageCongregations && (
        <CircuitCongregations circuito={circuito} congObjects={congObjects} isAdmin={isAdmin} onReload={onReload} />
      )}
      <CircuitUsers
        circuito={circuito}
        congObjects={congObjects}
        circuitos={circuitos}
        users={users}
        currentUser={currentUser}
        canEditUsers={canEditUsers}
        canManageRoles={canManageRoles}
        canManagePermissions={canManagePermissions}
        isAdmin={isAdmin}
        onReload={onReload}
      />
      {hasPermission(currentUser, "admin_trash") && (
        <CircuitTrash circuito={circuito} congObjects={congObjects} />
      )}
      {hasPermission(currentUser, "admin_backup_restore") && (
        <CircuitBackup circuito={circuito} congObjects={congObjects} />
      )}
    </div>
  );
}