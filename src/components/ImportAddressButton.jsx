import { useRef, useState } from "react";
import { Upload, Loader2, FileJson, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const FIELD_ALIASES = {
  name: ["name", "nome", "nome_completo", "fullName"],
  gender: ["gender", "genero", "sexo"],
  age: ["age", "idade"],
  phone: ["phone", "telefone", "tel", "celular"],
  street: ["street", "rua", "endereco", "address", "logradouro"],
  neighborhood: ["neighborhood", "bairro"],
  city: ["city", "cidade"],
  state: ["state", "estado", "uf"],
  zip_code: ["zip_code", "cep", "zip", "postalcode"],
  lat: ["lat", "latitude"],
  lng: ["lng", "lon", "longitude"],
  maps_link: ["maps_link", "mapslink", "google_maps", "link", "url"],
  congregation: ["congregation", "congregacao"],
  observations: ["observations", "observacoes", "obs", "notes", "notas"],
  reference_point: ["reference_point", "referencia", "ponto_referencia"],
  best_time: ["best_time", "melhor_horario", "horario"],
  sign_language_level: ["sign_language_level", "libras", "nivel_libras", "lsm", "nivel_lsm"],
  status: ["status", "situacao"],
  last_visit_date: ["last_visit_date", "ultima_visita_data", "data_ultima_visita", "last_visit"],
  last_visit_time: ["last_visit_time", "ultima_visita_hora", "hora_ultima_visita"],
  last_visited_by: ["last_visited_by", "visitado_por", "ultima_visita_por"],
  visit_count: ["visit_count", "total_visitas", "visitas", "numero_visitas"],
};

const normalizeKey = (key) => key.trim().toLowerCase().replace(/\s+/g, "_");

const mapRecord = (raw) => {
  const result = {};
  const normalized = {};
  Object.keys(raw).forEach(k => { normalized[normalizeKey(k)] = raw[k]; });

  Object.entries(FIELD_ALIASES).forEach(([field, aliases]) => {
    for (const alias of aliases) {
      if (normalized[alias] !== undefined && normalized[alias] !== null && normalized[alias] !== "") {
        result[field] = String(normalized[alias]).trim();
        break;
      }
    }
  });
  return result;
};

const parseCSV = (text) => {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const values = [];
    let current = "";
    let inQuotes = false;
    for (let j = 0; j < lines[i].length; j++) {
      const ch = lines[i][j];
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === "," && !inQuotes) { values.push(current); current = ""; continue; }
      current += ch;
    }
    values.push(current);
    const record = {};
    headers.forEach((h, idx) => { record[h] = (values[idx] || "").trim(); });
    records.push(record);
  }
  return records;
};

export default function ImportAddressButton({ onImport, disabled }) {
  const inputRef = useRef(null);
  const [importing, setImporting] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      let records = [];

      if (file.name.endsWith(".json")) {
        const parsed = JSON.parse(text);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        records = arr.map(r => mapRecord(r));
      } else if (file.name.endsWith(".csv")) {
        records = parseCSV(text).map(r => mapRecord(r));
      } else {
        toast.error("Formato não suportado. Use JSON ou CSV.");
        return;
      }

      if (records.length === 0) {
        toast.error("Nenhum endereço encontrado no arquivo.");
        return;
      }

      onImport(records[0]);
      if (records.length > 1) {
        toast.success(`Primeiro endereço carregado! (${records.length} encontrados no arquivo)`);
      } else {
        toast.success("Endereço importado! Revise os dados antes de salvar.");
      }
    } catch {
      toast.error("Erro ao ler o arquivo. Verifique o formato.");
    } finally {
      setImporting(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="gap-2 rounded-lg ml-3 h-10 px-5 text-sm"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || importing}
      >
        {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        {importing ? "Importando..." : "Importar Arquivo"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".json,.csv"
        className="hidden"
        onChange={handleFile}
      />
    </>
  );
}