/* Dosya Adı: sw.js */
const CACHE_NAME = 'ibadet-takip-v26'; // Versiyonu v25'ten v26'ya güncelledim

const STATIC_ASSETS = [
  './',
  './index.html',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600&family=Amiri:wght@700&display=swap',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0',
  'https://cdn.jsdelivr.net/npm/js-confetti@latest/dist/js-confetti.browser.js'
];

// 1. KURULUM
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Dosyalar önbelleğe alınıyor...');
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// 2. AKTİF OLMA (Eski cache'leri sil)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Eski cache silindi:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. İSTEKLERİ YÖNETME
self.addEventListener('fetch', (event) => {
  const reqUrl = new URL(event.request.url);

  // A) Firebase isteklerini ASLA cacheleme (Network Only)
  if (reqUrl.href.includes('firebase') || reqUrl.href.includes('googleapis')) {
    return; 
  }

  // B) Sayfa yenileme isteği ise (Navigation)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        // İnternet yoksa index.html döndür
        return caches.match('./index.html');
      })
    );
    return;
  }

  // C) Diğer statik dosyalar (CSS, JS, Resim)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Varsa cache'den ver, yoksa internetten çek
      return cachedResponse || fetch(event.request);
    })
  );
});

