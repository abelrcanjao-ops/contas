// Service worker: deixa o app funcionar offline (cache dos arquivos do app).
const VERSAO = 'contas-v2';
const ARQUIVOS = [
  './', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest',
  'fonts/Poppins-Regular.ttf', 'fonts/Poppins-SemiBold.ttf', 'fonts/Poppins-Bold.ttf',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Responde do cache e atualiza em segundo plano (a versão nova aparece na abertura seguinte)
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      const rede = fetch(req).then((res) => {
        if (res.ok) caches.open(VERSAO).then((c) => c.put(req, res.clone()));
        return res;
      }).catch(() => hit);
      return hit || rede;
    })
  );
});
