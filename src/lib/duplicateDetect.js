// Detecção de possíveis cadastros duplicados.
// Módulo isolado/puro — não altera nenhuma funcionalidade existente.
// Usado pelo alerta pré-salvamento (AddressForm) e pela página de Duplicados.

function normStr(s) {
  return String(s == null ? "" : s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normPhone(s) {
  return String(s == null ? "" : s).replace(/\D/g, "").replace(/^0+/, "");
}

function toRad(d) { return (d * Math.PI) / 180; }

// Distância em metros entre duas coordenadas (haversine), ou null se faltar alguma.
export function coordDistance(a, b) {
  const la1 = Number(a?.lat), ln1 = Number(a?.lng), la2 = Number(b?.lat), ln2 = Number(b?.lng);
  if (!isFinite(la1) || !isFinite(ln1) || !isFinite(la2) || !isFinite(ln2)) return null;
  const R = 6371000;
  const dLat = toRad(la2 - la1);
  const dLng = toRad(ln2 - ln1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(la1)) * Math.cos(toRad(la2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

// Similaridade de nome por tokens (Jaccard), 0..1.
export function nameSimilarity(a, b) {
  const ta = new Set(normStr(a).split(" ").filter(Boolean));
  const tb = new Set(normStr(b).split(" ").filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  ta.forEach((t) => { if (tb.has(t)) inter++; });
  return inter / new Set([...ta, ...tb]).size;
}

export function pairKey(idA, idB) {
  return [idA, idB].sort().join("|");
}

// Avalia se `candidate` é possível duplicado de `existing`.
// Retorna { level: 'alta'|'media'|'baixa', matchedFields, distance, score } ou null.
export function detectDuplicate(candidate, existing) {
  const matched = [];
  let score = 0;

  const nameSim = nameSimilarity(candidate.name, existing.name);
  if (nameSim >= 0.8) { score += 4; matched.push("nome"); }
  else if (nameSim >= 0.6) { score += 2.5; matched.push("nome semelhante"); }
  else if (nameSim >= 0.4) { score += 1; matched.push("nome parecido"); }

  const cp = normPhone(candidate.phone);
  const ep = normPhone(existing.phone);
  if (cp && cp.length >= 8 && cp === ep) { score += 3; matched.push("telefone"); }

  const dist = coordDistance(candidate, existing);
  if (dist != null) {
    if (dist < 50) { score += 4; matched.push("coordenadas (~iguais)"); }
    else if (dist < 200) { score += 2; matched.push("coordenadas próximas"); }
    else if (dist < 500) { score += 1; matched.push("coordenadas"); }
  }

  if (normStr(candidate.neighborhood) && normStr(candidate.neighborhood) === normStr(existing.neighborhood)) {
    score += 1; matched.push("bairro");
  }
  if (normStr(candidate.street) && normStr(candidate.street) === normStr(existing.street)) {
    score += 1; matched.push("rua");
  }
  if (candidate.congregation && normStr(candidate.congregation) === normStr(existing.congregation)) {
    score += 0.5; matched.push("congregação");
  }
  if (candidate.sign_language_level && candidate.sign_language_level === existing.sign_language_level) {
    score += 0.3;
  }

  let level = null;
  if (score >= 5) level = "alta";
  else if (score >= 3) level = "media";
  else if (score >= 1.5) level = "baixa";
  if (!level) return null;

  return { existing, level, matchedFields: matched, distance: dist, score };
}

// Encontra duplicados de um cadastro candidato entre uma lista.
export function findDuplicates(candidate, addresses = []) {
  return addresses
    .map((a) => detectDuplicate(candidate, a))
    .filter(Boolean)
    .sort((x, y) => y.score - x.score);
}

// Encontra pares de possíveis duplicados numa lista, excluindo pares já
// decididos (Set de pairKey) — ex.: "não são a mesma pessoa".
export function findDuplicatePairs(addresses = [], excludeKeys = new Set()) {
  const pairs = [];
  for (let i = 0; i < addresses.length; i++) {
    for (let j = i + 1; j < addresses.length; j++) {
      const a = addresses[i], b = addresses[j];
      const key = pairKey(a.id, b.id);
      if (excludeKeys.has(key)) continue;
      const d = detectDuplicate(a, b);
      if (d) pairs.push({ a, b, level: d.level, matchedFields: d.matchedFields, distance: d.distance, score: d.score, key });
    }
  }
  return pairs.sort((x, y) => y.score - x.score);
}

export const LEVEL_STYLES = {
  alta: { label: "Alta possibilidade", className: "bg-destructive/10 text-destructive border-destructive/20" },
  media: { label: "Média possibilidade", className: "bg-chart-3/10 text-chart-3 border-chart-3/20" },
  baixa: { label: "Baixa possibilidade", className: "bg-muted text-muted-foreground border-border" },
};