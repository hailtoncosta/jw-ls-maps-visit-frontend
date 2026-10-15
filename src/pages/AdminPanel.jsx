import { useState, useEffect } from "react";
import { api, listAdminUsers } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Loader2, Mail, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { useCongregations, useCircuitos, useCongregationObjects } from "@/lib/congregations";
import { normalizeRole, hasPermission } from "@/lib/permissions";
import CircuitList from "@/components/admin/CircuitList";
import CircuitDetail from "@/components/admin/CircuitDetail";
import GlobalBackupCard from "@/components/admin/GlobalBackupCard";
import PendingAddressesCard from "@/components/admin/PendingAddressesCard";
import UserFormDialog from "@/components/admin/UserFormDialog";
import AdminContactSection from "@/components/AdminContactSection";
import GlobalUsersList from "@/components/admin/GlobalUsersList";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { useTranslation } from "@/lib/i18n";

const ROLE_OPTIONS = [
  { value: "publisher", label: "Publicador" },
  { value: "helper", label: "Ajudante" },
  { value: "elder", label: "Ancião" },
  { value: "superintendente", label: "Superint. de Circuito" },
  { value: "admin", label: "Administrador" },
];

export default function AdminPanel() {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedCircuitId, setSelectedCircuitId] = useState(null);

  // Convite global (admin geral)
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("publisher");
  const [inviteCongregation, setInviteCongregation] = useState("");
  const [inviteCircuito, setInviteCircuito] = useState("");
  const [inviting, setInviting] = useState(false);

  // Transferir administração geral
  const [transferTarget, setTransferTarget] = useState(null);
  const [transferConfirm, setTransferConfirm] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [globalInviteOpen, setGlobalInviteOpen] = useState(false);

  const { congregations, reload: reloadCongregations } = useCongregations();
  const { circuitos, reload: reloadCircuitos } = useCircuitos();
  const { items: congObjects, reload: reloadCongObjects } = useCongregationObjects();

  const loadData = async () => {
    const me = await api.auth.me().catch(() => null);
    setCurrentUser(me);
    try {
      // A lista de candidatos a compartilhamento não inclui o perfil, status
      // nem permissões. O painel precisa dos usuários completos do banco.
      const payload = await listAdminUsers();
      if (!Array.isArray(payload) || payload.some((user) => !user.role)) {
        throw new Error("A lista de usuários não retornou os perfis cadastrados.");
      }
      setUsers(payload);
    } catch (error) {
      setUsers([]);
      toast.error("Não foi possível carregar os perfis atuais.", { description: error.message });
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const reloadAll = () => { loadData(); reloadCongregations(); reloadCongObjects(); reloadCircuitos(); };

  const role = normalizeRole(currentUser?.role);
  const isAdmin = role === "admin";
  const canManageUsers = hasPermission(currentUser, "admin_manage_users");

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviting(true);
    try {
      const updates = {};
      if (inviteRole === "superintendente") {
        if (!inviteCircuito) {
          toast.error(t("admin.select_circuit_super"));
          setInviting(false);
          return;
        }
        updates.role = "superintendente";
        updates.circuito_id = inviteCircuito;
        if (inviteCongregation) updates.congregation = inviteCongregation;
      } else {
        if (inviteCongregation) {
          updates.congregation = inviteCongregation;
          const congObj = congObjects.find((c) => c.name === inviteCongregation);
          if (congObj?.circuito_id) updates.circuito_id = congObj.circuito_id;
        }
        if (inviteRole) updates.role = inviteRole;
      }
      const res = await api.functions.invoke("inviteOrUpdateUser", { email: inviteEmail, updates });
      toast.success(res?.data?.action === "updated" ? t("admin.profile_updated", { email: inviteEmail }) : t("admin.invite_sent", { email: inviteEmail }));
      setInviteEmail(""); setInviteCongregation(""); setInviteRole("publisher"); setInviteCircuito("");
      loadData();
    } catch {
      toast.error(t("admin.invite_error"));
    }
    setInviting(false);
  };

  const handleTransferAdmin = async () => {
    if (!transferTarget) return;
    setTransferring(true);
    try {
      await api.functions.invoke("transferAdmin", { targetUserId: transferTarget.id });
      toast.success(t("admin.transfer_success", { name: transferTarget.full_name || transferTarget.email }));
      setTransferConfirm(false);
      setTransferTarget(null);
      setTimeout(() => api.auth.logout("/"), 1800);
    } catch (e) {
      toast.error(e?.message?.includes("Forbidden") ? t("admin.transfer_forbidden") : t("admin.transfer_error"));
    }
    setTransferring(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!canManageUsers) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="h-14 w-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <Shield className="h-7 w-7 text-destructive" />
        </div>
        <h2 className="font-heading font-bold text-xl">{t("admin.restricted")}</h2>
        <p className="text-muted-foreground text-sm text-center max-w-sm">{t("admin.restricted_desc")}</p>
      </div>
    );
  }

  // Superintendente (e demais gestores com circuito atribuído): entra direto no detalhe do seu circuito, sem funções globais.
  if (!isAdmin) {
    const myCircuito = circuitos.find((c) => c.id === currentUser?.circuito_id) || null;
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4 sm:space-y-6">
        <div>
          <h1 className="font-heading font-bold text-2xl">{role === "superintendente" ? t("admin.super_panel") : t("admin.panel")}</h1>
          <p className="text-muted-foreground text-sm">{t("admin.circuit_mgmt")}</p>
        </div>
        <CircuitDetail circuito={myCircuito} congObjects={congObjects} circuitos={circuitos} users={users} currentUser={currentUser} onReload={reloadAll} />
      </div>
    );
  }

  // Admin geral: detalhe de um circuito selecionado
  const selectedCircuit = selectedCircuitId ? circuitos.find((c) => c.id === selectedCircuitId) : null;
  if (selectedCircuit) {
    return (
      <div className="mx-auto w-full max-w-6xl">
        <CircuitDetail
          circuito={selectedCircuit}
          congObjects={congObjects}
          circuitos={circuitos}
          users={users}
          currentUser={currentUser}
          onBack={() => setSelectedCircuitId(null)}
          onReload={reloadAll}
        />
      </div>
    );
  }

  // Admin geral: lista de circuitos + funções globais
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 sm:space-y-6">
      <div>
        <h1 className="font-heading font-bold text-2xl">{t("admin.admin_panel")}</h1>
        <p className="text-muted-foreground text-sm">{t("admin.admin_desc")}</p>
      </div>

      <CircuitList
        circuitos={circuitos}
        congObjects={congObjects}
        users={users}
        onSelect={(id) => setSelectedCircuitId(id)}
        onReload={reloadAll}
      />

      <GlobalUsersList
        users={users}
        currentUser={currentUser}
        circuitos={circuitos}
        congObjects={congObjects}
        onReload={reloadAll}
      />

      {/* Convidar novo usuário (global) — formulário hierárquico */}
      <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 animate-fade-in">
        <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Mail className="h-5 w-5 text-primary" />
              <h2 className="font-heading font-semibold">{t("admin.invite_global")}</h2>
            </div>
            <p className="text-sm text-muted-foreground">{t("admin.invite_global_desc")}</p>
          </div>
          <Button className="w-full gap-2 rounded-xl sm:w-auto sm:shrink-0" onClick={() => setGlobalInviteOpen(true)}>
            <Mail className="h-4 w-4" />
            {t("admin.invite_btn")}
          </Button>
        </div>
        <UserFormDialog
          open={globalInviteOpen}
          onOpenChange={setGlobalInviteOpen}
          mode="invite"
          circuitos={circuitos}
          congObjects={congObjects}
          currentUser={currentUser}
          onSaved={reloadAll}
        />
      </div>

      <PendingAddressesCard congObjects={congObjects} />

      <GlobalBackupCard circuitos={circuitos} congObjects={congObjects} />

      {/* A transferência da administração geral não pertence a um circuito. */}
      {isAdmin && <>
      <div className="bg-card rounded-2xl border border-primary/30 p-4 sm:p-6 animate-fade-in">
        <div className="flex items-center gap-2 mb-2">
          <ArrowLeftRight className="h-5 w-5 text-primary" />
          <h2 className="font-heading font-semibold">{t("admin.transfer_admin")}</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {t("admin.transfer_admin_desc")}
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Select value={transferTarget?.id || ""} onValueChange={(val) => setTransferTarget(users.find((u) => u.id === val) || null)}>
              <SelectTrigger><SelectValue placeholder={t("admin.select_new_admin")} /></SelectTrigger>
              <SelectContent>
                {users.filter((u) => u.id !== currentUser?.id).map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}{normalizeRole(u.role) === "admin" ? " (Admin)" : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="destructive" className="w-full gap-2 rounded-xl sm:w-auto sm:shrink-0" disabled={!transferTarget || transferring} onClick={() => setTransferConfirm(true)}>
          {transferring ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeftRight className="h-4 w-4" />}
          {t("admin.transfer_btn")}
          </Button>
        </div>
      </div>

      <AdminContactSection />
      </>}

      <AlertDialog open={transferConfirm} onOpenChange={(open) => { if (!open) setTransferConfirm(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.transfer_confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {transferTarget && (
                <>
                  {t("admin.transfer_confirm_1")} <strong>{transferTarget.full_name || transferTarget.email}</strong>.<br /><br />
                  {t("admin.transfer_confirm_2")} <strong>{t("admin.transfer_confirm_3")}</strong>. {t("admin.transfer_confirm_4")} <strong>{t("admin.transfer_confirm_5")}</strong> {t("admin.transfer_confirm_6")}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={transferring}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={transferring} onClick={handleTransferAdmin} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {transferring ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t("admin.confirm_transfer")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
