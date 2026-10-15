import { useConnectionStatus } from "@/hooks/useConnectionStatus";
import { useTranslation } from "@/lib/i18n";
import { Wifi, WifiOff, CloudUpload } from "lucide-react";

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function ConnectionStatusBadge({ compact = false }) {
  const { online, pendingCount, lastSync } = useConnectionStatus();
  const { t } = useTranslation();

  if (compact) {
    return (
      <span
        className={`flex items-center gap-1 text-xs font-medium ${
          online ? "text-emerald-600" : "text-amber-600"
        }`}
      >
        {online ? (
          <Wifi className="h-3.5 w-3.5" />
        ) : (
          <WifiOff className="h-3.5 w-3.5" />
        )}
        {pendingCount > 0 && (
          <span className="bg-amber-500 text-white rounded-full px-1.5 text-[10px] leading-4">
            {pendingCount}
          </span>
        )}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-3 text-xs">
      <span
        className={`flex items-center gap-1 font-medium ${
          online ? "text-emerald-600" : "text-amber-600"
        }`}
      >
        {online ? (
          <Wifi className="h-3.5 w-3.5" />
        ) : (
          <WifiOff className="h-3.5 w-3.5" />
        )}
        {online ? t("status.online") : t("status.offline")}
      </span>
      {pendingCount > 0 && (
        <span className="flex items-center gap-1 text-amber-600">
          <CloudUpload className="h-3.5 w-3.5" />
          {t("status.pending", { n: pendingCount })}
        </span>
      )}
      {pendingCount === 0 && lastSync && online && (
        <span className="text-muted-foreground hidden xl:inline">
          {t("status.last_sync", { time: formatTime(lastSync) })}
        </span>
      )}
    </div>
  );
}