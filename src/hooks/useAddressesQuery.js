import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { fetchAddressesForUser, normalizeRole } from "@/lib/permissions";
import { cacheAddresses, getCachedAddresses } from "@/lib/offlineDb";

// Camada de dados baseada em React Query para a lista de endereços.
// Centraliza fetch + cache compartilhado para que mutações (registro de
// visita e alterações de endereço) possam atualizar a lista de forma
// otimista (antes da validação do backend) com rollback automático em falha.

export const addressesKey = (userId) => ["addresses", userId];

async function fetchAddresses({ user }) {
  if (!navigator.onLine) {
    const cached = getCachedAddresses();
    return { addresses: normalizeRole(user?.role) === "superintendente"
      ? cached.filter((address) => user.circuito_id && address.circuito_id === user.circuito_id)
      : cached, shareMap: {} };
  }
  const data = await fetchAddressesForUser(user, "-updated_date", 0, true);
  cacheAddresses(data);
  let shareMap = {};
  try {
    const shares = await api.entities.SharedAddress.list("-created_date", 0);
    const map = {};
    shares.forEach((s) => {
      if (s.address_id && !map[s.address_id]) {
        map[s.address_id] = {
          id: s.id, shared_by_user_id: s.shared_by_user_id, shared_with_user_id: s.shared_with_user_id,
          name: s.shared_with_name || s.shared_with_user_id,
          created_date: s.created_date,
        };
      }
    });
    shareMap = map;
  } catch {
    shareMap = {};
  }
  return { addresses: data, shareMap };
}

export function useAddressesQuery(user, { enabled = true } = {}) {
  return useQuery({
    queryKey: addressesKey(user?.id),
    queryFn: () => fetchAddresses({ user }),
    enabled: enabled && !!user,
    staleTime: 0,
  });
}

// Atualização otimista genérica do cache de endereços.
function optimisticUpdate(qc, key, updater) {
  const prev = qc.getQueryData(key);
  qc.setQueryData(key, (old) => {
    if (!old) return old;
    return { ...old, addresses: updater(old.addresses) };
  });
  return { prev };
}

// Registro de visita: cria VisitHistory + atualiza o endereço e libera o
// compartilhamento interno. Otimista: aplica addressUpdate à lista imediatamente.
export function useRecordVisitMutation(userId) {
  const qc = useQueryClient();
  const key = addressesKey(userId);
  return useMutation({
    mutationFn: async ({ address, visitPayload, addressUpdate }) => {
      const res = await api.functions.invoke("recordVisit", {
        address_id: address.id,
        visit_payload: visitPayload,
        address_update: addressUpdate,
      });
      return res?.data?.address || res?.data;
    },
    onMutate: async ({ address, addressUpdate }) => {
      await qc.cancelQueries({ queryKey: key });
      const ctx = optimisticUpdate(qc, key, (list) =>
        list.map((a) =>
          a.id === address.id
            ? { ...a, ...addressUpdate, updated_date: new Date().toISOString() }
            : a
        )
      );
      return ctx;
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
    },
  });
}

// Criação/edição de endereço. Otimista apenas para edições (atualiza o
// registro correspondente na lista); criações são refletidas após a invalidação.
export function useSaveAddressMutation(userId) {
  const qc = useQueryClient();
  const key = addressesKey(userId);
  return useMutation({
    mutationFn: async ({ editId, data, visitInfo, form }) => {
      let addressId = editId;
      const res = await api.functions.invoke("saveAddress", {
        address_data: data,
        address_id: editId || undefined,
      });
      const savedAddr = res?.data?.address || res?.address;
      if (savedAddr?.id) addressId = savedAddr.id;
      if (editId) {
        // Confirma os dados no servidor antes de mostrar sucesso e sair da tela.
        const persisted = await api.entities.Address.get(editId);
        const fields = ["name", "congregation", "street", "neighborhood", "city", "state",
          "phone", "observations", "reference_point", "house_photo", "best_time",
          "language", "language_level", "sign_language_level", "status", "situacao"];
        const mismatched = fields.filter((field) =>
          String(persisted?.[field] ?? "") !== String(data[field] ?? "")
        );
        if (mismatched.length) {
          throw new Error(`O servidor não salvou as alterações: ${mismatched.join(", ")}. Reinicie o backend com o JAR atualizado.`);
        }
      }
      if (visitInfo && addressId) {
        await api.entities.VisitHistory.create({
          address_id: addressId,
          address_name: form.name,
          visit_date: visitInfo.date,
          visit_time: visitInfo.time,
          visited_by: visitInfo.by,
          congregation: form.congregation,
          circuito_id: data.circuito_id || "",
          notes: "Visita registrada automaticamente ao detectar coordenadas.",
          result: "Encontrado",
        }).catch(() => {});
      }
      return { addressId };
    },
    onMutate: async ({ editId, data }) => {
      if (!editId) return {};
      await qc.cancelQueries({ queryKey: key });
      const ctx = optimisticUpdate(qc, key, (list) =>
        list.map((a) => (a.id === editId ? { ...a, ...data } : a))
      );
      return ctx;
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
    },
  });
}
