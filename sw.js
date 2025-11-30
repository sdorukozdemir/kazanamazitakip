/* Dosya Adı: sw.js */
const CACHE_NAME = 'ibadet-takip-v35'; // Versiyonu v35 yaptım. Bu sayede telefon yeni tasarımı indirecek.

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

// 1. KURULUM (Install)
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Yeni versiyon gelir gelmez beklemeden yükle
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Yeni dosyalar önbelleğe alınıyor...');
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// 2. AKTİF OLMA (Activate - Eski cache'leri sil)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Eski cache temizlendi:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. İSTEKLERİ YÖNETME (Fetch)
self.addEventListener('fetch', (event) => {
  const reqUrl = new URL(event.request.url);

  // A) Firebase ve Google API isteklerini ASLA cacheleme (Network Only)
  if (reqUrl.href.includes('firebase') || reqUrl.href.includes('googleapis')) {
    return; 
  }

  // B) Sayfa yenileme isteği ise (Navigation) - İnternet varsa yenisini al, yoksa cache'den ver
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => {
          return caches.match('./index.html');
        })
    );
    return;
  }

  // C) Diğer statik dosyalar
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});

