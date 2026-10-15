import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Loader2, Copy, GitMerge, UserX, ShieldAlert, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { normalizeRole, fetchAddressesForUser } from "@/lib/permissions";
import { findDuplicatePairs, LEVEL_STYLES } from "@/lib/duplicateDetect";
import CompareAddressesDialog from "@/components/duplicates/CompareAddressesDialog";
import MergeDialog from "@/components/duplicates/MergeDialog";
import { useTranslation } from "@/lib/i18n";

const CAN_MERGE_ROLES = ["elder", "superintendente", "admin"];

function PairRow({ pair, busy, canMerge, onCompare, onNotSame, onMerge }) {
  const { t } = useTranslation();
  const ls = LEVEL_STYLES[pair.level] || LEVEL_STYLES.baixa;
  const distLabel = pair.distance == null ? null : pair.distance < 1000 ? `${pair.distance} m` : `${(pair.distance / 1000).toFixed(1)} km`;
  return (
    <Card className="p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={ls.className}>{ls.label}</Badge>
            {pair.matchedFields.map((f) => (
              <Badge key={f} variant="outline" className="bg-primary/5 text-primary border-primary/20">{f}</Badge>
            ))}
            {distLabel && <Badge variant="outline" className="bg-muted text-muted-foreground">{distLabel}</Badge>}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">{pair.a.name}</span>
            <span className="text-muted-foreground">vs</span>
            <span className="font-medium">{pair.b.name}</span>
          </div>
          <p className="text-xs text-muted-foreground">{pair.a.congregation} • {pair.a.neighborhood || pair.a.city || "—"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => onCompare(pair)}><Copy className="h-4 w-4" /> {t("duplicates.compare")}</Button>
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" disabled={busy === pair.key} onClick={() => onNotSame(pair)}>
            {busy === pair.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserX className="h-4 w-4" />} {t("duplicates.not_same")}
          </Button>
          {canMerge && (
            <Button size="sm" className="gap-2" onClick={() => onMerge(pair)}><GitMerge className="h-4 w-4" /> {t("duplicates.merge")}</Button>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function Duplicates() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const role = normalizeRole(user?.role);
  const canMerge = CAN_MERGE_ROLES.includes(role);

  const [loading, setLoading] = useState(true);
  const [pairs, setPairs] = useState([]);
  const [compare, setCompare] = useState(null);
  const [mergePair, setMergePair] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [addresses, decisions] = await Promise.all([
        fetchAddressesForUser(user),
        api.entities.DuplicateDecision.list("-created_date", 500).catch(() => []),
      ]);
      const notSameKeys = new Set(
        decisions.filter((d) => d.decision === "not_same").map((d) => d.pair_key)
      );
      setPairs(findDuplicatePairs(addresses, notSameKeys));
    } catch {
      toast.error(t("duplicates.error_load"));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const handleNotSame = async (pair) => {
    setBusy(pair.key);
    try {
      await api.entities.DuplicateDecision.create({
        address_a_id: pair.a.id,
        address_b_id: pair.b.id,
        pair_key: pair.key,
        decision: "not_same",
        decided_by: user?.full_name || user?.email || "",
        reason: "não são a mesma pessoa",
        congregation: pair.a.congregation || "",
        circuito_id: pair.a.circuito_id || "",
      });
      toast.success(t("duplicates.not_same_success"));
      setPairs((prev) => prev.filter((p) => p.key !== pair.key));
    } catch {
      toast.error(t("duplicates.not_same_error"));
    }
    setBusy(null);
  };

  const scopeLabel = role === "admin" ? t("duplicates.scope_all") : role === "superintendente" ? t("duplicates.scope_circuit") : t("duplicates.scope_congregation");

  if (!canMerge) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <ShieldAlert className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">{t("duplicates.no_access_desc")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading font-bold text-2xl">{t("duplicates.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("duplicates.pairs_found", { n: pairs.length, scope: scopeLabel })}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} {t("duplicates.refresh")}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : pairs.length === 0 ? (
        <Card className="p-12 text-center">
          <CheckCircle2 className="h-10 w-10 text-accent mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{t("duplicates.empty")}</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {pairs.map((pair) => (
            <PairRow
              key={pair.key}
              pair={pair}
              busy={busy}
              canMerge={canMerge}
              onCompare={setCompare}
              onNotSame={handleNotSame}
              onMerge={setMergePair}
            />
          ))}
        </div>
      )}

      {compare && (
        <CompareAddressesDialog
          open={!!compare}
          onOpenChange={(v) => { if (!v) setCompare(null); }}
          a={compare.a}
          b={compare.b}
          level={compare.level}
          matchedFields={compare.matchedFields}
          distance={compare.distance}
          footer={
            <div className="flex justify-end gap-2 pt-3">
              <Button variant="outline" onClick={() => setCompare(null)}>{t("duplicates.close")}</Button>
              {canMerge && (
                <Button className="gap-2" onClick={() => { const p = compare; setCompare(null); setMergePair(p); }}>
                  <GitMerge className="h-4 w-4" /> {t("duplicates.merge")}
                </Button>
              )}
            </div>
          }
        />
      )}

      {mergePair && (
        <MergeDialog
          open={!!mergePair}
          onOpenChange={(v) => { if (!v) setMergePair(null); }}
          a={mergePair.a}
          b={mergePair.b}
          onDone={() => { setMergePair(null); load(); }}
        />
      )}
    </div>
  );
}