import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MapPin, Loader2 } from "lucide-react";
import { getCurrentPosition, reverseGeocode } from "@/lib/maps";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";

export default function QuickRegisterButton({ variant = "default", className = "" }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  const handleClick = async () => {
    setLoading(true);
    try {
      const { lat, lng } = await getCurrentPosition();
      const mapsLink = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

      toast.info(t("quick.location_obtained"));

      const address = await reverseGeocode(lat, lng);

      const prefill = {
        maps_link: mapsLink,
        street: address?.street || "",
        neighborhood: address?.neighborhood || "",
        city: address?.city || "",
        state: address?.state || "",
        zip_code: address?.zip_code || "",
        reference_point: address?.reference_point || "",
        status: "Ativo"
      };

      sessionStorage.setItem("address_prefill", JSON.stringify(prefill));
      navigate("/addresses/new");
    } catch (e) {
      toast.error(e.message || t("quick.location_error"));
    } finally {
      setLoading(false);
    }
  };

  return null;

}