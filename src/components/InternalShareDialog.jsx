import { useState, useEffect } from "react";
import { api } from "@/api/apiClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Share2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { hasPermission } from "@/lib/permissions";
import { useTranslation } from "@/lib/i18n";

export default function InternalShareDialog({ address, open, onOpenChange, onShared }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const canList = hasPermission(user, "action_share_internal");
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [inUseBy, setInUseBy] = useState(null);
  const [checkingUse, setCheckingUse] = useState(false);

  useEffect(() => {
    if (!open || !address) return;
    setInUseBy(null);
    setCheckingUse(true);
    api.entities.SharedAddress.filter({ address_id: address.id })
      .then((shares) => {
        const active = shares && shares.length > 0 ? shares[0] : null;
        setInUseBy(active ? active.shared_with_name || active.shared_with_user_id : null);
      })
      .catch(() => setInUseBy(null))
      .finally(() => setCheckingUse(false));
  }, [open, address?.id]);

  useEffect(() => {
    if (!open || !canList) return;
    setSelectedUserId("");
    setUsers([]);
    setLoading(true);
    api.functions.invoke('listCongregationUsers', {})
      .then((response) => {
        const payload = response.data ?? response;
        const list = Array.isArray(payload) ? payload : payload?.users ?? [];
        setUsers(list.filter((u) => u.id && u.id !== user?.id && u.active !== false));
      })
      .catch(() => toast.error(t("share.error_load")))
      .finally(() => setLoading(false));
  }, [open, user?.id, canList]);

  const handleShare = async () => {
    if (!selectedUserId || !address) return;
    setSharing(true);
    try {
      const target = users.find((u) => u.id === selectedUserId);
      await api.entities.SharedAddress.create({
        address_id: address.id,
        address_name: address.name,
        shared_by_user_id: user.id,
        shared_by_name: user.full_name || user.email,
        shared_with_user_id: selectedUserId,
        shared_with_name: target?.full_name || target?.email || "",
        congregation: address.congregation || user.congregation || "",
        ...(address?.circuito_id ? { circuito_id: address.circuito_id } : {}),
      });
      toast.success(t("share.success", { name: target?.full_name || "—" }));
      onOpenChange(false);
      setSelectedUserId("");
      onShared?.();
    } catch (error) {
      toast.error(error.message || t("share.error"));
    }
    setSharing(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md max-h-[calc(100dvh-2rem)] min-w-0 overflow-x-hidden overflow-y-auto rounded-2xl p-4 sm:p-6">
        <DialogHeader className="min-w-0 text-left pr-6">
          <DialogTitle className="flex items-start gap-2 min-w-0 break-words leading-snug">
            <Share2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            {t("share.title")}
          </DialogTitle>
          <DialogDescription className="min-w-0 whitespace-normal [overflow-wrap:anywhere] leading-relaxed">
            {t("share.desc", { name: address?.name })}
          </DialogDescription>
        </DialogHeader>
        <div className="min-w-0 w-full space-y-4 py-2">
          {checkingUse ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : inUseBy ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <ShieldAlert className="h-8 w-8 text-amber-500" />
              <p className="text-sm text-muted-foreground">
                {t("share.in_use_prefix")} <span className="font-semibold text-foreground">{t("share.in_use")}</span> {t("share.in_use_by")}{" "}
                <span className="font-semibold text-foreground">{inUseBy}</span>{t("share.in_use_suffix")}
              </p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !canList ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <ShieldAlert className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {t("share.no_permission")}
              </p>
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t("share.no_users")}
            </p>
          ) : (
            <div className="min-w-0 w-full space-y-2">
              <label htmlFor="internal-share-user" className="block text-sm font-medium">{t("share.with")}</label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger id="internal-share-user" className="w-full min-w-0 max-w-full rounded-xl [&>span]:min-w-0 [&>span]:flex-1 [&>span]:truncate [&>span]:text-left [&>svg]:shrink-0">
                  <SelectValue placeholder={t("share.select_member")} />
                </SelectTrigger>
                <SelectContent className="w-[var(--radix-select-trigger-width)] min-w-0 max-w-[calc(100vw-2rem)] [&_[role=option]]:min-w-0 [&_[role=option]>span:last-child]:min-w-0 [&_[role=option]>span:last-child]:whitespace-normal [&_[role=option]>span:last-child]:[overflow-wrap:anywhere]">
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name ? `${u.full_name} (${u.email})` : u.email}{u.congregation ? ` — ${u.congregation}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div className="grid min-w-0 w-full grid-cols-1 sm:grid-cols-2 gap-2 border-t pt-4">
          <Button variant="outline" className="w-full min-w-0 rounded-xl" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleShare} disabled={!canList || loading || checkingUse || !selectedUserId || sharing || !!inUseBy} className="w-full min-w-0 rounded-xl gap-2">
            {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
            {t("common.share")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
