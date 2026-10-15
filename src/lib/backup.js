// Backup/Restore library for LS Maps Visit — pure logic, no SDK calls

export const BACKUP_FORMAT_VERSION = "1.0";

// Generate backup filename: LSMaps_Backup_AAAA-MM-DD.json
export function getBackupFilename() {
  const date = new Date().toISOString().split("T")[0];
  return `LSMaps_Backup_${date}.json`;
}

export function getExportFilename() {
  const date = new Date().toISOString().split("T")[0];
  return `LSMaps_Export_${date}.json`;
}

// Strip auto-managed field that shouldn't be sent on create
function stripAutoFields(record) {
  if (!record) return record;
  const { updated_date, ...rest } = record;
  return rest;
}

// Create the backup JSON structure
export function createBackup(addresses, visits = []) {
  return {
    format_version: BACKUP_FORMAT_VERSION,
    backup_date: new Date().toISOString(),
    type: "LSMaps_Backup",
    total_records: addresses.length,
    addresses: addresses.map(stripAutoFields),
    visits: visits.map(stripAutoFields),
  };
}

// Create an export-only structure (addresses, no visits)
export function createExport(addresses) {
  return {
    format_version: BACKUP_FORMAT_VERSION,
    backup_date: new Date().toISOString(),
    type: "LSMaps_Export",
    total_records: addresses.length,
    addresses: addresses.map(stripAutoFields),
  };
}

// Validate backup file structure
export function validateBackupFile(json) {
  if (!json || typeof json !== "object") {
    return { valid: false, error: "Arquivo não é um JSON válido" };
  }
  if (!json.format_version) {
    return { valid: false, error: "Campo 'format_version' ausente" };
  }
  if (!json.addresses || !Array.isArray(json.addresses)) {
    return { valid: false, error: "Campo 'addresses' ausente ou inválido" };
  }
  return {
    valid: true,
    format_version: json.format_version,
    backup_date: json.backup_date || null,
    type: json.type || "LSMaps_Backup",
    total_records: json.total_records || json.addresses.length,
    addresses: json.addresses,
    visits: Array.isArray(json.visits) ? json.visits : [],
  };
}

// Check if an address is a duplicate of an existing one
// Detection by: ID, phone, or Name + Street + City
export function findDuplicate(addr, existingList) {
  if (!addr || !existingList || existingList.length === 0) return null;

  // By ID
  if (addr.id) {
    const byId = existingList.find(a => a.id === addr.id);
    if (byId) return { type: "id", match: byId };
  }

  // By phone (normalized comparison)
  if (addr.phone) {
    const phone = String(addr.phone).replace(/\D/g, "");
    if (phone.length >= 8) {
      const byPhone = existingList.find(a => {
        if (!a.phone) return false;
        const p = String(a.phone).replace(/\D/g, "");
        return p.length >= 8 && p === phone;
      });
      if (byPhone) return { type: "phone", match: byPhone };
    }
  }

  // By Name + Street + City (case-insensitive, trimmed)
  if (addr.name && addr.street) {
    const norm = (s) => String(s || "").toLowerCase().trim();
    const byNameAddr = existingList.find(a =>
      norm(a.name) === norm(addr.name) &&
      norm(a.street) === norm(addr.street) &&
      norm(a.city) === norm(addr.city)
    );
    if (byNameAddr) return { type: "name_address", match: byNameAddr };
  }

  return null;
}

// Validate a single address record — returns error message or null if valid
export function validateAddressRecord(addr) {
  if (!addr || typeof addr !== "object") return "Registro inválido";
  if (!addr.name || !String(addr.name).trim()) return "Nome é obrigatório";
  if (!addr.congregation || !String(addr.congregation).trim()) return "Congregação é obrigatória";
  return null;
}

// Analyze restore: count new, updatable (by ID), and duplicates
export function analyzeRestore(backupAddresses, existingAddresses) {
  let newCount = 0;
  let updateCount = 0;
  let duplicateCount = 0;

  for (const addr of backupAddresses) {
    const dup = findDuplicate(addr, existingAddresses);
    if (!dup) {
      newCount++;
    } else if (dup.type === "id") {
      updateCount++;
    } else {
      duplicateCount++;
    }
  }

  return {
    total: backupAddresses.length,
    newCount,
    updateCount,
    duplicateCount,
  };
}

// Download JSON data as a file
export function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Read and parse an uploaded JSON file
export function parseJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        resolve(JSON.parse(e.target.result));
      } catch {
        reject(new Error("Arquivo JSON inválido"));
      }
    };
    reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
    reader.readAsText(file);
  });
}

const EXCEL_COLUMNS = [
  { key: "name", label: "Nome" },
  { key: "gender", label: "Gênero" },
  { key: "age", label: "Idade" },
  { key: "street", label: "Rua/Endereço" },
  { key: "neighborhood", label: "Bairro" },
  { key: "city", label: "Cidade/Distrito" },
  { key: "state", label: "Província/Estado" },
  { key: "phone", label: "Telefone" },
  { key: "observations", label: "Observações" },
  { key: "reference_point", label: "Ponto de Referência" },
  { key: "best_time", label: "Melhor Horário" },
  { key: "sign_language_level", label: "Nível de Língua de Sinais" },
  { key: "status", label: "Status" },
  { key: "situacao", label: "Situação" },
  { key: "congregation", label: "Congregação" },
  { key: "last_visit_date", label: "Data da Última Visita" },
  { key: "last_visit_time", label: "Hora da Última Visita" },
  { key: "last_visited_by", label: "Visitado por" },
  { key: "visit_count", label: "Total de Visitas" },
  { key: "lat", label: "Latitude" },
  { key: "lng", label: "Longitude" },
  { key: "imported", label: "Importado" },
  { key: "import_source", label: "Origem da Importação" },
  { key: "created_date", label: "Data de Criação" },
  { key: "updated_date", label: "Data de Atualização" },
];

export function getExcelFilename() {
  const date = new Date().toISOString().split("T")[0];
  return `LSMaps_Enderecos_${date}.xls`;
}

export function downloadAddressesExcel(addresses) {
  const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const header = EXCEL_COLUMNS.map((c) => `<th>${esc(c.label)}</th>`).join("");
  const rows = addresses
    .map((a) => `<tr>${EXCEL_COLUMNS.map((c) => `<td>${esc(a[c.key])}</td>`).join("")}</tr>`)
    .join("");
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table border="1"><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></body></html>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = getExcelFilename();
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}