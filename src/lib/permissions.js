import { api } from "@/api/apiClient";

export const ROLES = {
  PUBLISHER: "publisher",
  HELPER: "helper",
  ELDER: "elder",
  SUPERINTENDENTE: "superintendente",
  ADMIN: "admin",
};

export const ROLE_LABELS = {
  publisher: "Publicador",
  helper: "Ajudante",
  elder: "Ancião",
  superintendente: "Superintendente de Circuito",
  admin: "Administrador Geral",
};

export function normalizeRole(role) {
  if (role === "user") return "publisher";
  return role || "publisher";
}

// Permission categories organized for the admin UI
export const PERMISSION_CATEGORIES = {
  pages: {
    label: "Páginas",
    permissions: [
      { key: "page_home", label: "Início" },
      { key: "page_addresses", label: "Endereços" },
      { key: "page_new_address", label: "Novo Endereço" },
      { key: "page_map", label: "Mapa" },
      { key: "page_visit_cards", label: "Territórios" },
      { key: "page_my_territories", label: "Meus Territórios" },
      { key: "page_progress", label: "Progresso do Território" },
      { key: "page_reports", label: "Relatórios" },
      { key: "page_users", label: "Usuários" },
      { key: "page_congregations", label: "Congregações" },
      { key: "page_settings", label: "Configurações" },
    ],
  },
  addresses: {
    label: "Permissões de Endereços",
    permissions: [
      { key: "action_view", label: "Visualizar endereços", desc: "Permite visualizar os endereços autorizados." },
      { key: "action_edit", label: "Editar endereços", desc: "Permite alterar informações dos endereços autorizados." },
      { key: "action_finish_visit", label: "Finalizar visitas", desc: "Permite finalizar visitas e liberar endereços compartilhados para novo envio." },
      { key: "action_retake", label: "Retomar endereços", desc: "Permite encerrar um compartilhamento e liberar o endereço para novo envio." },
      { key: "action_delete", label: "Excluir endereços", desc: "Permite excluir endereços." },
    ],
  },
  actions: {
    label: "Ações",
    permissions: [
      { key: "action_create", label: "Criar" },
      { key: "action_share", label: "Compartilhar" },
      { key: "action_share_internal", label: "Compartilhar Internamente" },
      { key: "action_import", label: "Importar" },
      { key: "action_export", label: "Exportar" },
    ],
  },
  admin: {
    label: "Administração",
    permissions: [
      { key: "admin_manage_users", label: "Gerenciar Usuários" },
      { key: "admin_change_roles", label: "Alterar Perfis" },
      { key: "admin_manage_congregations", label: "Gerenciar Congregações" },
      { key: "admin_manage_permissions", label: "Gerenciar Permissões" },
      { key: "admin_view_all_congregations", label: "Ver Todas as Congregações" },
      { key: "admin_view_all_addresses", label: "Ver Todos os Endereços" },
      { key: "admin_isolate_circuit", label: "Limitar Acesso a Outros Circuitos" },
      { key: "admin_backup_restore", label: "Backup e Restauração" },
      { key: "admin_trash", label: "Lixeira" },
    ],
  },
};

export const ALL_PERMISSION_KEYS = [
  ...PERMISSION_CATEGORIES.pages.permissions.map(p => p.key),
  ...PERMISSION_CATEGORIES.addresses.permissions.map(p => p.key),
  ...PERMISSION_CATEGORIES.actions.permissions.map(p => p.key),
  ...PERMISSION_CATEGORIES.admin.permissions.map(p => p.key),
];

// Default permissions per role (used when user has no explicit permissions set)
export const DEFAULT_PERMISSIONS = {
  publisher: [
    "page_home", "page_addresses", "page_new_address", "page_map", "page_my_territories", "page_settings",
    "action_view", "action_create", "action_edit", "action_retake", "action_finish_visit", "action_share", "action_share_internal", "action_import",
  ],
  helper: [
    "page_home", "page_addresses", "page_new_address", "page_map", "page_visit_cards", "page_my_territories", "page_progress", "page_settings",
    "action_view", "action_create", "action_edit", "action_retake", "action_finish_visit", "action_share", "action_share_internal", "action_import",
  ],
  elder: [
    "page_home", "page_addresses", "page_new_address", "page_map", "page_visit_cards", "page_my_territories", "page_progress", "page_settings",
    "action_view", "action_create", "action_edit", "action_retake", "action_finish_visit", "action_share", "action_share_internal", "action_import", "action_export",
    "admin_manage_users",
  ],
  // Superintendente de Circuito: TODAS as permissões funcionais disponíveis no
  // aplicativo, porém endereços ficam limitados ao circuito E à congregação.
  // garantido pelos gates de circuito (role === "superintendente") em
  // fetchAddressForUser/fetchAddressesForUser/getScopedAddresses/listCongregationUsers
  // e pelo RLS das entidades — nunca por estas permissões. O acesso global
  // (admin_view_all_*) continua exclusivo de role === "admin", mesmo que o
  // superintendente possua estas permissões. Lista explícita — NÃO usar ["*"].
  superintendente: ALL_PERMISSION_KEYS.filter(key => key !== "admin_view_all_addresses" && key !== "admin_view_all_congregations"),
  admin: ["*"],
};

// Page path → permission key mapping (for route guards)
export const PAGE_PERMISSIONS = {
  "/": "page_home",
  "/addresses": "page_addresses",
  "/addresses/new": "page_new_address",
  "/addresses/:id": "page_addresses",
  "/map": "page_map",
  "/visit-cards": "page_visit_cards",
  "/my-territories": "page_my_territories",
  "/progress": "page_progress",
  "/admin": "admin_manage_users",
  "/congregacoes": "admin_manage_congregations",
  "/admin/backup": "admin_backup_restore",
  "/admin/trash": "admin_trash",
  "/settings": "page_settings",
};

// Get the effective permissions for a user (explicit overrides role defaults)
export function getEffectivePermissions(user) {
  if (!user) return [];
  const role = normalizeRole(user.role);
  if (role === "admin") return ["*"];
  if (user.permissions && Array.isArray(user.permissions) && user.permissions.length > 0) {
    return user.permissions.filter(permission => permission !== "__none__");
  }
  return DEFAULT_PERMISSIONS[role] || [];
}

export function hasPermission(user, permission) {
  if (!user) return false;
  if (["action_share", "action_share_internal"].includes(permission)) return ["publisher", "helper", "elder", "superintendente", "admin"].includes(normalizeRole(user.role));
  const perms = getEffectivePermissions(user);
  return perms.includes("*") || perms.includes(permission);
}

export function hasPagePermission(user, path) {
  const perm = PAGE_PERMISSIONS[path];
  if (!perm) return true;
  return hasPermission(user, perm);
}

// --- Escopo por Circuito ---
// Administrador geral e Superintendente de Circuito gerenciam usuários/congregações.
export function isCircuitManager(user) {
  const role = normalizeRole(user?.role);
  return role === "admin" || role === "superintendente";
}

export function getUserCircuitoId(user) {
  return user?.circuito_id || user?.circuitoId || "";
}

// O administrador do sistema tem acesso global, inclusive em contas antigas.
export function isAdminCircuitIsolated(user) {
  return false;
}

// Congregações (nomes) que pertencem ao circuito visível pelo usuário.
// Admin → todas; Superintendente → do seu circuito; demais → vazio.
export function circuitCongregationNames(user, congObjects) {
  if (!user || !congObjects) return [];
  const role = normalizeRole(user.role);
  if (role === "admin") {
    if (isAdminCircuitIsolated(user)) {
      const userCircuitId = String(getUserCircuitoId(user));
      return congObjects
        .filter(c => String(c.circuito_id || c.circuitoId || "") === userCircuitId)
        .map(c => c.name || c.nome)
        .filter(Boolean);
    }
    return congObjects.map(c => c.name || c.nome).filter(Boolean);
  }
  if (role === "superintendente" && getUserCircuitoId(user)) {
    const userCircuitId = String(getUserCircuitoId(user));
    return congObjects
      .filter(c => String(c.circuito_id || c.circuitoId || "") === userCircuitId
        && normalizeCongregation(c.name || c.nome) === normalizeCongregation(user.congregation))
      .map(c => c.name || c.nome)
      .filter(Boolean);
  }
  return [];
}

// --- Cache nome da congregação -> circuito_id ---
// Populado por fetchAddressesForUser/fetchAddressForUser e por componentes que
// carregam useCongregationObjects. Permite às funções síncronas
// canEditAddress/canDeleteAddress/canShareAddress escopar o superintendente.
let _congCircuitMap = {};

export function setCongregationCircuitCache(congObjects) {
  if (!Array.isArray(congObjects)) return;
  const next = {};
  congObjects.forEach((c) => { if (c.name && c.circuito_id) next[c.name] = c.circuito_id; });
  _congCircuitMap = next;
}

function addressInUserCircuit(user, address) {
  const circuitoId = user?.circuito_id;
  if (!circuitoId) return false;
  if (address?.circuito_id) return address.circuito_id === circuitoId;
  if (!address?.congregation) return false;
  return _congCircuitMap[address.congregation] === circuitoId;
}

function addressInSuperintendentScope(user, address) {
  if (!addressInUserCircuit(user, address) || !normalizeCongregation(user?.congregation)) return false;
  if (user.congregation_id && address?.congregation_id)
    return String(user.congregation_id) === String(address.congregation_id);
  return normalizeCongregation(address?.congregation) === normalizeCongregation(user.congregation);
}

export const MENU_ITEMS = [
  { path: "/", label: "menu.home", icon: "Home", permission: "page_home" },
  { path: "/addresses/new", label: "menu.new_address", icon: "Plus", permission: "page_new_address" },
  { path: "/addresses", label: "menu.addresses", icon: "ListFilter", permission: "page_addresses", publisherLabel: "menu.my_addresses" },
  { path: "/my-territories", label: "menu.my_territories", icon: "Briefcase", permission: "page_my_territories" },
  { path: "/map", label: "menu.map", icon: "Map", permission: "page_map" },
  { path: "/visit-cards", label: "menu.cards", icon: "Printer", permission: "page_visit_cards" },
  { path: "/progress", label: "menu.progress", icon: "BarChart3", permission: "page_progress" },
  { path: "/profile", label: "menu.profile", icon: "User" },
  { path: "/admin", label: "menu.admin", icon: "Shield", permission: "admin_manage_users" },
  { path: "/settings", label: "menu.settings", icon: "Settings", permission: "page_settings" },
];

export function getMenuForUser(user) {
  if (!user) return [];
  return MENU_ITEMS.filter(item => {
    if (!item.permission) return true;
    return hasPermission(user, item.permission);
  });
}

// Backward compat wrapper
export function getMenuForRole(role) {
  return MENU_ITEMS.filter(item => {
    if (!item.permission) return true;
    const perms = DEFAULT_PERMISSIONS[normalizeRole(role)] || [];
    return perms.includes("*") || perms.includes(item.permission);
  });
}

// As ações dependem das permissões individuais sobre endereços acessíveis.
// Preserva as restrições específicas de circuito e de superintendente.
function addressInUserScope(user, address) {
  const role = normalizeRole(user.role);
  if (role === "admin") return !isAdminCircuitIsolated(user) || addressInUserCircuit(user, address);
  if (role === "superintendente") return addressInSuperintendentScope(user, address);
  return true;
}

export function canEditAddress(user, address) {
  if (!user || !address) return false;
  if (!hasPermission(user, "action_edit")) return false;
  return addressInUserScope(user, address);
}

export function canDeleteAddress(user, address) {
  if (!user || !address) return false;
  if (!hasPermission(user, "action_delete")) return false;
  return addressInUserScope(user, address);
}

export function canShareAddress(user, address) {
  if (!user || !address) return false;
  return hasPermission(user, "action_share") && addressInUserScope(user, address);
}

// Normalização simples para comparar nomes de congregação sem depender de
// igualdade literal do texto (espaços duplicados, maiúsculas/minúsculas,
// acentos, espaços nas bordas). Usada apenas para localizar registros —
// NÃO altera o nome armazenado no banco.
export function normalizeCongregation(value) {
  return String(value == null ? "" : value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// A API entrega os endereços cadastrados aos usuários autenticados.
export async function fetchAddressesForUser(user, sort = "-updated_date", limit = 2000, excludeTerritoryOnly = false) {
  if (!user) return [];
  if (!hasPermission(user, "action_view")) return [];
  try {
    const res = await api.functions.invoke("getScopedAddresses", { sort, limit, excludeTerritoryOnly });
    // O Spring Boot devolve /enderecos/scoped como um array JSON direto.
    // Mantemos também compatibilidade com o formato legado { addresses: [] }.
    const payload = res?.data ?? res;
    const addresses = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.addresses)
        ? payload.addresses
        : [];

    const scoped = normalizeRole(user.role) === "superintendente"
      ? addresses.filter((address) => addressInSuperintendentScope(user, address))
      : addresses;
    const ordered = sortItemsByField(scoped, sort);
    return limit ? ordered.slice(0, Number(limit)) : ordered;
  } catch {
    return [];
  }
}

function sortItemsByField(items, sort) {
  if (!sort) return items;
  const descending = String(sort).startsWith("-");
  const field = String(sort).replace(/^-/, "");
  return [...items].sort((a, b) => {
    const left = a?.[field];
    const right = b?.[field];
    if (left == null && right == null) return 0;
    if (left == null) return descending ? 1 : -1;
    if (right == null) return descending ? -1 : 1;
    return String(left).localeCompare(String(right), undefined, { numeric: true }) * (descending ? -1 : 1);
  });
}

export async function fetchAddressForUser(user, addressId) {
  if (!user) return null;
  if (!hasPermission(user, "action_view")) return null;
  const addr = await api.entities.Address.get(addressId);
  if (normalizeRole(user.role) === "superintendente" && !addressInSuperintendentScope(user, addr || {})) return null;
  return addr && !addr.deleted ? addr : null;
}

// Finalização exige permissão e um compartilhamento ativo sob responsabilidade do usuário.
export function canFinishSharedVisit(user, share) {
  if (!user?.id || user.active === false || !share?.id || !hasPermission(user, "action_finish_visit")) return false;
  const role = normalizeRole(user.role);
  if (!["publisher", "helper", "elder", "superintendente", "admin"].includes(role)) return false;
  return role === "admin" || share.shared_by_user_id === user.id || share.shared_with_user_id === user.id;
}

export function canFinishAddressVisit(user, address, share) {
  if (!user?.id || user.active === false || !address || !hasPermission(user, "action_finish_visit")) return false;
  if (!addressInUserScope(user, address)) return false;
  return !share?.id || canFinishSharedVisit(user, share);
}
