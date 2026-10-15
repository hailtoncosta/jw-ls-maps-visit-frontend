import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

// QR Code gerado pela biblioteca `qrcode` (padrão de mercado, ISO/IEC 18004),
// com correção de erro nível H (máxima tolerância a falhas).
//
// Dois modos de renderização:
// - PNG (padrão): usado no cartão digital (exibição em tela).
// - SVG vetorial (vector=true): usado no cartão IMPRESSO. Permanece como
//   gráfico vetorial durante a geração do PDF (window.print), preservando
//   todos os módulos nítidos em qualquer zoom — garantindo a leitura do QR
//   no PDF e na impressão em papel. Não sofre rasterização/redução como o PNG.
export default function QrCodeImage({ value, size = 200, className = "", vector = false }) {
  // --- Modo vetorial (SVG) — síncrono, sem dependência de carregamento de imagem ---
  const svg = useMemo(() => {
    if (!vector || !value) return null;
    try {
      const qr = QRCode.create(value, { errorCorrectionLevel: "H" });
      const n = qr.modules.size;
      const data = qr.modules.data;
      const qz = 2; // quiet zone: margem branca ao redor (módulos)
      const total = n + qz * 2;
      let parts = "";
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          if (data[r * n + c]) parts += `M${c + qz},${r + qz}h1v1h-1z`;
        }
      }
      return { path: parts, total };
    } catch {
      return null;
    }
  }, [value, vector]);

  // --- Modo PNG (cartão digital) — mantido sem alterações ---
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (vector) return;
    let active = true;
    if (!value) { setSrc(""); return; }
    QRCode.toDataURL(value, {
      errorCorrectionLevel: "H",
      margin: 2,
      width: Math.max(size * 4, 512),
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then((url) => { if (active) setSrc(url); })
      .catch(() => { if (active) setSrc(""); });
    return () => { active = false; };
  }, [value, size, vector]);

  if (vector) {
    if (!svg) return null;
    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${svg.total} ${svg.total}`}
        className={className}
        shapeRendering="crispEdges"
        style={{ width: size, height: size, display: "block" }}
      >
        <rect width={svg.total} height={svg.total} fill="white" />
        <path d={svg.path} fill="black" />
      </svg>
    );
  }

  if (!src) return null;
  return (
    <img
      src={src}
      alt="QR Code"
      width={size}
      height={size}
      className={className}
      style={{ imageRendering: "crisp-edges", width: size, height: size }}
    />
  );
}