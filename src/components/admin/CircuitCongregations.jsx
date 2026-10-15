import { useState } from "react";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { House, Plus, Trash2, Loader2, ArrowDownToLine } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { useTranslation } from "@/lib/i18n";

// Congregações pertencentes ao circuito: adicionar, remover e trazer de outro circuito.
export default function CircuitCongregations({ circuito, congObjects, isAdmin, onReload }) {
  const { t } = useTranslation();
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [toTransfer, setToTransfer] = useState(null);
  const [transferring, setTransferring] = useState(false);

  const inList = congObjects.filter((c) => c.circuito_id === circuito.id);
  const outList = congObjects.filter((c) => c.circuito_id !== circuito.id);

  const handleAdd = async (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    if (congObjects.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      toast.error(t("admin.cong_exists"));
      return;
    }
    setBusy(true);
    try {
      await api.entities.Congregation.create({ name, circuito_id: circuito.id, circuito: circuito.name });
      toast.success(t("admin.cong_added"));
      setNewName("");
      onReload();
    } catch {
      toast.error(t("admin.cong_add_error"));
    } finally {
      setBusy(false);
    }
  };

  const moveIn = (congId) => {
    const cong = congObjects.find((c) => c.id === congId);
    if (!cong) return;
    setToTransfer(cong);
  };

  const confirmTransfer = async () => {
    if (!toTransfer) return;
    setTransferring(true);
    try {
      const res = await api.functions.invoke("transferCongregationCircuit", {
        congregationId: toTransfer.id,
        newCircuitoId: circuito.id
      });
      if (res?.data?.error) throw new Error(res.data.error);
      toast.success(t("admin.cong_transferred", { name: toTransfer.name, circuit: circuito.name }));
      setToTransfer(null);
      onReload();
    } catch (e) {
      toast.error(e?.message || t("admin.cong_transfer_error"));
    } finally {
      setTransferring(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await api.entities.Congregation.delete(toDelete.id);
      toast.success(t("admin.cong_removed"));
      setToDelete(null);
      onReload();
    } catch {
      toast.error(t("admin.cong_remove_error"));
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-6 animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <House className="h-5 w-5 text-primary" />
        <h2 className="font-heading font-semibold">{t("admin.circuit_congs")} ({inList.length})</h2>
      </div>
      <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex-1">
          <Input placeholder={t("admin.new_cong_ph")} value={newName} onChange={(e) => setNewName(e.target.value)} required />
        </div>
        <Button type="submit" className="gap-2 rounded-xl shrink-0" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {t("admin.add")}
        </Button>
      </form>

      <div className="flex flex-wrap gap-2 mb-4">
        {inList.map((c) => (
          <div key={c.id} className="flex items-center gap-1 bg-secondary/50 rounded-lg pl-3 pr-1.5 py-1.5">
            <span className="text-xs font-medium">{c.name}</span>
            <button onClick={() => setToDelete(c)} className="ml-1 p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title={t("admin.remove")}>
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
        {inList.length === 0 && <p className="text-xs text-muted-foreground">{t("admin.no_congs")}</p>}
      </div>

      {isAdmin && outList.length > 0 && (
        <div className="pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><ArrowDownToLine className="h-3.5 w-3.5" /> {t("admin.bring_cong")}</p>
          <Select value="" onValueChange={moveIn}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t("admin.select_cong_ph")} /></SelectTrigger>
            <SelectContent>
              {outList.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {!isAdmin && (
        <p className="text-xs text-muted-foreground pt-3 border-t border-border">
          {t("admin.migration_restricted")}
        </p>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.remove_cong_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete && <>{t("admin.remove_cong_desc_1")} <strong>{toDelete.name}</strong>? {t("admin.remove_cong_desc_2")}</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t("admin.remove")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!toTransfer} onOpenChange={(o) => !o && !transferring && setToTransfer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.transfer_cong_title", { name: circuito.name })}</AlertDialogTitle>
            <AlertDialogDescription>
              {toTransfer && (
                <>
                  {t("admin.transfer_cong_desc")}
                  <br /><br />
                  <strong>{toTransfer.name}</strong> → <strong>{circuito.name}</strong>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={transferring}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={transferring}
              onClick={confirmTransfer}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {transferring ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t("admin.confirm_transfer")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}