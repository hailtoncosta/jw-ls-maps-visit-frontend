import { useState, useEffect } from "react";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageCircle, Save, Loader2, Trash2, Inbox } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";

const CREATOR_EMAIL = "jhailtoncosta@gmail.com";
const CREATOR_WHATSAPP = "(098) 9 8701-8764";

// Área do Administrador Geral para configurar o contato do criador
// (e-mail + WhatsApp) e ler as mensagens recebidas pela página de contato.
export default function AdminContactSection() {
  const { t } = useTranslation();
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState({
    contact_email: CREATOR_EMAIL,
    whatsapp_number: CREATOR_WHATSAPP,
    whatsapp_message: "",
  });
  const [saving, setSaving] = useState(false);
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);

  const loadConfig = async () => {
    const list = await api.entities.CreatorContact.list("-updated_date", 1);
    const rec = list[0] || null;
    setConfig(rec);
    setForm({
      contact_email: CREATOR_EMAIL,
      whatsapp_number: CREATOR_WHATSAPP,
      whatsapp_message: rec?.whatsapp_message || "",
    });
  };

  const loadMessages = async () => {
    const data = await api.entities.ContactMessage.list("-created_date", 100);
    setMessages(data);
    setLoadingMsgs(false);
  };

  useEffect(() => {
    loadConfig().catch(() => {});
    loadMessages().catch(() => setLoadingMsgs(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (config?.id) await api.entities.CreatorContact.update(config.id, form);
      else await api.entities.CreatorContact.create(form);
      toast.success(t("admin.contact_saved"));
      await loadConfig();
    } catch {
      toast.error(t("admin.contact_save_error"));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMessage = async (id) => {
    try {
      await api.entities.ContactMessage.delete(id);
      setMessages((m) => m.filter((x) => x.id !== id));
      toast.success(t("admin.msg_removed"));
    } catch {
      toast.error(t("admin.msg_remove_error"));
    }
  };

  return (
    <>
      <div className="bg-card rounded-2xl border border-border p-6 animate-fade-in space-y-4">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          <h2 className="font-heading font-semibold">{t("admin.creator_contact")}</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("admin.creator_contact_desc")}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Label>{t("admin.creator_email")}</Label>
            <Input
              value={form.contact_email}
              disabled
              readOnly
            />
          </div>
          <div>
            <Label>{t("admin.whatsapp_number")}</Label>
            <Input
              value={form.whatsapp_number}
              disabled
              readOnly
            />
          </div>
          <div>
            <Label>{t("admin.whatsapp_msg")}</Label>
            <Input
              placeholder="Olá! Preciso de ajuda..."
              value={form.whatsapp_message}
              onChange={(e) => setForm((p) => ({ ...p, whatsapp_message: e.target.value }))}
            />
          </div>
        </div>
        <Button onClick={handleSave} className="gap-2 rounded-xl" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
           {t("admin.save_contact")}
          </Button>
      </div>

      <div className="bg-card rounded-2xl border border-border p-6 animate-fade-in space-y-4">
        <div className="flex items-center gap-2">
          <Inbox className="h-5 w-5 text-primary" />
          <h2 className="font-heading font-semibold">{t("admin.received_msgs")} ({messages.length})</h2>
        </div>
        {loadingMsgs ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">{t("admin.no_msgs")}</p>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => (
              <div key={m.id} className="rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{m.subject}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {m.name} • {m.email}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteMessage(m.id)}
                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    title={t("admin.remove")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-sm mt-2 whitespace-pre-wrap">{m.message}</p>
                <p className="text-[10px] text-muted-foreground mt-2">
                  {m.created_date ? new Date(m.created_date).toLocaleString("pt-BR") : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
