import { useState, useEffect, useMemo } from "react";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Printer, Monitor, MapPin, Share2, Loader2, Sparkles } from "lucide-react";
import PrintCard from "@/components/PrintCard";
import DigitalCard from "@/components/DigitalCard";
import FitScale from "@/components/FitScale";
import EmptyState from "@/components/EmptyState";
import { buildGroupText, shareContent } from "@/lib/shareCard";
import { fetchAddressesForUser } from "@/lib/permissions";
import { extractCoords, getMapsLink } from "@/lib/maps";
import { getCachedAddresses, cacheAddresses } from "@/lib/offlineDb";

import { useMapSnapshots } from "@/hooks/useMapSnapshots";
import PrintCardEditor from "@/components/print/PrintCardEditor";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";

const pairUp = (items) => {
  const groups = [];
  for (let i = 0; i < items.length; i += 2) {
    const pair = items.slice(i, i + 2);
    groups.push({ id: pair.map((a) => a.id).join("__"), items: pair });
  }
  return groups;
};

export default function VisitCards() {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [cardStyle, setCardStyle] = useState("compact");
  const [cardsPerGroup, setCardsPerGroup] = useState("6");
  const [statusFilter, setStatusFilter] = useState("Ativo");
  const [congregationFilter, setCongregationFilter] = useState("all");
  const [selectedGroup, setSelectedGroup] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    api
      .auth.me()
      .catch(() => null)
      .then(async (me) => {
        setUser(me);
        if (!navigator.onLine) {
          setAddresses(getCachedAddresses());
          setLoading(false);
          return;
        }
        let data = me ? await fetchAddressesForUser(me, "name", 2000, true) : [];
        if (me?.role?.toLowerCase() === "admin" && data.some((address) => address.card_number == null)) {
          try {
            await api.functions.invoke("backfillCardNumbers");
            data = await fetchAddressesForUser(me, "name", 2000, true);
          } catch (error) {
            console.error("Não foi possível numerar os cartões", error);
          }
        }
        setAddresses(data);
        cacheAddresses(data);
        setLoading(false);
      });
  }, []);

  const congregations = useMemo(() => {
    const set = new Set(addresses.map((a) => a.congregation).filter(Boolean));
    return [...set].sort();
  }, [addresses]);

  const filtered = useMemo(() => {
    return addresses.filter((a) => {
      if (statusFilter !== "all" && !(a.status === statusFilter || (!a.status && statusFilter === "Ativo"))) return false;
      if (congregationFilter !== "all" && a.congregation !== congregationFilter) return false;
      return true;
    });
  }, [addresses, statusFilter, congregationFilter]);

  // One snapshot per address — the map shows only that address's pin.
  const withCoords = useMemo(() => {
    return filtered
      .map((a) => {
        const coords =
          a.lat != null && a.lng != null
            ? { lat: a.lat, lng: a.lng }
            : extractCoords(getMapsLink(a) || "");
        return { address: a, coords };
      })
      .filter((w) => w.coords);
  }, [filtered]);

  const { containerRef, snapshots, generating, progress, generate } = useMapSnapshots();

  const handleGenerate = () => {
    const items = allGroups[selectedGroup]?.items || [];
    const groups = items
      .map((a) => {
        const coords =
          a.lat != null && a.lng != null
            ? { lat: a.lat, lng: a.lng }
            : extractCoords(getMapsLink(a) || "");
        return { id: a.id, points: [{ address: a, coords }] };
      })
      .filter((g) => g.points[0].coords);
    if (groups.length === 0) {
      toast.info(t("cards.no_coords_toast"));
      return;
    }
    generate(groups);
  };

  const perGroup = parseInt(cardsPerGroup);
  const groupedByCongregation = useMemo(() => {
    const map = {};
    filtered.forEach((a) => {
      const key = a.congregation || t("cards.ungrouped");
      if (!map[key]) map[key] = [];
      map[key].push(a);
    });
    return Object.keys(map)
      .sort()
      .map((congregation) => ({ congregation, items: map[congregation], groups: [] }))
      .map((entry) => {
        for (let i = 0; i < entry.items.length; i += perGroup) {
          entry.groups.push(entry.items.slice(i, i + perGroup));
        }
        return entry;
      });
  }, [filtered, perGroup]);

  const allGroups = useMemo(() => {
    const result = [];
    groupedByCongregation.forEach((entry) => {
      entry.groups.forEach((group) => {
        result.push({ congregation: entry.congregation, items: group });
      });
    });
    return result;
  }, [groupedByCongregation]);

  // Cards pareados (1 ou 2 surdos) com coordenadas, para o editor de impressão.
  const editorCards = useMemo(() => {
    return (allGroups[selectedGroup]?.items || [])
      .map((a) => {
        const coords =
          a.lat != null && a.lng != null
            ? { lat: a.lat, lng: a.lng }
            : extractCoords(getMapsLink(a) || "");
        return { id: a.id, points: [{ address: a, coords }] };
      })
      .filter((g) => g.points[0].coords);
  }, [allGroups, selectedGroup]);

  const handlePrint = () => window.print();

  const handleShareGroup = async () => {
    const group = allGroups[selectedGroup];
    if (!group) return;
    setSharing(true);
    const text = buildGroupText(group.items, group.congregation);
    const result = await shareContent(t("common.visit_card"), text);
    setSharing(false);
    if (result.method === "clipboard") toast.success(t("cards.clipboard_success"));
    else if (result.method === "error") toast.error(t("cards.share_error"));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const currentGroup = allGroups[selectedGroup];
  const readyCount = Object.keys(snapshots).length;

  return (
    <>
    <div className={`space-y-6 ${editorOpen ? "no-print" : ""}`}>
      <div>
        <h1 className="font-heading font-bold text-2xl">{t("cards.title")}</h1>
        <p className="text-muted-foreground text-sm">
          {t("cards.subtitle")}
        </p>
      </div>

      {/* Controls */}
      <div className="no-print bg-card rounded-2xl border border-border p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <Label>{t("cards.style")}</Label>
            <Select value={cardStyle} onValueChange={setCardStyle}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">
                  <div className="flex items-center gap-2"><Printer className="h-4 w-4" /> {t("cards.style_print")}</div>
                </SelectItem>
                <SelectItem value="digital">
                  <div className="flex items-center gap-2"><Monitor className="h-4 w-4" /> {t("cards.style_digital")}</div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("cards.per_group")}</Label>
            <Select value={cardsPerGroup} onValueChange={setCardsPerGroup}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 por grupo</SelectItem>
                <SelectItem value="6">6 por grupo</SelectItem>
                <SelectItem value="9">9 por grupo</SelectItem>
                <SelectItem value="12">12 por grupo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {user?.role === "admin" && (
            <div>
              <Label>{t("common.congregation")}</Label>
              <Select value={congregationFilter} onValueChange={(v) => { setCongregationFilter(v); setSelectedGroup(0); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("cards.all")}</SelectItem>
                  {congregations.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>{t("common.status")}</Label>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setSelectedGroup(0); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("cards.status_all")}</SelectItem>
                <SelectItem value="Ativo">{t("cards.status_active")}</SelectItem>
                <SelectItem value="Inativo">{t("cards.status_inactive")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {cardStyle === "compact" && (
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div className="text-sm text-muted-foreground">
              {generating ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" /> {t("cards.generating", { n: progress })}
                </span>
              ) : (
                <span>
                  {t("cards.coords_ready", { n: withCoords.length, m: readyCount })}
                  {readyCount === 0 && t("cards.gen_hint")}
                </span>
              )}
            </div>
            <Button onClick={handleGenerate} disabled={generating} variant="outline" className="gap-2 rounded-xl shrink-0">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {t("cards.generate")}
            </Button>
          </div>
        )}

        <div className="flex gap-3">
          {cardStyle === "compact" ? (
            <Button onClick={() => setEditorOpen(true)} className="gap-2 rounded-xl flex-1" disabled={editorCards.length === 0}>
              <Printer className="h-4 w-4" /> {t("cards.configure_print")}
            </Button>
          ) : (
            <Button onClick={handlePrint} className="gap-2 rounded-xl flex-1">
              <Printer className="h-4 w-4" /> {t("common.print")}
            </Button>
          )}
          <Button
            onClick={handleShareGroup}
            variant="outline"
            className="gap-2 rounded-xl flex-1"
            disabled={sharing || !currentGroup}
          >
            {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
            {t("common.share")}
          </Button>
        </div>

        {allGroups.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">{t("cards.group")}</span>
            {allGroups.map((g, i) => (
              <Button
                key={i}
                variant={selectedGroup === i ? "default" : "outline"}
                size="sm"
                className="rounded-lg"
                onClick={() => setSelectedGroup(i)}
              >
                {i + 1}
              </Button>
            ))}
            <span className="text-xs text-muted-foreground ml-2">
              {t("cards.group_summary", { n: filtered.length, g: allGroups.length, c: groupedByCongregation.length })}
            </span>
          </div>
        )}
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title={t("cards.empty_title")}
          description={t("cards.empty_desc")}
          actionLabel={t("cards.empty_action")}
          actionPath="/addresses/new"
        />
      ) : cardStyle === "digital" ? (
        <div className="animate-fade-in space-y-6">
          {groupedByCongregation.map((entry) => {
            const showThis = allGroups
              .map((g, i) => ({ ...g, index: i }))
              .some((g) => g.congregation === entry.congregation && g.index === selectedGroup);
            if (!showThis) return null;
            return (
              <div key={entry.congregation} className="space-y-3">
                <div className="flex items-center gap-2 print:mb-2">
                  <div className="h-6 w-1 bg-primary rounded-full" />
                  <h2 className="font-heading font-bold text-lg text-foreground">{entry.congregation}</h2>
                  <span className="text-sm text-muted-foreground">({entry.items.length} endereços)</span>
                </div>
                {(currentGroup?.items || []).map((a, i) => (
                  <FitScale key={a.id}>
                    <DigitalCard addresses={[a]} />
                  </FitScale>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="print-area no-print space-y-2">
          {(currentGroup?.items || []).map((a) => (
            <PrintCard key={a.id} addresses={[a]} snapshot={snapshots[a.id]} />
          ))}
        </div>
      )}

      {/* Off-screen map used to capture snapshots (free, no API credits) */}
      <div
        ref={containerRef}
        aria-hidden
        className="no-print"
        style={{
          position: "fixed",
          left: "-9999px",
          top: 0,
          width: "600px",
          height: "500px",
          zIndex: -1,
          pointerEvents: "none",
        }}
      />
    </div>

    <PrintCardEditor cards={editorCards} open={editorOpen} onClose={() => setEditorOpen(false)} />
    </>
  );
}
