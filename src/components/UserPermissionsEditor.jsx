import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { PERMISSION_CATEGORIES, ALL_PERMISSION_KEYS, getEffectivePermissions, normalizeRole } from "@/lib/permissions";
import { useTranslation } from "@/lib/i18n";

export default function UserPermissionsEditor({ user, onSave, saving, isAdmin, manualAccess }) {
  const { t } = useTranslation();
  const [perms, setPerms] = useState([]);
  const [manual, setManual] = useState("basic");

  useEffect(() => {
    const effective = getEffectivePermissions(user);
    setPerms(effective.includes("*") ? [...ALL_PERMISSION_KEYS] : [...effective]);
    setManual(normalizeRole(user?.role) === "admin" ? "full" : (manualAccess || "basic"));
  }, [user, manualAccess]);

  const role = normalizeRole(user?.role);
  const toggle = (key) => {
    setPerms(prev => prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]);
  };

  const handleSave = () => {
    const toSave = perms.length === ALL_PERMISSION_KEYS.length ? ["*"] : perms;
    onSave(role === "admin" ? ["*"] : toSave, role === "admin" ? "full" : manual);
  };

  return (
    <div className="space-y-5">
      {isAdmin && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">{t("admin.manual_available")}</p>
          <Select disabled={role === "admin"} value={manual} onValueChange={setManual}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="basic">{t("admin.manual_basic")}</SelectItem>
              <SelectItem value="full">{t("admin.manual_full")}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t("admin.manual_setting_desc")}</p>
        </div>
      )}
      {role === "admin" && (
        <div className="text-xs text-muted-foreground bg-primary/5 border border-primary/20 rounded-lg p-3">
          {t("admin.admin_perm_note_1")} <strong>{t("admin.admin_perm_note_2")}</strong>. {t("admin.admin_perm_note_3")}
        </div>
      )}

      {Object.entries(PERMISSION_CATEGORIES).map(([catKey, cat]) => (
        <div key={catKey} className="space-y-2">
          <p className="text-sm font-semibold text-foreground">{cat.label}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {cat.permissions.map(perm => {
              const checked = perms.includes(perm.key);
              return (
                <label key={perm.key} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-secondary/50 cursor-pointer transition-colors">
                  <Checkbox disabled={role === "admin"} checked={role === "admin" || checked} onCheckedChange={() => toggle(perm.key)} />
                  <span className="text-sm select-none">{perm.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      ))}

      <Button onClick={handleSave} disabled={saving} className="w-full rounded-xl gap-2">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {t("admin.save_permissions")}
      </Button>
    </div>
  );
}