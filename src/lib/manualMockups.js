// Ilustrações vetoriais no estilo do app, desenhadas com jsPDF.
// Cada variante preenche exatamente o retângulo (x,y,w,h) — sem espaços vazios.

const C = {
  primary: [14, 165, 233],
  accent: [20, 184, 166],
  bg: [248, 250, 252],
  card: [255, 255, 255],
  border: [226, 232, 240],
  muted: [203, 213, 225],
  text: [51, 65, 85],
  amber: [251, 191, 36],
  red: [239, 68, 68],
  green: [52, 211, 153],
  purple: [139, 92, 246],
};

const ACTIVE = {
  home: 0, addresses: 1, new_address: 1, map: 2, visit_cards: 3,
  territories: 3, progress: 4, admin: 0, backup: 0, trash: 0, contact: 4, settings: 4,
};

function fill(doc, [r, g, b]) { doc.setFillColor(r, g, b); }
function stroke(doc, [r, g, b]) { doc.setDrawColor(r, g, b); }

function card(doc, x, y, w, h) {
  fill(doc, C.card); stroke(doc, C.border); doc.setLineWidth(0.2);
  doc.roundedRect(x, y, w, h, 2, 2, "FD");
}
function pill(doc, x, y, w, h, color) {
  fill(doc, color);
  doc.roundedRect(x, y, Math.max(1, w), Math.max(1, h), Math.min(h / 2, 2), Math.min(h / 2, 2), "F");
}
function line(doc, x, y, w, color) {
  fill(doc, color || C.muted);
  doc.roundedRect(x, y, Math.max(1, w), Math.max(0.8, w * 0.04), 1, 1, "F");
}

export function drawAppScreen(doc, x, y, w, h, variant) {
  const rx = Math.min(3, w * 0.03);
  // window
  fill(doc, C.card); stroke(doc, C.border); doc.setLineWidth(0.2);
  doc.roundedRect(x, y, w, h, rx, rx, "FD");

  // top bar
  const tb = Math.max(5, h * 0.05);
  fill(doc, C.bg);
  doc.roundedRect(x, y, w, tb, 2, 2, "F");
  stroke(doc, C.border); doc.setLineWidth(0.2); doc.line(x, y + tb, x + w, y + tb);
  const r = Math.max(0.5, tb * 0.16);
  const dy = y + tb / 2;
  fill(doc, C.red); doc.circle(x + w * 0.03, dy, r, "F");
  fill(doc, C.amber); doc.circle(x + w * 0.06, dy, r, "F");
  fill(doc, C.green); doc.circle(x + w * 0.09, dy, r, "F");
  // url pill
  fill(doc, C.card); stroke(doc, C.border);
  doc.roundedRect(x + w * 0.16, y + tb * 0.25, w * 0.55, tb * 0.5, tb * 0.2, tb * 0.2, "FD");

  // content
  const cx = x + w * 0.02, cy = y + tb + h * 0.015, cw = w * 0.96, ch = h - tb - h * 0.03;
  const sw = cw * 0.26;
  // sidebar
  fill(doc, C.bg);
  doc.roundedRect(cx, cy, sw, ch, 2, 2, "F");
  const mi = Math.max(4, ch * 0.055);
  const gap = mi * 0.5;
  let my = cy + ch * 0.04;
  const active = ACTIVE[variant] ?? 0;
  for (let i = 0; i < 5; i++) {
    if (i === active) {
      pill(doc, cx + sw * 0.08, my, sw * 0.84, mi, C.primary);
      line(doc, cx + sw * 0.2, my + mi * 0.4, sw * 0.45, C.card);
    } else {
      pill(doc, cx + sw * 0.12, my + mi * 0.25, sw * 0.5, mi * 0.5, C.muted);
    }
    my += mi + gap;
  }

  // inner content
  const ix = cx + sw + Math.max(2, cw * 0.02);
  const iy = cy + Math.max(2, ch * 0.02);
  const iw = cw - sw - Math.max(4, cw * 0.04);
  const ih = ch - Math.max(4, ch * 0.04);
  // header line
  fill(doc, C.text);
  doc.roundedRect(ix, iy, iw * 0.4, Math.max(2.5, ih * 0.05), 1, 1, "F");

  drawVariant(doc, variant, ix, iy + ih * 0.12, iw, ih * 0.88);
}

function drawVariant(doc, variant, x, y, w, h) {
  const gap = w * 0.025;
  const rows = (n, rowH, render) => {
    let ry = y;
    for (let i = 0; i < n; i++) { render(ry, i); ry += rowH + gap; }
  };

  switch (variant) {
    case "home": {
      const c3 = (w - gap * 2) / 3;
      const sh = h * 0.22;
      for (let i = 0; i < 3; i++) {
        const cx = x + i * (c3 + gap);
        card(doc, cx, y, c3, sh);
        pill(doc, cx + c3 * 0.15, y + sh * 0.25, c3 * 0.18, sh * 0.18, [C.primary, C.accent, C.amber][i]);
        line(doc, cx + c3 * 0.15, y + sh * 0.55, c3 * 0.5);
        line(doc, cx + c3 * 0.15, y + sh * 0.72, c3 * 0.35, C.muted);
      }
      const cy2 = y + sh + gap;
      const ch2 = h * 0.48;
      card(doc, x, cy2, w, ch2);
      const bars = 6, bw = w * 0.07;
      for (let i = 0; i < bars; i++) {
        const bh = ch2 * (0.2 + (i % 3) * 0.18);
        pill(doc, x + w * 0.08 + i * (bw + w * 0.035), cy2 + ch2 * 0.82 - bh, bw, bh, i % 2 ? C.accent : C.primary);
      }
      const cy3 = cy2 + ch2 + gap;
      card(doc, x, cy3, w, h - (cy3 - y));
      // mini map grid
      stroke(doc, C.border); doc.setLineWidth(0.15);
      for (let i = 1; i < 5; i++) doc.line(x + (w / 5) * i, cy3 + 2, x + (w / 5) * i, cy3 + h - (cy3 - y) - 2);
      fill(doc, C.primary); doc.circle(x + w * 0.3, cy3 + (h - (cy3 - y)) * 0.4, 1.5, "F");
      fill(doc, C.accent); doc.circle(x + w * 0.6, cy3 + (h - (cy3 - y)) * 0.6, 1.5, "F");
      break;
    }
    case "addresses":
    case "territories":
    case "trash": {
      // search
      card(doc, x, y, w, h * 0.1);
      line(doc, x + w * 0.04, y + h * 0.05, w * 0.5, C.muted);
      const rowH = h * 0.16;
      let ry = y + h * 0.14;
      for (let i = 0; i < 4 && ry + rowH < y + h; i++) {
        card(doc, x, ry, w, rowH);
        fill(doc, [C.primary, C.accent, C.amber, C.purple][i % 4]);
        doc.circle(x + w * 0.06, ry + rowH * 0.5, rowH * 0.22, "F");
        line(doc, x + w * 0.16, ry + rowH * 0.35, w * 0.35);
        line(doc, x + w * 0.16, ry + rowH * 0.6, w * 0.22, C.muted);
        pill(doc, x + w * 0.78, ry + rowH * 0.3, w * 0.16, rowH * 0.3, variant === "trash" ? C.red : C.green);
        ry += rowH + gap;
      }
      break;
    }
    case "new_address":
    case "contact":
    case "settings": {
      const fieldH = h * 0.1;
      let fy = y;
      const n = variant === "new_address" ? 5 : variant === "settings" ? 5 : 3;
      for (let i = 0; i < n; i++) {
        line(doc, x, fy + 1, w * 0.3, C.muted);
        card(doc, x, fy + fieldH * 0.4, w, fieldH);
        fy += fieldH * 1.1 + gap;
      }
      pill(doc, x, fy, w * 0.32, fieldH * 0.7, C.primary);
      break;
    }
    case "map": {
      card(doc, x, y, w, h);
      stroke(doc, C.border); doc.setLineWidth(0.15);
      for (let i = 1; i < 7; i++) doc.line(x + (w / 7) * i, y + 2, x + (w / 7) * i, y + h - 2);
      for (let i = 1; i < 5; i++) doc.line(x + 2, y + (h / 5) * i, x + w - 2, y + (h / 5) * i);
      const pins = [[0.25, 0.35, C.primary], [0.5, 0.55, C.accent], [0.7, 0.3, C.primary], [0.35, 0.7, C.amber], [0.8, 0.7, C.accent]];
      pins.forEach(([px, py, c]) => { fill(doc, c); doc.circle(x + w * px, y + h * py, 2.2, "F"); });
      break;
    }
    case "visit_cards": {
      const cw3 = (w - gap * 2) / 3;
      for (let i = 0; i < 3; i++) {
        const cx = x + i * (cw3 + gap);
        card(doc, cx, y, cw3, h);
        fill(doc, C.bg);
        doc.roundedRect(cx + cw3 * 0.1, y + h * 0.1, cw3 * 0.8, h * 0.45, 1, 1, "F");
        stroke(doc, C.border); doc.setLineWidth(0.12);
        for (let j = 1; j < 4; j++) doc.line(cx + cw3 * 0.1, y + h * 0.1 + (h * 0.45 / 4) * j, cx + cw3 * 0.9, y + h * 0.1 + (h * 0.45 / 4) * j);
        fill(doc, C.primary); doc.circle(cx + cw3 * 0.5, y + h * 0.33, 1.8, "F");
        line(doc, cx + cw3 * 0.1, y + h * 0.65, cw3 * 0.8);
        line(doc, cx + cw3 * 0.1, y + h * 0.78, cw3 * 0.5, C.muted);
      }
      break;
    }
    case "progress": {
      const ch2 = h * 0.5;
      card(doc, x, y, w, ch2);
      const bars = 5, bw = w * 0.08;
      for (let i = 0; i < bars; i++) {
        pill(doc, x + w * 0.08 + i * (bw + w * 0.05), y + ch2 * 0.85 - ch2 * (0.2 + (i % 3) * 0.2), bw, ch2 * (0.2 + (i % 3) * 0.2), C.primary);
        pill(doc, x + w * 0.08 + i * (bw + w * 0.05), y + ch2 * 0.85, bw, ch2 * 0.06, C.accent);
      }
      const ty2 = y + ch2 + gap;
      const rowH = (h - ch2 - gap) / 4;
      for (let i = 0; i < 4; i++) {
        const ry = ty2 + i * rowH;
        line(doc, x, ry + rowH * 0.4, w * 0.3);
        line(doc, x + w * 0.5, ry + rowH * 0.4, w * 0.1, C.muted);
        pill(doc, x + w * 0.75, ry + rowH * 0.25, w * 0.15, rowH * 0.4, [C.green, C.amber, C.red, C.primary][i]);
        stroke(doc, C.border); doc.setLineWidth(0.12); doc.line(x, ry + rowH, x + w, ry + rowH);
      }
      break;
    }
    case "admin": {
      card(doc, x, y, w, h * 0.12);
      pill(doc, x + w * 0.04, y + h * 0.04, w * 0.2, h * 0.06, C.primary);
      const rowH = h * 0.16;
      let ry = y + h * 0.18;
      for (let i = 0; i < 4 && ry + rowH < y + h; i++) {
        card(doc, x, ry, w, rowH);
        fill(doc, [C.primary, C.accent, C.amber, C.purple][i % 4]);
        doc.circle(x + w * 0.06, ry + rowH * 0.5, rowH * 0.22, "F");
        line(doc, x + w * 0.16, ry + rowH * 0.35, w * 0.3);
        line(doc, x + w * 0.16, ry + rowH * 0.6, w * 0.18, C.muted);
        pill(doc, x + w * 0.7, ry + rowH * 0.3, w * 0.22, rowH * 0.3, [C.primary, C.amber, C.accent, C.muted][i]);
        ry += rowH + gap;
      }
      break;
    }
    case "backup": {
      const bw2 = (w - gap) / 2;
      card(doc, x, y, bw2, h * 0.2);
      pill(doc, x + bw2 * 0.2, y + h * 0.07, bw2 * 0.6, h * 0.07, C.primary);
      card(doc, x + bw2 + gap, y, bw2, h * 0.2);
      pill(doc, x + bw2 + gap + bw2 * 0.2, y + h * 0.07, bw2 * 0.6, h * 0.07, C.accent);
      let ry = y + h * 0.26;
      const rowH = h * 0.16;
      for (let i = 0; i < 3 && ry + rowH < y + h; i++) {
        card(doc, x, ry, w, rowH);
        line(doc, x + w * 0.06, ry + rowH * 0.4, w * 0.4);
        line(doc, x + w * 0.06, ry + rowH * 0.65, w * 0.25, C.muted);
        pill(doc, x + w * 0.8, ry + rowH * 0.3, w * 0.12, rowH * 0.35, C.green);
        ry += rowH + gap;
      }
      break;
    }
    default:
      card(doc, x, y, w, h);
  }
}