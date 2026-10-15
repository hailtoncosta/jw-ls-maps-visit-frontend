import { useState, useEffect } from "react";
import { api } from "@/api/apiClient";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ExternalLink, MapPin, RefreshCw, Users, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { extractCoords, buildGoogleMapsUrl, resolveCoords } from "@/lib/maps";
import { fetchAddressesForUser } from "@/lib/permissions";
import { useTranslation } from "@/lib/i18n";

// Fix leaflet default icon issue with vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// Custom colored icons by gender
const createIcon = (emoji, color) => L.divIcon({
  className: "",
  html: `<div style="
    background: ${color};
    border: 3px solid white;
    border-radius: 50% 50% 50% 0;
    width: 36px;
    height: 36px;
    transform: rotate(-45deg);
    box-shadow: 0 3px 10px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
  ">
    <span style="transform: rotate(45deg); font-size: 16px; display: block; text-align: center; line-height: 30px;">${emoji}</span>
  </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -38],
});

const maleIcon = createIcon("👨", "#0ea5e9");
const femaleIcon = createIcon("👩", "#ec4899");
const coupleIcon = createIcon("👫", "#8b5cf6");
const defaultIcon = createIcon("📍", "#64748b");

const genderIcon = { "Masculino": maleIcon, "Feminino": femaleIcon, "Casal": coupleIcon };

const statusColors = {
  "Ativo": "bg-green-100 text-green-700",
  "Inativo": "bg-gray-100 text-gray-600",
  "Mudou-se": "bg-yellow-100 text-yellow-700",
  "Não Interessado": "bg-red-100 text-red-600",
};

export default function MapView() {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [resolvedCoords, setResolvedCoords] = useState({});
  const [filter, setFilter] = useState("all");
  const { t } = useTranslation();

  const loadAddresses = async () => {
    setLoading(true);
    const me = await api.auth.me().catch(() => null);
    const data = me ? await fetchAddressesForUser(me, "name", 500, false) : [];
    setAddresses(data);
    setResolvedCoords({});
    setLoading(false);
  };

  useEffect(() => { loadAddresses(); }, []);

  // Async resolve short URLs (goo.gl, bit.ly, etc.) that don't have extractable coords
  useEffect(() => {
    const toResolve = addresses.filter(a =>
      a.maps_link &&
      /^https?:\/\//i.test(a.maps_link) &&
      !extractCoords(a.maps_link) &&
      !resolvedCoords[a.id]
    );
    if (toResolve.length === 0) return;

    setResolving(true);
    Promise.all(toResolve.map(async (addr) => {
      const coords = await resolveCoords(addr.maps_link);
      return { id: addr.id, coords };
    })).then(results => {
      const newResolved = {};
      results.forEach(r => {
        if (r.coords) newResolved[r.id] = r.coords;
      });
      setResolvedCoords(prev => ({ ...prev, ...newResolved }));
      setResolving(false);
    });
  }, [addresses]);

  const getCoords = (a) => {
    if (a.lat != null && a.lng != null) return { lat: a.lat, lng: a.lng };
    return extractCoords(a.maps_link) || resolvedCoords[a.id] || null;
  };

  const withCoords = addresses
    .filter(a => filter === "all" || a.status === filter || (!a.status && filter === "Ativo"))
    .map(a => ({ ...a, coords: getCoords(a) }))
    .filter(a => a.coords);

  const noCoords = addresses
    .filter(a => filter === "all" || a.status === filter || (!a.status && filter === "Ativo"))
    .filter(a => !getCoords(a));

  // Calculate center from addresses or default to Brazil
  const center = withCoords.length > 0
    ? [
        withCoords.reduce((s, a) => s + a.coords.lat, 0) / withCoords.length,
        withCoords.reduce((s, a) => s + a.coords.lng, 0) / withCoords.length,
      ]
    : [-15.7942, -47.8825]; // Brasília

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-heading font-bold text-2xl">{t("map.title")}</h1>
          <p className="text-muted-foreground text-sm">
            {t("map.count", { n: withCoords.length })}
            {resolving && t("map.resolving")}
            {!resolving && noCoords.length > 0 && t("map.no_coords_count", { n: noCoords.length })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {["all", "Ativo", "Inativo"].map(f => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              className="rounded-xl"
              onClick={() => setFilter(f)}
            >
              {f === "all" ? t("map.all") : (f === "Ativo" ? t("status.ativo") : t("status.inativo"))}
            </Button>
          ))}
          <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={loadAddresses}>
            <RefreshCw className="h-3.5 w-3.5" /> {t("map.refresh")}
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap text-sm">
        <span className="text-muted-foreground font-medium">{t("map.legend")}</span>
        <span className="flex items-center gap-1.5">👨 <span className="text-muted-foreground">{t("map.male")}</span></span>
        <span className="flex items-center gap-1.5">👩 <span className="text-muted-foreground">{t("map.female")}</span></span>
        <span className="flex items-center gap-1.5">👫 <span className="text-muted-foreground">{t("map.couple")}</span></span>
      </div>

      {/* Map */}
      {withCoords.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border flex flex-col items-center justify-center py-20 gap-3">
          <MapPin className="h-12 w-12 text-muted-foreground/30" />
          <p className="font-medium text-muted-foreground">
            {resolving ? t("map.resolving_links") : t("map.empty_title")}
          </p>
          <p className="text-sm text-muted-foreground max-w-sm text-center">
            {t("map.empty_desc_prefix")} <strong>{t("map.empty_desc_format")}</strong>{t("map.empty_desc_suffix")}
          </p>
          <Link to="/addresses/new"><Button className="mt-2">{t("map.register")}</Button></Link>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden border border-border shadow-md relative z-0" style={{ height: "520px" }}>
          <MapContainer center={center} zoom={12} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {withCoords.map((addr) => (
              <Marker
                key={addr.id}
                position={[addr.coords.lat, addr.coords.lng]}
                icon={genderIcon[addr.gender] || defaultIcon}
              >
                <Popup maxWidth={260}>
                  <div className="p-1 min-w-[200px]">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">
                        {addr.gender === "Masculino" ? "👨" : addr.gender === "Feminino" ? "👩" : addr.gender === "Casal" ? "👫" : "👤"}
                      </span>
                      <div>
                        <p className="font-bold text-sm leading-tight">{addr.name}</p>
                        <p className="text-xs text-gray-500">{addr.congregation}</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 mb-1">
                      📍 {addr.street}{addr.neighborhood ? `, ${addr.neighborhood}` : ""}
                    </p>
                    {addr.city && <p className="text-xs text-gray-500 mb-2">{addr.city}{addr.state ? `/${addr.state}` : ""}</p>}
                    {addr.last_visit_date && (
                      <p className="text-xs text-gray-500 mb-2">🕐 {t("map.last_visit")} {addr.last_visit_date}</p>
                    )}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColors[addr.status] || statusColors["Ativo"]}`}>
                      {addr.status || "Ativo"}
                    </span>
                    <div className="flex gap-1.5 mt-3">
                      {addr.maps_link && (() => {
                        const url = buildGoogleMapsUrl(addr.maps_link);
                        return (
                          <a href={url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs bg-blue-500 text-white px-2.5 py-1.5 rounded-lg font-medium hover:bg-blue-600 transition-colors">
                            <ExternalLink className="h-3 w-3" /> Maps
                          </a>
                        );
                      })()}
                      <Link to={`/addresses/${addr.id}`}
                        className="flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2.5 py-1.5 rounded-lg font-medium hover:bg-gray-200 transition-colors">
                        <Users className="h-3 w-3" /> {t("map.details")}
                      </Link>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}

      {/* Addresses without coords */}
      {noCoords.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <p className="text-sm font-medium text-yellow-800">{t("map.no_coords_badge", { n: noCoords.length })}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {noCoords.slice(0, 10).map(a => (
              <Link key={a.id} to={`/addresses/${a.id}`}>
                <span className="text-xs bg-white border border-yellow-200 text-yellow-700 px-2.5 py-1 rounded-lg hover:bg-yellow-100 transition-colors cursor-pointer">
                  {a.name}
                </span>
              </Link>
            ))}
            {noCoords.length > 10 && <span className="text-xs text-yellow-600">{t("map.more", { n: noCoords.length - 10 })}</span>}
          </div>
        </div>
      )}
    </div>
  );
}