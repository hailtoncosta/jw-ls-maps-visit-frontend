import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { extractCoords } from "@/lib/maps";

// Small, credit-free map preview using free CartoDB tiles (no LLM calls).
export default function DashboardMapPreview({ addresses }) {
  const points = addresses
    .map((a) => {
      if (a.lat != null && a.lng != null) return { lat: a.lat, lng: a.lng };
      const c = extractCoords(a.maps_link);
      return c;
    })
    .filter(Boolean);

  const center =
    points.length > 0
      ? [
          points.reduce((s, p) => s + p.lat, 0) / points.length,
          points.reduce((s, p) => s + p.lng, 0) / points.length,
        ]
      : [-18.6657, 35.5296]; // Mozambique center

  return (
    <div
      className="rounded-xl overflow-hidden border border-border relative z-0"
      style={{ height: 220 }}
    >
      <MapContainer
        center={center}
        zoom={points.length > 0 ? 6 : 5}
        scrollWheelZoom={false}
        zoomControl={false}
        attributionControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
        {points.map((p, i) => (
          <CircleMarker
            key={i}
            center={[p.lat, p.lng]}
            radius={5}
            pathOptions={{
              color: "hsl(199 89% 48%)",
              fillColor: "hsl(199 89% 48%)",
              fillOpacity: 0.75,
              weight: 1.5,
            }}
          >
            <Tooltip>{`${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`}</Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}