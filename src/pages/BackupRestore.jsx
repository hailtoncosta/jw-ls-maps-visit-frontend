import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Download, Upload, Database, AlertCircle, CheckCircle,
  Loader2, FileJson, RotateCcw, FileUp, Filter, Trash2
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { hasPermission } from "@/lib/permissions";
import {
  createBackup, createExport, validateBackupFile, findDuplicate,
  validateAddressRecord, analyzeRestore, downloadJson, parseJsonFile,
  getBackupFilename, getExportFilename
} from "@/lib/backup";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { useTranslation } from "@/lib/i18n";

const BULK_BATCH = 400;

export default function BackupRestore() {
  const { user, isLoadingAuth } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState("export");

  // Restore state
  const [parsedFile, setParsedFile] = useState(null);
  const [restorePreview, setRestorePreview] = useState(null);
  const [restoreMode, setRestoreMode] = useState("add_new");
  const [confirmRestore, setConfirmRestore] = useState(false);
  const restoreInputRef = useRef(null);

  // Mass import state
  const [importFileName, setImportFileName] = useState(null);
  const [importSummary, setImportSummary] = useState(null);
  const [confirmImport, setConfirmImport] = useState(false);
  const importInputRef = useRef(null);

  if (isLoadingAuth) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasPermission(user, "admin_backup_restore")) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="h-14 w-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <AlertCircle className="h-7 w-7 text-destructive" />
        </div>
        <h2 className="font-heading font-bold text-xl">{t("backup.restricted")}</h2>
        <p className="text-muted-foreground text-sm text-center max-w-sm">
          {t("backup.restricted_desc")}
        </p>
      </div>
    );
  }

  // ===== EXPORTAR BACKUP COMPLETO =====
  const handleExportBackup = async () => {
    setLoading(true);
    try {
      const addresses = await api.entities.Address.list("-created_date", 10000);
      const visits = await api.entities.VisitHistory.list("-visit_date", 10000);
      const backup = createBackup(addresses, visits);
      downloadJson(backup, getBackupFilename());
      toast.success(t("admin.global_backup_done", { n: addresses.length, v: visits.length }));
    } catch {
      toast.error(t("backup.export_error"));
    }
    setLoading(false);
  };

  // ===== EXPORTAR ENDEREÇOS =====
  const handleExportAddresses = async () => {
    setLoading(true);
    try {
      const all = await api.entities.Address.list("-created_date", 10000);
      const addresses = all.filter(a => !a.deleted);
      const exportData = createExport(addresses);
      downloadJson(exportData, getExportFilename());
      toast.success(t("admin.global_addrs_done", { n: addresses.length }));
    } catch {
      toast.error(t("backup.export_addr_error"));
    }
    setLoading(false);
  };

  // ===== RESTAURAR BACKUP =====
  const handleRestoreFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const json = await parseJsonFile(file);
      const result = validateBackupFile(json);
      if (!result.valid) {
        toast.error(result.error);
        setParsedFile(null);
        setRestorePreview(null);
        return;
      }
      setParsedFile(result);
      const existing = await api.entities.Address.list("-created_date", 10000);
      setRestorePreview(analyzeRestore(result.addresses, existing));
      toast.info(t("backup.records_found", { n: result.addresses.length }));
    } catch (err) {
      toast.error(err.message || t("backup.read_error"));
      setParsedFile(null);
      setRestorePreview(null);
    }
    e.target.value = "";
  };

  const handleRestore = async () => {
    if (!parsedFile) return;
    setLoading(true);
    try {
      const existing = await api.entities.Address.list("-created_date", 10000);
      let created = 0, updated = 0, skipped = 0;

      if (restoreMode === "restore_all") {
        await api.entities.Address.deleteMany({});
        const toCreate = parsedFile.addresses.map(a => {
          const { updated_date, ...data } = a;
          return data;
        });
        for (let i = 0; i < toCreate.length; i += BULK_BATCH) {
          await api.entities.Address.bulkCreate(toCreate.slice(i, i + BULK_BATCH));
        }
        created = toCreate.length;
        if (parsedFile.visits.length > 0) {
          await api.entities.VisitHistory.deleteMany({});
          const visitData = parsedFile.visits.map(v => {
            const { updated_date, ...data } = v;
            return data;
          });
          for (let i = 0; i < visitData.length; i += BULK_BATCH) {
            await api.entities.VisitHistory.bulkCreate(visitData.slice(i, i + BULK_BATCH));
          }
        }
        toast.success(t("backup.restore_done", { n: created }));
      } else if (restoreMode === "add_new") {
        const toCreate = [];
        for (const addr of parsedFile.addresses) {
          const dup = findDuplicate(addr, existing);
          if (!dup) {
            const { updated_date, ...data } = addr;
            toCreate.push(data);
          }
        }
        for (let i = 0; i < toCreate.length; i += BULK_BATCH) {
          await api.entities.Address.bulkCreate(toCreate.slice(i, i + BULK_BATCH));
        }
        created = toCreate.length;
        skipped = parsedFile.addresses.length - created;
        toast.success(t("backup.added_done", { n: created, d: skipped }));
      } else if (restoreMode === "update_existing") {
        const toUpdate = [];
        for (const addr of parsedFile.addresses) {
          const dup = findDuplicate(addr, existing);
          if (dup && dup.type === "id") {
            toUpdate.push(addr);
          }
        }
        for (let i = 0; i < toUpdate.length; i += BULK_BATCH) {
          await api.entities.Address.bulkUpdate(toUpdate.slice(i, i + BULK_BATCH));
        }
        updated = toUpdate.length;
        skipped = parsedFile.addresses.length - updated;
        toast.success(t("backup.updated_done", { n: updated, d: skipped }));
      }

      setConfirmRestore(false);
      setParsedFile(null);
      setRestorePreview(null);
    } catch {
      toast.error(t("backup.restore_error"));
    }
    setLoading(false);
  };

  // ===== IMPORTAÇÃO EM MASSA =====
  const handleImportFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const json = await parseJsonFile(file);
      let addresses;
      if (Array.isArray(json)) {
        addresses = json;
      } else if (json.addresses && Array.isArray(json.addresses)) {
        addresses = json.addresses;
      } else {
        toast.error(t("backup.invalid_format"));
        return;
      }

      const existing = await api.entities.Address.list("-created_date", 10000);
      const summary = { total: addresses.length, valid: [], invalid: [], duplicates: [] };
      for (const addr of addresses) {
        const error = validateAddressRecord(addr);
        if (error) {
          summary.invalid.push({ name: addr?.name || "?", error });
          continue;
        }
        const dup = findDuplicate(addr, existing);
        if (dup) {
          summary.duplicates.push({ name: addr.name, type: dup.type });
        } else {
          summary.valid.push(addr);
        }
      }
      setImportFileName(file.name);
      setImportSummary(summary);
    } catch (err) {
      toast.error(err.message || t("backup.read_error"));
    }
    e.target.value = "";
  };

  const handleMassImport = async () => {
    if (!importSummary || importSummary.valid.length === 0) return;
    setLoading(true);
    try {
      const toCreate = importSummary.valid.map(a => {
        const { updated_date, id, created_date, created_by_id, ...data } = a;
        return data;
      });
      for (let i = 0; i < toCreate.length; i += BULK_BATCH) {
        await api.entities.Address.bulkCreate(toCreate.slice(i, i + BULK_BATCH));
      }
      toast.success(t("backup.import_done", { n: toCreate.length }));
      setConfirmImport(false);
      setImportSummary(null);
      setImportFileName(null);
    } catch {
      toast.error(t("backup.import_error"));
    }
    setLoading(false);
  };

  const sections = [
    { id: "export", label: t("backup.tab_export"), icon: Database },
    { id: "restore", label: t("backup.tab_restore"), icon: RotateCcw },
    { id: "import", label: t("backup.tab_import"), icon: FileUp },
    { id: "exportAddr", label: t("backup.tab_export_addr"), icon: Filter },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin">
          <Button variant="ghost" size="icon" className="rounded-xl">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="font-heading font-bold text-2xl">{t("backup.title")}</h1>
          <p className="text-muted-foreground text-sm">{t("backup.subtitle")}</p>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex flex-wrap gap-2">
        {sections.map(s => (
          <Button
            key={s.id}
            variant={activeSection === s.id ? "default" : "outline"}
            size="sm"
            className="gap-2 rounded-xl"
            onClick={() => setActiveSection(s.id)}
          >
            <s.icon className="h-4 w-4" />
            {s.label}
          </Button>
        ))}
      </div>

      {/* EXPORTAR BACKUP COMPLETO */}
      {activeSection === "export" && (
        <div className="bg-card rounded-2xl border border-border p-6 space-y-4 animate-fade-in">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <h2 className="font-heading font-semibold">{t("backup.export_full")}</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("backup.export_full_desc_1")}
            {t("backup.export_full_desc_2")} <code className="text-xs bg-muted px-1.5 py-0.5 rounded">LSMaps_Backup_AAAA-MM-DD.json</code>.
          </p>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="h-4 w-4 text-accent" />
            <span>{t("backup.includes")}</span>
          </div>
          <Button onClick={handleExportBackup} disabled={loading} className="gap-2 rounded-xl">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {t("backup.export_full_btn")}
          </Button>
        </div>
      )}

      {/* RESTAURAR BACKUP */}
      {activeSection === "restore" && (
        <div className="bg-card rounded-2xl border border-border p-6 space-y-4 animate-fade-in">
          <div className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-primary" />
            <h2 className="font-heading font-semibold">{t("backup.restore_title")}</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("backup.restore_desc")}
          </p>
          <div>
            <input
              ref={restoreInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleRestoreFileSelect}
            />
            <Button
              variant="outline"
              className="gap-2 rounded-xl"
              onClick={() => restoreInputRef.current?.click()}
              disabled={loading}
            >
              <Upload className="h-4 w-4" />
               {t("backup.select_json")}
              </Button>
              </div>

              {parsedFile && (
              <div className="space-y-3 p-4 rounded-xl bg-secondary/40">
               <div className="flex items-center gap-2">
                 <FileJson className="h-4 w-4 text-primary" />
                 <span className="text-sm font-medium">{t("backup.file_validated")}</span>
                <Badge variant="outline" className="text-xs">v{parsedFile.format_version}</Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">{t("backup.total_records")}</p>
                  <p className="font-semibold">{parsedFile.total_records}</p>
                  </div>
                  {restorePreview && (
                  <>
                    <div>
                      <p className="text-xs text-muted-foreground">{t("backup.new")}</p>
                      <p className="font-semibold text-accent">{restorePreview.newCount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t("backup.updatable")}</p>
                      <p className="font-semibold text-primary">{restorePreview.updateCount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t("backup.duplicates")}</p>
                      <p className="font-semibold text-chart-3">{restorePreview.duplicateCount}</p>
                    </div>
                  </>
                )}
              </div>
              {parsedFile.backup_date && (
                <p className="text-xs text-muted-foreground">Data do backup: {new Date(parsedFile.backup_date).toLocaleString("pt-BR")}</p>
              )}

              <div className="space-y-2 pt-2">
                <Label className="text-xs font-medium">{t("backup.restore_mode")}</Label>
                <div className="space-y-2">
                  <label className="flex items-start gap-2 p-3 rounded-lg border border-border cursor-pointer hover:bg-secondary/50">
                    <input
                      type="radio"
                      name="restoreMode"
                      value="add_new"
                      checked={restoreMode === "add_new"}
                      onChange={(e) => setRestoreMode(e.target.value)}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium">{t("backup.add_new")}</p>
                      <p className="text-xs text-muted-foreground">{t("backup.add_new_desc")}</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-2 p-3 rounded-lg border border-border cursor-pointer hover:bg-secondary/50">
                    <input
                      type="radio"
                      name="restoreMode"
                      value="update_existing"
                      checked={restoreMode === "update_existing"}
                      onChange={(e) => setRestoreMode(e.target.value)}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium">{t("backup.update_existing")}</p>
                      <p className="text-xs text-muted-foreground">{t("backup.update_desc")}</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-2 p-3 rounded-lg border border-destructive/20 cursor-pointer hover:bg-destructive/5">
                    <input
                      type="radio"
                      name="restoreMode"
                      value="restore_all"
                      checked={restoreMode === "restore_all"}
                      onChange={(e) => setRestoreMode(e.target.value)}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium text-destructive">{t("backup.restore_all")}</p>
                      <p className="text-xs text-muted-foreground">{t("backup.restore_all_desc")}</p>
                    </div>
                  </label>
                </div>
              </div>

              <Button onClick={() => setConfirmRestore(true)} className="gap-2 rounded-xl w-full" disabled={loading}>
                <RotateCcw className="h-4 w-4" />
                {t("backup.confirm_restore")}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* IMPORTAÇÃO EM MASSA */}
      {activeSection === "import" && (
        <div className="bg-card rounded-2xl border border-border p-6 space-y-4 animate-fade-in">
          <div className="flex items-center gap-2">
            <FileUp className="h-5 w-5 text-primary" />
            <h2 className="font-heading font-semibold">{t("backup.import_title")}</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("backup.import_desc_1")}
            {t("backup.import_desc_2")}
          </p>
          <div>
            <input
              ref={importInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportFileSelect}
            />
            <Button
              variant="outline"
              className="gap-2 rounded-xl"
              onClick={() => importInputRef.current?.click()}
              disabled={loading}
            >
              <Upload className="h-4 w-4" />
              {t("backup.select_json")}
            </Button>
          </div>

          {importSummary && (
            <div className="space-y-3 p-4 rounded-xl bg-secondary/40">
              <div className="flex items-center gap-2">
                <FileJson className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{importFileName}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                <div className="p-2 rounded-lg bg-background">
                  <p className="text-xs text-muted-foreground">{t("admin.total")}</p>
                  <p className="font-semibold text-lg">{importSummary.total}</p>
                </div>
                <div className="p-2 rounded-lg bg-background">
                  <p className="text-xs text-muted-foreground">{t("backup.valid_new")}</p>
                  <p className="font-semibold text-lg text-accent">{importSummary.valid.length}</p>
                </div>
                <div className="p-2 rounded-lg bg-background">
                  <p className="text-xs text-muted-foreground">{t("backup.duplicates")}</p>
                  <p className="font-semibold text-lg text-chart-3">{importSummary.duplicates.length}</p>
                </div>
                <div className="p-2 rounded-lg bg-background">
                  <p className="text-xs text-muted-foreground">{t("backup.with_error")}</p>
                  <p className="font-semibold text-lg text-destructive">{importSummary.invalid.length}</p>
                </div>
              </div>

              {importSummary.invalid.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-destructive">{t("backup.error_records", { n: importSummary.invalid.length })}</p>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {importSummary.invalid.slice(0, 10).map((item, i) => (
                      <p key={i} className="text-xs text-muted-foreground">• {item.name}: {item.error}</p>
                    ))}
                    {importSummary.invalid.length > 10 && (
                      <p className="text-xs text-muted-foreground">{t("backup.more_records", { n: importSummary.invalid.length - 10 })}</p>
                    )}
                  </div>
                </div>
              )}

              {importSummary.valid.length > 0 ? (
                <Button onClick={() => setConfirmImport(true)} className="gap-2 rounded-xl w-full" disabled={loading}>
                  <Upload className="h-4 w-4" />
                  {t("backup.import_valid", { n: importSummary.valid.length })}
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">{t("backup.no_valid")}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* EXPORTAR ENDEREÇOS */}
      {activeSection === "exportAddr" && (
        <div className="bg-card rounded-2xl border border-border p-6 space-y-4 animate-fade-in">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" />
            <h2 className="font-heading font-semibold">{t("backup.export_addr_title")}</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("backup.export_addr_desc_1")}
            {t("backup.export_addr_desc_2")}
          </p>
          <Button onClick={handleExportAddresses} disabled={loading} className="gap-2 rounded-xl">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {t("backup.export_all_addr")}
          </Button>
          <Link to="/addresses">
            <Button variant="outline" className="gap-2 rounded-xl">
              <Filter className="h-4 w-4" />
              {t("backup.go_to_addr")}
            </Button>
          </Link>
        </div>
      )}

      {/* CONFIRMAÇÃO RESTAURAR */}
      <AlertDialog open={confirmRestore} onOpenChange={setConfirmRestore}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("backup.confirm_restore_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {restoreMode === "restore_all" ? (
                <span className="text-destructive font-medium">
                  {t("backup.restore_all_warning")}
                </span>
              ) : restoreMode === "add_new" ? (
                <>{t("backup.add_new_confirm")}</>
              ) : (
                <>{t("backup.update_confirm")}</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestore}
              className={restoreMode === "restore_all" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t("backup.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* CONFIRMAÇÃO IMPORT */}
      <AlertDialog open={confirmImport} onOpenChange={setConfirmImport}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("backup.confirm_import_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("backup.confirm_import_desc", { n: importSummary?.valid.length || 0 })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleMassImport}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t("backup.import_btn")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}