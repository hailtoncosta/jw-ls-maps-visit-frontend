import { useState } from "react";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Database, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createBackup, createExport, downloadJson, getBackupFilename, getExportFilename } from "@/lib/backup";
import { useTranslation } from "@/lib/i18n";

// Backup geral com filtro avançado por circuito e congregação (função global do admin).
export default function GlobalBackupCard({ circuitos, congObjects }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [circuitoFilter, setCircuitoFilter] = useState("all");
  const [congFilter, setCongFilter] = useState("all");

  const congOptions = circuitoFilter === "all"
    ? congObjects
    : congObjects.filter((c) => c.circuito_id === circuitoFilter);

  const computeScope = (all) => {
    let scoped = all;
    if (circuitoFilter !== "all") {
      const names = congObjects.filter((c) => c.circuito_id === circuitoFilter).map((c) => c.name);
      scoped = scoped.filter((a) => names.includes(a.congregation));
    }
    if (congFilter !== "all") {
      scoped = scoped.filter((a) => a.congregation === congFilter);
    }
    return scoped;
  };

  const exportBackup = async () => {
    setLoading(true);
    try {
      const all = await api.entities.Address.list("-created_date", 10000);
      const scoped = computeScope(all);
      const visits = await api.entities.VisitHistory.list("-visit_date", 10000);
      const ids = new Set(scoped.map((a) => a.id));
      const scopedVisits = visits.filter((v) => ids.has(v.address_id));
      downloadJson(createBackup(scoped, scopedVisits), `global_${getBackupFilename()}`);
      toast.success(t("admin.global_backup_done", { n: scoped.length, v: scopedVisits.length }));
    } catch {
      toast.error(t("admin.export_error"));
    }
    setLoading(false);
  };

  const exportAddresses = async () => {
    setLoading(true);
    try {
      const all = await api.entities.Address.list("-created_date", 10000);
      const scoped = computeScope(all).filter((a) => !a.deleted);
      downloadJson(createExport(scoped), `global_${getExportFilename()}`);
      toast.success(t("admin.global_addrs_done", { n: scoped.length }));
    } catch {
      toast.error(t("admin.export_error_short"));
    }
    setLoading(false);
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-6 animate-fade-in space-y-4">
      <div className="flex items-center gap-2">
        <Database className="h-5 w-5 text-primary" />
        <h2 className="font-heading font-semibold">{t("admin.global_backup")}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{t("admin.global_backup_desc")}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Select value={circuitoFilter} onValueChange={(v) => { setCircuitoFilter(v); setCongFilter("all"); }}>
          <SelectTrigger><SelectValue placeholder={t("admin.circuits_title")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin.all_circuits")}</SelectItem>
            {circuitos.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={congFilter} onValueChange={setCongFilter}>
          <SelectTrigger><SelectValue placeholder={t("admin.filter_cong")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin.all_congregations")}</SelectItem>
            {congOptions.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={exportBackup} disabled={loading} className="gap-2 rounded-xl">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {t("admin.full_backup")}
        </Button>
        <Button onClick={exportAddresses} disabled={loading} variant="outline" className="gap-2 rounded-xl">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {t("admin.export_addrs")}
        </Button>
      </div>
    </div>
  );
}