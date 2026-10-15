import { useState, useEffect, useRef } from "react";
import jsQR from "jsqr";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Camera, X, ScanLine } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export default function QrScannerDialog({ open, onOpenChange, onScan }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const { t } = useTranslation();

  const stopCamera = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setReady(false);
  };

  const scanLoop = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      rafRef.current = requestAnimationFrame(scanLoop);
      return;
    }

    if (video.readyState >= video.HAVE_CURRENT_DATA) {
      // Scan a center square region for performance
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (vw > 0 && vh > 0) {
        const scanSize = Math.min(vw, vh, 720);
        const sx = (vw - scanSize) / 2;
        const sy = (vh - scanSize) / 2;

        canvas.width = scanSize;
        canvas.height = scanSize;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(video, sx, sy, scanSize, scanSize, 0, 0, scanSize, scanSize);

        try {
          const imageData = ctx.getImageData(0, 0, scanSize, scanSize);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });
          if (code && code.data) {
            stopCamera();
            onScan(code.data);
            return;
          }
        } catch {
          // continue
        }
      }
    }
    rafRef.current = requestAnimationFrame(scanLoop);
  };

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setError("");

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", "true");
          await videoRef.current.play();
          setReady(true);
          rafRef.current = requestAnimationFrame(scanLoop);
        }
      } catch {
        if (mounted) {
          setError(t("qr.error"));
        }
      }
    };

    startCamera();

    return () => {
      mounted = false;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleClose = () => {
    stopCamera();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            {t("qr.title")}
          </DialogTitle>
          <DialogDescription>{t("qr.desc")}</DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="text-center py-6 space-y-3">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={handleClose} className="rounded-xl">
              {t("qr.close")}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative aspect-square rounded-xl overflow-hidden bg-black mx-auto max-w-[280px]">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative w-3/5 h-3/5">
                  <div className="absolute inset-0 border-2 border-white/80 rounded-xl" />
                  <ScanLine className="absolute top-1/2 left-0 w-full h-0.5 text-primary/80 animate-pulse" />
                </div>
              </div>
              {!ready && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-white" />
                </div>
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" />
            <Button variant="outline" className="w-full rounded-xl gap-2" onClick={handleClose}>
              <X className="h-4 w-4" />
              {t("common.cancel")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}