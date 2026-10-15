import { useState, useEffect } from "react";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Send, MessageCircle, Mail, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";

export default function ContactCreator() {
  const [config, setConfig] = useState(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const { t } = useTranslation();

  useEffect(() => {
    api.entities.CreatorContact
      .list("-updated_date", 1)
      .then((list) => setConfig(list[0] || null))
      .catch(() => setConfig(null));
  }, []);

  const update = (field, value) => setForm((p) => ({ ...p, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await api.entities.ContactMessage.create(form);
      setForm({ name: "", email: "", subject: "", message: "" });
      setSent(true);
      toast.success(t("contact.send_success"));
      setTimeout(() => setSent(false), 5000);
    } catch {
      toast.error(t("contact.send_error"));
    } finally {
      setSending(false);
    }
  };

  const waNumber = (config?.whatsapp_number || "").replace(/[^\d]/g, "");
  const waLink = waNumber
    ? `https://wa.me/${waNumber}?text=${encodeURIComponent(
        config?.whatsapp_message || t("contact.wa_default")
      )}`
    : null;
    const mailLink = config?.contact_email
    ? `mailto:${config.contact_email}?subject=${encodeURIComponent(t("contact.mail_subject"))}`
    : null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-heading font-bold text-2xl">{t("contact.title")}</h1>
        <p className="text-muted-foreground text-sm">
          {t("contact.subtitle")}
        </p>
      </div>

      {sent && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {t("contact.sent_msg")}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>{t("contact.name")}</Label>
            <Input required value={form.name} onChange={(e) => update("name", e.target.value)} />
          </div>
          <div>
            <Label>{t("contact.email")}</Label>
            <Input type="email" required value={form.email} onChange={(e) => update("email", e.target.value)} />
          </div>
        </div>
        <div>
          <Label>{t("contact.subject")}</Label>
          <Input required value={form.subject} onChange={(e) => update("subject", e.target.value)} />
        </div>
        <div>
          <Label>{t("contact.message")}</Label>
          <Textarea required rows={5} value={form.message} onChange={(e) => update("message", e.target.value)} />
        </div>
        <Button type="submit" className="gap-2 rounded-xl" disabled={sending}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {t("contact.send")}
        </Button>
      </form>

      {(waLink || mailLink) && (
        <div className="bg-card rounded-2xl border border-border p-6 space-y-3">
          <h2 className="font-heading font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            {t("contact.other_channels")}
          </h2>
          <div className="flex flex-col sm:flex-row gap-3">
            {waLink && (
              <a href={waLink} target="_blank" rel="noreferrer" className="flex-1">
                <Button type="button" variant="outline" className="w-full gap-2 rounded-xl">
                  <MessageCircle className="h-4 w-4" />
                  {t("contact.whatsapp")}
                </Button>
              </a>
            )}
            {mailLink && (
              <a href={mailLink} className="flex-1">
                <Button type="button" variant="outline" className="w-full gap-2 rounded-xl">
                  <Mail className="h-4 w-4" />
                  {t("contact.mail")}
                </Button>
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}