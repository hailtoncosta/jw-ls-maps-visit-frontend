import { useState } from "react";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Database, Download, Loader2, Filter } from "lucide-react";
import { toast } from "sonner";
import { createBackup, createExport, downloadJson, getBackupFilename, getExportFilename } from "@/lib/backup";
import { useTranslation } from "@/lib/i18n";

// Backup local do circuito: exporta apenas endereços e visitas das congregações do circuito.
export default function CircuitBackup({ circuito, congObjects }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const congNames = congObjects.filter((c) => c.circuito_id === circuito.id).map((c) => c.name);
  const slug = circuito.name.replace(/\s+/g, "_");

  const exportBackup = async () => {
    if (congNames.length === 0) { toast.error(t("admin.no_congs_circuit")); return; }
    setLoading(true);
    try {
      const all = await api.entities.Address.list("-created_date", 10000);
      const scoped = all.filter((a) => congNames.includes(a.congregation));
      const visits = await api.entities.VisitHistory.list("-visit_date", 10000);
      const ids = new Set(scoped.map((a) => a.id));
      const scopedVisits = visits.filter((v) => ids.has(v.address_id));
      downloadJson(createBackup(scoped, scopedVisits), `circuito_${slug}_${getBackupFilename()}`);
      toast.success(t("admin.circuit_backup_done", { n: scoped.length, v: scopedVisits.length }));
    } catch {
      toast.error(t("admin.export_error"));
    }
    setLoading(false);
  };

  const exportAddresses = async () => {
    if (congNames.length === 0) { toast.error(t("admin.no_congs_circuit")); return; }
    setLoading(true);
    try {
      const all = await api.entities.Address.list("-created_date", 10000);
      const scoped = all.filter((a) => !a.deleted && congNames.includes(a.congregation));
      downloadJson(createExport(scoped), `circuito_${slug}_${getExportFilename()}`);
      toast.success(t("admin.circuit_addrs_done", { n: scoped.length }));
    } catch {
      toast.error(t("admin.export_addrs_error"));
    }
    setLoading(false);
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-6 animate-fade-in space-y-4">
      <div className="flex items-center gap-2">
        <Database className="h-5 w-5 text-primary" />
        <h2 className="font-heading font-semibold">{t("admin.circuit_backup")}</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        {t("admin.circuit_backup_desc")} ({circuito.name}).
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={exportBackup} disabled={loading} className="gap-2 rounded-xl">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {t("admin.full_circuit_backup")}
        </Button>
        <Button onClick={exportAddresses} disabled={loading} variant="outline" className="gap-2 rounded-xl">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Filter className="h-4 w-4" />}
          {t("admin.export_circuit_addrs")}
        </Button>
      </div>
    </div>
  );
}