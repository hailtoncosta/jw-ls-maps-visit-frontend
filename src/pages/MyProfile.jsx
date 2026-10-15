import { useState, useEffect } from "react";
import { api, downloadSystemBackup } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Mail, Phone, Shield, MapPin, House, Save, Loader2, CheckCircle2, CircleSlash, KeyRound, Eye, EyeOff, ListChecks, Database, Download } from "lucide-react";
import { toast } from "sonner";
import { normalizeRole, ROLE_LABELS, PERMISSION_CATEGORIES, getEffectivePermissions } from "@/lib/permissions";
import { useTranslation } from "@/lib/i18n";

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-border last:border-0">
      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value || "—"}</p>
      </div>
    </div>
  );
}

export default function MyProfile() {
  const [user, setUser] = useState(null);
  const [circuits, setCircuits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [publisherName, setPublisherName] = useState("");
  const [editingPassword, setEditingPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { t } = useTranslation();

  useEffect(() => {
    Promise.all([
      api.auth.me(),
      api.entities.Circuito.list("name", 200).catch(() => []),
    ]).then(([u, cs]) => {
      setUser(u);
      setCircuits(cs || []);
      setPublisherName(u?.publisher_name || "");
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const role = normalizeRole(user?.role);
  const roleLabel = ROLE_LABELS[role] || role;
  const effectivePermissions = getEffectivePermissions(user);
  const allPermissions = effectivePermissions.includes("*");
  const grantedCategories = Object.entries(PERMISSION_CATEGORIES).map(([key, category]) => ({
    key,
    label: category.label,
    permissions: category.permissions.filter((permission) =>
      allPermissions || effectivePermissions.includes(permission.key)
    ),
  })).filter((category) => category.permissions.length > 0);
  const circuitName =
    circuits.find((c) => c.id === user?.circuito_id)?.name ||
    user?.circuito_id ||
    "—";

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.auth.updateMe({ publisher_name: publisherName });
      setUser((u) => ({ ...u, publisher_name: publisherName }));
      toast.success(t("profile.save_success"));
    } catch {
      toast.error(t("profile.save_error"));
    }
    setSaving(false);
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("As novas senhas não coincidem.");
      return;
    }
    if (newPassword.length < 8 || newPassword.length > 128) {
      toast.error("A nova senha deve ter entre 8 e 128 caracteres.");
      return;
    }
    setChangingPassword(true);
    try {
      await api.auth.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswords(false);
      setEditingPassword(false);
      toast.success("Senha alterada com sucesso.");
    } catch (error) {
      toast.error(error.message || "Não foi possível alterar a senha.");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSystemBackup = async () => {
    setBackingUp(true);
    try {
      await downloadSystemBackup();
      toast.success("Backup completo baixado com sucesso.");
    } catch (error) {
      toast.error(error.message || "Não foi possível criar o backup completo.");
    } finally {
      setBackingUp(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const isActive = user?.active !== false;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-heading font-bold text-2xl">{t("profile.title")}</h1>
        <p className="text-muted-foreground text-sm">{t("profile.subtitle")}</p>
      </div>

      <div className="bg-card rounded-2xl border border-border p-6 animate-fade-in">
        <div className="flex items-center gap-4 mb-2">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="h-8 w-8 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="font-heading font-semibold text-lg truncate">
              {user?.full_name || publisherName || t("profile.member")}
            </h2>
            <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
            <span className="inline-block mt-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
              {roleLabel}
            </span>
          </div>
        </div>
        <div className="mt-2">
          <InfoRow icon={Mail} label={t("profile.email")} value={user?.email} />
          {user?.phone ? <InfoRow icon={Phone} label={t("profile.phone")} value={user.phone} /> : null}
          <InfoRow icon={Shield} label={t("profile.role")} value={roleLabel} />
          <InfoRow icon={MapPin} label={t("profile.circuit")} value={circuitName} />
          <InfoRow icon={House} label={t("profile.congregation")} value={user?.congregation} />
          <InfoRow
            icon={isActive ? CheckCircle2 : CircleSlash}
            label={t("profile.account_status")}
            value={isActive ? t("profile.active") : t("profile.inactive")}
          />
        </div>
      </div>

      {role === "admin" && (
        <div className="bg-card rounded-2xl border border-border p-6 space-y-4 animate-fade-in">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <h2 className="font-heading font-semibold">Backup completo do sistema</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Baixe um arquivo ZIP com todas as tabelas do banco de dados, incluindo usuários,
            endereços, congregações e visitas, além dos arquivos e fotos enviados.
          </p>
          <p className="text-xs text-muted-foreground">
            O arquivo contém dados pessoais e credenciais protegidas. Guarde-o em local seguro.
            A restauração automática deste ZIP ainda não está disponível.
          </p>
          <Button onClick={handleSystemBackup} disabled={backingUp} className="gap-2 rounded-xl">
            {backingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {backingUp ? "Criando backup..." : "Baixar backup completo"}
          </Button>
        </div>
      )}

      <div className="bg-card rounded-2xl border border-border p-6 space-y-4 animate-fade-in">
        <div className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-primary" />
          <h2 className="font-heading font-semibold">Funções liberadas para você</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Permissões atuais da sua conta, definidas pelo administrador e pelo seu perfil.
        </p>
        {grantedCategories.length ? grantedCategories.map((category) => (
          <div key={category.key} className="space-y-2">
            <h3 className="text-sm font-semibold">{category.label}</h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {category.permissions.map((permission) => (
                <li key={permission.key} className="flex items-start gap-2 rounded-lg bg-primary/5 px-3 py-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>{permission.label}</span>
                </li>
              ))}
            </ul>
          </div>
        )) : <p className="text-sm text-muted-foreground">Nenhuma função liberada.</p>}
      </div>

      <div className="bg-card rounded-2xl border border-border p-6 space-y-4 animate-fade-in">
        <div className="flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          <h2 className="font-heading font-semibold">{t("profile.personal_data")}</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("profile.managed_note")}
        </p>
        <div>
          <Label>{t("profile.publisher_name")}</Label>
          <Input
            placeholder={t("profile.publisher_name_ph")}
            value={publisherName}
            onChange={(e) => setPublisherName(e.target.value)}
          />
        </div>
        <Button onClick={handleSave} className="gap-2 rounded-xl" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t("profile.save")}
        </Button>
      </div>

      <div className="bg-card rounded-2xl border border-border p-6 space-y-4 animate-fade-in">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" />
          <h2 className="font-heading font-semibold">Senha da conta</h2>
        </div>
        {!editingPassword ? (
          <Button variant="outline" className="rounded-xl gap-2" onClick={() => setEditingPassword(true)}>
            <KeyRound className="h-4 w-4" /> Alterar senha
          </Button>
        ) : (
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="profile-current-password">Senha atual</Label>
              <Input id="profile-current-password" type={showPasswords ? "text" : "password"}
                value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-new-password">Nova senha</Label>
              <Input id="profile-new-password" type={showPasswords ? "text" : "password"}
                value={newPassword} onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password" minLength={8} maxLength={128} required />
              <p className="text-xs text-muted-foreground">Use entre 8 e 128 caracteres.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-confirm-password">Confirmar nova senha</Label>
              <Input id="profile-confirm-password" type={showPasswords ? "text" : "password"}
                value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password" minLength={8} maxLength={128} required />
            </div>
            <button type="button" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setShowPasswords((shown) => !shown)}>
              {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showPasswords ? "Ocultar senhas" : "Mostrar senhas"}
            </button>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" className="rounded-xl gap-2" disabled={changingPassword}>
                {changingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar nova senha
              </Button>
              <Button type="button" variant="outline" className="rounded-xl" disabled={changingPassword}
                onClick={() => { setEditingPassword(false); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); setShowPasswords(false); }}>
                Cancelar
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
