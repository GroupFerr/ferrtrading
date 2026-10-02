// Service Worker do FerrTrading
const CACHE_NAME = 'ferrtrading-v1';
const ARQUIVOS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Instala e faz cache dos arquivos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ARQUIVOS).catch(() => {
        console.log('Alguns arquivos não puderam ser cacheados');
      });
    })
  );
  self.skipWaiting();
});

// Ativa e limpa caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nomes) => {
      return Promise.all(
        nomes.map((nome) => {
          if (nome !== CACHE_NAME) return caches.delete(nome);
        })
      );
    })
  );
  self.clients.claim();
});

// Intercepta requisições: tenta cache, depois rede
self.addEventListener('fetch', (event) => {
  // Não intercepta requisições do Firebase (precisa sempre da rede)
  if (event.request.url.includes('firebase') ||
      event.request.url.includes('googleapis') ||
      event.request.url.includes('gstatic')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((resposta) => {
      return resposta || fetch(event.request).then((res) => {
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