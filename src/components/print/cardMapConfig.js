import L from "leaflet";

// Fonte cartográfica idêntica à da página "Mapa" (MapView):
// tiles padrão do OpenStreetMap. Reutilizada pelos cartões de visita
// (prévia interativa e snapshot de impressão) para garantir a mesma
// aparência visual do mapa principal.
export const CARD_MAP_TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
export const CARD_MAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

// Marcadores idênticos aos da página "Mapa": pino colorido por gênero,
// com borda branca e emoji centralizado.
export function createCardMarkerIcon(gender) {
  const GENDER_STYLE = {
    Masculino: { emoji: "👨", color: "#0ea5e9" },
    Feminino: { emoji: "👩", color: "#ec4899" },
    Casal: { emoji: "👫", color: "#8b5cf6" },
  };
  const { emoji, color } = GENDER_STYLE[gender] || { emoji: "📍", color: "#64748b" };
  return L.divIcon({
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
}