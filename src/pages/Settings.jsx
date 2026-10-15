import { useState, useEffect } from "react";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Settings as SettingsIcon, User, MapPin, Info, Save, Loader2, Download, Trash2, MessageCircle, BookOpen, LogOut, RotateCcw, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useCongregations } from "@/lib/congregations";
import { normalizeRole } from "@/lib/permissions";
import { useTranslation } from "@/lib/i18n";
import { downloadManual } from "@/lib/manualGenerator";

export default function Settings() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    congregation: "",
    publisher_name: "",
    default_city: "",
    default_state: "",
  });
  const { congregations } = useCongregations();
  const [now, setNow] = useState(Date.now());
  const [undoing, setUndoing] = useState(false);
  const { t, language } = useTranslation();

  useEffect(() => {
    api.auth.me().then((u) => {
      setUser(u);
      setForm({
        congregation: u?.congregation || "",
        publisher_name: u?.publisher_name || "",
        default_city: u?.default_city || "",
        default_state: u?.default_state || "",
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Tick every 30s to update the reversal countdown
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const pendingReversal = user?.pending_reversal;
  const reversalExpiresAt = pendingReversal?.expires_at ? new Date(pendingReversal.expires_at).getTime() : 0;
  const reversalActive = pendingReversal?.to_user_id && reversalExpiresAt > now;
  const reversalRemainingMs = Math.max(0, reversalExpiresAt - now);
  const reversalRemainingHours = Math.floor(reversalRemainingMs / 3600000);
  const reversalRemainingMinutes = Math.floor((reversalRemainingMs % 3600000) / 60000);

  const handleUndoTransfer = async () => {
    setUndoing(true);
    try {
      await api.functions.invoke('undoAdminTransfer', {});
      toast.success(t("settings.undo_success"));
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      toast.error(e?.message?.includes("expirou") ? t("settings.undo_expired") : t("settings.undo_fail"));
      setUndoing(false);
    }
  };

  const role = normalizeRole(user?.role);
  const isAdminOrElder = role === "admin" || role === "elder" || role === "superintendente";
  const isPublisherOrHelper = role === "publisher" || role === "helper";

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const saved = await api.auth.updateMe(form);
      setUser(saved);
      setForm({
        congregation: saved?.congregation || "",
        publisher_name: saved?.publisher_name || "",
        default_city: saved?.default_city || "",
        default_state: saved?.default_state || "",
      });
      toast.success(t("settings.saved"));
    } catch (err) {
      toast.error(t("settings.save_fail"), {
        description: err?.message || t("settings.save_fail_description"),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    const allAddresses = await api.entities.Address.list("name", 2000);
    const isAdmin = user?.role === "admin";
    const congregation = user?.congregation;
    const addresses = isAdmin ? allAddresses : (congregation ? allAddresses.filter(a => a.congregation === congregation) : []);
    const blob = new Blob([JSON.stringify(addresses, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jw-maps-visit-export-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("settings.export_success"));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-heading font-bold text-2xl">{t("settings.title")}</h1>
        <p className="text-muted-foreground text-sm">{t("settings.subtitle")}</p>
      </div>

      {/* Desfazer Transferência de Administração */}
      {reversalActive && (
        <div className="bg-card rounded-2xl border border-primary/40 p-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            <h2 className="font-heading font-semibold">{t("settings.undo_transfer_title")}</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-1">
            {t("settings.undo_transfer_desc_1", { name: pendingReversal.to_user_name })}
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            {t("settings.undo_transfer_desc_2")}{" "}
            <strong className="text-primary">{reversalRemainingHours}h {reversalRemainingMinutes}min</strong>.
          </p>
          <Button className="gap-2 rounded-xl" disabled={undoing} onClick={handleUndoTransfer}>
            {undoing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            {t("settings.undo_btn")}
          </Button>
        </div>
      )}

      {/* Profile */}
      <div className="bg-card rounded-2xl border border-border p-6 space-y-4 animate-fade-in">
        <div className="flex items-center gap-2 mb-2">
          <User className="h-5 w-5 text-primary" />
          <h2 className="font-heading font-semibold">{t("settings.profile_title")}</h2>
          {role === "admin" && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Administrador</span>
          )}
          {role === "superintendente" && (
            <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full font-medium">Superintendente</span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>{t("settings.publisher_name")}</Label>
            <Input placeholder={t("settings.publisher_name_placeholder")} value={form.publisher_name} onChange={(e) => setForm(p => ({ ...p, publisher_name: e.target.value }))} />
          </div>
          <div>
            <Label>{t("common.congregation")}</Label>
            <Select value={form.congregation} onValueChange={(v) => setForm(p => ({ ...p, congregation: v }))}>
              <SelectTrigger><SelectValue placeholder={t("settings.congregation_placeholder")} /></SelectTrigger>
              <SelectContent>
                {congregations.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Defaults */}
      <div className="bg-card rounded-2xl border border-border p-6 space-y-4 animate-fade-in">
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="h-5 w-5 text-primary" />
          <h2 className="font-heading font-semibold">{t("settings.defaults_title")}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>{t("common.city")}</Label>
            <Input placeholder={t("settings.city_placeholder")} value={form.default_city} onChange={(e) => setForm(p => ({ ...p, default_city: e.target.value }))} />
          </div>
          <div>
            <Label>{t("common.state")}</Label>
            <Input placeholder={t("settings.state_placeholder")} value={form.default_state} onChange={(e) => setForm(p => ({ ...p, default_state: e.target.value }))} />
          </div>
        </div>
        <Button onClick={handleSave} className="gap-2 rounded-xl" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t("settings.save")}
        </Button>
      </div>

      {/* Data Management */}
      <div className="bg-card rounded-2xl border border-border p-6 space-y-4 animate-fade-in">
        <div className="flex items-center gap-2 mb-2">
          <SettingsIcon className="h-5 w-5 text-primary" />
          <h2 className="font-heading font-semibold">{t("settings.data_mgmt_title")}</h2>
        </div>
        <p className="text-sm text-muted-foreground">{t("settings.data_mgmt_desc")}</p>
        <Button variant="outline" onClick={handleExport} className="gap-2 rounded-xl">
          <Download className="h-4 w-4" />
          {t("settings.export_btn")}
        </Button>
      </div>

      {/* Sair da Conta */}
      <div className="bg-card rounded-2xl border border-border p-6 animate-fade-in">
        <div className="flex items-center gap-2 mb-3">
          <LogOut className="h-5 w-5 text-primary" />
          <h2 className="font-heading font-semibold">{t("settings.logout_title")}</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {t("settings.logout_desc")}
        </p>
        <Button variant="outline" className="gap-2 rounded-xl" onClick={() => api.auth.logout("/")}>
          <LogOut className="h-4 w-4" />
          {t("settings.logout_btn")}
        </Button>
      </div>

      {/* Delete Account */}
      <div className="bg-card rounded-2xl border border-destructive/40 p-6 animate-fade-in">
        <div className="flex items-center gap-2 mb-3">
          <Trash2 className="h-5 w-5 text-destructive" />
          <h2 className="font-heading font-semibold text-destructive">{t("settings.delete_account_title")}</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {t("settings.delete_account_desc")}
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="gap-2 rounded-xl">
              <Trash2 className="h-4 w-4" />
              {t("settings.delete_account_title")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("settings.delete_confirm_title")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("settings.delete_confirm_desc")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => { api.auth.logout("/"); toast.error(t("settings.account_deleted")); }}
              >
                {t("settings.delete_action")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Manual */}
      <div className="bg-card rounded-2xl border border-border p-6 animate-fade-in">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <h2 className="font-heading font-semibold">{t("settings.manual_title")}</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {t("settings.manual_desc")}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {isPublisherOrHelper ? (
            <Button
              onClick={() => downloadManual("basic", language)}
              className="w-full gap-2 rounded-xl"
            >
              <Download className="h-4 w-4" />
              {t("settings.manual_publisher")}
            </Button>
          ) : (
            <Button disabled variant="outline" className="w-full gap-2 rounded-xl">
              <BookOpen className="h-4 w-4" />
              {t("settings.manual_publisher")}
            </Button>
          )}
          {isAdminOrElder ? (
            <Button
              onClick={() => downloadManual("full", language)}
              className="w-full gap-2 rounded-xl"
            >
              <Download className="h-4 w-4" />
              {t("settings.manual_admin")}
            </Button>
          ) : (
            <Button disabled variant="outline" className="w-full gap-2 rounded-xl">
              <BookOpen className="h-4 w-4" />
              {t("settings.no_permission")}
            </Button>
          )}
        </div>
      </div>

      {/* Contact Creator */}
      <div className="bg-card rounded-2xl border border-border p-6 animate-fade-in">
        <div className="flex items-center gap-2 mb-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          <h2 className="font-heading font-semibold">{t("settings.contact_title")}</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {t("settings.contact_desc")}
        </p>
        <Link to="/contact">
          <Button className="gap-2 rounded-xl">{t("settings.open_contact")}</Button>
        </Link>
      </div>

      {/* About */}
      <div className="bg-card rounded-2xl border border-border p-6 animate-fade-in">
        <div className="flex items-center gap-2 mb-3">
          <Info className="h-5 w-5 text-primary" />
          <h2 className="font-heading font-semibold">{t("settings.about_title")}</h2>
        </div>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p><strong className="text-foreground">{t("app.title")}</strong> — {t("settings.about_line1")}</p>
          <p>{t("settings.about_line2")}</p>
          <Separator className="my-3" />
          <p className="text-xs">{t("settings.version")}</p>
        </div>
      </div>
    </div>
  );
}