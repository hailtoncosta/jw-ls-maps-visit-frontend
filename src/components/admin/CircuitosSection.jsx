import { useState } from "react";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Network, Plus, Trash2, Pencil, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { normalizeRole } from "@/lib/permissions";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { useTranslation } from "@/lib/i18n";

export default function CircuitosSection({ circuitos, congObjects, users, onReload }) {
  const { t } = useTranslation();
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState("");
  const [toDelete, setToDelete] = useState(null);
  const [designating, setDesignating] = useState({});

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

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await api.entities.Circuito.delete(toDelete.id);
      toast.success(t("admin.circuit_removed"));
      setToDelete(null);
      onReload();
    } catch {
      toast.error(t("admin.circuit_remove_error"));
    }
  };

  const moveCongregation = async (circuitoId, circuitoName, congId) => {
    if (!congId) return;
    try {
      const res = await api.functions.invoke("transferCongregationCircuit", {
        congregationId: congId,
        newCircuitoId: circuitoId
      });
      if (res?.data?.error) throw new Error(res.data.error);
      toast.success(t("admin.cong_transferred_circuit"));
      onReload();
    } catch (e) {
      toast.error(e?.message || t("admin.move_cong_error"));
    }
  };

  const designate = async (circuitoId, userId) => {
    if (!userId) return;
    setDesignating((p) => ({ ...p, [circuitoId]: true }));
    try {
      const current = users.find(
        (u) => normalizeRole(u.role) === "superintendente" && u.circuito_id === circuitoId && u.id !== userId
      );
      if (current) {
        await api.functions.invoke("updateCongregationUser", { userId: current.id, updates: { role: "elder" } });
      }
      await api.functions.invoke("updateCongregationUser", { userId, updates: { role: "superintendente", circuito_id: circuitoId } });
      toast.success(t("admin.super_designated"));
      onReload();
    } catch {
      toast.error(t("admin.designate_error"));
    } finally {
      setDesignating((p) => ({ ...p, [circuitoId]: false }));
    }
  };

  const congsIn = (cid) => congObjects.filter((c) => c.circuito_id === cid);
  const congsOut = (cid) => congObjects.filter((c) => c.circuito_id !== cid);
  const superOf = (cid) => users.find((u) => normalizeRole(u.role) === "superintendente" && u.circuito_id === cid);
  const candidateUsers = users.filter((u) => normalizeRole(u.role) !== "admin" && normalizeRole(u.role) !== "superintendente");

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

      <div className="space-y-3">
        {circuitos.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">{t("admin.no_circuits")}</p>
        )}
        {circuitos.map((circ) => {
          const inList = congsIn(circ.id);
          const outList = congsOut(circ.id);
          const currentSuper = superOf(circ.id);
          return (
            <div key={circ.id} className="rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                {editing?.id === circ.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8" />
                    <Button size="sm" className="h-8 px-2" onClick={saveRename} disabled={busy}><Check className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setEditing(null)}><X className="h-3.5 w-3.5" /></Button>
                  </div>
                ) : (
                  <>
                    <h3 className="font-heading font-semibold">{circ.name}</h3>
                    <div className="flex items-center gap-1">
                      <button className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary" title={t("admin.rename")} onClick={() => { setEditing(circ); setEditName(circ.name); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title={t("admin.remove_circuit_btn")} onClick={() => setToDelete(circ)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div className="text-xs text-muted-foreground">
                {inList.length} {t("admin.congs_count")} • {t("admin.superintendent")}: {currentSuper ? (currentSuper.full_name || currentSuper.email) : "—"}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {inList.map((c) => (
                  <span key={c.id} className="text-xs bg-secondary/60 rounded-md px-2 py-1">{c.name}</span>
                ))}
                {inList.length === 0 && <span className="text-xs text-muted-foreground italic">{t("admin.no_congs_assigned")}</span>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <Select value="" onValueChange={(val) => moveCongregation(circ.id, circ.name, val)} disabled={outList.length === 0}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder={outList.length === 0 ? t("admin.all_congs_here") : t("admin.move_cong_here")} />
                  </SelectTrigger>
                  <SelectContent>
                    {outList.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value="" onValueChange={(val) => designate(circ.id, val)} disabled={designating[circ.id] || candidateUsers.length === 0}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder={designating[circ.id] ? t("admin.designating") : t("admin.designate_super")} />
                  </SelectTrigger>
                  <SelectContent>
                    {candidateUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          );
        })}
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.remove_circuit_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete && <>{t("admin.remove_circuit_desc_1")} <strong>{toDelete.name}</strong>? {t("admin.remove_circuit_desc_2")}</>}
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