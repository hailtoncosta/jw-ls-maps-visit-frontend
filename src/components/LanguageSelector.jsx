import { useState, useMemo, useEffect } from "react";
import { api } from "@/api/apiClient";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandGroup, CommandItem, CommandSeparator } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Check, ChevronDown, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";

// Seletor de idioma pesquisável com catálogo abrangente (línguas faladas e de sinais).
// Permite pesquisar por nome, nome alternativo ou código.
// Inclui opção "+ Adicionar novo idioma" com verificação de duplicados.
export default function LanguageSelector({ value, onChange, placeholder, circuitoId, user }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newLang, setNewLang] = useState({ name: "", alternate_name: "", code: "" });
  const [adding, setAdding] = useState(false);
  const [languages, setLanguages] = useState([]);
  const { t } = useTranslation();

  const loadLanguages = async () => {
    const list = await api.entities.Language.list("name", 500).catch(() => []);
    setLanguages(list);
  };

  useEffect(() => { loadLanguages(); }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return languages;
    const s = search.toLowerCase();
    return languages.filter((l) =>
      (l.name || "").toLowerCase().includes(s) ||
      (l.alternate_name || "").toLowerCase().includes(s) ||
      (l.code || "").toLowerCase().includes(s)
    );
  }, [languages, search]);

  const handleAdd = async () => {
    const trimmedName = newLang.name.trim();
    if (!trimmedName) return;

    // Verificação de duplicados (nome ou nome alternativo)
    const existing = languages.find((l) =>
      (l.name || "").toLowerCase() === trimmedName.toLowerCase() ||
      (l.alternate_name || "").toLowerCase() === trimmedName.toLowerCase()
    );
    if (existing) {
      toast.info(t("language_catalog.already_exists"));
      onChange(existing.name);
      setShowAddDialog(false);
      setOpen(false);
      setNewLang({ name: "", alternate_name: "", code: "" });
      return;
    }

    setAdding(true);
    try {
      await api.entities.Language.create({
        name: trimmedName,
        alternate_name: newLang.alternate_name.trim(),
        code: newLang.code.trim(),
        is_custom: true,
        circuito_id: circuitoId || "",
        created_by_name: user?.full_name || "",
      });
      toast.success(t("language_catalog.added"));
      onChange(trimmedName);
      setNewLang({ name: "", alternate_name: "", code: "" });
      setShowAddDialog(false);
      setOpen(false);
      await loadLanguages();
    } catch {
      toast.error(t("language_catalog.add_error"));
    } finally {
      setAdding(false);
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            {value || <span className="text-muted-foreground">{placeholder}</span>}
            <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0" align="start" style={{ width: "var(--radix-popover-trigger-width)" }}>
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={t("language_catalog.search")}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {filtered.length === 0 && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {t("language_catalog.no_results")}
                </div>
              )}
              <CommandGroup>
                {filtered.map((lang) => (
                  <CommandItem
                    key={lang.id}
                    value={lang.name}
                    onSelect={() => {
                      onChange(lang.name);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === lang.name ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="truncate">{lang.name}</span>
                      {lang.alternate_name && (
                        <span className="text-xs text-muted-foreground truncate">
                          {lang.alternate_name}
                        </span>
                      )}
                    </div>
                    {lang.is_custom && (
                      <Badge variant="secondary" className="ml-2 shrink-0 text-[10px]">
                        {t("language_catalog.custom")}
                      </Badge>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setShowAddDialog(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t("language_catalog.add_new")}
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("language_catalog.add_new")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>{t("language_catalog.name")}</Label>
              <Input
                value={newLang.name}
                onChange={(e) => setNewLang((p) => ({ ...p, name: e.target.value }))}
                placeholder="Portuguese Sign Language"
                autoFocus
              />
            </div>
            <div>
              <Label>{t("language_catalog.alternate_name")}</Label>
              <Input
                value={newLang.alternate_name}
                onChange={(e) => setNewLang((p) => ({ ...p, alternate_name: e.target.value }))}
                placeholder="LGP"
              />
            </div>
            <div>
              <Label>{t("language_catalog.code")}</Label>
              <Input
                value={newLang.code}
                onChange={(e) => setNewLang((p) => ({ ...p, code: e.target.value }))}
                placeholder="psr"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleAdd}
              disabled={!newLang.name.trim() || adding}
              className="gap-2"
            >
              {adding && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("language_catalog.add_btn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}