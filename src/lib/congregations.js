import { useState, useEffect } from "react";
import { api } from "@/api/apiClient";
import { normalizeRole } from "@/lib/permissions";
import { getCachedCongregationNames, cacheCongregationNames, getCachedCongregationObjects, cacheCongregationObjects, getCachedCircuitos, cacheCircuitos } from "./offlineCache";

export const DEFAULT_CONGREGATIONS = [
  "Munhava Língua de Sinais, Beira, SO",
  "Palmeiras Língua de Sinais, Beira, SO",
  "Pista Língua de Sinais, Caia, SO",
  "Cololo Língua de Sinais, Quelimane, ZA",
  "Aeroporto Língua de Sinais, Mocuba, ZA",
  "Gurué Língua de Sinais, Gurué, ZA",
  "Cuamba Língua de Sinais, Chiúta, NI",
  "Lichinga Língua de Sinais, Lichinga, NI",
  "Central Língua de Sinais, Nampula, NA",
  "Maiaia Nacala Língua de Sinais, Nacala, NA",
  "Cariacó - Pemba Língua de Sinais, Pemba, CD",
  "Montepuez Língua de Sinais, Montepuez, CD",
  "Mucessua Língua de Sinais, Gondola, MN",
  "Cabeça de Velho Língua de Sinais, Chimoio, MN",
  "Chinhamapere Língua de Sinais, Manica, MN",
  "Machipanda Língua de Sinais, Machipanda, MN",
  "Moatize Língua de Sinais, Moatize, TE",
  "Central Língua de Sinais, Tete Cidade, TE",
  "Satemwa Chichewa, Zobue, TE",
  "Concito Portuguesa Dondo, Dondo, SO",
  "Máquina Ndau-Oeste, Dombe, MN",
  "Thopwitho Makhuwa-Marrevone, Larde, NA",
  "Issipe Macua, Mecubúri, NA",
  "Entre-lagos Chichewa, Insaca, NI",
  "Nacawale Yao, Mandimba, NI",
  "Guara-Guara Ndau, Buzi, SO",
  "Chimphacasse Chichewa, Furancungo, TE",
  "Dzunsa Nyungwe, Chitima, TE",
  "Rovubue Ponte Chichewa, Tete Cidade, TE",
  "Kafuwa Chichewa, Furancungo, TE",
  "Nachininji Chichewa, Domue, TE",
  "Matambo Chichewa, Ulongue, TE",
  "Kaponda Chichewa, Ntengo Wa Mbalame, TE",
];

// Backward-compatible static export (used as fallback)
export const CONGREGATIONS = DEFAULT_CONGREGATIONS;

let _seedPromise = null;

async function loadCongregationsWithSeed() {
  let data = await api.entities.Congregation.list("name", 500);
  if (data.length > 0) return data;

  // O backend exige circuito_id ao cadastrar uma congregação. Em instalações
  // novas, cria (ou reutiliza) o Circuito Padrão antes de inserir a lista
  // inicial. A mesma Promise impede que dois hooks façam a carga em paralelo.
  if (!_seedPromise) {
    _seedPromise = (async () => {
      let circuitos = await api.entities.Circuito.list("name", 200);
      let circuitoPadrao = circuitos.find((c) => c.name === "Circuito Padrão");
      if (!circuitoPadrao) {
        circuitoPadrao = await api.entities.Circuito.create({ name: "Circuito Padrão" });
      }

      await api.entities.Congregation.bulkCreate(
        DEFAULT_CONGREGATIONS.map((name) => ({
          name,
          circuito_id: circuitoPadrao.id,
          circuito: circuitoPadrao.name || "Circuito Padrão",
        }))
      );
    })().catch((error) => {
      _seedPromise = null;
      throw error;
    });
  }

  await _seedPromise;
  data = await api.entities.Congregation.list("name", 500);
  return data;
}

// Hook that loads congregations from the database (source of truth).
// Seeds the predefined list once if the DB is empty (e.g. fresh install) so
// admins can remove any congregation and have the removal persist.
// Falls back to DEFAULT_CONGREGATIONS only when the database is unreachable.
export function useCongregations() {
  const [congregations, setCongregations] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    if (!navigator.onLine) {
      const cached = await getCachedCongregationNames();
      setCongregations(cached.length > 0 ? cached : DEFAULT_CONGREGATIONS);
      setLoading(false);
      return;
    }
    try {
      const data = await loadCongregationsWithSeed();
      const names = data.map((c) => c.name).filter(Boolean);
      setCongregations(names);
      await cacheCongregationNames(names);
    } catch {
      const cached = await getCachedCongregationNames();
      setCongregations(cached.length > 0 ? cached : DEFAULT_CONGREGATIONS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return { congregations, loading, reload: load };
}

// Carrega os circuitos cadastrados (fonte de verdade no banco).
export function useCircuitos() {
  const [circuitos, setCircuitos] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    if (!navigator.onLine) {
      setCircuitos(await getCachedCircuitos());
      setLoading(false);
      return;
    }
    try {
      const data = await api.entities.Circuito.list("name", 200);
      setCircuitos(data);
      await cacheCircuitos(data);
    } catch {
      setCircuitos(await getCachedCircuitos());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  return { circuitos, loading, reload: load };
}

// Carrega os objetos completos de congregação (com circuito_id).
export function useCongregationObjects() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    if (!navigator.onLine) {
      setItems(await getCachedCongregationObjects());
      setLoading(false);
      return;
    }
    try {
      const data = await loadCongregationsWithSeed();
      setItems(data);
      await cacheCongregationObjects(data);
    } catch {
      setItems(await getCachedCongregationObjects());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  return { items, loading, reload: load };
}

// Mapa nome da congregação -> circuito_id (uma única query).
// Usado ao importar/criar endereços para garantir o isolamento por circuito.
export async function fetchCircuitoMap() {
  try {
    const data = await api.entities.Congregation.list("name", 500);
    const map = {};
    data.forEach((c) => { if (c.name && c.circuito_id) map[c.name] = c.circuito_id; });
    return map;
  } catch {
    return {};
  }
}

let _migrated = false;

// Migração única: cria um "Circuito Padrão" e atribui a ele todas as
// congregações e usuários existentes que ainda não têm circuito.
// Executa apenas para o administrador geral.
export async function ensureCircuitMigration(user) {
  if (!user) return;
  if (normalizeRole(user.role) !== "admin") return;
  if (_migrated) return;
  _migrated = true;
  try {
    // Compartilha a inicialização com os hooks para evitar a criação paralela
    // de circuitos/congregações na primeira abertura do sistema.
    const congs = await loadCongregationsWithSeed();
    let circuitos = await api.entities.Circuito.list("name", 200);
    let padrao = circuitos.find((c) => c.name === "Circuito Padrão");
    if (!padrao) {
      padrao = await api.entities.Circuito.create({ name: "Circuito Padrão" });
    }
    const padraoId = padrao.id;

    const congsToUpdate = congs
      .filter((c) => !c.circuito_id)
      .map((c) => ({ id: c.id, circuito_id: padraoId, circuito: "Circuito Padrão" }));
    if (congsToUpdate.length) {
      await api.entities.Congregation.bulkUpdate(congsToUpdate);
    }

    const users = await api.entities.User.list("-created_date", 500);
    const usersToUpdate = users
      .filter((u) => !u.circuito_id && normalizeRole(u.role) !== "admin")
      .map((u) => ({ id: u.id, circuito_id: padraoId }));
    if (usersToUpdate.length) {
      try { await api.entities.User.bulkUpdate(usersToUpdate); } catch {}
    }
  } catch {}
}
