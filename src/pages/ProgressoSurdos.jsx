import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { api } from "@/api/apiClient";
import { fetchAddressesForUser, normalizeRole } from "@/lib/permissions";
import { getCityPopulation, normalizeCity, MZ_CITIES_SOURCE } from "@/lib/mzCities";
import { useCongregationObjects } from "@/lib/congregations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Building2, Users, Target, TrendingUp, AlertTriangle, Info, Pencil, Trash2, Loader2, Printer, Plus } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useTranslation } from "@/lib/i18n";
import LanguageSelector from "@/components/LanguageSelector";

function cityFromCongregation(name) {
  if (!name) return "";
  const parts = name.split(",").map((s) => s.trim());
  return parts.length >= 3 ? parts[1] : "";
}

function StatCard({ icon: Icon, label, value, tone }) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/10 text-accent",
    warn: "bg-amber-100 text-amber-700",
    ok: "bg-emerald-100 text-emerald-700",
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${tones[tone] || tones.primary}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold leading-tight">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProgressoSurdos() {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cityFilter, setCityFilter] = useState("all");
  const [congFilter, setCongFilter] = useState("all");
  const [overrides, setOverrides] = useState({});
  const [user, setUser] = useState(null);
  const [editCity, setEditCity] = useState(null);
  const [popInput, setPopInput] = useState("");
  const [renameCity, setRenameCity] = useState(null);
  const [newCityName, setNewCityName] = useState("");
  const [deleteCity, setDeleteCity] = useState(null);
  const [savingCity, setSavingCity] = useState(false);
  const [circuitConfigs, setCircuitConfigs] = useState([]);
  const [selectedCircuitoId, setSelectedCircuitoId] = useState("");
  const [configForm, setConfigForm] = useState({ language: "", speakers: "", population_ref: "" });
  const [savingConfig, setSavingConfig] = useState(false);
  const { t } = useTranslation();

  const { items: congObjects, reload: reloadCongregations } = useCongregationObjects();
  const dbCongregations = useMemo(() => congObjects.map((c) => c.name), [congObjects]);

  const reload = useCallback(async () => {
    const me = await api.auth.me().catch(() => null);
    if (me) setUser(me);
    if (!me) return;
    const data = await fetchAddressesForUser(me, "-updated_date", 2000, false);
    setAddresses(data);
  }, []);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

  // Anciãos e ajudantes veem apenas o progresso da sua própria congregação
  useEffect(() => {
    if (user && normalizeRole(user.role) !== "admin" && normalizeRole(user.role) !== "superintendente" && user.congregation) {
      setCongFilter(user.congregation);
    }
  }, [user]);

  const [overrideIds, setOverrideIds] = useState({});
  const overrideIdsRef = useRef({});
  overrideIdsRef.current = overrideIds;
  const [popStatus, setPopStatus] = useState("");
  const [popInitial, setPopInitial] = useState("");

  const loadOverrides = useCallback(async () => {
    const list = await api.entities.PopulationOverride.list("city_key", 200).catch(() => []);
    const ov = {};
    const ids = {};
    list.forEach((r) => { ov[r.city_key] = r.population; ids[r.city_key] = r.id; });
    setOverrides(ov);
    setOverrideIds(ids);
  }, []);

  useEffect(() => { loadOverrides(); }, [loadOverrides]);

  useEffect(() => {
    const unsub = api.entities.PopulationOverride.subscribe(() => { loadOverrides(); });
    return unsub;
  }, [loadOverrides]);

  const loadCircuitConfigs = useCallback(async () => {
    const list = await api.entities.CircuitLanguageConfig.list("-updated_date", 200).catch(() => []);
    setCircuitConfigs(list);
  }, []);

  useEffect(() => { loadCircuitConfigs(); }, [loadCircuitConfigs]);

  useEffect(() => {
    const unsub = api.entities.CircuitLanguageConfig.subscribe(() => { loadCircuitConfigs(); });
    return unsub;
  }, [loadCircuitConfigs]);

  // Auto-update when new addresses are created/updated/deleted
  useEffect(() => {
    const unsub = api.entities.Address.subscribe(() => { reload(); });
    return unsub;
  }, [reload]);

  // Auto-update when congregations are added/removed
  useEffect(() => {
    const unsub = api.entities.Congregation.subscribe(() => { reloadCongregations(); });
    return unsub;
  }, [reloadCongregations]);

  const isAdmin = normalizeRole(user?.role) === "admin";
  const isSuper = normalizeRole(user?.role) === "superintendente";
  const isManager = isAdmin || isSuper;
  const userCongregation = user?.congregation || "";

  const circuitos = useMemo(() => {
    const map = {};
    congObjects.forEach((c) => {
      if (c.circuito_id) map[c.circuito_id] = c.circuito || c.circuito_id;
    });
    return Object.entries(map).map(([id, name]) => ({ id, name }));
  }, [congObjects]);

  // Auto-select first circuit for admin
  useEffect(() => {
    if (isAdmin && !selectedCircuitoId && circuitos.length > 0) {
      setSelectedCircuitoId(circuitos[0].id);
    }
  }, [isAdmin, selectedCircuitoId, circuitos]);

  const userCongregationObj = congObjects.find((c) => c.name === userCongregation);
  const userCircuitoId = user?.circuito_id || userCongregationObj?.circuito_id || "";
  const activeCircuitoId = isAdmin ? selectedCircuitoId : userCircuitoId;
  const activeConfig = circuitConfigs.find((c) => c.circuito_id === activeCircuitoId);
  const circuitLanguage = activeConfig?.language || "";
  const circuitSpeakers = activeConfig?.speakers || 0;
  const circuitPopRef = activeConfig?.population_ref || 0;
  const hasLanguage = !!circuitLanguage;
  const hasRatio = circuitSpeakers > 0 && circuitPopRef > 0;
  const hasConfig = hasLanguage && hasRatio;

  // Sync configForm when activeConfig changes
  useEffect(() => {
    if (activeConfig) {
      setConfigForm({
        language: activeConfig.language || "",
        speakers: activeConfig.speakers != null ? String(activeConfig.speakers) : "",
        population_ref: activeConfig.population_ref != null ? String(activeConfig.population_ref) : "",
      });
    } else {
      setConfigForm({ language: "", speakers: "", population_ref: "" });
    }
  }, [activeCircuitoId, activeConfig]);

  const congregations = useMemo(() => {
    const set = new Set();
    if (isAdmin) {
      const filterCircuitoId = selectedCircuitoId || "";
      dbCongregations.forEach((c) => {
        if (!filterCircuitoId) {
          set.add(c);
        } else {
          const cong = congObjects.find((co) => co.name === c);
          if (cong?.circuito_id === filterCircuitoId) set.add(c);
        }
      });
    } else if (isSuper && user?.circuito_id) {
      congObjects.filter((c) => c.circuito_id === user.circuito_id).forEach((c) => set.add(c.name));
    } else if (userCongregation) {
      set.add(userCongregation);
    }
    addresses.forEach((a) => { if (a.congregation) set.add(a.congregation); });
    return [...set].sort();
  }, [dbCongregations, congObjects, addresses, isAdmin, isSuper, userCongregation, user, selectedCircuitoId]);

  const scopedAddresses = useMemo(() => {
    if (!isManager) return addresses.filter((a) => a.congregation === userCongregation);
    if (activeCircuitoId) return addresses.filter((a) => a.circuito_id === activeCircuitoId);
    return addresses;
  }, [addresses, isManager, userCongregation, activeCircuitoId]);

  const citiesList = useMemo(() => {
    const set = new Set(scopedAddresses.map((a) => (a.city || "").trim()).filter(Boolean));
    if (isAdmin || isSuper) {
      congregations.forEach((cname) => {
        const c = cityFromCongregation(cname);
        if (c) set.add(c);
      });
    } else if (userCongregation) {
      const c = cityFromCongregation(userCongregation);
      if (c) set.add(c);
    }
    return [...set].sort();
  }, [scopedAddresses, congregations, isAdmin, isSuper, userCongregation]);

  const citiesData = useMemo(() => {
    const base = scopedAddresses.filter((a) => congFilter === "all" || a.congregation === congFilter);
    const counts = {};
    base.forEach((a) => {
      const city = (a.city || "").trim() || "Sem cidade";
      counts[city] = (counts[city] || 0) + 1;
    });
    const citySet = new Set(Object.keys(counts));
    congregations.forEach((cname) => {
      const c = cityFromCongregation(cname);
      if (c) citySet.add(c);
    });
    let rows = [...citySet].map((city) => {
      const info = getCityPopulation(city);
      const key = normalizeCity(city);
      const override = overrides[key];
      const pop = override != null ? Number(override) : info?.pop ?? null;
      const year = override != null ? t("progress.year_manual") : info?.year ?? null;
      const cadastrados = counts[city] || 0;
      // Meta baseada exclusivamente na proporção do circuito (não por cidade).
      // Não existe proporção automática ou padrão.
      let meta = null;
      if (hasConfig && pop != null) {
        meta = (pop / circuitPopRef) * circuitSpeakers;
      }
      const faltam = meta != null ? Math.max(meta - cadastrados, 0) : null;
      const pct = meta != null ? (cadastrados / meta) * 100 : null;
      return { city, pop, year, cadastrados, meta, faltam, pct, found: pop != null };
    });
    rows.sort((a, b) => b.cadastrados - a.cadastrados);
    if (cityFilter !== "all") rows = rows.filter((r) => r.city === cityFilter);
    return rows;
  }, [scopedAddresses, congregations, congFilter, cityFilter, overrides, hasConfig, circuitPopRef, circuitSpeakers, t]);

  const totals = useMemo(() => {
    const totalCadastrados = citiesData.reduce((s, c) => s + c.cadastrados, 0);
    const totalMeta = citiesData.reduce((s, c) => s + (c.meta || 0), 0);
    const totalFaltam = citiesData.reduce((s, c) => s + (c.faltam || 0), 0);
    return {
      totalCities: citiesData.length,
      totalCadastrados,
      totalMeta,
      totalFaltam,
      totalPct: totalMeta > 0 ? (totalCadastrados / totalMeta) * 100 : 0,
    };
  }, [citiesData]);

  const chartData = useMemo(
    () =>
      citiesData.map((c) => ({
        name: c.city.length > 14 ? c.city.slice(0, 13) + "…" : c.city,
        Meta: c.meta != null ? Math.round(c.meta) : 0,
        Cadastrados: c.cadastrados,
        Faltam: c.faltam != null ? Math.round(c.faltam) : 0,
      })),
    [citiesData]
  );

  const openEdit = (city) => {
    setEditCity(city);
    const row = citiesData.find((r) => r.city === city);
    const init = row && row.pop != null ? String(row.pop) : "";
    setPopInput(init);
    setPopInitial(init);
    setPopStatus("");
  };

  const persistOverride = useCallback(async (city, rawVal) => {
    const key = normalizeCity(city);
    const num = rawVal ? Number(rawVal) : null;
    setPopStatus("salvando");
    try {
      if (num != null) {
        const id = overrideIdsRef.current[key];
        if (id) {
          await api.entities.PopulationOverride.update(id, { population: num });
        } else {
          const rec = await api.entities.PopulationOverride.create({ city_key: key, city_name: city, population: num });
          setOverrideIds((prev) => ({ ...prev, [key]: rec.id }));
        }
        setOverrides((prev) => ({ ...prev, [key]: num }));
      } else {
        const id = overrideIdsRef.current[key];
        if (id) {
          await api.entities.PopulationOverride.delete(id);
          setOverrideIds((prev) => { const n = { ...prev }; delete n[key]; return n; });
        }
        setOverrides((prev) => { const n = { ...prev }; delete n[key]; return n; });
      }
      setPopInitial(num != null ? String(num) : "");
      setPopStatus("salvo");
    } catch {
      setPopStatus("erro");
      toast.error(t("progress.pop_save_error"));
    }
  }, [t]);

  useEffect(() => {
    if (!editCity) return;
    if (popInput.replace(/[^\d]/g, "") === popInitial.replace(/[^\d]/g, "")) return;
    const timer = setTimeout(() => {
      persistOverride(editCity, popInput.replace(/[^\d]/g, ""));
    }, 900);
    return () => clearTimeout(timer);
  }, [popInput, editCity, popInitial, persistOverride]);

  const saveEdit = async () => {
    await persistOverride(editCity, popInput.replace(/[^\d]/g, ""));
    setEditCity(null);
  };

  const clearOverride = (city) => {
    persistOverride(city, "");
  };

  const openRename = (city) => {
    setRenameCity(city);
    setNewCityName(city === "Sem cidade" ? "" : city);
  };

  const handleRenameCity = async () => {
    if (!renameCity || !newCityName.trim()) return;
    const oldName = renameCity;
    const newName = newCityName.trim();
    if (newName === oldName) { setRenameCity(null); return; }
    setSavingCity(true);
    try {
      const isEmpty = oldName === "Sem cidade";
      const addrIds = scopedAddresses
        .filter((a) => (isEmpty ? !(a.city || "").trim() : (a.city || "").trim() === oldName))
        .map((a) => a.id);
      if (addrIds.length) {
        await api.entities.Address.bulkUpdate(addrIds.map((id) => ({ id, city: newName })));
      }
      const all = await api.entities.Congregation.list("name", 300);
      const congUpdates = all
        .filter((c) => { const p = c.name.split(",").map((s) => s.trim()); return p.length >= 3 && p[1] === oldName; })
        .map((c) => { const p = c.name.split(",").map((s) => s.trim()); p[1] = newName; return { id: c.id, name: p.join(", ") }; });
      if (congUpdates.length) await api.entities.Congregation.bulkUpdate(congUpdates);
      toast.success(t("progress.rename_success", { name: newName }));
      setRenameCity(null);
      setNewCityName("");
      await reload();
      await reloadCongregations();
    } catch {
      toast.error(t("progress.rename_error"));
    } finally {
      setSavingCity(false);
    }
  };

  const handleDeleteCity = async () => {
    if (!deleteCity) return;
    const cityName = deleteCity;
    setSavingCity(true);
    try {
      const isEmpty = cityName === "Sem cidade";
      const addrIds = scopedAddresses
        .filter((a) => (isEmpty ? !(a.city || "").trim() : (a.city || "").trim() === cityName))
        .map((a) => a.id);
      if (addrIds.length) {
        await api.entities.Address.bulkUpdate(addrIds.map((id) => ({ id, deleted: true })));
      }
      toast.success(t("progress.delete_success", { n: addrIds.length }));
      setDeleteCity(null);
      await reload();
    } catch {
      toast.error(t("progress.delete_error"));
    } finally {
      setSavingCity(false);
    }
  };

  // --- Configuração do idioma do circuito ---
  const handleSaveConfig = async () => {
    if (!activeCircuitoId) {
      toast.error(t("progress.circuit_config_error"));
      return;
    }
    setSavingConfig(true);
    try {
      const payload = {
        circuito_id: activeCircuitoId,
        circuito_name: circuitos.find((c) => c.id === activeCircuitoId)?.name || "",
        language: configForm.language || "",
        speakers: Number(configForm.speakers) || 0,
        population_ref: Number(configForm.population_ref) || 0,
        configured_by: user?.id || "",
        configured_by_name: user?.full_name || "",
      };
      if (activeConfig) {
        await api.entities.CircuitLanguageConfig.update(activeConfig.id, payload);
      } else {
        await api.entities.CircuitLanguageConfig.create(payload);
      }
      toast.success(t("progress.circuit_config_saved"));
      await loadCircuitConfigs();
    } catch {
      toast.error(t("progress.circuit_config_error"));
    } finally {
      setSavingConfig(false);
    }
  };

  const fmt = (n) => (n != null ? Math.round(n).toLocaleString("pt-BR") : "—");

  const handlePrintReport = () => {
    const dateStr = new Date().toLocaleDateString("pt-BR");
    const rowsHtml = citiesData
      .map(
        (c) => `<tr>
          <td>${c.city}</td>
          <td style="text-align:right">${c.found ? fmt(c.pop) : "—"}${c.year ? ` <span class="muted">(${c.year})</span>` : ""}</td>
          <td style="text-align:right">${c.meta != null ? fmt(c.meta) : "—"}</td>
          <td style="text-align:right">${c.cadastrados}</td>
          <td style="text-align:right">${fmt(c.faltam)}</td>
          <td style="text-align:right">${c.pct != null ? c.pct.toFixed(1) + "%" : "—"}</td>
        </tr>`
      )
      .join("");
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${t("progress.print_report_title")}</title>
<style>
  body{font-family:Inter,Arial,sans-serif;color:#1e293b;margin:24px;}
  h1{font-size:20px;margin:0 0 4px;}
  .sub{color:#64748b;font-size:12px;margin-bottom:16px;}
  .stats{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px;}
  .stat{border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;flex:1;min-width:120px;}
  .stat .l{font-size:11px;color:#64748b;}
  .stat .v{font-size:18px;font-weight:700;}
  table{width:100%;border-collapse:collapse;font-size:12px;}
  th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left;}
  th{background:#f1f5f9;}
  .muted{color:#94a3b8;font-size:10px;}
  .footer{margin-top:18px;font-size:10px;color:#94a3b8;}
  @media print{@page{size:A4;margin:14mm;}}
</style></head><body>
  <h1>${t("progress.print_report_title")}</h1>
  <div class="sub">${t("progress.print_generated", { date: dateStr })}</div>
  <div class="stats">
    <div class="stat"><div class="l">${t("progress.print_stat_total_cities")}</div><div class="v">${totals.totalCities}</div></div>
    <div class="stat"><div class="l">${t("progress.print_stat_registered")}</div><div class="v">${totals.totalCadastrados}</div></div>
    <div class="stat"><div class="l">${t("progress.print_stat_goal")}</div><div class="v">${fmt(totals.totalMeta)}</div></div>
    <div class="stat"><div class="l">${t("progress.print_stat_missing")}</div><div class="v">${fmt(totals.totalFaltam)}</div></div>
    <div class="stat"><div class="l">${t("progress.print_stat_achieved")}</div><div class="v">${totals.totalPct.toFixed(1)}%</div></div>
  </div>
  <table>
    <thead><tr><th>${t("progress.print_th_city")}</th><th style="text-align:right">${t("progress.print_th_pop")}</th><th style="text-align:right">${t("progress.print_th_goal")}</th><th style="text-align:right">${t("progress.print_th_registered")}</th><th style="text-align:right">${t("progress.print_th_missing")}</th><th style="text-align:right">${t("progress.print_th_achieved")}</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div class="footer">${t("progress.print_footer", { src: MZ_CITIES_SOURCE })}</div>
  <script>window.onload=function(){setTimeout(function(){window.print();},300);}</script>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) { toast.error(t("progress.print_no_popup")); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading font-bold text-2xl">{t("progress.title")}</h1>
          <p className="text-muted-foreground text-sm">
            {t("progress.subtitle")}
          </p>
        </div>
        <Button variant="outline" className="gap-2 rounded-xl shrink-0" onClick={handlePrintReport}>
          <Printer className="h-4 w-4" />
          {t("progress.print_report")}
        </Button>
      </div>

      <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 flex items-start gap-2">
        <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800">
          {t("progress.reference_note", { src: MZ_CITIES_SOURCE })}
        </p>
      </div>

      {/* Status da configuração do circuito */}
      <div className="rounded-xl bg-muted/50 border border-border p-3 flex items-start gap-2">
        <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground space-y-1">
          {isAdmin && !activeCircuitoId ? (
            <p>{t("progress.circuit_select_prompt")}</p>
          ) : !hasLanguage ? (
            <p>{t("progress.circuit_no_language")}</p>
          ) : !hasRatio ? (
            <p>{t("progress.circuit_no_ratio")}</p>
          ) : (
            <p className="font-medium text-foreground">
              {t("progress.circuit_configured", { language: circuitLanguage, speakers: circuitSpeakers, pop_ref: circuitPopRef })}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>{t("progress.filter_city")}</Label>
          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("progress.all_cities")}</SelectItem>
              {citiesList.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isManager && (
          <div>
            <Label>{t("progress.filter_congregation")}</Label>
            <Select value={congFilter} onValueChange={setCongFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("progress.all_congregations")}</SelectItem>
                {congregations.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard icon={Building2} label={t("progress.total_cities")} value={totals.totalCities} tone="primary" />
        <StatCard icon={Users} label={t("progress.registered")} value={totals.totalCadastrados} tone="primary" />
        <StatCard icon={Target} label={t("progress.goal_total")} value={fmt(totals.totalMeta)} tone="accent" />
        <StatCard icon={AlertTriangle} label={t("progress.missing")} value={fmt(totals.totalFaltam)} tone="warn" />
        <StatCard icon={TrendingUp} label={t("progress.achieved")} value={totals.totalMeta > 0 ? `${totals.totalPct.toFixed(1)}%` : "—"} tone="ok" />
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("progress.chart_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" interval={0} height={60} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Meta" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Cadastrados" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Faltam" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("progress.table_city")}</TableHead>
                <TableHead className="text-right">{t("progress.table_pop")}</TableHead>
                <TableHead className="text-right">{t("progress.table_goal")}</TableHead>
                <TableHead className="text-right">{t("progress.table_registered")}</TableHead>
                <TableHead className="text-right">{t("progress.table_missing")}</TableHead>
                <TableHead className="text-right">{t("progress.table_achieved")}</TableHead>
                {isManager && <TableHead className="text-right">{t("progress.table_actions")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {citiesData.map((c) => (
                <TableRow key={c.city}>
                  <TableCell className="font-medium">{c.city}</TableCell>
                  <TableCell className="text-right">
                    {c.found ? (
                      <div className="flex items-center justify-end gap-1">
                        <span>{fmt(c.pop)}</span>
                        <span className="text-[10px] text-muted-foreground">({c.year})</span>
                        <button onClick={() => openEdit(c.city)} className="text-muted-foreground hover:text-primary" title={t("common.edit")}>
                          <Pencil className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-amber-600 text-xs italic">{t("progress.pop_not_found")}</span>
                        <button onClick={() => openEdit(c.city)} className="text-primary underline text-xs">{t("progress.inform")}</button>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {c.meta != null ? (
                      <span>{fmt(c.meta)}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">{t("progress.goal_not_set")}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold">{c.cadastrados}</TableCell>
                  <TableCell className="text-right">{fmt(c.faltam)}</TableCell>
                  <TableCell className="text-right">
                    {c.pct != null ? (
                      <span className={`font-semibold ${c.pct >= 100 ? "text-emerald-600" : c.pct >= 50 ? "text-amber-600" : "text-red-600"}`}>
                        {c.pct.toFixed(1)}%
                      </span>
                    ) : "—"}
                  </TableCell>
                  {isManager && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openRename(c.city)} className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors" title={t("progress.rename_title")}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setDeleteCity(c.city)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title={t("progress.delete_city_title", { name: c.city })}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {citiesData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isManager ? 7 : 6} className="text-center text-muted-foreground py-8">
                    {t("progress.no_data")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Configuração do idioma do circuito — gestão pelo Superintendente de Circuito */}
      {isManager && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-accent" />
              <h2 className="font-heading font-semibold text-lg">{t("progress.circuit_config_title")}</h2>
            </div>
            <p className="text-sm text-muted-foreground">{t("progress.circuit_config_desc")}</p>

            {isAdmin && (
              <div>
                <Label>{t("progress.circuit_select")}</Label>
                <Select value={selectedCircuitoId} onValueChange={setSelectedCircuitoId}>
                  <SelectTrigger><SelectValue placeholder={t("progress.circuit_select")} /></SelectTrigger>
                  <SelectContent>
                    {circuitos.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {activeCircuitoId && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label>{t("progress.circuit_language_label")}</Label>
                    <LanguageSelector
                      value={configForm.language}
                      onChange={(v) => setConfigForm((p) => ({ ...p, language: v }))}
                      placeholder={t("progress.circuit_language_ph")}
                      circuitoId={activeCircuitoId}
                      user={user}
                    />
                  </div>
                  <div>
                    <Label>{t("progress.circuit_speakers_label")}</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      placeholder="0"
                      value={configForm.speakers}
                      onChange={(e) => setConfigForm((p) => ({ ...p, speakers: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>{t("progress.circuit_pop_ref_label")}</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      placeholder="0"
                      value={configForm.population_ref}
                      onChange={(e) => setConfigForm((p) => ({ ...p, population_ref: e.target.value }))}
                    />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">{t("progress.circuit_config_ratio_example")}</p>

                <Button onClick={handleSaveConfig} disabled={savingConfig || !configForm.language} className="gap-2 rounded-xl">
                  {savingConfig ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {t("progress.circuit_config_save")}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editCity} onOpenChange={(o) => !o && setEditCity(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("progress.pop_dialog_title", { name: editCity })}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("progress.pop_dialog_desc")}</p>
          <Input
            value={popInput}
            onChange={(e) => setPopInput(e.target.value)}
            placeholder={t("progress.pop_placeholder")}
            inputMode="numeric"
          />
          <p className="text-xs text-muted-foreground flex items-center gap-1 min-h-[1rem]">
            {popStatus === "salvando" && <><Loader2 className="h-3 w-3 animate-spin" /> {t("progress.autosaving")}</>}
            {popStatus === "salvo" && <span className="text-emerald-600">{t("progress.saved")}</span>}
            {popStatus === "erro" && <span className="text-destructive">{t("progress.error_save")}</span>}
            {!popStatus && t("progress.autosave_note")}
          </p>
          <DialogFooter>
            {editCity && overrides[normalizeCity(editCity)] != null && (
              <Button variant="ghost" onClick={() => { clearOverride(editCity); setEditCity(null); }} className="mr-auto">
                {t("progress.restore")}
              </Button>
            )}
            <Button variant="outline" onClick={() => setEditCity(null)}>{t("progress.cancel")}</Button>
            <Button onClick={saveEdit}>{t("progress.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renameCity} onOpenChange={(o) => !o && setRenameCity(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("progress.rename_title")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("progress.rename_desc", { name: renameCity })}
          </p>
          <Input
            value={newCityName}
            onChange={(e) => setNewCityName(e.target.value)}
            placeholder={t("progress.new_city_placeholder")}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameCity(null)}>{t("progress.cancel")}</Button>
            <Button onClick={handleRenameCity} disabled={savingCity || !newCityName.trim()} className="gap-2">
              {savingCity && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("progress.rename_btn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteCity} onOpenChange={(o) => !o && setDeleteCity(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("progress.delete_city_title", { name: deleteCity })}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteCity && (() => {
                const isEmpty = deleteCity === "Sem cidade";
                const n = scopedAddresses.filter((a) => isEmpty ? !(a.city || "").trim() : (a.city || "").trim() === deleteCity).length;
                return <>{t("progress.delete_city_desc", { n })}</>;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("progress.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCity} disabled={savingCity} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2">
              {savingCity && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("progress.delete_btn")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}