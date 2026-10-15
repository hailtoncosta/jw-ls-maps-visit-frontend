import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../api/apiClient";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  ArrowLeft, Edit, Trash2, MapPin, Phone, Clock, User, ExternalLink,
  CalendarDays, MessageCircle, HandMetal, Plus, Loader2, RotateCcw, ArrowRightLeft
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "../components/ui/alert-dialog";
import RecordVisitDialog from "../components/RecordVisitDialog";
import TransferAddressDialog from "../components/TransferAddressDialog";
import ShareAddressButton from "../components/ShareAddressButton";
import QrCodeImage from "../components/QrCodeImage";
import { buildGoogleMapsUrl, getMapsLink } from "@/lib/maps";
import { fetchAddressForUser, canEditAddress, canDeleteAddress, canShareAddress, hasPermission, normalizeRole, canFinishAddressVisit } from "@/lib/permissions";
import { goBack } from "../lib/goBack";
import { useTranslation } from "../lib/i18n";
import { getCachedAddresses, getCachedVisits, cacheVisits } from "@/lib/offlineDb";
import { toast } from "sonner";

const statusColors = {
  "Ativo": "bg-accent/10 text-accent border-accent/20",
  "Inativo": "bg-muted text-muted-foreground border-border",
  "Mudou-se": "bg-chart-3/10 text-chart-3 border-chart-3/20",
  "Não Interessado": "bg-destructive/10 text-destructive border-destructive/20",
};

const genderEmoji = { "Masculino": "👨", "Feminino": "👩", "Casal": "👫" };

const resultColors = {
  "Encontrado": "text-accent",
  "Ausente": "text-chart-3",
  "Mudou-se": "text-muted-foreground",
  "Não Interessado": "text-destructive",
  "Revisita Marcada": "text-primary",
};

export default function AddressDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [address, setAddress] = useState(null);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showVisitDialog, setShowVisitDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [user, setUser] = useState(null);
  const [sharedWith, setSharedWith] = useState(null);
  const [retaking, setRetaking] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const { t } = useTranslation();

  const loadData = async () => {
    const me = await api.auth.me().catch(() => null);
    setUser(me);
    if (!navigator.onLine) {
      const cachedAddr = getCachedAddresses().find((a) => a.id === id
        && (normalizeRole(me?.role) !== "superintendente" || me.circuito_id && a.circuito_id === me.circuito_id)) || null;
      setAddress(cachedAddr);
      setVisits(getCachedVisits().filter((v) => v.address_id === id));
      setLoading(false);
      return;
    }
    const addr = me ? await fetchAddressForUser(me, id) : null;
    // Cadastro já incorporado noutro: redireciona para o cadastro principal.
    if (addr && addr.merged && addr.merged_into_address_id) {
      navigate(`/addresses/${addr.merged_into_address_id}`, { replace: true });
      return;
    }
    setAddress(addr);
    if (addr) {
      const allVisits = await api.entities.VisitHistory.filter({ address_id: id }, "-visit_date", 200);
      setVisits(allVisits);
      cacheVisits(allVisits);
      // Compartilhamento interno ativo (para "Em uso" e "Retomar").
      try {
        const shares = await api.entities.SharedAddress.filter({ address_id: id }, "-created_date", 10);
        const active = shares && shares.length > 0 ? shares[0] : null;
        setSharedWith(active ? { id: active.id, shared_by_user_id: active.shared_by_user_id, shared_with_user_id: active.shared_with_user_id, name: active.shared_with_name || active.shared_with_user_id, created_date: active.created_date } : null);
      } catch {
        setSharedWith(null);
      }
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [id]);

  const handleRetake = async () => {
    if (retaking || !sharedWith?.id) return;
    setRetaking(true);
    try {
      await api.functions.invoke("retakeSharedAddress", { shared_address_id: sharedWith.id });
      toast.success(t("detail.retake_success"));
      setSharedWith(null);
      await loadData();
    } catch (error) {
      toast.error(error?.message || t("detail.retake_fail"));
    } finally {
      setRetaking(false);
    }
  };

  const handleFinishVisit = async () => {
    if (finishing || !canFinishAddressVisit(user, address, sharedWith) || !navigator.onLine) return;
    if (!window.confirm(`Finalizar as visitas de ${address?.name || "este endereço"}?`)) return;
    setFinishing(true);
    try {
      await api.functions.invoke('finishAddressVisit', {address_id: address.id});
      toast.success("Visitas finalizadas com sucesso.");
      setSharedWith(null);
      await loadData();
    } catch (error) {toast.error(error.message || t('territories.error_load'));}
    finally {setFinishing(false);}
  };

  const handleDelete = async () => {
    await api.functions.invoke("softDeleteAddress", { addressId: id });
    toast.success(t("detail.delete_success"));
    navigate("/addresses");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!address) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">{t("detail.not_found")}</p>
        <Link to="/addresses"><Button variant="outline" className="mt-4">{t("detail.back")}</Button></Link>
      </div>
    );
  }

  const canEdit = canEditAddress(user, address);
  const canDelete = canDeleteAddress(user, address);
  const canShare = canShareAddress(user, address);
  const canRetake = sharedWith?.id && hasPermission(user, "action_retake") && (normalizeRole(user?.role) === 'admin' || sharedWith.shared_by_user_id === user?.id || sharedWith.shared_with_user_id === user?.id);
  const showFinishVisit = hasPermission(user, "action_finish_visit");
  const canFinishVisit = canFinishAddressVisit(user, address, sharedWith);
  const finishVisitHint = !canFinishVisit ? "Você não pode finalizar visitas deste endereço." : "";
  const canTransferAddress = ['admin', 'superintendente'].includes(normalizeRole(user?.role));
  const mapsLink = getMapsLink(address);
  const shareLink = `${window.location.origin}/s/${address.id}`;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => goBack(navigate, "/addresses")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{genderEmoji[address.gender] || "👤"}</span>
              <h1 className="font-heading font-bold text-2xl">{address.name}</h1>
            </div>
            <p className="text-muted-foreground text-sm">{address.congregation}</p>
          </div>
        </div>
        <Badge variant="outline" className={`${statusColors[address.status] || statusColors["Ativo"]} text-sm`}>
          {address.status || "Ativo"}
        </Badge>
      </div>

      {sharedWith && (
        <div className="rounded-2xl border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">{t("detail.in_use")}</span>
            <span className="text-sm text-amber-700 dark:text-amber-300">{t("detail.shared_with")} {sharedWith.name || "—"}</span>
            {sharedWith.created_date && (
              <span className="text-xs text-muted-foreground">
                {t("detail.days_ago", { n: Math.max(0, Math.floor((Date.now() - new Date(sharedWith.created_date).getTime()) / 86400000)) })}
              </span>
            )}
          </div>
          {canRetake && (
            <Button variant="outline" className="gap-2 rounded-xl text-amber-700 dark:text-amber-300 border-amber-300/60 hover:bg-amber-100 dark:hover:bg-amber-950/50 shrink-0" disabled={retaking} onClick={handleRetake}>
              {retaking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              {t("detail.retake")}
            </Button>
          )}
        </div>
      )}

      <div className="bg-card rounded-2xl border border-border p-6 space-y-4 animate-fade-in">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InfoRow icon={MapPin} label={t("common.address")} value={`${address.street}${address.neighborhood ? `, ${address.neighborhood}` : ""}${address.city ? ` - ${address.city}` : ""}${address.state ? `/${address.state}` : ""}`} />
          {address.phone && <InfoRow icon={Phone} label={t("common.phone")} value={address.phone} />}
          {address.age && <InfoRow icon={User} label={t("common.age")} value={t("detail.age_value", { n: address.age })} />}
          {address.best_time && <InfoRow icon={Clock} label={t("common.best_time")} value={address.best_time} />}
          {address.language && <InfoRow icon={HandMetal} label={t("detail.circuit_language_label")} value={address.language} />}
          {address.language_level && <InfoRow icon={HandMetal} label={t("detail.language_level_label")} value={address.language_level} />}
          {address.sign_language_level && <InfoRow icon={HandMetal} label={t("detail.language_label")} value={address.sign_language_level} />}
          {address.reference_point && <InfoRow icon={MapPin} label={t("detail.reference_point_label")} value={address.reference_point} />}
          <InfoRow icon={CalendarDays} label={t("detail.total_visits_label")} value={address.visit_count || 0} />
          {address.last_visit_date && <InfoRow icon={Clock} label={t("common.last_visit")} value={address.last_visit_time ? t("detail.last_visit_at", { date: address.last_visit_date, time: address.last_visit_time }) : address.last_visit_date} />}
          {address.last_visited_by && <InfoRow icon={User} label={t("detail.visited_by_label")} value={address.last_visited_by} />}
        </div>

        {address.observations && (
          <div className="pt-4 border-t border-border">
            <div className="flex items-start gap-2">
              <MessageCircle className="h-4 w-4 mt-1 text-primary shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t("common.observations")}</p>
                <p className="text-sm">{address.observations}</p>
              </div>
            </div>
          </div>
        )}

        {address.house_photo && (
          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">{t("detail.photo_label")}</p>
            <img src={address.house_photo} alt="Foto da casa" className="max-h-56 rounded-xl border border-border" />
          </div>
        )}

        <div className="flex flex-wrap gap-3 pt-4 border-t border-border">
          {mapsLink && (
            <a href={buildGoogleMapsUrl(mapsLink)} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="gap-2 rounded-xl">
                <ExternalLink className="h-4 w-4" />
                {t("detail.google_maps")}
              </Button>
            </a>
          )}
          {canShare && <ShareAddressButton address={address} onShared={loadData} />}
          <Button className="gap-2 rounded-xl" onClick={() => setShowVisitDialog(true)}>
            <Plus className="h-4 w-4" />
            {t("detail.register_visit")}
          </Button>
          {showFinishVisit && (
            <div className="flex flex-col gap-1" title={finishVisitHint || undefined}>
              <Button variant="outline" className="gap-2 rounded-xl"
                disabled={!canFinishVisit || finishing || retaking || !navigator.onLine}
                onClick={handleFinishVisit}
                aria-describedby={finishVisitHint ? "finish-visit-hint" : undefined}>
                {finishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                {t("territories.finish_visit")}
              </Button>
              {finishVisitHint && <span id="finish-visit-hint" className="max-w-56 text-xs text-muted-foreground">{finishVisitHint}</span>}
            </div>
          )}
          {canTransferAddress && (
            <Button variant="outline" className="gap-2 rounded-xl" onClick={() => setShowTransferDialog(true)}>
              <ArrowRightLeft className="h-4 w-4" />
              {t("common.transfer")}
            </Button>
          )}
          {canEdit && (
            <Link to={`/addresses/new?edit=${address.id}`}>
              <Button variant="outline" className="gap-2 rounded-xl">
                <Edit className="h-4 w-4" />
                {t("common.edit")}
              </Button>
            </Link>
          )}
          {canDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="gap-2 rounded-xl text-destructive border-destructive/20 hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4" />
                  {t("common.delete")}
                  </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                  <AlertDialogHeader>
                  <AlertDialogTitle>{t("detail.delete_confirm_title")}</AlertDialogTitle>
                  <AlertDialogDescription>{t("detail.delete_confirm_desc")}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                  <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">{t("detail.delete_confirm_action")}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {canShare && (
        <div className="bg-card rounded-2xl border border-border p-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <QrCodeImage value={shareLink} size={180} className="rounded-xl border border-border shrink-0" />
            <div className="flex-1 text-center sm:text-left">
              <h2 className="font-heading font-semibold text-lg mb-1">{t("detail.qr_title")}</h2>
              <p className="text-sm text-muted-foreground mb-3">
                {t("detail.qr_desc")}
              </p>
              <p className="text-xs text-muted-foreground font-mono break-all">{shareLink}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-card rounded-2xl border border-border p-6 animate-fade-in">
        <h2 className="font-heading font-semibold text-lg mb-4">{t("detail.visit_history_title")}</h2>
        {visits.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">{t("detail.no_visits")}</p>
        ) : (
          <div className="space-y-3">
            {visits.map((visit) => (
              <div key={visit.id} className="flex items-start gap-3 p-3 rounded-xl bg-secondary/50">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center mt-0.5">
                  <CalendarDays className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium">{visit.visit_date || visit.created_date?.slice(0, 10) || "Data não informada"}{visit.visit_time ? ` às ${visit.visit_time}` : ""}</p>
                    {visit.result && <span className={`text-xs font-medium ${resultColors[visit.result] || ""}`}>{visit.result}</span>}
                  </div>
                  {visit.visited_by && <p className="text-xs text-muted-foreground">{t("detail.by", { name: visit.visited_by })}</p>}
                  {visit.notes && <p className="text-xs text-muted-foreground mt-1">{visit.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showVisitDialog && (
        <RecordVisitDialog
          open={showVisitDialog}
          onClose={() => setShowVisitDialog(false)}
          address={address}
          onVisitRecorded={loadData}
        />
      )}

      {showTransferDialog && (
        <TransferAddressDialog
          open={showTransferDialog}
          onClose={() => setShowTransferDialog(false)}
          address={address}
          user={user}
          onTransferred={loadData}
        />
      )}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 mt-1 text-primary shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
