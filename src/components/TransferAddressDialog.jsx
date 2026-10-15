import { useEffect, useMemo, useState } from "react";
import { api } from "@/api/apiClient";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { normalizeRole } from "@/lib/permissions";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";

// Transferência de endereço entre congregações (mesmo ID, mesmos dados).
// Superintendente: somente congregações do próprio circuito.
// Admin: acesso global. Demais perfis não chegam aqui (botão oculto + backend 403).
export default function TransferAddressDialog({ open, onClose, address, user, onTransferred }) {
  const [congregations, setCongregations] = useState([]);
  const [targetId, setTargetId] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { t } = useTranslation();

  const role = normalizeRole(user?.role);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const congs = await api.entities.Congregation.list("name", 500);
        if (cancelled) return;
        // Superintendente vê apenas congregações do seu circuito.
        // Admin vê todas (acesso global).
        const scoped = role === "superintendente"
          ? (congs || []).filter((c) => user?.circuito_id && c.circuito_id === user.circuito_id)
          : (congs || []);
        setCongregations(scoped);
      } catch {
        if (!cancelled) setCongregations([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [open, role, user?.circuito_id]);

  const target = useMemo(
    () => congregations.find((c) => c.id === targetId) || null,
    [congregations, targetId]
  );

  const canSubmit = Boolean(target && target.name !== address?.congregation);

  const handleTransfer = async () => {
    setSubmitting(true);
    try {
      const res = await api.functions.invoke("transferAddress", {
        addressId: address.id,
        targetCongregationId: target.id
      });
      if (res?.data?.success || res?.success) {
        toast.success(t("transfer.success"));
        onTransferred?.();
        onClose();
      } else {
        toast.error(res?.data?.error || res?.error || t("transfer.error"));
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || t("transfer.error");
      toast.error(msg);
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <ArrowRightLeft className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle>{t("transfer.title")}</DialogTitle>
                <DialogDescription>{t("transfer.desc")}</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <p className="text-xs text-muted-foreground mb-1">{t("transfer.address")}</p>
              <p className="text-sm font-medium">{address?.name}{address?.street ? ` — ${address.street}` : ""}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">{t("transfer.current_cong")}</p>
              <p className="text-sm font-medium">{address?.congregation || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">{t("transfer.new_cong")}</p>
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> {t("transfer.loading")}
                </div>
              ) : congregations.length === 0 ? (
                <p className="text-sm text-destructive">{t("transfer.none")}</p>
              ) : (
                <Select value={targetId} onValueChange={setTargetId}>
                  <SelectTrigger><SelectValue placeholder={t("transfer.select")} /></SelectTrigger>
                  <SelectContent>
                    {congregations.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {target && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t("transfer.circuit")}</p>
                <p className="text-sm font-medium">{target.circuito || target.circuito_id || "—"}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={submitting}>{t("common.cancel")}</Button>
            <Button onClick={() => setConfirmOpen(true)} disabled={!canSubmit || submitting || loading}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
              {t("transfer.transfer_btn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => { if (!submitting) setConfirmOpen(o); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("transfer.confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-1">
                <p>{t("transfer.from")} <strong className="text-foreground">{address?.congregation || "—"}</strong></p>
                <p>{t("transfer.to")} <strong className="text-foreground">{target?.name || "—"}</strong></p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleTransfer} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {t("transfer.confirm_btn")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}