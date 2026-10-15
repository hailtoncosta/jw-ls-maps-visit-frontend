import { useState, useEffect } from "react";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { BookOpen, FileText, Download, Lock, Loader2 } from "lucide-react";
import { normalizeRole } from "@/lib/permissions";
import { useTranslation } from "@/lib/i18n";
import { downloadManual } from "@/lib/manualGenerator";

export default function ManualGenerator() {
  const [me, setMe] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const { t, language } = useTranslation();

  useEffect(() => {
    api.auth.me().then(setMe).catch(() => {});
  }, []);

  const role = normalizeRole(me?.role);
  const isAdminOrElder = role === "admin" || role === "elder";
  const isPublisherOrHelper = role === "publisher" || role === "helper";

  const handleDownload = (manualType) => {
    setDownloading(manualType);
    try {
      downloadManual(manualType, language);
    } finally {
      setTimeout(() => setDownloading(null), 1500);
    }
  };

  const cards = [
    {
      key: "basic",
      title: t("manual.publisher_title"),
      desc: t("manual.publisher_desc"),
      Icon: BookOpen,
      manualType: "basic",
      allowed: isPublisherOrHelper || isAdminOrElder,
      roles: t("manual.publisher_roles"),
    },
    {
      key: "full",
      title: t("manual.admin_title"),
      desc: t("manual.admin_desc"),
      Icon: FileText,
      manualType: "full",
      allowed: isAdminOrElder,
      roles: t("manual.admin_roles"),
    },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-heading font-bold text-2xl">{t("manual.title")}</h1>
        <p className="text-muted-foreground text-sm">
          {t("manual.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map((c) => (
          <div
            key={c.key}
            className={`bg-card rounded-2xl border p-6 space-y-4 flex flex-col ${
              c.allowed ? "border-border" : "border-border opacity-60"
            }`}
          >
            <div className="flex items-center gap-2">
              <c.Icon className="h-5 w-5 text-primary" />
              <h2 className="font-heading font-semibold text-base">{c.title}</h2>
            </div>
            <p className="text-sm text-muted-foreground flex-1">{c.desc}</p>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">{t("manual.profile")}</span> {c.roles}
            </p>
            {c.allowed ? (
              <Button
                onClick={() => handleDownload(c.manualType)}
                disabled={downloading === c.manualType}
                className="w-full gap-2 rounded-xl"
              >
                {downloading === c.manualType ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {t("manual.download")}
              </Button>
            ) : (
              <Button disabled className="w-full gap-2 rounded-xl pointer-events-none">
                <Lock className="h-4 w-4" />
                {t("manual.no_permission")}
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}