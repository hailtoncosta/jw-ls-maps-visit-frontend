import { useState, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import html2canvas from "html2canvas";
import { CARD_MAP_TILES, createCardMarkerIcon } from "@/components/print/cardMapConfig";

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export function useMapSnapshots() {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markersRef = useRef([]);
  const [snapshots, setSnapshots] = useState({}); // groupId -> dataURL
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  const ensureMap = useCallback(() => {
    if (mapRef.current) return mapRef.current;
    if (!containerRef.current) return null;
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      fadeAnimation: false,
      zoomAnimation: false,
      markerZoomAnimation: false,
    });
    map.setView([-18.6657, 35.5296], 13);
    const tl = L.tileLayer(CARD_MAP_TILES, {
      crossOrigin: "anonymous",
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    tileLayerRef.current = tl;
    return map;
  }, []);

  const clearMarkers = () => {
    markersRef.current.forEach((m) => mapRef.current.removeLayer(m));
    markersRef.current = [];
  };

  // groups: [{ id, points: [{ address, coords }] }]
  // options.zoom: número (13-19) ou "auto"/undefined (enquadramento automático).
  // Um snapshot por grupo (cartão), mostrando todos os marcadores do grupo.
  const generate = useCallback(
    async (groups, options) => {
      const map = ensureMap();
      if (!map || !groups || groups.length === 0) return null;
      const zoomOpt = options?.zoom;
      const useAuto = zoomOpt === undefined || zoomOpt === "auto";
      setGenerating(true);
      setProgress(0);
      map.invalidateSize();
      const out = {};
      for (let i = 0; i < groups.length; i++) {
        const g = groups[i];
        const pts = (g.points || []).filter((p) => p.coords);
        if (pts.length === 0) continue;

        clearMarkers();
        pts.forEach(({ address, coords }) => {
          const icon = createCardMarkerIcon(address.gender);
          const m = L.marker([coords.lat, coords.lng], { icon }).addTo(map);
          markersRef.current.push(m);
        });

        const center =
          pts.length === 1
            ? [pts[0].coords.lat, pts[0].coords.lng]
            : [
                pts.reduce((s, p) => s + p.coords.lat, 0) / pts.length,
                pts.reduce((s, p) => s + p.coords.lng, 0) / pts.length,
              ];

        if (useAuto) {
          if (pts.length > 1) {
            const bounds = L.latLngBounds(pts.map((p) => [p.coords.lat, p.coords.lng]));
            map.fitBounds(bounds, { padding: [40, 40], animate: false });
          } else {
            map.setView(center, 17, { animate: false });
          }
        } else {
          map.setView(center, zoomOpt, { animate: false });
        }

        await delay(900); // permitir renderização dos tiles
        let url = null;
        try {
          const canvas = await html2canvas(map.getContainer(), {
            useCORS: true,
            allowTaint: false,
            scale: 2,
            backgroundColor: "#ffffff",
            logging: false,
          });
          url = canvas.toDataURL("image/jpeg", 0.92);
        } catch {
          url = null;
        }
        if (url) out[g.id] = url;
        setSnapshots((prev) => ({ ...prev, [g.id]: url }));
        setProgress(Math.round(((i + 1) / groups.length) * 100));
      }
      setSnapshots((prev) => ({ ...prev, ...out }));
      setGenerating(false);
      return out;
    },
    [ensureMap]
  );

  return { containerRef, snapshots, generating, progress, generate };
}