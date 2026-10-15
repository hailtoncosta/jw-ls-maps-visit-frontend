import { resolveCityNeighborhood } from "@/lib/cityResolver";

// Convert DMS (19°46'41.9"S) to decimal degrees
function dmsToDecimal(dms) {
  const match = dms.match(/(-?\d+(?:\.\d+)?)\s*[°º]\s*(\d+(?:\.\d+)?)\s*['′]?\s*(?:(\d+(?:\.\d+)?)\s*["″]?)?\s*([NSEWnsew])?/);
  if (!match) return null;
  const [, deg, min, sec, dir] = match;
  let decimal = parseFloat(deg) + parseFloat(min) / 60 + (sec ? parseFloat(sec) / 3600 : 0);
  if (dir && /[SWsw]/.test(dir)) decimal = -decimal;
  return decimal;
}

function isValidLat(lat) { return !isNaN(lat) && lat >= -90 && lat <= 90; }
function isValidLng(lng) { return !isNaN(lng) && lng >= -180 && lng <= 180; }

// Extract lat/lng from ANY format: Google Maps URL, DMS, plain coordinates, Waze, Apple Maps, etc.
export function extractCoords(input) {
  if (!input || typeof input !== "string") return null;
  const str = input.trim();

  // DMS with direction: 19°46'41.9"S 34°52'24.2"E
  const dmsPairs = str.matchAll(/(-?\d+(?:\.\d+)?)\s*[°º]\s*(\d+(?:\.\d+)?)\s*['′]?\s*(?:(\d+(?:\.\d+)?)\s*["″]?)?\s*([NSns])\s*[, ]+\s*(-?\d+(?:\.\d+)?)\s*[°º]\s*(\d+(?:\.\d+)?)\s*['′]?\s*(?:(\d+(?:\.\d+)?)\s*["″]?)?\s*([EWew])/g);
  for (const m of dmsPairs) {
    const lat = dmsToDecimal(`${m[1]}°${m[2]}'${m[3] || 0}"${m[4]}`);
    const lng = dmsToDecimal(`${m[5]}°${m[6]}'${m[7] || 0}"${m[8]}`);
    if (lat !== null && lng !== null && isValidLat(lat) && isValidLng(lng)) return { lat, lng };
  }

  // DMS without direction: 19°46'41.9" 34°52'24.2"
  const dmsNoDir = str.matchAll(/(-?\d+(?:\.\d+)?)\s*[°º]\s*(\d+(?:\.\d+)?)\s*['′]?\s*(?:(\d+(?:\.\d+)?)\s*["″]?)?\s*[, \t]+\s*(-?\d+(?:\.\d+)?)\s*[°º]\s*(\d+(?:\.\d+)?)\s*['′]?\s*(?:(\d+(?:\.\d+)?)\s*["″]?)?(?!\s*[NSEWnsew])/g);
  for (const m of dmsNoDir) {
    let lat = parseFloat(m[1]) + parseFloat(m[2]) / 60 + (m[3] ? parseFloat(m[3]) / 3600 : 0);
    let lng = parseFloat(m[4]) + parseFloat(m[5]) / 60 + (m[6] ? parseFloat(m[6]) / 3600 : 0);
    if (m[1].startsWith("-")) lat = -Math.abs(lat);
    if (m[4].startsWith("-")) lng = -Math.abs(lng);
    if (isValidLat(lat) && isValidLng(lng)) return { lat, lng };
  }

  // Extract ALL decimal number pairs (4+ decimal places) and test them
  const allNumbers = [...str.matchAll(/(-?\d{1,3}\.\d{4,})/g)].map(m => parseFloat(m[1]));
  for (let i = 0; i < allNumbers.length - 1; i++) {
    const lat = allNumbers[i];
    const lng = allNumbers[i + 1];
    if (isValidLat(lat) && isValidLng(lng)) {
      return { lat, lng };
    }
  }

  // Degrees + minutes only: 19°46'S 34°52'W
  const dmPairs = str.matchAll(/(-?\d+(?:\.\d+)?)\s*[°º]\s*(\d+(?:\.\d+)?)\s*['′]?\s*([NSns])?\s*[, \t]+\s*(-?\d+(?:\.\d+)?)\s*[°º]\s*(\d+(?:\.\d+)?)\s*['′]?\s*([EWew])?/g);
  for (const m of dmPairs) {
    let lat = parseFloat(m[1]) + parseFloat(m[2]) / 60;
    let lng = parseFloat(m[4]) + parseFloat(m[5]) / 60;
    if (m[3] && /[Ss]/.test(m[3])) lat = -Math.abs(lat);
    if (m[6] && /[Ww]/.test(m[6])) lng = -Math.abs(lng);
    if (isValidLat(lat) && isValidLng(lng)) return { lat, lng };
  }

  return null;
}

// Get the Google Maps link for an address record.
// Uses maps_link if present; otherwise builds from lat/lng (handles retroactive records).
export function getMapsLink(address) {
  if (!address) return null;
  if (address.maps_link) return address.maps_link;
  if (address.lat != null && address.lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${address.lat},${address.lng}`;
  }
  return null;
}

// Build a proper Google Maps URL from any input (link, coordinates, DMS)
// If it's already an http(s) URL, use it as-is; otherwise convert to a maps search URL
export function buildGoogleMapsUrl(input) {
  if (!input) return null;
  const str = input.trim();
  if (/^https?:\/\//i.test(str)) return str;

  // Try to extract coordinates and build a search URL
  const coords = extractCoords(str);
  if (coords) {
    return `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`;
  }

  // Fallback: treat as a search query
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(str)}`;
}

// URL universal do Google Maps baseada em coordenadas reais (lat/lng).
// Usada pelo botão "Ver no Maps", pelo QR Code digital e pelo QR Code impresso,
// garantindo que os três apontem para a mesma localização.
// Retorna null se as coordenadas forem inválidas (não gera QR inválido).
export function getMapsUrl(lat, lng) {
  const la = parseFloat(lat);
  const ln = parseFloat(lng);
  if (isNaN(la) || isNaN(ln) || !isValidLat(la) || !isValidLng(ln)) return null;
  return `https://www.google.com/maps/search/?api=1&query=${la},${ln}`;
}

// Build a static map image URL from any input using OpenStreetMap static maps
export function buildStaticMapUrl(input, zoom = 16, size = "400x200") {
  const coords = extractCoords(input);
  if (!coords) return null;
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${coords.lat},${coords.lng}&zoom=${zoom}&size=${size}&markers=${coords.lat},${coords.lng},red-pushpin`;
}

// Detect short URLs (goo.gl, bit.ly, tinyurl, maps.app.goo.gl, etc.)
export function isShortUrl(url) {
  if (!url) return false;
  return /^https?:\/\/(goo\.gl|maps\.app\.goo\.gl|bit\.ly|tinyurl\.com|t\.co|ow\.ly|is\.gd|buff\.ly|rebrand\.ly|cutt\.ly|shorturl\.at|rb\.gy|x\.co|short\.link)/i.test(url.trim());
}

// Fetch with timeout using AbortController (broader browser support than AbortSignal.timeout)
function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

// Expand a short URL by following redirects via CORS proxies
async function expandShortUrl(url) {
  // Strategy 1: allorigins /get — returns JSON with status.url (final URL after redirects)
  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const response = await fetchWithTimeout(proxyUrl);
    if (response.ok) {
      const data = await response.json();
      const finalUrl = data.status?.url || null;
      const content = data.contents || "";

      // Check final URL for coordinates
      if (finalUrl && finalUrl !== url) {
        const coords = extractCoords(finalUrl);
        if (coords) return { finalUrl, coords };
      }
      // Check content for redirect URLs and coordinates
      if (content) {
        const coords = extractCoordsFromHtml(content);
        if (coords) return { finalUrl, coords };
      }
    }
  } catch {}

  // Strategy 2: allorigins /raw — returns raw HTML content
  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const response = await fetchWithTimeout(proxyUrl);
    if (response.ok) {
      const html = await response.text();
      const coords = extractCoordsFromHtml(html);
      if (coords) return { finalUrl: null, coords };
    }
  } catch {}

  // Strategy 3: codetabs proxy — follows redirects
  try {
    const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
    const response = await fetchWithTimeout(proxyUrl);
    if (response.ok) {
      const html = await response.text();
      const coords = extractCoordsFromHtml(html);
      if (coords) return { finalUrl: null, coords };
    }
  } catch {}

  return null;
}

// Extract coordinates from HTML content (handles meta refresh redirects, JS redirects, and embedded coords)
function extractCoordsFromHtml(html) {
  if (!html) return null;

  // Look for meta refresh redirect: <meta http-equiv="refresh" content="0;url=...">
  const metaMatch = html.match(/content=["'][^"']*url=([^"']+)["']/i);
  if (metaMatch) {
    const coords = extractCoords(metaMatch[1]);
    if (coords) return coords;
  }

  // Look for JavaScript redirects: window.location, location.replace, location.href, location.assign
  const jsRedirects = html.match(/(?:window\.location|location\.(?:replace|assign|href))\s*[=(]\s*["']([^"']+)["']/gi);
  if (jsRedirects) {
    for (const redirect of jsRedirects) {
      const urlMatch = redirect.match(/["']([^"']+)["']/);
      if (urlMatch) {
        const coords = extractCoords(urlMatch[1]);
        if (coords) return coords;
      }
    }
  }

  // Look for Google Maps URLs in the content
  const mapsUrls = html.match(/https?:\/\/(?:www\.)?(?:google\.[a-z]+\/maps|maps\.google\.[a-z]+)\/[^\s"'<>]+/gi);
  if (mapsUrls) {
    for (const mapsUrl of mapsUrls) {
      const coords = extractCoords(mapsUrl);
      if (coords) return coords;
    }
  }

  // Look for @lat,lng pattern (common in Google Maps URLs)
  const atCoords = html.match(/@(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/);
  if (atCoords) {
    const lat = parseFloat(atCoords[1]);
    const lng = parseFloat(atCoords[2]);
    if (isValidLat(lat) && isValidLng(lng)) return { lat, lng };
  }

  // Last resort: look for any coordinate pair in the entire HTML
  return extractCoords(html);
}

// Resolve coordinates from any input using LLM with web access (most reliable for short URLs)
async function resolveCoordsWithLLM(url) {
  try {
    const { api } = await import("@/api/apiClient");
    const res = await api.integrations.Core.InvokeLLM({
      prompt: `You are a URL resolver. Follow this Google Maps short link and extract the exact latitude and longitude coordinates it points to: ${url}\nThis is a maps.app.goo.gl link which redirects to a full Google Maps URL containing coordinates. Access the link, follow ALL redirects (including JavaScript/meta redirects), and return the precise decimal coordinates of the location. Do NOT guess — only return coordinates you found by actually resolving the URL.`,
      add_context_from_internet: true,
      model: "gemini_3_flash",
      response_json_schema: {
        type: "object",
        properties: {
          lat: { type: "number" },
          lng: { type: "number" }
        },
        required: ["lat", "lng"]
      }
    });
    if (res && typeof res.lat === "number" && typeof res.lng === "number" &&
        isValidLat(res.lat) && isValidLng(res.lng)) {
      return { lat: res.lat, lng: res.lng };
    }
  } catch {}
  return null;
}

// Resolve any maps link (including short URLs like goo.gl) to a full Google Maps URL with coordinates
export async function resolveMapsLink(input) {
  if (!input) return null;
  const str = input.trim();

  // Try direct coordinate extraction first (fast path)
  const directCoords = extractCoords(str);
  if (directCoords) {
    return `https://www.google.com/maps/search/?api=1&query=${directCoords.lat},${directCoords.lng}`;
  }

  // If it's a URL, try to expand/resolve it (handles short URLs)
  if (/^https?:\/\//i.test(str)) {
    // maps.app.goo.gl links return interstitial pages that CORS proxies can't resolve;
    // use LLM with web access FIRST for these, as it can follow redirects and parse JS
    const isMapsAppLink = /maps\.app\.goo\.gl/i.test(str);
    
    if (isMapsAppLink) {
      const llmCoords = await resolveCoordsWithLLM(str);
      if (llmCoords) {
        return `https://www.google.com/maps/search/?api=1&query=${llmCoords.lat},${llmCoords.lng}`;
      }
      // Fallback to CORS proxies if LLM fails
      const expanded = await expandShortUrl(str);
      if (expanded?.coords) {
        return `https://www.google.com/maps/search/?api=1&query=${expanded.coords.lat},${expanded.coords.lng}`;
      }
    } else {
      // For other short URLs, try CORS proxies first (faster)
      const expanded = await expandShortUrl(str);
      if (expanded?.coords) {
        return `https://www.google.com/maps/search/?api=1&query=${expanded.coords.lat},${expanded.coords.lng}`;
      }
      // Fallback: use LLM with web access to resolve the URL
      const llmCoords = await resolveCoordsWithLLM(str);
      if (llmCoords) {
        return `https://www.google.com/maps/search/?api=1&query=${llmCoords.lat},${llmCoords.lng}`;
      }
    }

    return str;
  }

  // For raw coordinates/DMS, build a URL
  return buildGoogleMapsUrl(str);
}

// Resolve coordinates from any input (sync first, then async for short URLs)
export async function resolveCoords(input) {
  if (!input) return null;
  const direct = extractCoords(input);
  if (direct) return direct;
  if (/^https?:\/\//i.test(input.trim())) {
    const resolved = await resolveMapsLink(input);
    if (resolved) return extractCoords(resolved);
  }
  return null;
}

// Reverse geocode coordinates to address using OpenStreetMap Nominatim
export async function reverseGeocode(lat, lng) {
  try {
    const response = await fetchWithTimeout(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' } },
      10000
    );
    if (!response.ok) return null;
    const data = await response.json();
    const addr = data.address || {};
    const road = addr.road || addr.pedestrian || addr.path || addr.cycleway || '';
    const houseNumber = addr.house_number || '';
    const { city, neighborhood } = resolveCityNeighborhood(lat, lng, addr);
    return {
      street: [road, houseNumber].filter(Boolean).join(', ') || '',
      neighborhood,
      city,
      state: addr.state || '',
      zip_code: addr.postcode || '',
      reference_point: addr.amenity || addr.shop || addr.office || addr.tourism || '',
    };
  } catch (e) {
    return null;
  }
}

// Get current GPS position as a Promise
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalização não suportada neste dispositivo'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        const messages = {
          1: 'Permissão de localização negada',
          2: 'Localização indisponível',
          3: 'Tempo esgotado ao obter localização',
        };
        reject(new Error(messages[err.code] || 'Erro ao obter localização'));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}