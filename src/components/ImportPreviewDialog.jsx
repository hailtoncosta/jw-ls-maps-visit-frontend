import { useState } from "react";
import { api } from "@/api/apiClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, CheckCircle2, User, Phone, MapPin, Building } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { savePendingCreate } from "@/lib/offlineDb";
import { fetchCircuitoMap } from "@/lib/congregations";
import { useTranslation } from "@/lib/i18n";

const STATUS_COLORS = {
  "Ativo": "bg-green-100 text-green-700",
  "Inativo": "bg-gray-100 text-gray-700",
  "Mudou-se": "bg-yellow-100 text-yellow-700",
  "Não Interessado": "bg-red-100 text-red-700",
};

export default function ImportPreviewDialog({ addresses, open, onOpenChange, onImported, importSource }) {
  const { user } = useAuth();
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const [dupCount, setDupCount] = useState(0);
  const [showDupConfirm, setShowDupConfirm] = useState(false);
  const { t } = useTranslation();

  const doImport = async () => {
    if (!addresses || addresses.length === 0) return;
    if (!user) return;
    setImporting(true);
    let success = 0, errors = 0, lastError = "";
    const circMap = await fetchCircuitoMap();

    // Offline: salva na fila local e sincroniza depois
    if (!navigator.onLine) {
      for (const addr of addresses) {
        const data = { ...addr, imported: true, import_source: importSource || "json" };
        if (!data.congregation || data.congregation === "Não definida") {
          data.congregation = user?.congregation || "Não definida";
        }
        data.circuito_id = circMap[data.congregation] || "";
        savePendingCreate(data);
        success++;
      }
      setImporting(false);
      setResults({ success, errors: 0, lastError: "" });
      toast.success(t("import_preview.offline_saved", { n: success }));
      if (onImported) onImported();
      return;
    }

    for (const addr of addresses) {
      try {
        const data = { ...addr, imported: true, import_source: importSource || "json" };
        if (!data.congregation || data.congregation === "Não definida") {
          data.congregation = user?.congregation || "Não definida";
        }
        data.circuito_id = circMap[data.congregation] || "";
        await api.entities.Address.create(data);
        success++;
      } catch (err) {
        errors++;
        lastError = err?.message || t("import_preview.unknown_error");
      }
    }

    setImporting(false);
    setResults({ success, errors, lastError });
    if (success > 0) toast.success(t("import_preview.imported_toast", { n: success }));
    if (errors > 0) toast.error(t("import_preview.errors_toast", { n: errors, err: lastError }));
    if (onImported) onImported();
  };

  const handleImportClick = async () => {
    if (!addresses || addresses.length === 0 || !user) return;
    if (!navigator.onLine) { doImport(); return; }
    setImporting(true);
    let dups = 0;
    try {
      for (const addr of addresses) {
        if (addr.name && addr.street) {
          const existing = await api.entities.Address.filter({
            name: addr.name, street: addr.street, created_by_id: user.id,
          });
          if (existing && existing.length > 0) dups++;
        }
      }
    } catch {
      // If duplicate check fails, proceed without blocking
    }
    setImporting(false);

    if (dups > 0) {
      setDupCount(dups);
      setShowDupConfirm(true);
    } else {
      doImport();
    }
  };

  const handleClose = () => {
    setResults(null);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) setResults(null); onOpenChange(v); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              {t("import_preview.title")}
            </DialogTitle>
            <DialogDescription>
              {results ? t("import_preview.results") : t("import_preview.found", { n: addresses?.length || 0 })}
            </DialogDescription>
          </DialogHeader>

          {results ? (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-center gap-6">
                <div className="text-center">
                  <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold">{results.success}</p>
                  <p className="text-xs text-muted-foreground">{t("import_preview.imported")}</p>
                </div>
                {results.errors > 0 && (
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-500">{results.errors}</p>
                    <p className="text-xs text-muted-foreground">{t("import_preview.errors")}</p>
                  </div>
                )}
              </div>
              <Button className="w-full rounded-xl" onClick={handleClose}>{t("import_preview.finish")}</Button>
            </div>
          ) : (
            <>
              <div className="space-y-2 py-2 max-h-[50vh] overflow-y-auto">
                {addresses?.map((addr, i) => (
                  <Card key={i} className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-primary shrink-0" />
                        <span className="font-medium text-sm">{addr.name}</span>
                      </div>
                      {addr.status && (
                        <Badge className={STATUS_COLORS[addr.status] || "bg-muted text-muted-foreground"}>
                          {addr.status}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      {addr.phone && <p className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{addr.phone}</p>}
                      {addr.street && <p className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{addr.street}</p>}
                      {addr.city && <p className="flex items-center gap-1.5"><Building className="h-3 w-3" />{addr.city}</p>}
                    </div>
                  </Card>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={handleClose}>{t("common.cancel")}</Button>
                <Button className="flex-1 rounded-xl gap-2" onClick={handleImportClick} disabled={importing}>
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {importing ? t("import_preview.checking") : t("import_preview.import_btn")}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDupConfirm} onOpenChange={setShowDupConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("import_preview.dup_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("import_preview.dup_desc", { n: dupCount })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowDupConfirm(false); doImport(); }}>
              {t("import_preview.import_anyway")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}