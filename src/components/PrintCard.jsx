import { MapPin } from "lucide-react";
import CardInfoColumn from "@/components/print/CardInfoColumn";
import QrCodeImage from "@/components/QrCodeImage";
import { getMapsUrl } from "@/lib/maps";

// Cartão de território para impressão — mesmo modelo visual aprovado do
// cartão digital. Layout definido por props (controles manuais do editor):
// - cardW × cardH (em `unit`: cm ou mm); default inicial 18×11 cm.
// - área de informações (infoWidth%) à esquerda; área do mapa (mapWidth%) à direita.
// - mapa: representação estática (snapshot) do mesmo mapa aprovado.
// - QR Code impresso apontando para o cartão digital interativo.
// Um surdo por cartão.
export default function PrintCard({
  addresses,
  snapshot,
  cardW = 18,
  cardH = 11,
  unit = "cm",
  infoWidth = 33,
  mapWidth = 67,
  infoHeight = 100,
  mapHeight = 100,
}) {
  const addr = (addresses && addresses[0]) || {};
  const mapsUrl = getMapsUrl(addr.lat, addr.lng);
  return (
    <div
      className="print-card relative bg-white border border-border overflow-hidden rounded-lg"
      style={{ width: `${cardW}${unit}`, height: `${cardH}${unit}` }}
    >
      {/* Coluna de informações */}
      <div className="absolute top-0 left-0 overflow-hidden" style={{ width: `${infoWidth}%`, height: `${infoHeight}%` }}>
        <CardInfoColumn address={addr} />
      </div>

      {/* Coluna do mapa (estático) */}
      <div className="absolute top-0 right-0 overflow-hidden bg-secondary" style={{ width: `${mapWidth}%`, height: `${mapHeight}%` }}>
        {snapshot ? (
          <img src={snapshot} alt="Mapa do território" className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-1">
            <MapPin className="h-6 w-6 opacity-40" />
            <span className="text-[9px]">Mapa do território</span>
          </div>
        )}
        <span className="absolute bottom-0.5 right-1 text-[7px] text-gray-700 bg-white/70 px-1 rounded">
          © OpenStreetMap contributors
        </span>
        {/* QR Code impresso (SVG vetorial) — permanece nítido no PDF/impressão.
            Vetorial evita a rasterização/redução que degradava o PNG no PDF. */}
        {mapsUrl ? (
          <div className="absolute bottom-1 left-1 bg-white p-1 rounded shadow-sm">
            <QrCodeImage value={mapsUrl} size={60} vector />
          </div>
        ) : (
          <span className="absolute bottom-1 left-1 bg-white/80 px-1 py-0.5 rounded text-[7px] text-muted-foreground">
            Sem localização
          </span>
        )}
      </div>
    </div>
  );
}