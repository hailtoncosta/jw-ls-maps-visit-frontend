import { useState } from "react";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Network, Plus, Pencil, Check, X, Loader2, ChevronRight, House, Users as UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { normalizeRole } from "@/lib/permissions";
import { useTranslation } from "@/lib/i18n";

// Lista de circuitos como cards clicáveis (entrada para o detalhe de cada circuito).
// Permite criar e renomear, mas não eliminar (eliminação fica fora deste painel).
export default function CircuitList({ circuitos, congObjects, users, onSelect, onReload }) {
  const { t } = useTranslation();
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState("");

  const handleAdd = async (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    if (circuitos.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      toast.error(t("admin.circuit_exists"));
      return;
    }
    setBusy(true);
    try {
      await api.entities.Circuito.create({ name });
      toast.success(t("admin.circuit_created"));
      setNewName("");
      onReload();
    } catch {
      toast.error(t("admin.circuit_create_error"));
    } finally {
      setBusy(false);
    }
  };

  const saveRename = async () => {
    if (!editing || !editName.trim()) return;
    setBusy(true);
    try {
      await api.entities.Circuito.update(editing.id, { name: editName.trim() });
      const toUpd = congObjects
        .filter((c) => c.circuito_id === editing.id)
        .map((c) => ({ id: c.id, circuito: editName.trim() }));
      if (toUpd.length) await api.entities.Congregation.bulkUpdate(toUpd);
      toast.success(t("admin.circuit_renamed"));
      setEditing(null);
      onReload();
    } catch {
      toast.error(t("admin.rename_error"));
    } finally {
      setBusy(false);
    }
  };

  const superOf = (cid) => users.find((u) => normalizeRole(u.role) === "superintendente" && u.circuito_id === cid);
  const congsCount = (cid) => congObjects.filter((c) => c.circuito_id === cid).length;
  const usersCount = (cid) => users.filter((u) => u.circuito_id === cid).length;

  return (
    <div className="bg-card rounded-2xl border border-border p-6 animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <Network className="h-5 w-5 text-primary" />
        <h2 className="font-heading font-semibold">{t("admin.circuits_title")} ({circuitos.length})</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        {t("admin.circuits_hint")}
      </p>

      <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex-1">
          <Input placeholder={t("admin.new_circuit_ph")} value={newName} onChange={(e) => setNewName(e.target.value)} required />
        </div>
        <Button type="submit" className="gap-2 rounded-xl shrink-0" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {t("admin.add_circuit")}
        </Button>
      </form>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {circuitos.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4 col-span-full">{t("admin.no_circuits")}</p>
        )}
        {circuitos.map((circ) => {
          const sup = superOf(circ.id);
          const inEdit = editing?.id === circ.id;
          return (
            <div
              key={circ.id}
              onClick={() => !inEdit && onSelect(circ.id)}
              className="text-left rounded-xl border border-border p-4 hover:shadow-lg hover:border-primary/30 transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between gap-2">
                {inEdit ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8" />
                    <Button size="sm" className="h-8 px-2" onClick={saveRename} disabled={busy}><Check className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setEditing(null)}><X className="h-3.5 w-3.5" /></Button>
                  </div>
                ) : (
                  <>
                    <h3 className="font-heading font-semibold">{circ.name}</h3>
                    <div className="flex items-center gap-1">
                      <span
                        className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary"
                        title={t("admin.rename")}
                        onClick={(e) => { e.stopPropagation(); setEditing(circ); setEditName(circ.name); }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><House className="h-3.5 w-3.5" /> {congsCount(circ.id)} {t("admin.cong_short")}</span>
                <span className="flex items-center gap-1"><UsersIcon className="h-3.5 w-3.5" /> {usersCount(circ.id)} {t("admin.users_word")}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 truncate">{t("admin.superintendent")}: {sup ? (sup.full_name || sup.email) : "—"}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}