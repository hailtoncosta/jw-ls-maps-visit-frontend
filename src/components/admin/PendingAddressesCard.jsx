import { useState, useEffect } from "react";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, MapPinOff, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";

export default function PendingAddressesCard({ congObjects }) {
  const { t } = useTranslation();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(null);
  const [stats, setStats] = useState(null);
  const [selections, setSelections] = useState({});

  const congById = {};
  const congByName = {};
  (congObjects || []).forEach((c) => {
    if (c.id) congById[c.id] = c;
    if (c.name) congByName[c.name] = c;
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const all = await api.entities.Address.list("-updated_date", 2000);
      let correct = 0, pending = 0, inconsistent = 0;
      const pendingList = [];
      for (const a of all) {
        const expected = (a.congregation_id && congById[a.congregation_id]?.circuito_id) ||
                         (a.congregation && congByName[a.congregation]?.circuito_id) || "";
        if (!a.circuito_id && !expected) {
          pending++;
          pendingList.push(a);
        } else if (a.circuito_id && expected && a.circuito_id !== expected) {
          inconsistent++;
        } else {
          correct++;
        }
      }
      setAddresses(pendingList);
      setStats({ total: all.length, correct, pending, inconsistent });
    } catch {
      toast.error(t("admin.pending_error"));
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [congObjects?.length]);

  const handleAssign = async (addressId) => {
    const congName = selections[addressId];
    if (!congName) {
      toast.error(t("admin.select_a_congregation"));
      return;
    }
    const cong = congByName[congName];
    if (!cong) return;
    setAssigning(addressId);
    try {
      await api.entities.Address.update(addressId, {
        congregation: cong.name,
        congregation_id: cong.id,
        circuito_id: cong.circuito_id || "",
      });
      toast.success(t("admin.assigned_success"));
      setSelections((s) => { const n = { ...s }; delete n[addressId]; return n; });
      loadData();
    } catch {
      toast.error(t("admin.assign_error"));
    }
    setAssigning(null);
  };

  if (loading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-6 flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">{t("admin.checking_pending")}</span>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-6 animate-fade-in space-y-4">
      <div className="flex items-center gap-2">
        <MapPinOff className="h-5 w-5 text-amber-500" />
        <h2 className="font-heading font-semibold">{t("admin.pending_title")}</h2>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">{t("admin.total")}</p>
            <p className="text-xl font-heading font-bold">{stats.total}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 p-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> {t("admin.correct")}</p>
            <p className="text-xl font-heading font-bold text-emerald-600">{stats.correct}</p>
          </div>
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 p-3">
            <p className="text-xs text-muted-foreground">{t("admin.pending")}</p>
            <p className="text-xl font-heading font-bold text-amber-600">{stats.pending}</p>
          </div>
          <div className="rounded-xl bg-red-50 dark:bg-red-950/30 p-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {t("admin.inconsistent")}</p>
            <p className="text-xl font-heading font-bold text-red-600">{stats.inconsistent}</p>
          </div>
        </div>
      )}

      {addresses.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("admin.no_pending")}</p>
      ) : (
        <div className="space-y-3">
          {addresses.map((a) => (
            <div key={a.id} className="rounded-xl border border-border p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{a.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                     {a.street || t("admin.no_street")} · {a.city || t("admin.no_city")}
                   </p>
                   <p className="text-xs text-muted-foreground">
                     {t("admin.current_cong")}: <span className="text-foreground">{a.congregation || "—"}</span>
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Select
                  value={selections[a.id] || ""}
                  onValueChange={(v) => setSelections((s) => ({ ...s, [a.id]: v }))}
                >
                  <SelectTrigger className="rounded-xl flex-1">
                     <SelectValue placeholder={t("admin.assign_correct")} />
                   </SelectTrigger>
                  <SelectContent>
                    {(congObjects || []).map((c) => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  className="rounded-xl shrink-0 gap-2"
                  disabled={!selections[a.id] || assigning === a.id}
                  onClick={() => handleAssign(a.id)}
                >
                  {assigning === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                   {t("admin.assign")}
                  </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}