import { useEffect, useMemo, useState } from "react";
import { House, Loader2, Pencil, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { normalizeRole } from "@/lib/permissions";

const emptyForm = { id: null, name: "", circuito_id: "" };

export default function Congregations() {
  const [currentUser, setCurrentUser] = useState(null);
  const [circuitos, setCircuitos] = useState([]);
  const [congregacoes, setCongregacoes] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [query, setQuery] = useState("");

  const role = normalizeRole(currentUser?.role);
  const isAdmin = role === "admin";
  const userCircuitoId = currentUser?.circuito_id || "";

  const load = async () => {
    setLoading(true);
    try {
      const [me, circuitList, congregationList] = await Promise.all([
        api.auth.me(),
        api.entities.Circuito.list("name", 500),
        api.entities.Congregation.list("name", 1000),
      ]);
      setCurrentUser(me);
      setCircuitos(circuitList || []);
      setCongregacoes(congregationList || []);
      if (normalizeRole(me?.role) !== "admin" && me?.circuito_id) {
        setForm((prev) => ({ ...prev, circuito_id: me.circuito_id }));
      }
    } catch (error) {
      toast.error(error?.message || "Não foi possível carregar as congregações.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const visibleCongregacoes = useMemo(() => {
    let rows = congregacoes;
    if (!isAdmin && userCircuitoId) {
      rows = rows.filter((item) => item.circuito_id === userCircuitoId);
    }
    const text = query.trim().toLowerCase();
    if (text) {
      rows = rows.filter((item) =>
        String(item.name || "").toLowerCase().includes(text) ||
        String(item.circuito || "").toLowerCase().includes(text)
      );
    }
    return rows;
  }, [congregacoes, isAdmin, userCircuitoId, query]);

  const resetForm = () => {
    setForm({ ...emptyForm, circuito_id: !isAdmin ? userCircuitoId : "" });
  };

  const handleEdit = (item) => {
    setForm({ id: item.id, name: item.name || "", circuito_id: item.circuito_id || "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const name = form.name.trim();
    const circuitoId = isAdmin ? form.circuito_id : userCircuitoId;
    if (!name) return toast.error("Informe o nome da congregação.");
    if (!circuitoId) return toast.error("Selecione o circuito.");

    const duplicate = congregacoes.some((item) =>
      item.id !== form.id && String(item.name || "").trim().toLowerCase() === name.toLowerCase()
    );
    if (duplicate) return toast.error("Já existe uma congregação com esse nome.");

    const circuito = circuitos.find((item) => item.id === circuitoId);
    if (!circuito) return toast.error("Circuito inválido.");

    setSaving(true);
    try {
      const payload = { name, circuito_id: circuitoId, circuito: circuito.name };
      if (form.id) {
        await api.entities.Congregation.update(form.id, payload);
        toast.success("Congregação atualizada com sucesso.");
      } else {
        await api.entities.Congregation.create(payload);
        toast.success("Congregação cadastrada com sucesso.");
      }
      resetForm();
      await load();
    } catch (error) {
      toast.error(error?.message || "Erro ao salvar congregação.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await api.entities.Congregation.delete(deleting.id);
      toast.success("Congregação excluída com sucesso.");
      if (form.id === deleting.id) resetForm();
      setDeleting(null);
      await load();
    } catch (error) {
      toast.error(error?.message || "Erro ao excluir congregação.");
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <House className="h-6 w-6 text-primary" />
            <h1 className="font-heading text-2xl font-bold">Cadastro de Congregações</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Cadastre, altere e organize as congregações por circuito.</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 md:p-6 shadow-sm">
        <h2 className="font-heading font-semibold text-lg mb-4">{form.id ? "Editar congregação" : "Nova congregação"}</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-4 items-end">
          <div className="space-y-2">
            <Label htmlFor="congregation-name">Nome da congregação</Label>
            <Input
              id="congregation-name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Ex.: Centro Língua de Sinais"
              maxLength={150}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Circuito</Label>
            <Select
              value={isAdmin ? form.circuito_id : userCircuitoId}
              onValueChange={(value) => setForm((prev) => ({ ...prev, circuito_id: value }))}
              disabled={!isAdmin}
            >
              <SelectTrigger><SelectValue placeholder="Selecione o circuito" /></SelectTrigger>
              <SelectContent>
                {circuitos
                  .filter((item) => isAdmin || item.id === userCircuitoId)
                  .map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            {form.id && (
              <Button type="button" variant="outline" size="icon" onClick={resetForm} title="Cancelar edição">
                <X className="h-4 w-4" />
              </Button>
            )}
            <Button type="submit" className="gap-2 min-w-32" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : form.id ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {form.id ? "Salvar" : "Cadastrar"}
            </Button>
          </div>
        </form>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="font-heading font-semibold text-lg">Congregações cadastradas</h2>
            <p className="text-xs text-muted-foreground">{visibleCongregacoes.length} registro(s)</p>
          </div>
          <Input className="sm:max-w-xs" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Pesquisar congregação..." />
        </div>

        {loading ? (
          <div className="py-16 flex justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
        ) : visibleCongregacoes.length === 0 ? (
          <div className="py-14 text-center text-sm text-muted-foreground">Nenhuma congregação encontrada.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-5 py-3">Congregação</th>
                  <th className="text-left font-medium px-5 py-3">Circuito</th>
                  <th className="text-right font-medium px-5 py-3 w-36">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleCongregacoes.map((item) => (
                  <tr key={item.id} className="hover:bg-secondary/20">
                    <td className="px-5 py-3 font-medium">{item.name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{item.circuito || circuitos.find((c) => c.id === item.circuito_id)?.name || "—"}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(item)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleting(item)} title="Excluir" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir congregação?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? `A congregação “${deleting.name}” será removida. Esta ação não pode ser desfeita.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
