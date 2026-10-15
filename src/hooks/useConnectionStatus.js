import { useState, useEffect } from "react";
import { pendingOpsCount } from "@/lib/offlineDb";

// Hook leve que rastreia apenas estado de conexão (sem executar sync).
// O sync em si é responsabilidade do useOfflineSync (montado no Layout).
export function useConnectionStatus() {
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState(() => pendingOpsCount());
  const [lastSync, setLastSync] = useState(() => {
    try {
      return localStorage.getItem("ls_last_sync");
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      setPendingCount(pendingOpsCount());
      try {
        setLastSync(localStorage.getItem("ls_last_sync"));
      } catch {}
    };
    const handleOffline = () => {
      setOnline(false);
      setPendingCount(pendingOpsCount());
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    // Polling leve para atualizar contador e lastSync
    const interval = setInterval(() => {
      setPendingCount(pendingOpsCount());
      try {
        setLastSync(localStorage.getItem("ls_last_sync"));
      } catch {}
    }, 3000);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  return { online, pendingCount, lastSync };
}