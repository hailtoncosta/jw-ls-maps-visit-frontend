import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Trash2, RotateCcw, AlertCircle, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { hasPermission } from "@/lib/permissions";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { useTranslation } from "@/lib/i18n";

export default function Trash() {
  const { user, isLoadingAuth } = useAuth();
  const { t } = useTranslation();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadTrash = async () => {
    setLoading(true);
    try {
      const all = await api.entities.Address.list("-updated_date", 10000);
      setAddresses(all.filter(a => a.deleted === true));
    } catch {
      toast.error(t("trash.load_error"));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!isLoadingAuth) loadTrash();
  }, [isLoadingAuth]);

  const handleRestore = async () => {
    if (!restoreTarget) return;
    setActionLoading(true);
    try {
      await api.entities.Address.update(restoreTarget.id, { deleted: false });
      toast.success(t("trash.restore_success", { name: restoreTarget.name }));
      setRestoreTarget(null);
      loadTrash();
    } catch {
      toast.error(t("trash.restore_error"));
    }
    setActionLoading(false);
  };

  const handlePermanentDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await api.entities.VisitHistory.deleteMany({ address_id: deleteTarget.id });
      await api.entities.Address.delete(deleteTarget.id);
      toast.success(t("trash.delete_success", { name: deleteTarget.name }));
      setDeleteTarget(null);
      loadTrash();
    } catch {
      toast.error(t("trash.delete_error"));
    }
    setActionLoading(false);
  };

  if (isLoadingAuth) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasPermission(user, "admin_trash")) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="h-14 w-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <AlertCircle className="h-7 w-7 text-destructive" />
        </div>
        <h2 className="font-heading font-bold text-xl">{t("trash.restricted")}</h2>
        <p className="text-muted-foreground text-sm text-center max-w-sm">
          {t("trash.restricted_desc")}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin">
          <Button variant="ghost" size="icon" className="rounded-xl">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="font-heading font-bold text-2xl flex items-center gap-2">
            <Trash2 className="h-6 w-6 text-muted-foreground" />
            {t("trash.title")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("trash.subtitle")}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : addresses.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-12 text-center">
          <Trash2 className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-muted-foreground">{t("trash.empty")}</p>
          <p className="text-xs text-muted-foreground mt-1">{t("trash.empty_desc")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-xs">{addresses.length} {t("trash.in_trash")}</Badge>
          </div>
          {addresses.map(addr => (
            <div key={addr.id} className="bg-card rounded-xl border border-border p-4 flex items-center gap-3 animate-fade-in">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <MapPin className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{addr.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {addr.street}{addr.city ? ` - ${addr.city}` : ""} · {addr.congregation}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 rounded-lg text-accent border-accent/20 hover:bg-accent/10"
                  onClick={() => setRestoreTarget(addr)}
                  disabled={actionLoading}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                   {t("trash.restore")}
                  </Button>
                  <Button
                   size="sm"
                   variant="ghost"
                   className="gap-1.5 rounded-lg text-destructive hover:bg-destructive/10"
                   onClick={() => setDeleteTarget(addr)}
                   disabled={actionLoading}
                  >
                   <Trash2 className="h-3.5 w-3.5" />
                   {t("trash.delete")}
                  </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmação Restaurar */}
      <AlertDialog open={!!restoreTarget} onOpenChange={(open) => !open && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("trash.restore_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("trash.restore_desc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore} className="bg-accent text-accent-foreground hover:bg-accent/90">
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t("trash.restore")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação Excluir Definitivamente */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir definitivamente?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="text-destructive font-medium">{t("trash.delete_warning")}</span>
              <br />
              {t("trash.delete_desc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handlePermanentDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t("trash.delete_btn")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}