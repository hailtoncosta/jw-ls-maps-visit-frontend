import axios from "axios";

// O frontend local sempre usa o proxy do Vite (/api e /uploads).
// Ignora VITE_API_URL herdada de builds antigos ou do servidor remoto.
const API_URL = "/api";
const TOKEN_KEY = "ls_mapas_visit_access_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) =>
  token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY);

const http = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    if (status === 401 || (status === 403 && error.config?.url === "/users/me")) {
      setToken(null);
      window.dispatchEvent(new CustomEvent("ls-auth-expired"));
    }
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message;
    const e = new Error(message || "Erro na API");
    e.status = status;
    e.data = error.response?.data;
    throw e;
  }
);

const normalize = (value) => value?.data ?? value;
const normalizeUser = (value) => {
  const user = normalize(value);
  return user && {
    ...user,
    publisher_name: user.publisher_name ?? user.full_name ?? user.nome_publicador ?? "",
    default_city: user.default_city ?? user.cidade ?? "",
    default_state: user.default_state ?? user.estado ?? "",
  };
};

export async function downloadSystemBackup() {
  const response = await http.get("/system-backup/export", { responseType: "blob", timeout: 0 });
  const disposition = response.headers["content-disposition"] || "";
  const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || "LSMaps_Backup_Completo.zip";
  const url = URL.createObjectURL(response.data);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}

// Os nomes da entidade Java diferem dos usados pelas telas e pelo cache offline.
const normalizeVisit = (visit) => visit && ({
  ...visit,
  visit_date: visit.visit_date ?? visit.data_visita,
  visit_time: visit.visit_time ?? visit.hora_visita,
  visited_by: visit.visited_by ?? visit.visitado_por,
  result: visit.result ?? visit.resultado,
  congregation: visit.congregation ?? visit.congregacao,
});
const toVisitPayload = (visit) => ({
  ...visit,
  data_visita: visit.visit_date ?? visit.data_visita,
  hora_visita: visit.visit_time ?? visit.hora_visita,
  visitado_por: visit.visited_by ?? visit.visitado_por,
  resultado: visit.result ?? visit.resultado,
  congregacao: visit.congregation ?? visit.congregacao,
});

const sortItems = (items, sort) => {
  if (!sort || !Array.isArray(items)) return items;
  const desc = String(sort).startsWith("-");
  const field = String(sort).replace(/^-/, "");
  return [...items].sort((a, b) => {
    const av = a?.[field];
    const bv = b?.[field];
    if (av == null && bv == null) return 0;
    if (av == null) return desc ? 1 : -1;
    if (bv == null) return desc ? -1 : 1;
    return (
      String(av).localeCompare(String(bv), undefined, { numeric: true }) *
      (desc ? -1 : 1)
    );
  });
};

const matches = (item, query) =>
  Object.entries(query || {}).every(
    ([key, value]) =>
      String(item?.[key] ?? "").toLowerCase() ===
      String(value ?? "").toLowerCase()
  );

/*
 * Rotas reais do Spring Boot.
 * O client mantém a API de alto nível usada pelas telas React, mas traduz
 * automaticamente para os endpoints existentes no backend.
 */
const endpointMap = {
  Address: { base: "enderecos", list: "scoped", get: (id) => `${id}`, create: "save", update: (id) => `update/${id}`, delete: (id) => `delete/${id}` },
  VisitHistory: { base: "historico-visitas", list: "listAll", get: (id) => `findById/${id}`, create: "save", update: (id) => `update/${id}`, delete: (id) => `delete/${id}` },
  SharedAddress: { base: "endereco-compartilhado", list: "listAll", get: (id) => `findById/${id}`, create: "save", update: (id) => `update/${id}`, delete: (id) => `delete/${id}` },
  Congregation: { base: "congregacoes", list: "listAll", get: (id) => `findById/${id}`, create: "save", update: (id) => `update/${id}`, delete: (id) => `delete/${id}` },
  Circuito: { base: "circuitos", list: "listAll", get: (id) => `findById/${id}`, create: "save", update: (id) => `update/${id}`, delete: (id) => `delete/${id}` },
  User: { base: "users", list: "listAll", get: (id) => `findById/${id}`, create: "save", update: (id) => `update/${id}`, delete: (id) => `delete/${id}` },
  Language: { base: "languages", list: "listAll", get: (id) => `findById/${id}`, create: "save", update: (id) => `update/${id}`, delete: (id) => `delete/${id}` },
  LanguageGoal: { base: "language-gols", list: "listAll", get: (id) => `findById/${id}`, create: "save", update: (id) => `update/${id}`, delete: (id) => `delete/${id}` },
  PopulationOverride: { base: "population-overrides", list: "listAll", get: (id) => `findById/${id}`, create: "save", update: (id) => `update/${id}`, delete: (id) => `delete/${id}` },
  CircuitLanguageConfig: { base: "circuit-language-configs", list: "listAll", get: (id) => `findById/${id}`, create: "save", update: (id) => `update/${id}`, delete: (id) => `delete/${id}` },
  CreatorContact: { base: "creator-contact", list: "listAll", get: (id) => `findById/${id}`, create: "save", update: (id) => `update/${id}`, delete: (id) => `delete/${id}` },
  ContactMessage: { base: "contact-messages", list: "listAll", get: (id) => `findById/${id}`, create: "save", update: (id) => `update/${id}`, delete: (id) => `delete/${id}` },
  DuplicateDecision: { base: "decisoes-duplicadas", list: "listAll", get: (id) => `findById/${id}`, create: "save", update: (id) => `update/${id}`, delete: (id) => `delete/${id}` },
  PendingInvite: { base: "convite-pendente", list: "listAll", get: (id) => `findById/${id}`, create: "save", update: (id) => `update/${id}`, delete: (id) => `delete/${id}` },
  AppManual: { base: "app-manuals", list: "listAll", get: (id) => `findById/${id}`, create: "save", update: (id) => `update/${id}`, delete: (id) => `delete/${id}` },
  CardSequence: { base: "card-sequence", list: "listAll", get: (id) => `findById/${id}`, create: "save", update: (id) => `update/${id}`, delete: (id) => `delete/${id}` },
};

function pathOf(cfg, operation, id) {
  const part = typeof cfg[operation] === "function" ? cfg[operation](id) : cfg[operation];
  return `/${cfg.base}/${part}`;
}

function entity(name) {
  const cfg = endpointMap[name];
  if (!cfg) throw new Error(`Entidade não mapeada: ${name}`);

  return {
    async list(sort, limit) {
      const data = normalize(await http.get(pathOf(cfg, "list")));
      const result = sortItems(name === "VisitHistory" ? data.map(normalizeVisit) : data, sort);
      return limit ? result.slice(0, Number(limit)) : result;
    },
    async get(id) {
      const data = normalize(await http.get(pathOf(cfg, "get", id)));
      return name === "VisitHistory" ? normalizeVisit(data) : data;
    },
    async create(payload) {
      const data = normalize(await http.post(pathOf(cfg, "create"), name === "VisitHistory" ? toVisitPayload(payload) : payload));
      return name === "VisitHistory" ? normalizeVisit(data) : data;
    },
    async update(id, payload) {
      return normalize(await http.put(pathOf(cfg, "update", id), payload));
    },
    async delete(id) {
      return normalize(await http.delete(pathOf(cfg, "delete", id)));
    },
    async filter(query, sort, limit) {
      const data = await this.list(sort);
      const result = data.filter((x) => matches(x, query));
      return limit ? result.slice(0, Number(limit)) : result;
    },
    async bulkCreate(items) {
      return Promise.all((items || []).map((x) => this.create(x)));
    },
    async bulkUpdate(items) {
      return Promise.all(
        (items || []).map(({ id, ...x }) => this.update(id, x))
      );
    },
    async deleteMany(query) {
      const rows = await this.filter(query);
      return Promise.all(rows.map((x) => this.delete(x.id)));
    },
    subscribe(callback, interval = 15000) {
      let active = true;
      const tick = async () => {
        if (!active) return;
        try {
          await callback();
        } catch {}
      };
      const timer = setInterval(tick, interval);
      return () => {
        active = false;
        clearInterval(timer);
      };
    },
  };
}

const functions = {
  async invoke(name, payload = {}) {
    const map = {
      getScopedAddresses: () => http.get("/enderecos/scoped"),
      backfillCardNumbers: () => http.post("/admin/backfill-card-numbers"),
      saveAddress: () =>
        payload.address_id
          ? http.put(`/enderecos/update/${payload.address_id}`, payload.address_data)
          : http.post("/enderecos/save", payload.address_data),
      recordVisit: () => http.post("/visita/record", payload),
      softDeleteAddress: () => http.delete(`/enderecos/delete/${payload.addressId}`),
      transferAddress: () =>
        http.post("/admin/enderecos/transfer", {
          principalId: payload.addressId,
          duplicateId: payload.targetCongregationId,
        }),
      mergeAddresses: () => {
        const p = payload || {};
        return http.post("/admin/enderecos/merge", {
          principalId: p.principalId || p.principal_id || p.addressAId || p.address_a_id,
          duplicateId: p.duplicateId || p.duplicate_id || p.addressBId || p.address_b_id,
        });
      },
      transferCongregationCircuit: () =>
        http.post("/admin/congregations/transfer-circuit", payload),
      listCongregationUsers: () => http.get("/users/share-candidates"),
      updateCongregationUser: () =>
        http.put(`/users/update/${payload.userId}`, payload.updates),
      inviteOrUpdateUser: () =>
        http.post("/users/invite", { email: payload.email, ...payload.updates }),
      transferAdmin: () => http.post("/admin/transfer", payload),
      undoAdminTransfer: () => http.post("/admin/undo-transfer", payload),
      retakeSharedAddress: () =>
        http.post(
          `/endereco-compartilhado/${payload.shared_address_id || payload.address_id}/retake`
        ),
      finishAddressVisit: () => http.post(`/endereco-compartilhado/by-address/${payload.address_id}/finish`),
      finishSharedAddress: () => http.post(`/endereco-compartilhado/${payload.shared_address_id}/finish`),
      releaseSharedAddress: () =>
        payload.shared_address_id
          ? http.delete(`/endereco-compartilhado/${payload.shared_address_id}`)
          : http.delete(`/endereco-compartilhado/by-address/${payload.address_id}`),
      getDigitalCard: () =>
        http.get(`/public/digital-card/${encodeURIComponent(payload.ids || "")}`),
      applyPendingInvite: () => http.post("/convite-pendente/apply"),
    };

    if (!map[name]) throw new Error(`Função não mapeada no backend: ${name}`);
    return await map[name]();
  },
};

// Consulta específica do painel Admin: cada entrada precisa incluir o perfil
// persistido. O parâmetro variável impede respostas HTTP antigas.
export async function listAdminUsers() {
  return normalize(await http.get("/users/listAll", {
    params: { _: Date.now() },
    headers: { "Cache-Control": "no-cache" },
  }));
}

export const api = {
  entities: Object.fromEntries(
    Object.keys(endpointMap).map((name) => [name, entity(name)])
  ),
  functions,
  auth: {
    async requestPasswordReset(email) {
      return normalize(await http.post("/auth/forgot-password", { email }));
    },
    async resetPassword(token, password) {
      return normalize(await http.post("/auth/reset-password", { token, password }));
    },
    async login(email, password) {
      const res = normalize(await http.post("/auth/login", { email, password }));
      setToken(res.token);
      return res.user;
    },
    async me() {
      return normalizeUser(await http.get("/users/me"));
    },
    async updateMe(payload) {
      return normalizeUser(await http.put("/users/me", payload));
    },
    async changePassword(currentPassword, newPassword) {
      return normalize(await http.post("/users/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      }));
    },
    isAuthenticated() {
      return !!getToken();
    },
    logout() {
      setToken(null);
      window.location.href = "/login";
    },
    redirectToLogin() {
      window.location.href = "/login";
    },
  },
  integrations: {
    Core: {
      async UploadFile({ file }) {
        const form = new FormData();
        form.append("file", file);
        const res = await http.post("/files", form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        return normalize(res);
      },
      async InvokeLLM() {
        throw new Error("LLM externo não está disponível nesta versão local.");
      },
    },
  },
};

export { http, API_URL };
