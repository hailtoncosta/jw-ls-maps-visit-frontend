import { useMemo, useState } from "react";
import { Users, Search, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { normalizeRole } from "@/lib/permissions";
import UserFormDialog from "./UserFormDialog";
import { useTranslation } from "@/lib/i18n";

export default function GlobalUsersList({ users, currentUser, circuitos, congObjects, onReload }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [editUser, setEditUser] = useState(null);

  const circuitNames = useMemo(
    () => Object.fromEntries((circuitos || []).map((c) => [c.id, c.name])),
    [circuitos]
  );

  const congregationCircuits = useMemo(
    () => Object.fromEntries((congObjects || []).map((c) => [c.name, c.circuito_id])),
    [congObjects]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...(users || [])]
      .filter((u) => !query || [u.full_name, u.email, u.congregation, u.role]
        .some((value) => String(value || "").toLowerCase().includes(query)))
      .sort((a, b) => String(a.full_name || a.email || "").localeCompare(String(b.full_name || b.email || "")));
  }, [users, search]);

  const roleLabel = (role) => t(`role.${normalizeRole(role)}`);
  const circuitName = (user) => {
    const id = user.circuito_id || congregationCircuits[user.congregation];
    return circuitNames[id] || "—";
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-4 sm:p-6 animate-fade-in space-y-4 overflow-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="font-heading font-semibold">{t("admin.registered_users")} ({users?.length || 0})</h2>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("admin.search_users")}
            className="pl-9"
          />
        </div>
      </div>

      <div className="hidden md:grid grid-cols-12 gap-3 px-3 text-xs font-semibold uppercase text-muted-foreground">
        <div className="col-span-3">{t("admin.col_name")}</div>
        <div className="col-span-2">{t("admin.filter_profile")}</div>
        <div className="col-span-2">{t("admin.filter_cong")}</div>
        <div className="col-span-2">{t("admin.step_circuit")}</div>
        <div className="col-span-2">{t("admin.filter_status")}</div>
        <div className="col-span-1 text-right">{t("admin.col_actions")}</div>
      </div>

      <div className="space-y-2">
        {filtered.map((user) => {
          const active = user.active !== false;
          return (
            <div key={user.id} className="rounded-xl bg-secondary/40 p-3 sm:p-4 md:p-3">
              <div className="md:hidden space-y-3">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium">{user.full_name || "—"}</p>
                    <p className="break-all text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <Button size="sm" variant="ghost" className="h-9 w-9 shrink-0 p-0" onClick={() => setEditUser(user)} title={t("admin.edit")}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{roleLabel(user.role)}</Badge>
                  <Badge variant="outline" className={active ? "text-emerald-600 border-emerald-200" : "text-red-600 border-red-200"}>
                    {active ? t("admin.active") : t("admin.inactive")}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 gap-3 border-t border-border/60 pt-3 sm:grid-cols-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase text-muted-foreground">{t("admin.filter_cong")}</p>
                    <p className="break-words text-sm">{user.congregation || "—"}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase text-muted-foreground">{t("admin.step_circuit")}</p>
                    <p className="break-words text-sm">{circuitName(user)}</p>
                  </div>
                </div>
              </div>

              <div className="hidden md:grid grid-cols-12 gap-3 items-center">
                <div className="col-span-3 min-w-0">
                  <p className="text-sm font-medium truncate">{user.full_name || "—"}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
                <div className="col-span-2 min-w-0"><Badge variant="outline" className="max-w-full truncate">{roleLabel(user.role)}</Badge></div>
                <div className="col-span-2 text-xs text-muted-foreground truncate">{user.congregation || "—"}</div>
                <div className="col-span-2 text-xs text-muted-foreground truncate">{circuitName(user)}</div>
                <div className="col-span-2">
                  <Badge variant="outline" className={active ? "text-emerald-600 border-emerald-200" : "text-red-600 border-red-200"}>
                    {active ? t("admin.active") : t("admin.inactive")}
                  </Badge>
                </div>
                <div className="col-span-1 text-right">
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditUser(user)} title={t("admin.edit")}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{t("admin.no_users")}</p>}
      </div>

      <UserFormDialog
        open={!!editUser}
        onOpenChange={(open) => !open && setEditUser(null)}
        mode="edit"
        targetUser={editUser}
        circuitos={circuitos}
        congObjects={congObjects}
        currentUser={currentUser}
        onSaved={() => { setEditUser(null); onReload?.(); }}
      />
    </div>
  );
}
