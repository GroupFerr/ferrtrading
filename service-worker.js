// Service Worker do FerrTrading
const CACHE_NAME = 'ferrtrading-v4';
const ARQUIVOS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ARQUIVOS).catch(() => {
        console.log('Alguns arquivos não puderam ser cacheados');
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nomes) => {
      return Promise.all(
        nomes.map((nome) => {
          if (nome !== CACHE_NAME) {
            console.log('🗑️ Removendo cache antigo:', nome);
            return caches.delete(nome);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('firebase') ||
      event.request.url.includes('googleapis') ||
      event.request.url.includes('gstatic') ||
      event.request.url.includes('unsplash')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((resposta) => {
      if (resposta) return resposta;
      return fetch(event.request).then((res) => {
        if (event.request.method === 'GET' && res.status === 200) {
          const copia = res.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, copia);
          });
        }
        return res;
      }).catch(() => {
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});