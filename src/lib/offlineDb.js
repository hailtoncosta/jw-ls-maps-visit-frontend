import { api } from "@/api/apiClient";

// Banco de dados local do aparelho (localStorage) para modo offline.
// - Fila de operações pendentes (criar / editar / visita) aguardando sincronização
// - Caches de endereços, visitas, compartilhados, territórios e populações

const PENDING_OPS_KEY = "ls_offline_pending_ops";
const CACHE_ADDRESSES = "ls_offline_address_cache";
const CACHE_VISITS = "ls_offline_visits_cache";
const CACHE_SHARED = "ls_offline_shared_cache";
const CACHE_MY_TERR = "ls_offline_my_terr_cache";
const CACHE_OVERRIDES = "ls_offline_overrides_cache";

function read(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function newClientId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/* ===== Fila de operações pendentes ===== */

export function listPendingOps() {
  return read(PENDING_OPS_KEY, []);
}

export function pendingOpsCount() {
  return listPendingOps().length;
}

export function removePendingOp(clientId) {
  write(PENDING_OPS_KEY, listPendingOps().filter((p) => p.clientId !== clientId));
}

export function updatePendingOp(clientId, updates) {
  const list = listPendingOps().map((p) =>
    p.clientId === clientId ? { ...p, ...updates } : p
  );
  write(PENDING_OPS_KEY, list);
}

export function savePendingOp(op) {
  const list = listPendingOps();
  const entry = { clientId: newClientId(), createdAt: new Date().toISOString(), ...op };
  list.push(entry);
  write(PENDING_OPS_KEY, list);
  applyOpToCache(entry);
  return entry;
}

export function savePendingCreate(data) {
  return savePendingOp({ op: "create", data });
}

export function savePendingUpdate(addressId, data) {
  const list = listPendingOps();
  const existing = list.find((p) => p.op === "update" && p.addressId === addressId);
  if (existing) {
    existing.data = { ...existing.data, ...data };
    write(PENDING_OPS_KEY, list);
    applyOpToCache(existing);
    return existing;
  }
  return savePendingOp({ op: "update", addressId, data });
}

export function savePendingVisit(visitData, addressUpdate) {
  return savePendingOp({ op: "visit", visit: visitData, addressUpdate });
}

// Sincroniza todas as operações pendentes, removendo as bem-sucedidas.
export async function syncPendingOps(onProgress) {
  const list = listPendingOps();
  if (list.length === 0) return { synced: 0, failed: 0 };
  let synced = 0;
  let failed = 0;
  const now = Date.now();
  for (const entry of [...list]) {
    // Pula operações em backoff (retry progressivo)
    if (entry.next_retry_at && new Date(entry.next_retry_at).getTime() > now) {
      failed += 1;
      continue;
    }
    try {
      if (entry.op === "create") {
        const dataWithKey = { ...entry.data, idempotency_key: entry.clientId };
        await api.functions.invoke("saveAddress", { address_data: dataWithKey });
      } else if (entry.op === "update") {
        await api.functions.invoke("saveAddress", { address_data: { ...entry.data, idempotency_key: entry.clientId }, address_id: entry.addressId });
      } else if (entry.op === "visit") {
        await api.entities.VisitHistory.create({ ...entry.visit, idempotency_key: entry.clientId });
        const aid = entry.visit?.address_id;
        if (entry.addressUpdate && aid) {
          await api.entities.Address.update(aid, entry.addressUpdate).catch(() => {});
        }
        if (aid) {
          try { await api.functions.invoke("releaseSharedAddress", { address_id: aid }); } catch {}
        }
      }
      removePendingOp(entry.clientId);
      synced += 1;
      onProgress?.(synced, failed);
    } catch (err) {
      // Retry progressivo: 2^n segundos, máximo 5 minutos
      const retryCount = (entry.retry_count || 0) + 1;
      const backoffMs = Math.min(1000 * Math.pow(2, retryCount), 300000);
      const nextRetry = new Date(Date.now() + backoffMs).toISOString();
      updatePendingOp(entry.clientId, {
        retry_count: retryCount,
        last_error: (err && err.message) || "unknown",
        next_retry_at: nextRetry,
        status: "pending",
      });
      failed += 1;
    }
  }
  if (synced > 0) {
    try { localStorage.setItem("ls_last_sync", new Date().toISOString()); } catch {}
  }
  return { synced, failed };
}

/* ===== Aplicar operação pendente ao cache local (reflete offline imediatamente) ===== */

export function applyOpToCache(entry) {
  if (entry.op === "create") {
    const addresses = getCachedAddresses();
    const tempId = entry.clientId;
    const addr = { ...entry.data, id: tempId, _pending: true, created_date: entry.createdAt, updated_date: entry.createdAt };
    cacheAddresses([addr, ...addresses.filter((a) => a.id !== tempId)]);
  } else if (entry.op === "update") {
    const addresses = getCachedAddresses().map((a) =>
      a.id === entry.addressId ? { ...a, ...entry.data, _pending: true } : a
    );
    cacheAddresses(addresses);
  } else if (entry.op === "visit") {
    const visits = getCachedVisits();
    const tempVisit = { ...entry.visit, id: entry.clientId, _pending: true, created_date: entry.createdAt };
    cacheVisits([tempVisit, ...visits.filter((v) => v.id !== entry.clientId)]);
    const aid = entry.visit?.address_id;
    if (entry.addressUpdate && aid) {
      const addresses = getCachedAddresses().map((a) =>
        a.id === aid ? { ...a, ...entry.addressUpdate, _pending: true } : a
      );
      cacheAddresses(addresses);
    }
  }
}

/* ===== Caches de consulta offline ===== */

export function cacheAddresses(addresses) {
  write(CACHE_ADDRESSES, { ts: Date.now(), addresses });
}
export function getCachedAddresses() {
  const c = read(CACHE_ADDRESSES, null);
  return c?.addresses || [];
}

export function cacheVisits(visits) {
  write(CACHE_VISITS, { ts: Date.now(), visits });
}
export function getCachedVisits() {
  const c = read(CACHE_VISITS, null);
  return c?.visits || [];
}

export function cacheSharedAddresses(addresses) {
  write(CACHE_SHARED, { ts: Date.now(), addresses });
}
export function getCachedSharedAddresses() {
  const c = read(CACHE_SHARED, null);
  return c?.addresses || [];
}

export function cacheMyTerritories(data) {
  write(CACHE_MY_TERR, { ts: Date.now(), data });
}
export function getCachedMyTerritories() {
  const c = read(CACHE_MY_TERR, null);
  return c?.data || null;
}

export function cacheOverrides(overrides) {
  write(CACHE_OVERRIDES, { ts: Date.now(), overrides });
}
export function getCachedOverrides() {
  const c = read(CACHE_OVERRIDES, null);
  return (c?.overrides && typeof c.overrides === "object") ? c.overrides : {};
}

/* ===== Compatibilidade com versão anterior ===== */

export const listPending = listPendingOps;
export const pendingCount = pendingOpsCount;
export const removePending = removePendingOp;
export function savePending(data) {
  return savePendingCreate(data);
}
export async function syncPending(onProgress) {
  return syncPendingOps(onProgress);
}