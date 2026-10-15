import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import { CARD_MAP_TILES, createCardMarkerIcon } from "@/components/print/cardMapConfig";

// Expõe a instância do mapa e emite mudanças de vista (arrastar/zoom) sem
// recentralizar automaticamente — quem controla a vista é o usuário.
function MapController({ onReady, onView }) {
  const map = useMap();
  useEffect(() => {
    onReady(map);
    const handler = () =>
      onView({ center: [map.getCenter().lat, map.getCenter().lng], zoom: map.getZoom() });
    map.on("moveend", handler);
    map.on("zoomend", handler);
    return () => {
      map.off("moveend", handler);
      map.off("zoomend", handler);
    };
  }, [map]);
  return null;
}

export default function PreviewMap({ points, onReady, onView }) {
  const valid = (points || []).filter((p) => p.coords);
  return (
    <MapContainer
      center={[0, 0]}
      zoom={2}
      zoomControl={false}
      dragging={true}
      scrollWheelZoom={true}
      touchZoom={true}
      doubleClickZoom={true}
      keyboard={true}
      attributionControl={false}
      style={{ width: "100%", height: "100%", background: "#eef2f7" }}
    >
      <TileLayer url={CARD_MAP_TILES} maxZoom={19} crossOrigin="anonymous" />
      {valid.map((p, i) => (
        <Marker key={i} position={[p.coords.lat, p.coords.lng]} icon={createCardMarkerIcon(p.address?.gender)} />
      ))}
      <MapController onReady={onReady} onView={onView} />
    </MapContainer>
  );
}