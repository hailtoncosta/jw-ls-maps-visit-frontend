import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { savePendingVisit } from "@/lib/offlineDb";
import { useAuth } from "@/lib/AuthContext";
import { useRecordVisitMutation } from "@/hooks/useAddressesQuery";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

// The visible viewport shrinks when a mobile keyboard opens.
function useVisitViewport(open, scrollRef) {
  const [viewport, setViewport] = useState(null);
  useEffect(() => {
    if (!open) return;
    const visual = window.visualViewport;
    let frame;
    const revealField = () => {
      const scroller = scrollRef.current;
      const field = document.activeElement;
      if (!scroller || !scroller.contains(field) || !field.matches('input, textarea, [role="combobox"]')) return;
      const area = scroller.getBoundingClientRect();
      const rect = field.getBoundingClientRect();
      if (rect.bottom > area.bottom - 16) scroller.scrollTop += rect.bottom - area.bottom + 16;
      else if (rect.top < area.top + 16) scroller.scrollTop -= area.top + 16 - rect.top;
    };
    const update = () => {
      setViewport({ height: visual?.height ?? window.innerHeight, top: visual?.offsetTop ?? 0, mobile: window.innerWidth < 768 });
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(revealField);
    };
    update();
    visual?.addEventListener('resize', update);
    visual?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    document.addEventListener('focusin', update);
    return () => {
      cancelAnimationFrame(frame);
      visual?.removeEventListener('resize', update);
      visual?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      document.removeEventListener('focusin', update);
    };
  }, [open, scrollRef]);
  return viewport;
}

function VisitForm({ form, setForm, address, loading, onClose, onSubmit }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4 py-2 px-1">
      <p className="text-sm text-muted-foreground">{t("visit.recording_for")} <strong>{address?.name}</strong></p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>{t("visit.date")}</Label>
          <Input type="date" value={form.visit_date} onChange={(e) => setForm(p => ({ ...p, visit_date: e.target.value }))} />
        </div>
        <div>
          <Label>{t("visit.time")}</Label>
          <Input type="time" value={form.visit_time} onChange={(e) => setForm(p => ({ ...p, visit_time: e.target.value }))} />
        </div>
      </div>

      <div>
        <Label>{t("visit.visited_by")}</Label>
        <Input placeholder={t("visit.visited_by_ph")} value={form.visited_by} onChange={(e) => setForm(p => ({ ...p, visited_by: e.target.value }))} />
      </div>

      <div>
        <Label>{t("visit.result")}</Label>
        <Select value={form.result} onValueChange={(v) => setForm(p => ({ ...p, result: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Encontrado">{t("result.encontrado")}</SelectItem>
            <SelectItem value="Ausente">{t("result.ausente")}</SelectItem>
            <SelectItem value="Mudou-se">{t("status.mudou_se")}</SelectItem>
            <SelectItem value="Não Interessado">{t("status.nao_interessado")}</SelectItem>
            <SelectItem value="Revisita Marcada">{t("result.revisita_marcada")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>{t("visit.observations")}</Label>
        <Textarea placeholder={t("visit.observations_ph")} value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))} />
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="flex-1" onClick={onClose}>{t("visit.cancel")}</Button>
        <Button className="flex-1" onClick={onSubmit} disabled={loading || !form.visited_by}>
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {t("visit.register")}
        </Button>
      </div>
    </div>
  );
}

export default function RecordVisitDialog({ open, onClose, address, onVisitRecorded }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    visit_date: new Date().toISOString().split("T")[0],
    visit_time: new Date().toTimeString().slice(0, 5),
    visited_by: "",
    notes: "",
    result: "Encontrado",
  });

  const { user } = useAuth();
  const recordVisit = useRecordVisitMutation(user?.id);
  const scrollRef = useRef(null);
  const viewport = useVisitViewport(open, scrollRef);
  const isMobile = viewport?.mobile ?? (typeof window !== "undefined" && window.innerWidth < 768);
  const availableHeight = viewport ? Math.max(0, viewport.height - 16) : "calc(100dvh - 16px)";

  const handleSubmit = async () => {
    setLoading(true);
    const visitPayload = {
      address_id: address.id,
      address_name: address.name,
      visit_date: form.visit_date,
      visit_time: form.visit_time,
      visited_by: form.visited_by,
      congregation: address.congregation,
      circuito_id: address.circuito_id,
      notes: form.notes,
      result: form.result,
    };
    const addressUpdate = {
      last_visit_date: form.visit_date,
      last_visit_time: form.visit_time,
      last_visited_by: form.visited_by,
      visit_count: (address.visit_count || 0) + 1,
      ...(form.result === "Mudou-se" ? { status: "Mudou-se" } : {}),
      ...(form.result === "Não Interessado" ? { status: "Não Interessado" } : {}),
    };

    // Offline: registra na fila local e sincroniza quando houver conexão
    if (!navigator.onLine) {
      savePendingVisit(visitPayload, addressUpdate);
      toast.success(t("visit.offline_success"));
      setLoading(false);
      onVisitRecorded();
      onClose();
      return;
    }

    try {
      await recordVisit.mutateAsync({ address, visitPayload, addressUpdate });
      toast.success(t("visit.success"));
      onVisitRecorded();
      onClose();
    } catch {
      toast.error(t("visit.fail"));
    } finally {
      setLoading(false);
    }
  };

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(next) => { if (!next) onClose(); }} repositionInputs={false} shouldScaleBackground={false}>
        <DrawerContent className="mt-0 overflow-hidden" style={{ top: viewport ? viewport.top + 8 : 8, bottom: "auto", maxHeight: availableHeight }}>
          <DrawerHeader className="shrink-0">
            <DrawerTitle className="font-heading">{t("visit.title")}</DrawerTitle>
          </DrawerHeader>
          <div ref={scrollRef} className="min-h-0 overflow-y-auto overscroll-contain px-4 pb-4 [&_input]:text-base [&_textarea]:text-base" style={{ WebkitOverflowScrolling: "touch", paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
            <VisitForm form={form} setForm={setForm} address={address} loading={loading} onClose={onClose} onSubmit={handleSubmit} />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-md flex flex-col overflow-hidden" style={{ maxHeight: availableHeight, top: viewport ? viewport.top + viewport.height / 2 : "50%" }}>
        <DialogHeader>
          <DialogTitle className="font-heading">{t("visit.title")}</DialogTitle>
        </DialogHeader>
        <div ref={scrollRef} className="min-h-0 overflow-y-auto overscroll-contain [&_input]:text-base [&_textarea]:text-base">
          <VisitForm form={form} setForm={setForm} address={address} loading={loading} onClose={onClose} onSubmit={handleSubmit} />
        </div>
      </DialogContent>
    </Dialog>
  );
}