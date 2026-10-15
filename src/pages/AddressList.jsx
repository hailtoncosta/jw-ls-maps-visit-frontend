import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, MapPin, RefreshCw, Download, ChevronDown, FileSpreadsheet, FileJson, QrCode, WifiOff, Loader2, CalendarRange, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ResponsiveSelect } from "@/components/ui/responsive-select";
import AddressCard from "../components/AddressCard";
import EmptyState from "../components/EmptyState";
import QuickRegisterButton from "../components/QuickRegisterButton";
import ImportPreviewDialog from "../components/ImportPreviewDialog";
import QrScannerDialog from "../components/QrScannerDialog";
import { api } from "@/api/apiClient";
import { resolveAddressFromQR, readFileAsText, parseJsonFileContent } from "@/lib/territoryImport";
import { useAuth } from "@/lib/AuthContext";
import { normalizeRole, hasPermission, canFinishAddressVisit } from "@/lib/permissions";
import { downloadJson, createExport, getExportFilename, downloadAddressesExcel } from "@/lib/backup";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useAddressesQuery } from "@/hooks/useAddressesQuery";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";

const PAGE_SIZE = 20;
const normalizeSearch = (value) => String(value ?? "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().trim();

export default function AddressList() {
  const { user, isLoadingAuth } = useAuth();
  const { t } = useTranslation();
  const { data, refetch, isFetching, isLoading } = useAddressesQuery(user, { enabled: !isLoadingAuth });
  const addresses = data?.addresses ?? [];
  const shareMap = data?.shareMap ?? {};

  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
  const loading = isLoading && addresses.length === 0 && !isOffline;
  const refreshing = isFetching && !isLoading;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [congregationFilter, setCongregationFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [situacaoFilter, setSituacaoFilter] = useState("all");
  const [visitMode, setVisitMode] = useState("all");
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [showPeriod, setShowPeriod] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [previewAddresses, setPreviewAddresses] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [importSource, setImportSource] = useState("");
  const [scanning, setScanning] = useState(false);
  const [finishingId, setFinishingId] = useState(null);
  const finishLock = useRef(false);
  const jsonInputRef = useRef(null);

  const { count: offlineCount, syncing: offlineSyncing, syncNow } = useOfflineSync();

  const touchStartY = useRef(0);
  const [pullDistance, setPullDistance] = useState(0);
  const PULL_THRESHOLD = 70;

  const handleFinishVisit = async (address, share) => {
    if (finishLock.current || !canFinishAddressVisit(user, address, share)) return;
    if (!navigator.onLine) {
      toast.error("Conecte-se à internet para finalizar as visitas.");
      return;
    }
    if (!window.confirm(`Finalizar as visitas de ${address.name || "este endereço"}?`)) return;
    finishLock.current = true;
    setFinishingId(address.id);
    try {
      await api.functions.invoke("finishAddressVisit", { address_id: address.id });
      toast.success("Visitas finalizadas com sucesso.");
      await refetch();
    } catch (error) {
      toast.error(error?.message || "Não foi possível finalizar as visitas.");
    } finally {
      finishLock.current = false;
      setFinishingId(null);
    }
  };

  const handleQRScan = async (qrText) => {
    setShowScanner(false);
    setScanning(true);
    try {
      const imported = await resolveAddressFromQR(qrText, api);
      if (!imported?.length) throw new Error(t("territories.qr_invalid"));
      setPreviewAddresses(imported);
      setImportSource("qr_code");
      setShowPreview(true);
    } catch (error) {
      toast.error(error.message || t("territories.scan_error"));
    } finally {
      setScanning(false);
    }
  };

  const handleJsonFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const imported = parseJsonFileContent(await readFileAsText(file));
      if (imported === null) throw new Error(t("territories.json_invalid"));
      if (!imported.length) throw new Error(t("territories.no_valid"));
      setPreviewAddresses(imported);
      setImportSource("json");
      setShowPreview(true);
    } catch (error) {
      toast.error(error.message || t("territories.read_error"));
    }
  };

  // Reseta a paginação quando uma nova consulta chega (refetch / optimistic).
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [data, search, statusFilter, genderFilter, congregationFilter, priorityFilter, situacaoFilter, visitMode, periodFrom, periodTo]);

  const handleTouchStart = (e) => {
    if (window.scrollY === 0) touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchMove = (e) => {
    if (touchStartY.current === 0) return;
    const dist = e.touches[0].clientY - touchStartY.current;
    if (dist > 0 && window.scrollY === 0) setPullDistance(Math.min(dist, PULL_THRESHOLD + 20));
  };
  const handleTouchEnd = () => {
    if (pullDistance >= PULL_THRESHOLD) refetch();
    setPullDistance(0);
    touchStartY.current = 0;
  };

  const role = normalizeRole(user?.role);

  const congregations = useMemo(() => {
    const set = new Set(addresses.map(a => a.congregation).filter(Boolean));
    return [...set].sort();
  }, [addresses]);

  const getDaysSinceVisit = (addr) => {
    if (!addr.last_visit_date) return Infinity;
    const visitDate = new Date(addr.last_visit_date);
    if (isNaN(visitDate)) return Infinity;
    return Math.floor((Date.now() - visitDate.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getPriorityLevel = (addr) => {
    if (addr.status === "Mudou-se" || addr.status === "Não Interessado") return "none";
    const days = getDaysSinceVisit(addr);
    if (days === Infinity) return "urgent";
    if (days >= 60) return "urgent";
    if (days >= 30) return "high";
    if (days >= 15) return "medium";
    return "low";
  };

  const filtered = useMemo(() => {
    const terms = normalizeSearch(search).split(/\s+/).filter(Boolean);
    return addresses.filter((a) => {
      const searchable = normalizeSearch([
        a.name, a.phone, a.street, a.neighborhood, a.city, a.state,
        a.congregation, a.card_number, a.reference_point,
      ].join(" "));
      const matchSearch = terms.every((term) => searchable.includes(term));
      const matchStatus = statusFilter === "all" || a.status === statusFilter || (!a.status && statusFilter === "Ativo");
      const matchGender = genderFilter === "all" || a.gender === genderFilter;
      const matchCongregation = congregationFilter === "all" || a.congregation === congregationFilter;
      const matchSituacao = situacaoFilter === "all" || a.situacao === situacaoFilter;
      const hasPeriod = periodFrom || periodTo;
      const inPeriod = (dStr) => {
        if (!dStr) return false;
        const d = new Date(dStr);
        if (isNaN(d)) return false;
        if (periodFrom) { const f = new Date(periodFrom); f.setHours(0, 0, 0, 0); if (d < f) return false; }
        if (periodTo) { const t = new Date(periodTo); t.setHours(23, 59, 59, 999); if (d > t) return false; }
        return true;
      };
      const visitedInPeriod = hasPeriod ? inPeriod(a.last_visit_date) : !!a.last_visit_date;
      const matchVisit = visitMode === "all" ? true : visitMode === "visited" ? visitedInPeriod : !visitedInPeriod;
      let matchPriority = true;
      if (priorityFilter !== "all") {
        const level = getPriorityLevel(a);
        if (priorityFilter === "never") matchPriority = getDaysSinceVisit(a) === Infinity;
        else matchPriority = level === priorityFilter;
      }
      return matchSearch && matchStatus && matchGender && matchCongregation && matchSituacao && matchVisit && matchPriority;
    }).sort((a, b) => {
      if (priorityFilter !== "all") {
        return getDaysSinceVisit(b) - getDaysSinceVisit(a);
      }
      return 0;
    });
  }, [addresses, search, statusFilter, genderFilter, congregationFilter, situacaoFilter, visitMode, periodFrom, periodTo, priorityFilter]);

  const visibleAddresses = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="space-y-6"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {pullDistance > 0 && (
        <div
          className="flex items-center justify-center text-muted-foreground text-sm gap-2 transition-all"
          style={{ height: pullDistance, overflow: "hidden" }}
        >
          <RefreshCw className={`h-4 w-4 ${pullDistance >= PULL_THRESHOLD ? "text-primary" : ""}`} />
          {pullDistance >= PULL_THRESHOLD ? t("list.release_refresh") : t("list.pull_refresh")}
        </div>
      )}
      {refreshing && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
          <RefreshCw className="h-4 w-4 animate-spin text-primary" />
          {t("list.refreshing")}
        </div>
      )}
      {(isOffline || offlineCount > 0) && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 px-4 py-2.5 text-sm">
          <span className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-medium">
            <WifiOff className="h-4 w-4" />
            {isOffline
              ? t("list.offline_mode")
              : t("list.pending_sync", { n: offlineCount })}
          </span>
          {offlineCount > 0 && (
            <Button size="sm" variant="outline" className="h-8 gap-1.5 shrink-0" onClick={async () => { await syncNow(); refetch(); }} disabled={offlineSyncing}>
              {offlineSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {t("list.sync")}
            </Button>
          )}
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading font-bold text-2xl">{role === "publisher" ? t("list.title_publisher") : t("list.title")}</h1>
          <p className="text-muted-foreground text-sm">
            {t("list.count", { n: filtered.length })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={showPeriod || visitMode !== "all" ? "default" : "outline"}
            className="gap-2 rounded-xl"
            onClick={() => setShowPeriod((v) => !v)}
          >
            <CalendarRange className="h-4 w-4" />
            {t("list.visit_period")}
          </Button>
          {hasPermission(user, "action_create") && (
            <>
              <QuickRegisterButton variant="outline" />
              <Link to="/addresses/new">
                <Button className="gap-2 rounded-xl">
                  <Plus className="h-4 w-4" />
                  {t("list.new_address")}
                </Button>
              </Link>
            </>
          )}
          {hasPermission(user, "action_import") && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 rounded-xl" disabled={scanning}>
                  {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {t("territories.import")}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => jsonInputRef.current?.click()}>
                  <FileJson className="h-4 w-4" /> {t("territories.import_json")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowScanner(true)}>
                  <QrCode className="h-4 w-4" /> {t("territories.scan_qr")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {hasPermission(user, "action_export") && filtered.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 rounded-xl">
                  <Download className="h-4 w-4" />
                  {t("list.export")}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => {
                  downloadJson(createExport(filtered), getExportFilename());
                  toast.success(t("list.export_json_toast", { n: filtered.length }));
                }}>
                  <FileJson className="h-4 w-4" />
                  {t("list.export_json")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  downloadAddressesExcel(addresses);
                  toast.success(t("list.export_excel_toast", { n: addresses.length }));
                }}>
                  <FileSpreadsheet className="h-4 w-4" />
                  {t("list.export_excel")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <input ref={jsonInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleJsonFile} />
      <QrScannerDialog open={showScanner} onOpenChange={setShowScanner} onScan={handleQRScan} />
      <ImportPreviewDialog
        addresses={previewAddresses}
        open={showPreview}
        onOpenChange={setShowPreview}
        onImported={() => refetch()}
        importSource={importSource}
      />

      <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            aria-label={t("common.search")}
            placeholder={t("list.search_placeholder")}
            className="w-full h-12 pl-10 pr-10 rounded-xl"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && <button type="button" aria-label={t("list.clear")} onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>}
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        {(hasPermission(user, "admin_view_all_congregations") || normalizeRole(user?.role) === "superintendente") && (
          <ResponsiveSelect
            value={congregationFilter}
            onValueChange={setCongregationFilter}
            placeholder={t("common.congregation")}
            triggerClassName="w-full sm:w-44"
            options={[
              { value: "all", label: t("list.all_congregations") },
              ...congregations.map((c) => ({ value: c, label: c })),
            ]}
          />
        )}
        <ResponsiveSelect
          value={statusFilter}
          onValueChange={setStatusFilter}
          placeholder={t("common.status")}
          triggerClassName="w-full sm:w-40"
          options={[
            { value: "all", label: t("list.all_status") },
            { value: "Ativo", label: t("status.ativo") },
            { value: "Inativo", label: t("status.inativo") },
            { value: "Mudou-se", label: t("status.mudou_se") },
            { value: "Não Interessado", label: t("status.nao_interessado") },
          ]}
        />
        <ResponsiveSelect
          value={situacaoFilter}
          onValueChange={setSituacaoFilter}
          placeholder={t("common.situation")}
          triggerClassName="w-full sm:w-44"
          options={[
            { value: "all", label: t("list.all_situations") },
            { value: "Interessado", label: t("situacao.interessado") },
            { value: "Estudante", label: t("situacao.estudante") },
            { value: "Publicador", label: t("situacao.publicador") },
            { value: "Batizado", label: t("situacao.batizado") },
            { value: "Pioneiro", label: t("situacao.pioneiro") },
            { value: "Servo Ministerial", label: t("situacao.servo_ministerial") },
            { value: "Ancião", label: t("situacao.anciao") },
            { value: "Pioneiro Especial", label: t("situacao.pioneiro_especial") },
          ]}
        />
        <ResponsiveSelect
          value={genderFilter}
          onValueChange={setGenderFilter}
          placeholder={t("common.gender")}
          triggerClassName="w-full sm:w-40"
          options={[
            { value: "all", label: t("list.all_genders") },
            { value: "Masculino", label: t("gender.masculino") },
            { value: "Feminino", label: t("gender.feminino") },
            { value: "Casal", label: t("gender.casal") },
          ]}
        />
        <ResponsiveSelect
          value={priorityFilter}
          onValueChange={setPriorityFilter}
          placeholder={t("list.visit_period")}
          triggerClassName="w-full sm:w-44"
          options={[
            { value: "all", label: t("list.all_priorities") },
            { value: "never", label: t("list.never_visited") },
            { value: "urgent", label: t("list.urgent_60") },
            { value: "high", label: t("list.high_30") },
            { value: "medium", label: t("list.medium_15") },
            { value: "low", label: t("list.low_recent") },
          ]}
        />
      </div>

      {showPeriod && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <CalendarRange className="h-4 w-4 text-primary" />
              {t("list.period_filter")}
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5"
              onClick={() => { setVisitMode("all"); setPeriodFrom(""); setPeriodTo(""); setShowPeriod(false); }}
            >
              <X className="h-3.5 w-3.5" /> {t("list.clear")}
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">{t("list.visit_status")}</Label>
              <ResponsiveSelect
                value={visitMode}
                onValueChange={setVisitMode}
                triggerClassName="rounded-xl"
                options={[
                  { value: "all", label: t("list.all_visit") },
                  { value: "visited", label: t("list.visited_period") },
                  { value: "pending", label: t("list.pending_period") },
                ]}
              />
            </div>
            <div>
              <Label className="text-xs">{t("list.from")}</Label>
              <Input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} className="rounded-xl" />
            </div>
            <div>
              <Label className="text-xs">{t("list.to")}</Label>
              <Input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} className="rounded-xl" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {visitMode === "visited" && t("list.visited_hint")}
            {visitMode === "pending" && t("list.pending_hint")}
            {visitMode === "all" && t("list.all_hint")}
          </p>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title={addresses.length === 0 ? t("list.empty_title") : t("list.empty_results")}
          description={addresses.length === 0 ? t("list.empty_desc") : t("list.empty_results_desc")}
          actionLabel={addresses.length === 0 ? t("list.empty_action") : undefined}
          actionPath={addresses.length === 0 ? "/addresses/new" : undefined}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {visibleAddresses.map((addr) => (
              <AddressCard key={addr.id} address={addr} sharedWith={shareMap[addr.id]} onShared={refetch}
                onFinishVisit={canFinishAddressVisit(user, addr, shareMap[addr.id]) ? () => handleFinishVisit(addr, shareMap[addr.id]) : undefined}
                finishing={finishingId === addr.id}
                finishDisabled={!!finishingId || isOffline}
              />
            ))}
          </div>
          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button variant="outline" className="rounded-xl gap-2" onClick={() => setVisibleCount(c => c + PAGE_SIZE)}>
                {t("list.load_more", { n: filtered.length - visibleCount })}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
