import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, GitMerge, AlertTriangle, MapPin } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/api/apiClient";
import { coordDistance } from "@/lib/duplicateDetect";
import { useTranslation } from "@/lib/i18n";

const FIELD_KEYS = [
  "name", "phone", "gender", "age", "street", "neighborhood",
  "city", "observations", "sign_language_level", "reference_point",
];

const empty = (v) => v === undefined || v === null || v === "";

export default function MergeDialog({ open, onOpenChange, a, b, onDone }) {
  const { t } = useTranslation();
  const FIELDS = FIELD_KEYS.map((k) => ({ key: k, label: t(`dup.${k === "sign_language_level" ? "language_level" : k === "reference_point" ? "reference_point" : k}`) }));
  const [principalId, setPrincipalId] = useState(null);
  const [choices, setChoices] = useState({});
  const [cardChoice, setCardChoice] = useState(null);
  const [sharedConfirmed, setSharedConfirmed] = useState(false);
  const [meta, setMeta] = useState({ visitsA: 0, visitsB: 0, sharesA: [], sharesB: [] });
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [merging, setMerging] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (!open || !a || !b) return;
    setPrincipalId(a.id);
    setChoices({});
    setCardChoice(null);
    setSharedConfirmed(false);
    setStep(1);
    setLoadingMeta(true);
    Promise.all([
      api.entities.VisitHistory.filter({ address_id: a.id }).catch(() => []),
      api.entities.VisitHistory.filter({ address_id: b.id }).catch(() => []),
      api.entities.SharedAddress.filter({ address_id: a.id }).catch(() => []),
      api.entities.SharedAddress.filter({ address_id: b.id }).catch(() => []),
    ]).then(([va, vb, sa, sb]) => {
      setMeta({ visitsA: va.length, visitsB: vb.length, sharesA: sa, sharesB: sb });
    }).finally(() => setLoadingMeta(false));
  }, [open, a?.id, b?.id]);

  if (!a || !b) return null;

  const dist = coordDistance(a, b);
  const cardConflict = !empty(a.card_number) && !empty(b.card_number) && a.card_number !== b.card_number;
  const sharedConflict = meta.sharesA.length > 0 && meta.sharesB.length > 0;

  const principal = principalId === a.id ? a : b;
  const duplicate = principalId === a.id ? b : a;

  const resolveFields = () => {
    const fields = {};
    for (const f of FIELDS) {
      const pick = choices[f.key]; // 'a' | 'b' | undefined
      const src = pick === "b" ? b : a;
      const val = src[f.key];
      if (!empty(val)) fields[f.key] = val;
    }
    return fields;
  };

  const handleMerge = async () => {
    if (cardConflict && !cardChoice) {
      toast.error(t("dup.card_resolve"));
      return;
    }
    if (sharedConflict && !sharedConfirmed) {
      toast.error(t("dup.shared_required"));
      return;
    }
    setMerging(true);
    try {
      const payload = {
        principalId,
        duplicateId: duplicate.id,
        fields: resolveFields(),
        cardNumberChoice: cardConflict ? cardChoice : undefined,
        sharedAddressAction: sharedConflict ? "confirmed" : undefined,
        reason: "fusão manual de duplicados",
      };
      const res = await api.functions.invoke("mergeAddresses", payload);
      toast.success(t("dup.merge_done", { n: res?.data?.visitHistoryMoved || 0 }));
      onDone?.(res?.data);
      onOpenChange(false);
    } catch (e) {
      const data = e?.response?.data;
      if (data?.error === "card_number_conflict") {
        toast.error(t("dup.card_toast", { a: data.principal, b: data.duplicate }));
      } else if (data?.error === "shared_address_conflict") {
        toast.error(t("dup.shared_toast"));
      } else {
        toast.error(data?.error || t("dup.merge_error"));
      }
    } finally {
      setMerging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><GitMerge className="h-5 w-5 text-primary" /> {t("dup.merge_title")}</DialogTitle>
          <DialogDescription>{t("dup.merge_desc")}</DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm font-medium">{t("dup.choose_principal")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[a, b].map((addr) => (
                <button
                  key={addr.id}
                  type="button"
                  onClick={() => setPrincipalId(addr.id)}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${principalId === addr.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                >
                  <p className="font-semibold">{addr.name}</p>
                  <p className="text-xs text-muted-foreground">{addr.congregation}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t("dup.card")}: {empty(addr.card_number) ? "—" : addr.card_number}</p>
                  <p className="text-xs text-muted-foreground">{t("dup.visits")}: {addr.id === a.id ? meta.visitsA : meta.visitsB}</p>
                </button>
              ))}
            </div>
            {loadingMeta && <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> {t("dup.loading_history")}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
              <Button onClick={() => setStep(2)}>{t("dup.continue")}</Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-primary/10 text-primary">{t("dup.principal_badge", { name: principal.name })}</Badge>
              <Badge variant="outline">{t("dup.merge_badge", { name: duplicate.name })}</Badge>
              {dist != null && (
                <Badge variant="outline" className="bg-muted text-muted-foreground"><MapPin className="h-3 w-3 mr-1" />{dist < 1000 ? `${dist} m` : `${(dist / 1000).toFixed(1)} km`}</Badge>
              )}
            </div>

            {cardConflict && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-sm font-medium flex items-center gap-1 text-destructive"><AlertTriangle className="h-4 w-4" /> {t("dup.card_conflict")}</p>
                <p className="text-xs text-muted-foreground mt-1">{t("dup.card_conflict_desc")}</p>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant={cardChoice === "principal" ? "default" : "outline"} onClick={() => setCardChoice("principal")}>{t("dup.keep")} {principal.card_number}</Button>
                  <Button size="sm" variant={cardChoice === "duplicate" ? "default" : "outline"} onClick={() => setCardChoice("duplicate")}>{t("dup.use")} {duplicate.card_number}</Button>
                </div>
              </div>
            )}

            {sharedConflict && (
              <div className="rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 p-3">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-300">{t("dup.shared_conflict")}</p>
                <p className="text-xs text-muted-foreground mt-1">{t("dup.principal_label")} {meta.sharesA.map((s) => s.shared_with_name).join(", ") || "—"}</p>
                <p className="text-xs text-muted-foreground">{t("dup.duplicate_label")} {meta.sharesB.map((s) => s.shared_with_name).join(", ") || "—"}</p>
                <label className="flex items-center gap-2 mt-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={sharedConfirmed} onChange={(e) => setSharedConfirmed(e.target.checked)} />
                  {t("dup.confirm_shared")}
                </label>
              </div>
            )}

            <div className="space-y-1">
              <p className="text-sm font-medium">{t("dup.diff_fields")}</p>
              {FIELDS.map((f) => {
                const va = a[f.key], vb = b[f.key];
                const onlyOne = empty(va) ^ empty(vb);
                const bothFilled = !empty(va) && !empty(vb) && String(va) !== String(vb);
                if (!bothFilled) {
                  if (onlyOne) {
                    return <p key={f.key} className="text-xs text-muted-foreground">{f.label}: {t("dup.preserved_from")} {empty(va) ? "B" : "A"}</p>;
                  }
                  return null;
                }
                const pick = choices[f.key];
                return (
                  <div key={f.key} className="flex items-center gap-2 py-1">
                    <span className="text-xs w-32 text-muted-foreground">{f.label}</span>
                    <button type="button" onClick={() => setChoices((c) => ({ ...c, [f.key]: "a" }))} className={`text-xs px-2 py-1 rounded-lg border ${pick === "a" ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>{String(va)}</button>
                    <button type="button" onClick={() => setChoices((c) => ({ ...c, [f.key]: "b" }))} className={`text-xs px-2 py-1 rounded-lg border ${pick === "b" ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>{String(vb)}</button>
                  </div>
                );
              })}
              {dist != null && dist < 50 && (
                <p className="text-xs text-accent mt-2">{t("dup.coords_close")}</p>
              )}
            </div>

            <div className="flex justify-between gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>{t("dup.back")}</Button>
              <Button onClick={() => setStep(3)}>{t("dup.review")}</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border p-4 space-y-1">
              <p className="text-xs text-muted-foreground">{t("dup.principal_register")}</p>
              <p className="font-semibold">{principal.name}</p>
              <p className="text-xs text-muted-foreground">{principal.congregation} • {t("dup.card")} {empty(principal.card_number) ? "—" : principal.card_number}</p>
              <p className="text-xs text-muted-foreground">{principal.street || "—"}</p>
              </div>
              <div className="rounded-xl border border-dashed border-border p-4 space-y-1">
              <p className="text-xs text-muted-foreground">{t("dup.to_merge")}</p>
              <p className="font-medium text-muted-foreground">{duplicate.name}</p>
              <p className="text-xs text-muted-foreground">{duplicate.congregation}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("dup.preserved", { v: meta.visitsA + meta.visitsB, s: meta.sharesA.length + meta.sharesB.length })}
            </p>
            <p className="text-sm font-medium">{t("dup.merge_warning")}</p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep(2)}>{t("dup.back")}</Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
              <Button onClick={handleMerge} disabled={merging} className="gap-2">
                {merging ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitMerge className="h-4 w-4" />}
                {t("dup.confirm_merge")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}