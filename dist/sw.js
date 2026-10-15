// Service Worker — JW Maps Visit
// Estratégia: cache runtime para o app shell (HTML/JS/CSS/fonts/assets).
// - Navegação: network-first, fallback para index.html cacheado (offline).
// - Assets estáticos: network-first para usar o código novo na primeira visita.
// - Chamadas de API (/api/, /functions/): nunca cacheadas.
const CACHE_NAME = 'jw-maps-visit-v4-finish-address';
const APP_SHELL = ['/', '/index.html'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      ),
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Nunca interceptar chamadas de API ou backend functions
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/functions/')) return;
  // Apenas mesma origem
  if (url.origin !== self.location.origin) return;

  // Navegação: network-first, fallback para cache offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          return response;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match('/index.html')))
    );
    return;
  }

  // Uma resposta antiga do cache aqui mantém a tela Admin usando a consulta
  // anterior até o usuário atualizar a página. Busque primeiro a versão atual.
  event.respondWith(
    fetch(req).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return response;
      }).catch(() => caches.match(req))
  );
});
