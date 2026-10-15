import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Printer, X, ChevronLeft, ChevronRight, Loader2, RotateCcw } from "lucide-react";
import html2canvas from "html2canvas";
import PrintCard from "@/components/PrintCard";
import CardInfoColumn from "@/components/print/CardInfoColumn";
import PreviewMap from "@/components/print/PreviewMap";

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const initialView = (card) => {
  const pts = (card?.points || []).filter((p) => p.coords);
  if (pts.length === 0) return { center: [-18.6657, 35.5296], zoom: 13 };
  const center =
    pts.length === 1
      ? [pts[0].coords.lat, pts[0].coords.lng]
      : [
          pts.reduce((s, p) => s + p.coords.lat, 0) / pts.length,
          pts.reduce((s, p) => s + p.coords.lng, 0) / pts.length,
        ];
  return { center, zoom: 15 };
};

// Editor MANUAL dos cartões de impressão.
// O sistema não impõe tamanho, divisão, zoom nem enquadramento.
// O usuário define tudo; a prévia reflete exatamente o que será impresso.
export default function PrintCardEditor({ cards, open, onClose }) {
  const [cardW, setCardW] = useState("18");
  const [cardH, setCardH] = useState("11");
  const [unit, setUnit] = useState("cm");
  const [infoWidth, setInfoWidth] = useState(33);
  const [mapWidth, setMapWidth] = useState(67);
  const [infoHeight, setInfoHeight] = useState(100);
  const [mapHeight, setMapHeight] = useState(100);
  const [idx, setIdx] = useState(0);
  const [previewPoints, setPreviewPoints] = useState([]);
  const [zoomDisplay, setZoomDisplay] = useState(15);
  const [printSnaps, setPrintSnaps] = useState({});
  const [printPending, setPrintPending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  const mapRef = useRef(null);
  const viewsRef = useRef({});
  const idxRef = useRef(0);
  const capturingRef = useRef(false);

  useEffect(() => { idxRef.current = idx; }, [idx]);

  const list = cards || [];
  const current = list[idx];

  const w = parseFloat(cardW);
  const h = parseFloat(cardH);
  const sizeValid = !isNaN(w) && w > 0 && !isNaN(h) && h > 0;

  const getStoredView = (card) => {
    if (!card) return { center: [-18.6657, 35.5296], zoom: 13 };
    if (viewsRef.current[card.id]) return viewsRef.current[card.id];
    const v = initialView(card);
    viewsRef.current[card.id] = v;
    return v;
  };

  // Reset ao (re)abrir — apenas limpa os controles, não impõe valores.
  useEffect(() => {
    if (!open) return;
    setCardW("18"); setCardH("11"); setUnit("cm");
    setInfoWidth(33); setMapWidth(67); setInfoHeight(100); setMapHeight(100);
    setIdx(0); setPrintSnaps({}); setPrintPending(false); setGenerating(false); setProgress(0);
    viewsRef.current = {};
    if (list.length) setPreviewPoints(list[0].points || []);
  }, [open]);

  // Troca de card: carrega marcadores e a vista escolhida (sem recentralizar).
  useEffect(() => {
    if (!open || !list.length) return;
    const card = list[idx];
    setPreviewPoints(card?.points || []);
    const v = getStoredView(card);
    setZoomDisplay(v.zoom);
    const t = setTimeout(() => {
      if (mapRef.current) {
        try { mapRef.current.invalidateSize(); } catch {}
        safeSetView(mapRef.current, v);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [idx, open]);

  // setView/setZoom antes do primeiro reset do mapa quebram o painel interno
  // (_leaflet_pos). Aguarda o mapa estar pronto via whenReady.
  const safeSetView = (map, v) => {
    const apply = () => { try { map.setView(v.center, v.zoom, { animate: false }); } catch {} };
    if (map._loaded) apply();
    else map.whenReady(apply);
  };
  const safeSetZoom = (map, z) => {
    const apply = () => { try { map.setZoom(z, { animate: false }); } catch {} };
    if (map._loaded) apply();
    else map.whenReady(apply);
  };

  const handleMapReady = (map) => {
    mapRef.current = map;
    const card = list[idxRef.current];
    if (card) {
      const v = getStoredView(card);
      safeSetView(map, v);
      setZoomDisplay(v.zoom);
    }
    setTimeout(() => { try { map.invalidateSize(); } catch {} }, 250);
  };

  const handleViewChange = ({ center, zoom }) => {
    if (capturingRef.current) return;
    const card = list[idxRef.current];
    if (card) viewsRef.current[card.id] = { center, zoom };
    setZoomDisplay(zoom);
  };

  const handleZoomSlider = (z) => {
    setZoomDisplay(z);
    if (mapRef.current) safeSetZoom(mapRef.current, z);
  };

  const handleRestore = () => {
    setCardW("18"); setCardH("11"); setUnit("cm");
    setInfoWidth(33); setMapWidth(67); setInfoHeight(100); setMapHeight(100);
    viewsRef.current = {};
    setPrintSnaps({});
    const card = list[idxRef.current];
    if (card) {
      const v = getStoredView(card);
      setZoomDisplay(v.zoom);
      setTimeout(() => { if (mapRef.current) safeSetView(mapRef.current, v); }, 200);
    }
  };

  // Captura cada card a partir da própria prévia (vista escolhida pelo usuário).
  const captureAll = async () => {
    if (!mapRef.current || !list.length) return {};
    capturingRef.current = true;
    setGenerating(true);
    setProgress(0);
    try { mapRef.current.invalidateSize(); } catch {}
    const snaps = {};
    for (let i = 0; i < list.length; i++) {
      const card = list[i];
      setPreviewPoints(card.points || []);
      setProgress(Math.round((i / list.length) * 100));
      await delay(250);
      const v = getStoredView(card);
      safeSetView(mapRef.current, v);
      await delay(900);
      let url = null;
      try {
        const canvas = await html2canvas(mapRef.current.getContainer(), {
          useCORS: true, allowTaint: false, scale: 2, backgroundColor: "#ffffff", logging: false,
        });
        url = canvas.toDataURL("image/jpeg", 0.92);
      } catch { url = null; }
      snaps[card.id] = url;
    }
    setProgress(100);
    setGenerating(false);
    capturingRef.current = false;
    const cur = list[idxRef.current];
    if (cur) {
      setPreviewPoints(cur.points || []);
      const v = getStoredView(cur);
      setTimeout(() => { if (mapRef.current) safeSetView(mapRef.current, v); }, 200);
    }
    return snaps;
  };

  const handlePrint = async () => {
    if (!sizeValid || !list.length) return;
    const snaps = await captureAll();
    setPrintSnaps(snaps);
    setPrintPending(true);
  };

  useEffect(() => {
    if (!printPending) return;
    let cancelled = false;
    const run = async () => {
      // Garante que o DOM commitou os cartões com os snapshots antes de imprimir.
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      // Aguarda o carregamento (decode) de todas as imagens (mapas) da área de impressão.
      const imgs = Array.from(document.querySelectorAll(".print-area img"));
      await Promise.all(
        imgs.map((img) => {
          if (img.complete && img.naturalWidth > 0) return Promise.resolve();
          return new Promise((resolve) => {
            img.addEventListener("load", resolve, { once: true });
            img.addEventListener("error", resolve, { once: true });
          });
        })
      );
      if (cancelled) return;
      window.print();
      setPrintPending(false);
    };
    const t = setTimeout(run, 50);
    return () => { cancelled = true; clearTimeout(t); };
  }, [printPending]);

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="no-print max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editor Manual dos Cartões</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
            {/* Prévia (tamanho real em cm/mm) */}
            <div>
              <div className="text-xs text-muted-foreground mb-2 flex items-center justify-between">
                <span>Prévia ({idx + 1}/{list.length})</span>
                <span className="text-[11px]">{sizeValid ? `${cardW}${unit} × ${cardH}${unit}` : "defina o tamanho"}</span>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4 overflow-auto flex items-center justify-center" style={{ minHeight: 300 }}>
                {sizeValid ? (
                  <div className="relative bg-white border border-border overflow-hidden rounded-lg shadow-sm" style={{ width: `${cardW}${unit}`, height: `${cardH}${unit}` }}>
                    <div className="absolute top-0 left-0 overflow-hidden" style={{ width: `${infoWidth}%`, height: `${infoHeight}%` }}>
                      <CardInfoColumn address={(current?.points || [])[0]?.address} />
                    </div>
                    <div className="absolute top-0 right-0 overflow-hidden bg-secondary" style={{ width: `${mapWidth}%`, height: `${mapHeight}%` }}>
                      <PreviewMap points={previewPoints} onReady={handleMapReady} onView={handleViewChange} />
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground py-16 text-center">
                    Defina a largura e a altura do cartão para ver a prévia.
                  </div>
                )}
              </div>
              {list.length > 1 && (
                <div className="flex items-center justify-center gap-2 mt-3">
                  <Button size="sm" variant="outline" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">{idx + 1} / {list.length}</span>
                  <Button size="sm" variant="outline" onClick={() => setIdx((i) => Math.min(list.length - 1, i + 1))} disabled={idx === list.length - 1}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Controles */}
            <div className="space-y-5">
              <div>
                <Label className="mb-2 block">Tamanho do cartão</Label>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <span className="text-[11px] text-muted-foreground">Largura</span>
                    <Input type="number" min="0" step="0.1" value={cardW} onChange={(e) => setCardW(e.target.value)} placeholder="ex: 15" />
                  </div>
                  <div className="flex-1">
                    <span className="text-[11px] text-muted-foreground">Altura</span>
                    <Input type="number" min="0" step="0.1" value={cardH} onChange={(e) => setCardH(e.target.value)} placeholder="ex: 10" />
                  </div>
                  <div>
                    <span className="text-[11px] text-muted-foreground">Unidade</span>
                    <div className="flex gap-1">
                      <Button size="sm" variant={unit === "cm" ? "default" : "outline"} onClick={() => setUnit("cm")}>cm</Button>
                      <Button size="sm" variant={unit === "mm" ? "default" : "outline"} onClick={() => setUnit("mm")}>mm</Button>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Área de informações</Label>
                <div className="space-y-2">
                  <div>
                    <span className="text-[11px] text-muted-foreground">Largura: {infoWidth}%</span>
                    <input type="range" min="0" max="100" step="1" value={infoWidth} onChange={(e) => setInfoWidth(Number(e.target.value))} className="w-full accent-primary" />
                  </div>
                  <div>
                    <span className="text-[11px] text-muted-foreground">Altura: {infoHeight}%</span>
                    <input type="range" min="0" max="100" step="1" value={infoHeight} onChange={(e) => setInfoHeight(Number(e.target.value))} className="w-full accent-primary" />
                  </div>
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Área do mapa</Label>
                <div className="space-y-2">
                  <div>
                    <span className="text-[11px] text-muted-foreground">Largura: {mapWidth}%</span>
                    <input type="range" min="0" max="100" step="1" value={mapWidth} onChange={(e) => setMapWidth(Number(e.target.value))} className="w-full accent-primary" />
                  </div>
                  <div>
                    <span className="text-[11px] text-muted-foreground">Altura: {mapHeight}%</span>
                    <input type="range" min="0" max="100" step="1" value={mapHeight} onChange={(e) => setMapHeight(Number(e.target.value))} className="w-full accent-primary" />
                  </div>
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Zoom do mapa: {zoomDisplay}</Label>
                <input type="range" min="1" max="19" step="1" value={zoomDisplay} onChange={(e) => handleZoomSlider(Number(e.target.value))} className="w-full accent-primary" />
                <p className="text-[11px] text-muted-foreground mt-1">Arraste o mapa na prévia para ajustar o enquadramento. Não há recentralização automática.</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={onClose} className="gap-2"><X className="h-4 w-4" /> Cancelar</Button>
            <Button variant="outline" onClick={handleRestore} className="gap-2"><RotateCcw className="h-4 w-4" /> Restaurar</Button>
            <Button onClick={handlePrint} disabled={generating || !sizeValid || !list.length} className="gap-2">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              {generating ? `Gerando... ${progress}%` : "Gerar impressão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Área de impressão (oculta na tela, visível só na impressão) */}
      <div className="print-only" style={{ display: "none" }}>
        <div className="print-area space-y-2">
          {list.map((g) => (
            <PrintCard
              key={g.id}
              addresses={g.points.map((p) => p.address)}
              snapshot={printSnaps[g.id]}
              cardW={cardW}
              cardH={cardH}
              unit={unit}
              infoWidth={infoWidth}
              mapWidth={mapWidth}
              infoHeight={infoHeight}
              mapHeight={mapHeight}
            />
          ))}
        </div>
      </div>
    </>
  );
}