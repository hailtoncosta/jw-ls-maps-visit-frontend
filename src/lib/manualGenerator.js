import { jsPDF } from "jspdf";
import { MANUAL_CONTENT } from "./manualContent";
import { drawAppScreen } from "./manualMockups";

const C = {
  primary: [14, 165, 233],
  accent: [20, 184, 166],
  text: [51, 65, 85],
  muted: [148, 163, 184],
  bg: [248, 250, 252],
};

const VARIANT = {
  "/": "home",
  "/addresses": "addresses",
  "/addresses/new": "new_address",
  "/map": "map",
  "/visit-cards": "visit_cards",
  "/my-territories": "territories",
  "/progress": "progress",
  "/admin": "admin",
  "/admin/backup": "backup",
  "/admin/trash": "trash",
  "/contact": "contact",
  "/settings": "settings",
};

const DATE_LOCALE = {
  pt: "pt-BR",
  en: "en-US",
  fr: "fr-FR",
  es: "es-ES",
};

function buildPdf(lang, manualType) {
  const content = MANUAL_CONTENT[lang] || MANUAL_CONTENT.pt;
  const sections = content.sections[manualType] || content.sections.basic;
  const isFull = manualType === "full";
  const meta = isFull
    ? { title: content.cover.admin_title, subtitle: content.cover.admin_subtitle }
    : { title: content.cover.publisher_title, subtitle: content.cover.publisher_subtitle };

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = 210, ph = 297, m = 14, cw = pw - 2 * m;

  // ----- Capa -----
  doc.setFillColor(...C.primary);
  doc.rect(0, 0, pw, 112, "F");
  doc.setFillColor(...C.accent);
  doc.rect(0, 104, pw, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text(meta.title, m, 56);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.text(meta.subtitle, m, 72);

  // ilustração principal
  drawAppScreen(doc, m + 6, 122, cw - 12, 78, "home");

  // sumário
  doc.setTextColor(...C.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(content.toc, m, 214);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const perCol = Math.ceil(sections.length / 2);
  sections.forEach((s, i) => {
    const col = Math.floor(i / perCol);
    const row = i % perCol;
    const tx = m + col * (cw / 2);
    const ty = 222 + row * 6.2;
    doc.setTextColor(...C.primary);
    doc.text(`${i + 1}.`, tx, ty);
    doc.setTextColor(...C.text);
    doc.text(s.title, tx + 5, ty);
  });

  doc.setTextColor(...C.muted);
  doc.setFontSize(8);
  const dateStr = new Date().toLocaleDateString(DATE_LOCALE[lang] || "pt-BR");
  doc.text(`${content.app_name} · ${content.generated_on} ${dateStr}`, m, ph - 8);

  // ----- Páginas das seções -----
  sections.forEach((s, idx) => {
    doc.addPage();
    doc.setFillColor(...C.bg);
    doc.rect(0, 0, pw, ph, "F");

    // barra de título
    const tb = 16;
    doc.setFillColor(...C.primary);
    doc.rect(0, 0, pw, tb, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(`${idx + 1}. ${s.title}`, m, tb / 2 + 1.6);

    // texto passo a passo
    let y = tb + 9;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...C.text);
    if (s.description) {
      const lines = doc.splitTextToSize(s.description, cw);
      doc.text(lines, m, y);
      y += lines.length * 4.8 + 3;
    }
    s.steps.forEach((step, i) => {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...C.primary);
      doc.text(`${i + 1}.`, m, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...C.text);
      const lines = doc.splitTextToSize(step, cw - 7);
      doc.text(lines, m + 7, y);
      y += Math.max(5.5, lines.length * 4.8) + 2.5;
    });

    // ilustração preenche o restante da página
    const mx = m, my = y + 5, mw = cw, mh = ph - m - my;
    if (mh > 28) {
      drawAppScreen(doc, mx, my, mw, mh, VARIANT[s.route] || "home");
    } else {
      doc.setDrawColor(...C.muted);
      doc.setLineWidth(0.2);
      doc.line(mx, my, mx + mw, my);
    }
  });

  return doc;
}

const FILENAME_LANG = { pt: "PT", en: "EN", fr: "FR", es: "ES" };

export function generateManual(manualType, lang = "pt") {
  const doc = buildPdf(lang, manualType);
  const blob = doc.output("blob");
  const suffix = FILENAME_LANG[lang] || "PT";
  const filename = `JW_Maps_Visit_Manual_${suffix}.pdf`;
  return { blob, filename };
}

export function downloadManual(manualType, lang = "pt") {
  const { blob, filename } = generateManual(manualType, lang);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}