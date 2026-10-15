import { useState, useEffect, useCallback, useRef } from "react";
import { syncPendingOps, pendingOpsCount } from "@/lib/offlineDb";
import { toast } from "sonner";

// Sincroniza automaticamente as operações salvas offline quando a conexão volta.
// Deve ser montado globalmente (ex.: no Layout) para sincronizar de qualquer página.
export function useOfflineSync() {
  const [count, setCount] = useState(() => pendingOpsCount());
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);

  const refreshCount = useCallback(() => setCount(pendingOpsCount()), []);

  const syncNow = useCallback(
    async (silent = false) => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      setSyncing(true);
      try {
        const { synced, failed } = await syncPendingOps();
        refreshCount();
        if (synced > 0) {
          toast.success(
            `${synced} alteração(ões) sincronizada(s) com o servidor${failed > 0 ? ` (${failed} falharam)` : ""}`
          );
        } else if (failed > 0 && !silent) {
          toast.error(`${failed} alteração(ões) não puderam ser sincronizadas`);
        }
      } finally {
        syncingRef.current = false;
        setSyncing(false);
      }
    },
    [refreshCount]
  );

  useEffect(() => {
    const handleOnline = () => syncNow(true);
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && navigator.onLine && pendingOpsCount() > 0) {
        syncNow(true);
      }
    };
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);
    if (navigator.onLine && pendingOpsCount() > 0) syncNow(true);
    return () => {
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [syncNow]);

  return { count, syncing, syncNow, refreshCount };
}