import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/api/apiClient";
import { Loader2, AlertCircle, MapPin } from "lucide-react";
import DigitalCard from "@/components/DigitalCard";
import FitScale from "@/components/FitScale";
import { useTranslation } from "@/lib/i18n";

// Página pública do cartão de visita digital: /cartao-digital/:ids
// Acessível sem login (destinatário do link compartilhado por WhatsApp).
export default function DigitalCardPage() {
  const { ids } = useParams();
  const [addresses, setAddresses] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    (async () => {
      try {
        const res = await api.functions.invoke("getDigitalCard", { ids });
        if (res && res.data && Array.isArray(res.data.addresses) && res.data.addresses.length > 0) {
          setAddresses(res.data.addresses);
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [ids]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !addresses) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-sm w-full text-center space-y-3">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
          <h1 className="font-heading font-bold text-xl">{t("card_page.not_found")}</h1>
          <p className="text-muted-foreground text-sm">{t("card_page.not_found_desc")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/40 flex flex-col items-center justify-center p-4 gap-4">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
          <MapPin className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="font-heading font-bold">LS Mapas Visit</span>
      </div>
      <FitScale>
        <DigitalCard addresses={addresses} publicMode />
      </FitScale>
      <p className="text-xs text-muted-foreground text-center">
        {t("card_page.map_hint")}
      </p>
    </div>
  );
}