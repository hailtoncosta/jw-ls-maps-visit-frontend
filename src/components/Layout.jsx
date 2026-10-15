import { Outlet, Link, useLocation } from "react-router-dom";
import { useState, useEffect, Fragment } from "react";
import { MapPin, Home, Plus, ListFilter, Printer, Settings, Menu, LogOut, Users, Map, Shield, Briefcase, BarChart3, User, GitMerge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/api/apiClient";
import { getMenuForUser, hasPermission, normalizeRole, ROLE_LABELS } from "@/lib/permissions";
import { ensureCircuitMigration } from "@/lib/congregations";
import { useAuth } from "@/lib/AuthContext";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useTranslation } from "@/lib/i18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ConnectionStatusBadge from "@/components/ConnectionStatusBadge";

const ICON_MAP = { Home, ListFilter, Plus, Map, Printer, Shield, Settings, Briefcase, BarChart3, User };

const isMenuActive = (pathname, path) => {
  if (path === "/") return pathname === "/";
  if (path === "/addresses") {
    return pathname === "/addresses" ||
      (pathname.startsWith("/addresses/") && pathname !== "/addresses/new");
  }
  if (path === "/addresses/new") return pathname === path;
  return pathname === path || pathname.startsWith(`${path}/`);
};

export default function Layout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();
  useOfflineSync();

  useEffect(() => {
    if (user) ensureCircuitMigration(user);
  }, [user]);

  useEffect(() => {
    const applyDark = (dark) => {
      document.documentElement.classList.toggle("dark", dark);
    };
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    applyDark(mq.matches);
    mq.addEventListener("change", (e) => applyDark(e.matches));
    return () => mq.removeEventListener("change", () => {});
  }, []);

  const role = normalizeRole(user?.role);
  const canSeeDuplicates = ["elder", "superintendente", "admin"].includes(role);
  const { t } = useTranslation();
  const menuItems = getMenuForUser(user);
  const roleLabel = ROLE_LABELS[role];
  const [resetKey, setResetKey] = useState(0);

  const handleLogout = () => {
    api.auth.logout("/");
  };

  const allBottomTabs = [
    { path: "/", labelKey: "tab.home", icon: Home, permission: "page_home" },
    { path: "/addresses", labelKey: role === "publisher" ? "tab.my" : "tab.addresses", icon: ListFilter, permission: "page_addresses" },
    { path: "/addresses/new", labelKey: "tab.new", icon: Plus, permission: "page_new_address" },
    { path: "/map", labelKey: "tab.map", icon: Map, permission: "page_map" },
    { path: "/settings", labelKey: "tab.settings", icon: Settings, permission: "page_settings" },
  ];
  const bottomTabs = allBottomTabs.filter(tab => hasPermission(user, tab.permission));

  return (
    <div className="min-h-screen bg-background flex">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`no-print fixed lg:sticky top-0 left-0 z-50 h-screen w-72 bg-card border-r border-border flex flex-col transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="p-6 border-b border-border" style={{ paddingTop: `max(1.5rem, env(safe-area-inset-top))` }}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <MapPin className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-heading font-bold text-lg text-foreground leading-tight">{t("app.title")}</h1>
              <p className="text-xs text-muted-foreground">{t("app.subtitle")}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = isMenuActive(location.pathname, item.path);
            const Icon = ICON_MAP[item.icon];
            const label = role === "publisher" && item.publisherLabel ? t(item.publisherLabel) : t(item.label);
            return (
              <Fragment key={item.path}>
                <Link
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all select-none ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  {Icon && <Icon className="h-5 w-5" />}
                  {label}
                </Link>
                {item.path === "/progress" && canSeeDuplicates && (
                  <Link
                    to="/duplicates"
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all select-none ${
                      location.pathname === "/duplicates"
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    <GitMerge className="h-5 w-5" /> {t("menu.duplicates")}
                  </Link>
                )}
              </Fragment>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          {user && (
            <div className="flex items-center gap-3 mb-3 px-2">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{user.full_name || "Membro"}</p>
                  {roleLabel && (
                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium shrink-0">
                      {roleLabel}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                {user.congregation && (
                  <p className="text-xs text-muted-foreground truncate">{user.congregation}</p>
                )}
              </div>
            </div>
          )}
          <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground select-none" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            {t("menu.sign_out")}
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen">
        <div className="no-print hidden lg:flex justify-end items-center gap-4 px-8 py-2 border-b border-border bg-card/50">
          <ConnectionStatusBadge />
          <LanguageSwitcher />
        </div>
        <header
          className="no-print lg:hidden sticky top-0 z-30 bg-card/80 backdrop-blur-xl border-b border-border px-4 flex items-center justify-between select-none"
          style={{
            paddingTop: `max(0.75rem, env(safe-area-inset-top))`,
            paddingLeft: `max(1rem, env(safe-area-inset-left))`,
            paddingRight: `max(1rem, env(safe-area-inset-right))`,
            paddingBottom: "0.75rem",
          }}
        >
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <span className="font-heading font-bold">{t("app.title")}</span>
          </div>
          <div className="flex items-center gap-2">
            <ConnectionStatusBadge compact />
            <LanguageSwitcher />
          </div>
        </header>

        <main key={resetKey} className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-24 lg:pb-8">
          <Outlet />
        </main>
      </div>

      <nav
        className="no-print lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-xl border-t border-border flex items-stretch select-none"
        style={{
          paddingBottom: `env(safe-area-inset-bottom)`,
          paddingLeft: `env(safe-area-inset-left)`,
          paddingRight: `env(safe-area-inset-right)`,
        }}
      >
        {bottomTabs.map((tab) => {
          const isActive = isMenuActive(location.pathname, tab.path);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              onClick={() => {
                if (isActive) {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                  // Aba ativa já na raiz: força remontagem para resetar a tela.
                  if (location.pathname === tab.path) setResetKey((k) => k + 1);
                }
              }}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className={`h-5 w-5 ${tab.path === "/addresses/new" ? `rounded-full p-0.5 h-7 w-7 ${isActive ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}` : ""}`} />
              {t(tab.labelKey)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
