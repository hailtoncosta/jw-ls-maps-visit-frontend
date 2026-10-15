import { useState, useMemo } from "react";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users as UsersIcon, ShieldCheck, UserMinus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { normalizeRole, ROLE_LABELS } from "@/lib/permissions";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import UserFormDialog from "./UserFormDialog";
import { useTranslation } from "@/lib/i18n";

// Lista de usuários do circuito com filtros (Perfil, Congregação, Status) e edição via formulário hierárquico.
export default function CircuitUsers({ circuito, congObjects, circuitos, users, currentUser, canEditUsers, canManageRoles, canManagePermissions, isAdmin, onReload }) {
  const { t } = useTranslation();
  const ROLES = [
    { value: "publisher", label: t("role.publisher") },
    { value: "helper", label: t("role.helper") },
    { value: "elder", label: t("role.elder") },
    { value: "superintendente", label: t("role.superintendente") },
    { value: "admin", label: t("role.admin") },
  ];
  const roleLabel = (r) => ({ publisher: t("role.publisher"), helper: t("role.helper"), elder: t("role.elder"), superintendente: t("role.superintendente"), admin: t("role.admin") })[r] || r;
  const [editUser, setEditUser] = useState(null);
  const [deleteUser, setDeleteUser] = useState(null);
  const [filterRole, setFilterRole] = useState("all");
  const [filterCong, setFilterCong] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const normKey = (s) => String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  const congNames = (congObjects || []).filter((c) => c.circuito_id === circuito.id).map((c) => c.name);
  // Mapa congregação (normalizado) -> circuito_id, para incluir usuários cujo
  // circuito_id está ausente mas cuja congregação pertence a este circuito.
  const congToCircuit = useMemo(() => {
    const m = {};
    (congObjects || []).forEach((c) => { if (c.name && c.circuito_id) m[normKey(c.name)] = c.circuito_id; });
    return m;
  }, [congObjects]);
  const validCircuitIds = useMemo(() => {
    const s = new Set();
    (congObjects || []).forEach((c) => { if (c.circuito_id) s.add(c.circuito_id); });
    return s;
  }, [congObjects]);
  const circuitUsers = useMemo(
    () => users.filter((u) => (isAdmin || normalizeRole(u.role) !== "admin")
      && ((u.circuito_id && validCircuitIds.has(u.circuito_id)) ? u.circuito_id : (u.congregation ? (congToCircuit[normKey(u.congregation)] || "") : "")) === circuito.id),
    [users, circuito.id, congToCircuit, validCircuitIds, isAdmin]
  );

  const filtered = useMemo(() => {
    return circuitUsers.filter((u) => {
      if (filterRole !== "all" && normalizeRole(u.role) !== filterRole) return false;
      if (filterCong !== "all" && (u.congregation || "") !== filterCong) return false;
      const isActive = u.active !== false;
      if (filterStatus === "active" && !isActive) return false;
      if (filterStatus === "inactive" && isActive) return false;
      return true;
    });
  }, [circuitUsers, filterRole, filterCong, filterStatus]);

  const confirmDelete = async () => {
    if (!deleteUser) return;
    try {
      await api.entities.User.delete(deleteUser.id);
      toast.success(t("admin.user_removed"));
      setDeleteUser(null);
      onReload();
    } catch {
      toast.error(t("admin.user_remove_error"));
    }
  };

  const badgeClass = (r) =>
    r === "admin" ? "bg-primary/10 text-primary border-primary/20" :
    r === "superintendente" ? "bg-chart-4/10 text-chart-4 border-chart-4/20" :
    r === "elder" ? "bg-chart-3/10 text-chart-3 border-chart-3/20" :
    r === "helper" ? "bg-accent/10 text-accent border-accent/20" :
    "bg-muted text-muted-foreground border-border";

  return (
    <div className="bg-card rounded-2xl border border-border p-6 animate-fade-in space-y-4">
      <div className="flex items-center gap-2">
        <UsersIcon className="h-5 w-5 text-primary" />
        <h2 className="font-heading font-semibold">{t("admin.users_title")} ({filtered.length}{filtered.length !== circuitUsers.length && ` / ${circuitUsers.length}`})</h2>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="rounded-xl"><SelectValue placeholder={t("admin.filter_profile")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin.all_profiles")}</SelectItem>
            {ROLES.filter((r) => isAdmin || r.value !== "admin").map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCong} onValueChange={setFilterCong}>
          <SelectTrigger className="rounded-xl"><SelectValue placeholder={t("admin.filter_cong")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin.all_congregations")}</SelectItem>
            {congNames.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="rounded-xl"><SelectValue placeholder={t("admin.filter_status")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin.all_status")}</SelectItem>
            <SelectItem value="active">{t("admin.active_only")}</SelectItem>
            <SelectItem value="inactive">{t("admin.inactive_only")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Cabeçalho da tabela */}
      <div className="hidden sm:grid grid-cols-12 gap-2 px-2 text-xs font-semibold text-muted-foreground uppercase">
        <div className="col-span-3">{t("admin.col_name")}</div>
         <div className="col-span-2">{t("admin.filter_profile")}</div>
         <div className="col-span-2">{t("admin.filter_cong")}</div>
         <div className="col-span-2">{t("admin.filter_status")}</div>
         <div className="col-span-2">{t("admin.col_permissions")}</div>
         <div className="col-span-1 text-right">{t("admin.col_actions")}</div>
      </div>

      <div className="space-y-2">
        {filtered.map((u) => {
          const uRole = normalizeRole(u.role);
          const isActive = u.active !== false;
          return (
            <div key={u.id} className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-center p-3 rounded-xl bg-secondary/40 hover:bg-secondary/70 transition-colors">
              <div className="sm:col-span-3 flex items-center gap-2 min-w-0">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-primary">{(u.full_name || u.email || "?")[0].toUpperCase()}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{u.full_name || "—"}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
              </div>
              <div className="sm:col-span-2">
                <Badge variant="outline" className={`text-xs ${badgeClass(uRole)}`}>{roleLabel(uRole)}</Badge>
              </div>
              <div className="sm:col-span-2 text-xs text-muted-foreground truncate">
                {u.congregation || "—"}
              </div>
              <div className="sm:col-span-2">
                <Badge variant="outline" className={`text-xs ${isActive ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"}`}>
                 {isActive ? t("admin.active") : t("admin.inactive")}
                </Badge>
              </div>
              <div className="sm:col-span-2">
                {canManagePermissions && u.id !== currentUser?.id && (
                  <span className="text-xs text-muted-foreground">
                    {(u.permissions && (u.permissions.includes("*") || u.permissions.length > 0)) ? t("admin.custom") : t("admin.default")}
                  </span>
                )}
              </div>
              <div className="sm:col-span-1 flex items-center justify-end gap-1">
                {canEditUsers && (
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg" onClick={() => setEditUser(u)} title={t("admin.edit")}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {isAdmin && u.id !== currentUser?.id && (
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteUser(u)} title={t("admin.remove")}>
                    <UserMinus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">{t("admin.no_users")}</p>}
      </div>

      <UserFormDialog
        open={!!editUser}
        onOpenChange={(open) => !open && setEditUser(null)}
        mode="edit"
        targetUser={editUser}
        lockedCircuito={circuito}
        circuitos={circuitos}
        congObjects={congObjects}
        currentUser={currentUser}
        onSaved={onReload}
      />

      <AlertDialog open={!!deleteUser} onOpenChange={(open) => !open && setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.remove_user_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteUser && <>{t("admin.remove_user_desc_1")} <strong>{deleteUser.full_name || deleteUser.email}</strong>? {t("admin.remove_user_desc_2")}</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t("admin.remove")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
