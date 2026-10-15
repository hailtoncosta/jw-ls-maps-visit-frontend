import ShareMessages from "@/components/ShareMessages";
import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  MapPin, Users, Building2, House, TrendingUp, Plus, Map as MapIcon,
  Briefcase, BarChart3, ChevronRight, ArrowRight, Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import AddressCard from "../components/AddressCard";
import EmptyState from "../components/EmptyState";
import QuickRegisterButton from "../components/QuickRegisterButton";
import DashboardMapPreview from "../components/DashbordMapPreview";
import { useAuth } from "@/lib/AuthContext";
import { fetchAddressesForUser, normalizeRole, hasPermission, setCongregationCircuitCache, isAdminCircuitIsolated } from "@/lib/permissions";
import { getCityPopulation, normalizeCity } from "@/lib/mzCities";
import { api } from "@/api/apiClient";
import { getCachedAddresses, cacheAddresses, getCachedVisits, cacheVisits, getCachedOverrides, cacheOverrides } from "@/lib/offlineDb";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useTranslation } from "@/lib/i18n";

// A meta fixa de 2/1000 foi removida. O progresso agora é baseado
// exclusivamente nas metas configuradas por idioma na página Progresso.

function Stat({ icon: Icon, label, value, tone }) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/10 text-accent",
    chart3: "bg-chart-3/15 text-chart-3",
    chart4: "bg-chart-4/15 text-chart-4",
  };
  return (
    <div className="bg-card rounded-2xl border border-border p-4 sm:p-5 flex items-center gap-3 sm:gap-4 animate-fade-in">
      <div className={`h-11 w-11 sm:h-12 sm:w-12 rounded-xl flex items-center justify-center shrink-0 ${tones[tone] || tones.primary}`}>
        <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
      </div>
      <div className="min-w-0">
        <p className="text-xl sm:text-2xl font-heading font-bold text-foreground leading-tight truncate">{value}</p>
        <p className="text-xs sm:text-sm text-muted-foreground truncate">{label}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [addresses, setAddresses] = useState([]);
  const [overrides, setOverrides] = useState({});
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [circuitConfigs, setCircuitConfigs] = useState([]);
  const [congregations, setCongregations] = useState([]);
  const { user, isLoadingAuth } = useAuth();
  const { t } = useTranslation();

  const loadAddresses = () => {
    if (!user) return;
    if (!navigator.onLine) {
      setAddresses(getCachedAddresses());
      setLoading(false);
      return;
    }
    fetchAddressesForUser(user, "-updated_date", 2000, true).then((addrs) => {
      setAddresses(addrs);
      cacheAddresses(addrs);
      setLoading(false);
    });
  };

  const loadOverrides = async () => {
    if (!navigator.onLine) {
      setOverrides(getCachedOverrides());
      return;
    }
    const list = await api.entities.PopulationOverride.list("city_key", 500).catch(() => []);
    const ov = {};
    list.forEach((r) => { ov[r.city_key] = r.population; });
    setOverrides(ov);
    cacheOverrides(ov);
  };

  const loadVisits = async () => {
    if (!navigator.onLine) {
      setVisits(getCachedVisits());
      return;
    }
    try {
      const all = await api.entities.VisitHistory.list("-visit_date", 2000);
      const role = normalizeRole(user?.role);
      let scoped = all;
      if (role === "admin" && !isAdminCircuitIsolated(user)) {
        scoped = all;
      } else if ((role === "superintendente" || isAdminCircuitIsolated(user)) && user.circuito_id) {
        const congs = await api.entities.Congregation.list("name", 500);
        setCongregationCircuitCache(congs);
        const names = new Set(congs.filter((c) => c.circuito_id === user.circuito_id).map((c) => c.name));
        scoped = all.filter((v) => v.congregation && names.has(v.congregation));
      } else if (user.congregation) {
        scoped = all.filter((v) => v.congregation === user.congregation);
      } else {
        scoped = [];
      }
      setVisits(scoped);
      cacheVisits(scoped);
    } catch {
      setVisits([]);
    }
  };

  const loadCircuitConfigs = async () => {
    if (!navigator.onLine) return;
    const list = await api.entities.CircuitLanguageConfig.list("-updated_date", 200).catch(() => []);
    setCircuitConfigs(list);
  };

  const loadCongregations = async () => {
    if (!navigator.onLine) return;
    const list = await api.entities.Congregation.list("name", 500).catch(() => []);
    setCongregations(list);
  };

  useEffect(() => {
    if (isLoadingAuth) return;
    if (!user) { setLoading(false); return; }
    loadAddresses();
    loadOverrides();
    loadVisits();
    loadCircuitConfigs();
    loadCongregations();
  }, [user, isLoadingAuth]);

  // Mantém os números atualizados em tempo real
  useEffect(() => {
    if (!user) return;
    const unsub = api.entities.Address.subscribe(() => { loadAddresses(); });
    return unsub;
  }, [user]);

  useEffect(() => {
    const unsub = api.entities.PopulationOverride.subscribe(() => { loadOverrides(); });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = api.entities.VisitHistory.subscribe(() => { loadVisits(); });
    return unsub;
  }, [user]);

  useEffect(() => {
    const unsub = api.entities.CircuitLanguageConfig.subscribe(() => { loadCircuitConfigs(); });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = api.entities.Congregation.subscribe(() => { loadCongregations(); });
    return unsub;
  }, []);

  const stats = useMemo(() => {
    const activeCount = addresses.filter((a) => a.status === "Ativo" || !a.status).length;
    const cityCounts = {};
    addresses.forEach((a) => {
      const c = (a.city || "").trim();
      if (c) cityCounts[c] = (cityCounts[c] || 0) + 1;
    });
    return {
      total: addresses.length,
      active: activeCount,
      cities: Object.keys(cityCounts).length,
    };
  }, [addresses]);

  const territoryProgress = useMemo(() => {
    const role = normalizeRole(user?.role);
    const userCongregation = congregations.find((c) => c.name === user?.congregation);
    // O painel mostra um circuito por vez, como a tela de Progresso.
    const circuitId = user?.circuito_id || userCongregation?.circuito_id ||
      (role === "admin" ? congregations.find((c) => c.circuito_id)?.circuito_id : "");
    const config = circuitConfigs.find((c) => c.circuito_id === circuitId);
    const hasConfig = !!config?.language && Number(config.speakers) > 0 && Number(config.population_ref) > 0;
    const circuitAddresses = circuitId
      ? addresses.filter((a) => a.circuito_id === circuitId ||
          (!a.circuito_id && congregations.some((c) => c.name === a.congregation && c.circuito_id === circuitId)))
      : addresses;
    const cityNames = new Map();
    const addCity = (name) => {
      const city = (name || "").trim();
      if (city) cityNames.set(normalizeCity(city), city);
    };
    circuitAddresses.forEach((a) => addCity(a.city));
    congregations.filter((c) => c.circuito_id === circuitId &&
      (["admin", "superintendente"].includes(role) || c.name === user?.congregation)).forEach((c) => {
      const parts = (c.name || "").split(",").map((part) => part.trim());
      if (parts.length >= 3) addCity(parts[1]);
    });
    let meta = 0;
    if (hasConfig) cityNames.forEach((city, key) => {
      const population = overrides[key] != null ? Number(overrides[key]) : getCityPopulation(city)?.pop;
      if (Number.isFinite(population) && population > 0)
        meta += population / Number(config.population_ref) * Number(config.speakers);
    });
    const cadastrados = circuitAddresses.length;
    const pct = meta > 0 ? cadastrados / meta * 100 : 0;
    return { cadastrados, meta, pct: Number.isFinite(pct) ? pct : 0 };
  }, [addresses, congregations, overrides, circuitConfigs, user]);

  const visitChart = useMemo(() => {
    const idSet = new Set(addresses.map((a) => a.id));
    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({ key, label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""), total: 0 });
    }
    const idx = {};
    months.forEach((m) => { idx[m.key] = m; });
    visits.forEach((v) => {
      if (!idSet.has(v.address_id)) return;
      const d = v.visit_date ? new Date(v.visit_date) : null;
      if (!d || isNaN(d)) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (idx[key]) idx[key].total += 1;
    });
    return months;
  }, [addresses, visits]);

  const recentAddresses = addresses.slice(0, 6);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const role = normalizeRole(user?.role);

  const quickActions = [
    { to: "/addresses/new", icon: Plus, label: t("dashboard.quick.new_register"), desc: t("dashboard.quick.new_register_desc"), perm: "action_create", primary: true },
    { to: "/map", icon: MapIcon, label: t("dashboard.quick.map"), desc: t("dashboard.quick.map_desc"), perm: "page_map" },
    { to: "/my-territories", icon: Briefcase, label: t("dashboard.quick.my_territories"), desc: t("dashboard.quick.my_territories_desc"), perm: "page_my_territories" },
    { to: "/progress", icon: BarChart3, label: t("dashboard.quick.progress"), desc: t("dashboard.quick.progress_desc"), perm: "page_progress" },
  ].filter((a) => !a.perm || hasPermission(user, a.perm));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/30 shrink-0">
            <MapPin className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>
          <div>
            <h1 className="font-heading font-bold text-xl sm:text-2xl text-foreground leading-tight">{t("app.title")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("dashboard.greeting", { name: user?.full_name ? `, ${user.full_name.split(" ")[0]}` : "" })}
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:items-end gap-2">
          <div className="flex items-center gap-3"><span className="text-sm font-medium text-foreground">{user?.full_name || "—"}</span><ShareMessages /></div>
          {user?.congregation && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
              <House className="h-3 w-3" /> {user.congregation}
            </span>
          )}
          {hasPermission(user, "action_create") && <QuickRegisterButton variant="outline" />}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Stat icon={MapPin} label={t("dashboard.stats.total_addresses")} value={stats.total} tone="primary" />
        <Stat icon={Users} label={t("dashboard.stats.active")} value={stats.active} tone="accent" />
        <Stat icon={Building2} label={t("dashboard.stats.cities")} value={stats.cities} tone="chart3" />
        <Stat icon={TrendingUp} label={t("dashboard.stats.progress")} value={territoryProgress.meta > 0 ? `${territoryProgress.pct.toFixed(1)}%` : "—"} tone="chart4" />
      </div>

      {/* Quick access */}
      {quickActions.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {quickActions.map((a) => {
            const Icon = a.icon;
            return (
              <Link key={a.to} to={a.to}>
                <div
                  className={`group h-full rounded-2xl border p-4 sm:p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all flex flex-col gap-3 ${
                    a.primary
                      ? "bg-primary text-primary-foreground border-primary hover:border-primary/80"
                      : "bg-card border-border hover:border-primary/40"
                  }`}
                >
                  <div
                    className={`h-11 w-11 rounded-xl flex items-center justify-center ${
                      a.primary ? "bg-primary-foreground/15 text-primary-foreground" : "bg-primary/10 text-primary"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className={`font-heading font-semibold ${a.primary ? "text-primary-foreground" : "text-foreground"}`}>
                      {a.label}
                    </p>
                    <p className={`text-xs ${a.primary ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                      {a.desc}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Progress + Map preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5 flex flex-col animate-fade-in">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-heading font-semibold text-lg">{t("dashboard.progress.title")}</h2>
            <Target className="h-5 w-5 text-accent" />
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            {t("dashboard.progress.reference_goal")}
          </p>
          <div className="flex items-end gap-2 mb-2">
            <span className="text-3xl font-heading font-bold text-foreground">{territoryProgress.meta > 0 ? `${territoryProgress.pct.toFixed(1)}%` : "—"}</span>
            <span className="text-sm text-muted-foreground mb-1">{t("dashboard.progress.achieved")}</span>
          </div>
          <div className="h-3 w-full rounded-full bg-muted overflow-hidden mb-2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all"
              role="progressbar"
              aria-valuenow={Math.min(100, Math.max(0, territoryProgress.pct))}
              aria-valuemin={0}
              aria-valuemax={100}
              style={{ width: `${Math.min(100, Math.max(0, territoryProgress.pct))}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mb-4">
            <span>{t("dashboard.progress.registered", { n: territoryProgress.cadastrados })}</span>
            <span>{t("dashboard.progress.goal", { n: territoryProgress.meta > 0 ? Math.round(territoryProgress.meta).toLocaleString("pt-BR") : "—" })}</span>
          </div>
          <div className="mt-auto">
            <Link to="/progress">
              <Button variant="outline" className="w-full rounded-xl gap-2">
                {t("dashboard.progress.view_progress")} <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 flex flex-col animate-fade-in">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-heading font-semibold text-lg">{t("dashboard.map_preview.title")}</h2>
            <MapIcon className="h-5 w-5 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground mb-3">{t("dashboard.map_preview.total", { n: addresses.length })}</p>
          <DashboardMapPreview addresses={addresses} />
          <Link to="/map">
            <Button variant="outline" className="w-full rounded-xl gap-2 mt-3">
              {t("dashboard.map_preview.open")} <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Visit history chart */}
      <div className="rounded-2xl border border-border bg-card p-5 animate-fade-in">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-heading font-semibold text-lg">{t("dashboard.visit_history.title")}</h2>
          <BarChart3 className="h-5 w-5 text-primary" />
        </div>
        <p className="text-sm text-muted-foreground mb-4">{t("dashboard.visit_history.subtitle")}</p>
        <div className="w-full h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={visitChart} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="total" name="Visitas" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-semibold text-lg">{t("dashboard.recent.title")}</h2>
          <Link to="/addresses" className="flex items-center gap-1 text-sm text-primary font-medium hover:underline">
            {t("dashboard.recent.view_all")} <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {addresses.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title={t("dashboard.empty.title")}
            description={t("dashboard.empty.description")}
            actionLabel={t("dashboard.empty.action")}
            actionPath="/addresses/new"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {recentAddresses.map((addr) => (
              <AddressCard key={addr.id} address={addr} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
