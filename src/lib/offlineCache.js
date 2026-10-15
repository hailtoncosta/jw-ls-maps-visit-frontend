// Cache de dados de referência em IndexedDB para uso offline.
// Quando online, os hooks sincronizam estes caches; quando offline,
// os selects e formulários usam estes dados.
import { idbGet, idbSet } from "./idb";

// Congregações (nomes)
export async function cacheCongregationNames(names) {
  await idbSet("congregation_names", names);
}
export async function getCachedCongregationNames() {
  return (await idbGet("congregation_names")) || [];
}

// Objetos de congregação (com circuito_id)
export async function cacheCongregationObjects(items) {
  await idbSet("congregation_objects", items);
}
export async function getCachedCongregationObjects() {
  return (await idbGet("congregation_objects")) || [];
}

// Circuitos
export async function cacheCircuitos(items) {
  await idbSet("circuitos", items);
}
export async function getCachedCircuitos() {
  return (await idbGet("circuitos")) || [];
}

// Configuração de idioma do circuito
export async function cacheCircuitConfig(configs) {
  await idbSet("circuit_config", configs);
}
export async function getCachedCircuitConfig() {
  return (await idbGet("circuit_config")) || [];
}

// Perfil do usuário
export async function cacheUserProfile(user) {
  await idbSet("user_profile", user);
}
export async function getCachedUserProfile() {
  return await idbGet("user_profile");
}