// Populações oficiais das cidades de Moçambique.
// Fonte: INE — III RGPH 2007 e IV RGPH 2017 (lista oficial de cidades).
// Onde o Censo 2017 não disponibilizou o valor, usa-se o de 2007 (ano indicado).

const CITIES = [
  { name: "Maputo", pop: 1101170, year: 2017, aliases: ["maputo", "cidade de maputo", "maputo cidade"] },
  { name: "Matola", pop: 1032197, year: 2017, aliases: ["matola"] },
  { name: "Nampula", pop: 743125, year: 2017, aliases: ["nampula"] },
  { name: "Beira", pop: 533825, year: 2017, aliases: ["beira"] },
  { name: "Mocuba", pop: 422681, year: 2017, aliases: ["mocuba"] },
  { name: "Chimoio", pop: 372821, year: 2017, aliases: ["chimoio"] },
  { name: "Quelimane", pop: 349842, year: 2017, aliases: ["quelimane"] },
  { name: "Nacala", pop: 225034, year: 2017, aliases: ["nacala", "nacala porto", "nacalaporto", "nacala-porto"] },
  { name: "Tete", pop: 155870, year: 2007, aliases: ["tete", "cidade de tete"] },
  { name: "Gurué", pop: 145466, year: 2007, aliases: ["gurue", "gurué"] },
  { name: "Lichinga", pop: 142331, year: 2007, aliases: ["lichinga"] },
  { name: "Pemba", pop: 138716, year: 2007, aliases: ["pemba"] },
  { name: "Xai-Xai", pop: 115752, year: 2007, aliases: ["xai xai", "xai-xai", "xaixai"] },
  { name: "Maxixe", pop: 108824, year: 2007, aliases: ["maxixe"] },
  { name: "Angoche", pop: 89998, year: 2007, aliases: ["angoche"] },
  { name: "Cuamba", pop: 79013, year: 2007, aliases: ["cuamba"] },
  { name: "Montepuez", pop: 76139, year: 2007, aliases: ["montepuez"] },
  { name: "Dondo", pop: 70817, year: 2007, aliases: ["dondo"] },
  { name: "Inhambane", pop: 65149, year: 2007, aliases: ["inhambane"] },
  { name: "Chibuto", pop: 63184, year: 2007, aliases: ["chibuto"] },
  { name: "Chócue", pop: 53062, year: 2007, aliases: ["chocue", "chokwe", "chocue plain"] },
  { name: "Ilha de Moçambique", pop: 48063, year: 2007, aliases: ["ilha de mocambique", "ilha de moçambique", "ilha de mozambique"] },
  { name: "Manica", pop: 36124, year: 2007, aliases: ["manica"] },
];

export function normalizeCity(s) {
  if (!s) return "";
  return s
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Returns { name, pop, year } or null if not found.
export function getCityPopulation(cityName) {
  if (!cityName) return null;
  const norm = normalizeCity(cityName);
  if (!norm) return null;
  for (const c of CITIES) {
    for (const a of c.aliases) {
      if (normalizeCity(a) === norm) return { name: c.name, pop: c.pop, year: c.year };
    }
  }
  for (const c of CITIES) {
    for (const a of c.aliases) {
      const an = normalizeCity(a);
      if (an && (norm.includes(an) || an.includes(norm))) return { name: c.name, pop: c.pop, year: c.year };
    }
  }
  return null;
}

export const MZ_CITIES_SOURCE = "INE — Censos de Moçambique (2007/2017)";