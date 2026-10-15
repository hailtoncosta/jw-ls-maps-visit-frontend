import { Button } from "@/components/ui/button";
import { normalizeRole, hasPermission } from "@/lib/permissions";
import AddressCard from "@/components/AddressCard";
import { useEffect, useState } from "react";
import { api } from "@/api/apiClient";
import { Card } from "@/components/ui/card";
import { Download, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { fetchAddressesForUser } from "@/lib/permissions";
import { cacheMyTerritories, getCachedMyTerritories } from "@/lib/offlineDb";
import { useTranslation } from "@/lib/i18n";

export default function MyTerritories() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [finishing, setFinishing] = useState(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [importedCount, setImportedCount] = useState(0);
  const [sharedCount, setSharedCount] = useState(0);
  const [receivedAddresses, setReceivedAddresses] = useState([]);

  useEffect(() => {
    if (!user?.id) { setReceivedAddresses([]); setSharedCount(0); setImportedCount(0); setLoading(false); return; }
    let active = true;
    let inFlight = false;
    const updateData = (addresses, shares) => {
      if (!active) return;
      const visible = (addresses || []).filter(address => !address.deleted);
      setImportedCount(visible.filter(address => address.imported === true && address.created_by_id === user.id).length);
      const received = new Map((shares || []).filter(share => share.shared_with_user_id === user.id).map(share => [share.address_id, share]));
      const shared = visible.filter(address => received.has(address.id))
        .map(address => ({address, share: received.get(address.id)}))
        .sort((a, b) => (a.address.name || '').localeCompare(b.address.name || '', 'pt-BR'));
      setReceivedAddresses(shared);
      setSharedCount(shared.length);
    };
    setReceivedAddresses([]); setSharedCount(0); setImportedCount(0); setLoading(true);
    const cached = getCachedMyTerritories();
    if (cached?.userId === user.id) updateData(cached.own, cached.shares);
    const load = async () => {
      if (!navigator.onLine || inFlight) { if (active) setLoading(false); return; }
      inFlight = true;
      try {
        const [addresses, shares] = await Promise.all([
          fetchAddressesForUser(user, '-updated_date', 0),
          api.entities.SharedAddress.filter({shared_with_user_id: user.id}),
        ]);
        if (active) {
          updateData(addresses, shares);
          cacheMyTerritories({userId: user.id, own: addresses, shares});
        }
      } catch { if (active) toast.error(t('territories.error_load')); }
      finally { inFlight = false; if (active) setLoading(false); }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    load();
    window.addEventListener('focus', load);
    window.addEventListener('online', load);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(onVisible, 30000);
    const finishVisit = async (share) => {
    if (finishing) return;
    if (!window.confirm(t('territories.finish_desc_shared', {name: share.address_name || ''}))) return;
    setFinishing(share.id);
    try {
      await api.functions.invoke('finishSharedAddress', {shared_address_id: share.id});
      toast.success(t('territories.visit_finished_shared'));
      setReceivedAddresses(items => items.filter(item => item.share.id !== share.id));
      setSharedCount(count => Math.max(0, count - 1));
      setRevision(value => value + 1);
    } catch (error) {toast.error(error.message || t('territories.error_load'));}
    finally {setFinishing(null);}
  };

  return () => {
      active = false; window.clearInterval(timer);
      window.removeEventListener('focus', load); window.removeEventListener('online', load);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user?.id, user?.role, user?.circuito_id, user?.congregation, revision]);

  return (
    <div className="space-y-6">
      <h1 className="font-heading font-bold text-2xl">{t("territories.title")}</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card className="p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Download className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-3xl font-bold">{loading ? <Loader2 className="h-6 w-6 animate-spin" /> : importedCount}</p>
            <p className="text-sm text-muted-foreground">{t("territories.imported_count")}</p>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center">
            <Users className="h-6 w-6 text-accent" />
          </div>
          <div>
            <p className="text-3xl font-bold">{loading ? <Loader2 className="h-6 w-6 animate-spin" /> : sharedCount}</p>
            <p className="text-sm text-muted-foreground">{t("territories.shared_count")}</p>
          </div>
        </Card>
      </div>
      <section className="space-y-4">
        <h2 className="font-heading font-semibold text-xl">{t("territories.received_title")}</h2>
        {loading ? <p className="text-muted-foreground">{t("territories.received_loading")}</p> : receivedAddresses.length === 0 ? (
          <Card className="p-5 text-muted-foreground">{t("territories.received_empty")}</Card>
        ) : <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {receivedAddresses.map(({address, share}) => <div key={address.id} className="space-y-2">
            {share.shared_by_name && <p className="text-sm text-muted-foreground">{t("territories.received_from")} {share.shared_by_name}</p>}
            <AddressCard address={address} sharedWith={{ name: share.shared_with_name || user?.full_name || user?.publisher_name || user?.email }} />
            {hasPermission(user, 'action_finish_visit') && ['publisher', 'helper', 'elder', 'superintendente', 'admin'].includes(normalizeRole(user?.role)) && <Button variant="outline" className="w-full rounded-xl" disabled={!!finishing} onClick={() => finishVisit(share)}>{finishing === share.id ? <Loader2 className="h-4 w-4 animate-spin" /> : t('territories.finish_visit')}</Button>}
          </div>)}
        </div>}
      </section>
    </div>
  );
}
