// Resolvedor de CIDADE e BAIRRO/LOCALIDADE a partir de coordenadas.
//
// Problema resolvido: bairros/postos administrativos da Cidade da Beira
// (Manga, Inhamízua, Nhaconjo, Manga Mascarenhas, Alto da Manga, etc.) estavam
// sendo classificados como cidades independentes, porque o geocodificador
// (Nominatim) às vezes retorna o nome do bairro no campo "city"/"town".
//
// Solução: NÃO confiar somente no campo "city". Analisar a hierarquia
// administrativa (suburb/neighbourhood/quarter/city_district/town/village/
// municipality/county) E aplicar uma salvaguarda por COORDENADA: quando o ponto
// está dentro da área administrativa da Beira, a cidade é sempre "Beira" e o
// nome do bairro permanece no campo de bairro. Não há substituição global de
// nomes — a decisão é por coordenada.

// Caixa delimitadora (bounding box) aproximada da área da Beira (cidade +
// postos administrativos vizinhos). Apenas pontos dentro desta caixa são
// classificados como "Beira", evitando converter outras localidades.
export const BEIRA_BBOX = {
  minLat: -19.96,
  maxLat: -19.62,
  minLng: 34.78,
  maxLng: 34.93,
};

export function isInBeira(lat, lng) {
  const la = Number(lat);
  const ln = Number(lng);
  if (!isFinite(la) || !isFinite(ln)) return false;
  return (
    la >= BEIRA_BBOX.minLat && la <= BEIRA_BBOX.maxLat &&
    ln >= BEIRA_BBOX.minLng && ln <= BEIRA_BBOX.maxLng
  );
}

function norm(s) {
  return String(s == null ? "" : s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ç/g, "c")
    .trim();
}

// Nomes que NÃO são bairros (níveis administrativos superiores) — não devem ser
// movidos para o campo bairro/localidade.
const NON_BAIRRO = new Set([
  "beira", "sofala", "mocambique", "mozambique", "moçambique",
  "cidade da beira", "beira cidade", "municipio da beira",
]);

// Resolve cidade e bairro a partir de coordenadas + hierarquia do geocodificador
// (objeto `address` retornado pelo Nominatim). Usado no reverseGeocode (novos
// cadastros e edição).
export function resolveCityNeighborhood(lat, lng, address = {}) {
  const addr = address || {};
  const localityCandidates = [
    addr.suburb, addr.neighbourhood, addr.quarter, addr.city_district,
    addr.residential, addr.subdistrict, addr.hamlet, addr.town, addr.village,
  ];
  const locality = localityCandidates.find((v) => v && typeof v === "string") || "";

  let city = "";
  let bairro = "";

  if (isInBeira(lat, lng)) {
    // Ponto dentro da Beira: cidade é sempre "Beira". O bairro é a localidade
    // mais específica; se o geocoder retornou o nome do bairro como
    // city/town/village, reutilizamos esse nome como bairro.
    city = "Beira";
    bairro = locality;
    if (!bairro) {
      const asBairro =
        [addr.city, addr.town, addr.village].find(
          (v) => v && norm(v) !== "beira"
        ) || "";
      bairro = asBairro;
    }
  } else {
    // Fora da Beira: cidade pela hierarquia — preferindo city/municipality sobre
    // town/village para não confundir bairro com cidade.
    city =
      [addr.city, addr.municipality, addr.town, addr.village, addr.county].find(
        (v) => v && typeof v === "string"
      ) || "";
    bairro = locality && norm(locality) !== norm(city) ? locality : "";
  }

  // Limpeza: bairro não pode ser igual à cidade nem um nível administrativo.
  if (bairro && (norm(bairro) === norm(city) || NON_BAIRRO.has(norm(bairro)))) {
    bairro = "";
  }

  return { city, neighborhood: bairro };
}

// Resolve cidade/bairro para o BACKFILL (sem chamar o geocodificador novamente):
// usa a coordenada atual + os campos já armazenados. Retorna { city, neighborhood }
// corrigidos, ou null quando não há nada a corrigir (fora da Beira ou já correto).
// Idempotente: uma segunda execução não altera registros já corrigidos.
export function resolveForBackfill(lat, lng, storedCity, storedNeighborhood) {
  if (!isInBeira(lat, lng)) return null; // fora da Beira: não tocar
  const trueCity = "Beira";
  const sc = storedCity || "";
  const sn = storedNeighborhood || "";

  let bairro = "";
  if (sn && !NON_BAIRRO.has(norm(sn)) && norm(sn) !== "beira" && norm(sn) !== norm(trueCity)) {
    bairro = sn; // bairro já armazenado é válido
  } else if (sc && !NON_BAIRRO.has(norm(sc)) && norm(sc) !== "beira" && norm(sc) !== norm(trueCity)) {
    bairro = sc; // a "cidade" armazenada era na verdade o bairro
  }

  if (norm(sc) === norm(trueCity) && norm(sn) === norm(bairro)) return null; // já correto
  return { city: trueCity, neighborhood: bairro };
}