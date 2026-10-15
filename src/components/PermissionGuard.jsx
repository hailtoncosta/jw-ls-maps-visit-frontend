import { Shield } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { hasPermission } from "@/lib/permissions";

export default function PermissionGuard({ permission, children }) {
  const { user, isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !hasPermission(user, permission)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="h-14 w-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <Shield className="h-7 w-7 text-destructive" />
        </div>
        <h2 className="font-heading font-bold text-xl">Acesso Restrito</h2>
        <p className="text-muted-foreground text-sm text-center max-w-sm">
          Você não tem permissão para acessar esta página.
        </p>
      </div>
    );
  }

  return children;
}