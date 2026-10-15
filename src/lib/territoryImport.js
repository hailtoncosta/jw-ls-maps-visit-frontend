import jsQR from "jsqr";

const ADDRESS_FIELDS = [
  "name", "gender", "age", "street", "neighborhood", "city", "state",
  "lat", "lng", "phone", "observations",   "reference_point", "house_photo", "best_time",
  "sign_language_level", "status", "congregation", "congregation_id",
  "last_visit_date", "last_visit_time", "last_visited_by", "visit_count",
];

export function sanitizeAddress(data) {
  if (!data || typeof data !== "object") return null;
  const mapped = {};
  for (const f of ADDRESS_FIELDS) {
    if (data[f] !== undefined && data[f] !== null && data[f] !== "") {
      mapped[f] = data[f];
    }
  }
  if (!mapped.name) return null;
  if (!mapped.congregation) mapped.congregation = "Não definida";
  if (!mapped.gender) mapped.gender = "Masculino";
  if (!mapped.status) mapped.status = "Ativo";
  if (mapped.visit_count === undefined) mapped.visit_count = 0;
  return mapped;
}

export function scanQRFromImage(imageFile) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(imageFile);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      URL.revokeObjectURL(url);
      if (code && code.data) resolve(code.data);
      else reject(new Error("QR Code não encontrado na imagem"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Erro ao carregar imagem"));
    };
    img.src = url;
  });
}

export function extractFromUrl(text) {
  const shareMatch = text.match(/\/s\/([a-zA-Z0-9_-]+)/);
  if (shareMatch) return { type: "share_id", id: shareMatch[1] };
  const dMatch = text.match(/[?&]d=([^&\s]+)/);
  if (dMatch) return { type: "base64", data: dMatch[1] };
  return null;
}

export function decodeBase64Address(b64) {
  try {
    const json = decodeURIComponent(atob(b64));
    return sanitizeAddress(JSON.parse(json));
  } catch {
    return null;
  }
}

export function parseJsonFileContent(text) {
  try {
    const data = JSON.parse(text);
    if (data && Array.isArray(data.addresses)) {
      return data.addresses.map(sanitizeAddress).filter(Boolean);
    }
    if (Array.isArray(data)) {
      return data.map(sanitizeAddress).filter(Boolean);
    }
    if (data && typeof data === "object") {
      const single = sanitizeAddress(data);
      return single ? [single] : [];
    }
    return [];
  } catch {
    return null;
  }
}

export async function resolveAddressFromQR(text, api) {
  const extracted = extractFromUrl(text);
  if (!extracted) {
    const parsed = parseJsonFileContent(text);
    if (parsed && parsed.length > 0) return parsed;
    return null;
  }
  if (extracted.type === "share_id") {
    try {
      const addr = await api.entities.Address.get(extracted.id);
      if (addr && !addr.deleted) return [sanitizeAddress(addr)];
    } catch {}
    return null;
  }
  if (extracted.type === "base64") {
    const decoded = decodeBase64Address(extracted.data);
    if (decoded) return [decoded];
  }
  return null;
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
    reader.readAsText(file);
  });
}