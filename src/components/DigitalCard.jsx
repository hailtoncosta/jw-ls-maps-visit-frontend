import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ExternalLink, Share2, MapPin, Crosshair, QrCode, User, Hand, House, Clock, FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CARD_MAP_TILES, CARD_MAP_ATTRIBUTION, createCardMarkerIcon } from "@/components/print/cardMapConfig";
import { extractCoords, getMapsLink, getMapsUrl } from "@/lib/maps";
import QrCodeImage from "@/components/QrCodeImage";
import { useTranslation } from "@/lib/i18n";

function getCoords(addr) {
  if (!addr) return null;
  if (addr.lat != null && addr.lng != null) return { lat: addr.lat, lng: addr.lng };
  return extractCoords(getMapsLink(addr) || addr.maps_link || "");
}

// Enquadra os marcadores uma única vez e depois deixa o usuário controlar
// livremente zoom/movimentação (sem reset automático).
function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 16, { animate: false });
    } else {
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [30, 30], animate: false });
    }
    const t = setTimeout(() => map.invalidateSize(), 200);
    return () => clearTimeout(t);
  }, [map, points]);
  return null;
}

// Expõe a instância do mapa para o parent permitir "Localizar" (recentrar).
function MapController({ mapRef }) {
  const map = useMap();
  useEffect(() => { if (mapRef) mapRef.current = map; }, [map, mapRef]);
  return null;
}

function InfoRow({ icon: Icon, label, value, fallback = "—" }) {
  const hasValue = value !== undefined && value !== null && value !== "";
  return (
    <div className="flex items-start gap-1.5">
      <Icon className="h-3 w-3 text-accent mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[7px] uppercase tracking-wide text-muted-foreground leading-none mb-0.5">{label}</p>
        <p className="text-[10px] font-medium leading-tight line-clamp-2">{hasValue ? value : fallback}</p>
      </div>
    </div>
  );
}

export default function DigitalCard({ addresses, cardNumber }) {
  const { t } = useTranslation();
  const list = (addresses || []).slice(0, 2);
  const addr = list[0] || {};
  const points = list.map(getCoords).filter(Boolean);
  const mapRef = useRef(null);
  const [showQr, setShowQr] = useState(false);

  const primaryCoord = points[0] || null;
  const shareUrl = `${window.location.origin}/cartao-digital/${list.map((a) => a.id).join(",")}`;
  const mapsUrl = primaryCoord ? getMapsUrl(primaryCoord.lat, primaryCoord.lng) : null;

  const openInMaps = () => {
    if (mapsUrl) window.open(mapsUrl, "_blank", "noopener,noreferrer");
  };

  const handleShare = async () => {
    const text = `${t("card.share_text")}\n${shareUrl}`;
    if (navigator.share) {
      try { await navigator.share({ title: t("common.visit_card"), text }); return; }
      catch { /* cancelado */ }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  const recenter = () => {
    if (mapRef.current && primaryCoord) {
      mapRef.current.setView([primaryCoord.lat, primaryCoord.lng], 16, { animate: true });
    }
  };

  const addrLine = [addr.street, addr.neighborhood, addr.city, addr.state].filter(Boolean).join(", ");
  const lastVisit = [addr.last_visit_date, addr.last_visit_time].filter(Boolean).join(" ");

  return (
    <div
      className="bg-card rounded-xl overflow-hidden border border-border shadow-md flex"
      style={{ width: "18cm", height: "11cm" }}
    >
      {/* Coluna esquerda — informações (6 cm) */}
      <div className="flex flex-col border-r border-border" style={{ width: "6cm", flexShrink: 0 }}>
        {/* Cabeçalho verde */}
        <div className="bg-accent text-accent-foreground px-3 py-2 flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-white flex items-center justify-center shrink-0">
            <span className="font-heading font-extrabold text-accent text-[10px]">JW</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-heading font-bold text-[11px] leading-tight truncate">{addr.congregation || t("card.congregation")}</p>
            <p className="text-[8px] opacity-90 leading-none mt-0.5">{t("card.number", { n: addr.card_number != null ? String(addr.card_number).padStart(4, "0") : "—" })}</p>
          </div>
        </div>

        {/* Corpo — informações */}
        <div className="flex-1 p-2.5 space-y-2 overflow-hidden bg-card">
          <InfoRow icon={User} label={t("card.person")} value={`${addr.name || ""}${addr.gender ? ` (${addr.gender})` : ""}`.trim()} />
          <InfoRow icon={Hand} label={t("card.language")} value={addr.sign_language_level} />
          <InfoRow icon={MapPin} label={t("card.address")} value={addrLine} />
          <InfoRow icon={House} label={t("card.congregation")} value={addr.congregation} />
          <InfoRow icon={Clock} label={t("card.last_visit")} value={lastVisit} />
          <InfoRow icon={User} label={t("card.visited_by")} value={addr.last_visited_by} fallback={t("card.not_visited")} />
          <InfoRow icon={FileText} label={t("card.observations")} value={addr.observations} />
        </div>

        {/* Rodapé — escritura */}
        <div className="bg-secondary/60 px-2.5 py-1.5">
          <p className="text-[7px] italic text-muted-foreground leading-tight">
            {t("card.scripture")}
          </p>
          {addr.last_visit_date && (
            <p className="text-[7px] text-muted-foreground/80 mt-0.5">{t("card.updated", { date: addr.last_visit_date })}</p>
          )}
        </div>
      </div>

      {/* Coluna direita — mapa interativo (12 cm) */}
      <div className="relative" style={{ flex: 1 }}>
        {points.length > 0 ? (
          <MapContainer
            center={primaryCoord ? [primaryCoord.lat, primaryCoord.lng] : [0, 0]}
            zoom={16}
            style={{ height: "100%", width: "100%", background: "#eef2f7" }}
            zoomControl={true}
            scrollWheelZoom={true}
            dragging={true}
            attributionControl={true}
          >
            <TileLayer url={CARD_MAP_TILES} attribution={CARD_MAP_ATTRIBUTION} maxZoom={19} />
            {points.map((p, i) => (
              <Marker key={i} position={[p.lat, p.lng]} icon={createCardMarkerIcon(list[i].gender)} />
            ))}
            <FitBounds points={points} />
            <MapController mapRef={mapRef} />
          </MapContainer>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-accent/20 via-primary/10 to-accent/5">
            <MapPin className="h-12 w-12 text-accent/30" />
          </div>
        )}

        {/* Controles sobre o mapa */}
        <div className="no-print absolute bottom-2 right-2 flex items-center gap-1.5 z-[1000]">
          <Button size="icon" variant="secondary" className="h-7 w-7 rounded-lg shadow-md" onClick={recenter} title={t("card.locate")}>
            <Crosshair className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="secondary" className="h-7 w-7 rounded-lg shadow-md" onClick={() => setShowQr((v) => !v)} title={t("card.qr_code")}>
            <QrCode className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" className="h-7 px-2 text-[10px] gap-1 rounded-lg shadow-md" onClick={openInMaps}>
            <ExternalLink className="h-3 w-3" /> {t("card.open_maps")}
          </Button>
          <Button size="sm" variant="secondary" className="h-7 px-2 text-[10px] gap-1 rounded-lg shadow-md" onClick={handleShare}>
            <Share2 className="h-3 w-3" /> {t("card.share_card")}
          </Button>
        </div>

        {showQr && (
          <div className="no-print absolute bottom-12 right-2 bg-white p-2 rounded-lg shadow-xl border border-border z-[1000]">
            {mapsUrl ? (
              <>
                <QrCodeImage value={mapsUrl} size={160} />
                <p className="text-[8px] text-muted-foreground text-center mt-1">{t("card.open_google_maps")}</p>
              </>
            ) : (
              <p className="text-[9px] text-muted-foreground text-center px-2 py-3 max-w-[140px]">
                {t("card.no_location")}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}