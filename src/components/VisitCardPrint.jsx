import { MapPin, ExternalLink, Phone, Clock, MessageCircle, Share2 } from "lucide-react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { CARD_MAP_TILES, CARD_MAP_ATTRIBUTION, createCardMarkerIcon } from "@/components/print/cardMapConfig";
import { buildGoogleMapsUrl, extractCoords, getMapsLink } from "@/lib/maps";
import { buildCardText, shareContent } from "@/lib/shareCard";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const genderEmoji = {
  "Masculino": "👨",
  "Feminino": "👩",
  "Casal": "👫",
};

export default function VisitCardPrint({ addresses, cardStyle = "compact" }) {
  if (cardStyle === "digital") {
    return (
      <div className="space-y-4">
        {addresses.map((addr) => {
          const gmapsUrl = buildGoogleMapsUrl(addr.maps_link);
          const coords = addr.lat != null && addr.lng != null
            ? { lat: addr.lat, lng: addr.lng }
            : extractCoords(getMapsLink(addr) || addr.maps_link || "");
          return (
            <div key={addr.id} className="relative rounded-2xl overflow-hidden border border-border bg-card shadow-lg">
              {/* Map image */}
              <div className="relative h-40 bg-secondary">
                {coords ? (
                  <MapContainer
                    center={[coords.lat, coords.lng]}
                    zoom={16}
                    style={{ height: "100%", width: "100%" }}
                    scrollWheelZoom={false}
                    zoomControl={false}
                    attributionControl={false}
                    dragging={true}
                  >
                    <TileLayer url={CARD_MAP_TILES} attribution={CARD_MAP_ATTRIBUTION} />
                    <Marker position={[coords.lat, coords.lng]} icon={createCardMarkerIcon(addr.gender)} />
                  </MapContainer>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 via-accent/10 to-primary/5">
                    <MapPin className="h-16 w-16 text-primary/30" />
                  </div>
                )}
                <div className="absolute top-3 right-3">
                  <span className="text-3xl drop-shadow-lg">{genderEmoji[addr.gender] || "👤"}</span>
                </div>
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-card to-transparent h-20" />
                <div className="absolute bottom-3 left-4">
                  <h3 className="font-heading font-bold text-xl text-foreground drop-shadow-sm">{addr.name}</h3>
                  <p className="text-sm text-muted-foreground">{addr.congregation}</p>
                </div>
              </div>

              <div className="p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-1 text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{addr.street}</p>
                    <p className="text-xs text-muted-foreground">
                      {addr.neighborhood}{addr.city ? `, ${addr.city}` : ""}
                    </p>
                    {addr.reference_point && (
                      <p className="text-xs text-accent mt-1">Ref: {addr.reference_point}</p>
                    )}
                  </div>
                </div>

                {addr.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-primary" />
                    <span className="text-sm">{addr.phone}</span>
                  </div>
                )}

                {addr.best_time && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="text-sm">{addr.best_time}</span>
                  </div>
                )}

                {addr.observations && (
                  <div className="flex items-start gap-2">
                    <MessageCircle className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                    <p className="text-sm text-muted-foreground line-clamp-2">{addr.observations}</p>
                  </div>
                )}

                {addr.maps_link && (
                  <a
                    href={gmapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Abrir Rota no Google Maps
                  </a>
                )}
                <Button
                  variant="outline"
                  className="gap-2 w-full py-2.5 rounded-xl text-sm"
                  onClick={async () => {
                    const result = await shareContent(`Cartão - ${addr.name}`, buildCardText(addr));
                    if (result.method === "clipboard") toast.success("Cartão copiado!");
                    else if (result.method === "error") toast.error("Não foi possível compartilhar.");
                  }}
                >
                  <Share2 className="h-4 w-4" />
                  Compartilhar Cartão
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Compact (print) layout is now handled by <PrintCard /> in VisitCards
  return null;
}