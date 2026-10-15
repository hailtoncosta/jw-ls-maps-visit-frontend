import { useState, useEffect } from "react";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, RotateCcw, MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { useTranslation } from "@/lib/i18n";

// Lixeira local do circuito: apenas endereços eliminados das congregações deste circuito.
export default function CircuitTrash({ circuito, congObjects }) {
  const { t } = useTranslation();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const congNames = congObjects.filter((c) => c.circuito_id === circuito.id).map((c) => c.name);

  const load = async () => {
    setLoading(true);
    try {
      const all = await api.entities.Address.list("-updated_date", 10000);
      setAddresses(all.filter((a) => a.deleted === true && congNames.includes(a.congregation)));
    } catch {
      toast.error(t("trash.load_error"));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [circuito.id]);

  const handleRestore = async () => {
    if (!restoreTarget) return;
    setBusy(true);
    try {
      await api.entities.Address.update(restoreTarget.id, { deleted: false });
      toast.success(`"${restoreTarget.name}" ${t("admin.circuit_restore")}`);
      setRestoreTarget(null);
      load();
    } catch {
      toast.error(t("admin.circuit_restore_error"));
    }
    setBusy(false);
  };

  const handlePermanentDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api.entities.VisitHistory.deleteMany({ address_id: deleteTarget.id });
      await api.entities.Address.delete(deleteTarget.id);
      toast.success(`"${deleteTarget.name}" ${t("admin.circuit_deleted")}`);
      setDeleteTarget(null);
      load();
    } catch {
      toast.error(t("admin.circuit_delete_error"));
    }
    setBusy(false);
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-6 animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <Trash2 className="h-5 w-5 text-muted-foreground" />
        <h2 className="font-heading font-semibold">{t("admin.circuit_trash")}</h2>
      </div>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : addresses.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">{t("admin.circuit_trash_empty")}</p>
      ) : (
        <div className="space-y-3">
          <Badge variant="outline" className="text-xs">{addresses.length} {t("admin.in_trash")}</Badge>
          {addresses.map((addr) => (
            <div key={addr.id} className="rounded-xl border border-border p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0"><MapPin className="h-5 w-5 text-muted-foreground" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{addr.name}</p>
                <p className="text-xs text-muted-foreground truncate">{addr.street}{addr.city ? ` - ${addr.city}` : ""} · {addr.congregation}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button size="sm" variant="outline" className="gap-1.5 rounded-lg text-accent border-accent/20 hover:bg-accent/10" onClick={() => setRestoreTarget(addr)} disabled={busy}><RotateCcw className="h-3.5 w-3.5" />{t("admin.restore")}</Button>
                <Button size="sm" variant="ghost" className="gap-1.5 rounded-lg text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(addr)} disabled={busy}><Trash2 className="h-3.5 w-3.5" />{t("admin.delete")}</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!restoreTarget} onOpenChange={(o) => !o && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("trash.restore_title")}</AlertDialogTitle><AlertDialogDescription>{t("trash.restore_desc")}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={handleRestore} className="bg-accent text-accent-foreground hover:bg-accent/90">{busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}{t("admin.restore")}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("trash.delete_title")}</AlertDialogTitle><AlertDialogDescription><span className="text-destructive font-medium">{t("trash.delete_warning")}</span><br />{t("trash.delete_desc")}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={handlePermanentDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}{t("trash.delete_btn")}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}