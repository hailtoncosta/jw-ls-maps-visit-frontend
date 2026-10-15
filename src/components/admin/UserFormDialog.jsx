import { useState, useEffect, useMemo } from "react";
import { api } from "@/api/apiClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  normalizeRole, ROLE_LABELS, PERMISSION_CATEGORIES, ALL_PERMISSION_KEYS,
  getEffectivePermissions, DEFAULT_PERMISSIONS,
} from "@/lib/permissions";
import { useTranslation } from "@/lib/i18n";

const CONG_REQUIRED = ["publisher", "helper", "elder"];

const ADDRESS_PERM_KEYS = ["action_view", "action_edit", "action_delete"];

function visiblePermKeys(role) {
  if (role === "admin") return ALL_PERMISSION_KEYS;
  const defaults = DEFAULT_PERMISSIONS[role] || [];
  return [...new Set([...defaults, ...ADDRESS_PERM_KEYS])];
}

export default function UserFormDialog({
  open, onOpenChange, mode = "invite", targetUser, lockedCircuito,
  circuitos, congObjects, currentUser, onSaved,
}) {
  const isEdit = mode === "edit";
  const { t } = useTranslation();
  const callerRole = normalizeRole(currentUser?.role);
  const isCallerAdmin = callerRole === "admin";

  const PROFILE_ORDER = [
    { value: "publisher", label: t("role.publisher") },
    { value: "helper", label: t("role.helper") },
    { value: "elder", label: t("role.elder") },
    { value: "superintendente", label: ROLE_LABELS.superintendente },
    { value: "admin", label: ROLE_LABELS.admin },
  ];

  const circuitLocked = !!lockedCircuito || callerRole === "superintendente";
  const fixedCircuitoId = lockedCircuito?.id || (callerRole === "superintendente" ? currentUser?.circuito_id : "") || (isEdit ? targetUser?.circuito_id : "") || "";

  const [email, setEmail] = useState("");
  const [initialPassword, setInitialPassword] = useState("");
  const [profile, setProfile] = useState("publisher");
  const [circuitoId, setCircuitoId] = useState("");
  const [congregation, setCongregation] = useState("");
  const [congregationId, setCongregationId] = useState("");
  const [perms, setPerms] = useState([]);
  const [manualAccess, setManualAccess] = useState("basic");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (isEdit && targetUser) {
      const r = normalizeRole(targetUser.role);
      setProfile(r);
      // Usa o ID real do circuito travado (contexto do admin) em vez do
      // circuito_id armazenado no usuário, que pode ser inválido (ex.: nome
      // do circuito em vez do ID). Isso garante que a lista de congregações
      // do circuito seja exibida e que o salvamento corrija o circuito_id.
      setCircuitoId(fixedCircuitoId || targetUser.circuito_id || "");
      // Corrige o nome da congregação para o nome canônico cadastrado na entidade
      // Congregation (correspondência normalizada). Resolve o caso de usuários
      // cuja congregação foi armazenada com formatação ligeiramente diferente
      // (ex.: sem acento, espaços diferentes) — o que impedia o campo de exibir a
      // congregação selecionada e o administrador de designá-la/salvá-la.
      {
        const rawCong = targetUser.congregation || "";
        const norm = (s) => String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
        const exact = (congObjects || []).find((c) => c.name === rawCong);
        const matched = exact || (rawCong ? (congObjects || []).find((c) => norm(c.name) === norm(rawCong)) : null);
        setCongregation(matched ? matched.name : rawCong);
        setCongregationId(matched?.id || "");
      }
      setPerms(getEffectivePermissions(targetUser).includes("*") ? [...ALL_PERMISSION_KEYS] : getEffectivePermissions(targetUser));
      setManualAccess(r === "admin" ? "full" : (targetUser.manual_access || "basic"));
      setActive(targetUser.active !== false);
    } else {
      setProfile("publisher");
      setCircuitoId(fixedCircuitoId);
      setCongregation("");
      setCongregationId("");
      setPerms(DEFAULT_PERMISSIONS.publisher);
      setManualAccess("basic");
      setActive(true);
    }
    setEmail("");
    setInitialPassword("");
  }, [open, targetUser, isEdit, fixedCircuitoId]);

  const profileOptions = isCallerAdmin
    ? PROFILE_ORDER
    : PROFILE_ORDER.filter((p) => p.value !== "admin" && p.value !== "superintendente");

  const congOptions = useMemo(
    () => (congObjects || []).filter((c) => c.id && c.name && (!circuitoId || c.circuito_id === circuitoId)),
    [congObjects, circuitoId]
  );

  const congregationRequired = CONG_REQUIRED.includes(profile);
  const visiblePerms = visiblePermKeys(profile);

  const onProfileChange = (v) => {
    setProfile(v);
    if (v === "admin") setManualAccess("full");
    setPerms(v === "admin" ? [...ALL_PERMISSION_KEYS] : (DEFAULT_PERMISSIONS[v] || []));
  };

  const onCircuitoChange = (v) => {
    setCircuitoId(v);
    const congsOf = new Set((congObjects || []).filter((c) => c.circuito_id === v).map((c) => c.name));
    if (!congsOf.has(congregation)) {
      setCongregation("");
      setCongregationId("");
    }
  };

  const onCongregationChange = (id) => {
    const selected = (congObjects || []).find((c) => c.id === id);
    if (!selected) return;
    setCongregation(selected.name);
    setCongregationId(selected.id);
    if (selected.circuito_id) setCircuitoId(selected.circuito_id);
  };

  const togglePerm = (key) => {
    setPerms((prev) => (prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]));
  };

  const validate = () => {
    if (!isEdit && !email.trim()) { toast.error(t("admin.inform_email")); return false; }
    if (!isEdit && initialPassword.length < 8) { toast.error(t("admin.password_min")); return false; }
    if (!profile) { toast.error(t("admin.select_profile")); return false; }
    if (profile === "superintendente" && !circuitoId) { toast.error(t("admin.select_circuit_super")); return false; }
    if (profile === "superintendente" && !congregationId) { toast.error("Selecione a congregação do superintendente."); return false; }
    if (congregationRequired && !congregation) { toast.error(t("admin.select_congregation")); return false; }
    if (congregationRequired && !circuitoId) { toast.error(t("admin.select_circuit")); return false; }
    if (congregation) {
      const cong = (congObjects || []).find((c) => c.id === congregationId);
      if (cong && cong.circuito_id !== circuitoId) {
        toast.error(t("admin.cong_not_in_circuit"));
        return false;
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const congObj = (congObjects || []).find((c) => c.id === congregationId);
      const updates = {
        role: profile,
        congregation: congregation || "",
        // UUID vazio não é aceito pelo Spring e cancela toda a atualização.
        ...(congObj?.id ? { congregation_id: congObj.id } : {}),
        ...(circuitoId ? { circuito_id: circuitoId } : {}),
        permissions: profile === "admin" ? ["*"] : perms.length === 0 ? ["__none__"]
          : ALL_PERMISSION_KEYS.every((key) => perms.includes(key)) ? ["*"] : perms,
        manual_access: profile === "admin" ? "full" : manualAccess,
        active,
      };
      if (!isEdit) updates.password = initialPassword;
      if (isEdit) {
        const response = await api.functions.invoke("updateCongregationUser", { userId: targetUser.id, updates });
        if (normalizeRole(response?.data?.role) !== profile) {
          throw new Error("O perfil retornado pelo servidor não corresponde ao perfil selecionado.");
        }
        toast.success(t("admin.user_updated"));
      } else {
        const response = await api.functions.invoke("inviteOrUpdateUser", { email: email.trim(), updates });
        toast.success(
          response?.data?.action === "updated"
            ? t("admin.profile_updated", { email: email.trim() })
            : t("admin.invite_sent", { email: email.trim() })
        );
      }
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      toast.error(e?.status === 403 ? t("admin.no_perm_op") : t("admin.user_save_error"), {
        description: e?.message,
      });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {isEdit ? `${t("admin.edit_user")} — ${targetUser?.full_name || targetUser?.email || ""}` : t("admin.invite_user")}
          </DialogTitle>
          <DialogDescription>
            {t("admin.user_form_desc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* 1. Perfil */}
          {!isEdit && (
            <>
              <div className="space-y-1.5">
                <Label>{t("admin.email")}</Label>
                <Input type="email" autoComplete="off" placeholder="email@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("admin.initial_password")}</Label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  placeholder={t("admin.initial_password_ph")}
                  value={initialPassword}
                  onChange={(e) => setInitialPassword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{t("admin.initial_password_hint")}</p>
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <Label>{t("admin.step_profile")}</Label>
            <Select value={profile} onValueChange={onProfileChange}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {profileOptions.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* 2. Circuito */}
          <div className="space-y-1.5">
            <Label>{t("admin.step_circuit")}</Label>
            {circuitLocked ? (
              <div className="rounded-xl border border-input bg-secondary/40 px-3 py-2 text-sm">
                 {circuitos?.find((c) => c.id === circuitoId)?.name || t("admin.no_circuit_short")}
               </div>
              ) : (
               <Select value={circuitoId} onValueChange={onCircuitoChange}>
                 <SelectTrigger className="rounded-xl"><SelectValue placeholder={t("admin.select_circuit")} /></SelectTrigger>
                <SelectContent>
                  {(circuitos || []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {profile === "admin" && (
              <p className="text-xs text-muted-foreground">{t("admin.admin_circuit_optional")}</p>
            )}
          </div>

          {/* 3. Congregação */}
          <div className="space-y-1.5">
            <Label>{t("admin.step_cong")} {congregationRequired && <span className="text-destructive">*</span>}</Label>
            <Select value={congregationId} onValueChange={onCongregationChange}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder={t("admin.select_cong")} /></SelectTrigger>
              <SelectContent>
                {congOptions.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}{!circuitoId && c.circuito ? ` — ${c.circuito}` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
            {profile === "superintendente" && (
              <p className="text-xs text-muted-foreground">{t("admin.super_cong_optional")}</p>
            )}
          </div>

          {/* 4. Permissões */}
          <div className="space-y-3 rounded-xl border border-border p-4">
            <div>
              <Label>{t("admin.step_perms")}</Label>
              <p className="text-xs text-muted-foreground mt-0.5">{profile === "admin" ? "O Administrador geral administra o sistema e possui todas as permissões, em todos os circuitos e congregações." : t("admin.perms_hint")}</p>
            </div>
            {Object.entries(PERMISSION_CATEGORIES).map(([catKey, cat]) => {
              const items = cat.permissions.filter((p) => visiblePerms.includes(p.key));
              if (items.length === 0) return null;
              const isAddressCat = catKey === "addresses";
              return (
                <div key={catKey} className={isAddressCat ? "space-y-2 rounded-lg bg-primary/5 border border-primary/20 p-3" : "space-y-1.5"}>
                  <p className="text-sm font-semibold">{cat.label}</p>
                  <div className={isAddressCat ? "space-y-2" : "grid grid-cols-1 sm:grid-cols-2 gap-1"}>
                    {items.map((perm) => (
                      <label key={perm.key} className={isAddressCat ? "flex items-start gap-2.5 p-1.5 rounded-lg hover:bg-secondary/50 cursor-pointer" : "flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-secondary/50 cursor-pointer"}>
                        <Checkbox disabled={profile === "admin"} checked={profile === "admin" || perms.includes(perm.key)} onCheckedChange={() => togglePerm(perm.key)} className={isAddressCat ? "mt-0.5" : ""} />
                        <div>
                          <span className="text-sm select-none block">{perm.label}</span>
                          {perm.desc && <span className="text-xs text-muted-foreground block">{perm.desc}</span>}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
            {isCallerAdmin && (
              <div className="space-y-1.5 pt-2 border-t border-border">
                <Label>{t("admin.manual_instruction")}</Label>
                <Select disabled={profile === "admin"} value={profile === "admin" ? "full" : manualAccess} onValueChange={setManualAccess}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">{t("admin.manual_basic")}</SelectItem>
                    <SelectItem value="full">{t("admin.manual_full")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* 5. Status da conta */}
          <div className="flex items-center justify-between rounded-xl border border-border p-4">
            <div>
              <Label>{t("admin.step_status")}</Label>
              <p className="text-xs text-muted-foreground mt-0.5">{t("admin.inactive_hint")}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{active ? t("admin.active") : t("admin.inactive")}</span>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)} disabled={saving}>{t("common.cancel")}</Button>
          <Button className="rounded-xl gap-2" disabled={saving} onClick={handleSave}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isEdit ? <ShieldCheck className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
            {isEdit ? t("admin.save") : t("admin.send_invite")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
