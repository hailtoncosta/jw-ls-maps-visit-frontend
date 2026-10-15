import { buildGoogleMapsUrl } from "@/lib/maps";

export function buildCardText(addr) {
  const gmapsUrl = buildGoogleMapsUrl(addr.maps_link);
  const lines = [
    `📍 ${addr.name || "Endereço"}`,
    addr.congregation ? `Congregação: ${addr.congregation}` : null,
    addr.gender ? `Gênero: ${addr.gender}` : null,
    addr.age ? `Idade: ${addr.age} anos` : null,
    addr.street ? `Endereço: ${addr.street}` : null,
    addr.neighborhood ? `Bairro: ${addr.neighborhood}` : null,
    addr.city ? `Cidade: ${addr.city}${addr.state ? ` - ${addr.state}` : ""}` : null,
    addr.reference_point ? `Referência: ${addr.reference_point}` : null,
    addr.phone ? `Telefone: ${addr.phone}` : null,
    addr.best_time ? `Melhor horário: ${addr.best_time}` : null,
    addr.observations ? `Observações: ${addr.observations}` : null,
    gmapsUrl ? `Maps: ${gmapsUrl}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

export function buildGroupText(addresses, congregationName) {
  const header = congregationName
    ? `🗂️ Cartão de Território - ${congregationName}`
    : "🗂️ Cartão de Território";
  const body = addresses.map((a, i) => {
    const single = buildCardText(a);
    return `${"─".repeat(30)}\n${i + 1}. ${single}`;
  }).join("\n\n");
  return `${header}\n${body}`;
}

export async function shareContent(title, text) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return { method: "share" };
    } catch {
      return { method: "cancelled" };
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return { method: "clipboard" };
  } catch {
    return { method: "error" };
  }
}