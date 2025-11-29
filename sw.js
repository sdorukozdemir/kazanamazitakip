/* 
  Dosya Adı: sw.js 
  Konumu: index.html ile aynı dizinde olmalı.
*/

const CACHE_NAME = 'ibadet-takip-v18'; // Versiyonu güncelledikçe burayı değiştirin (v19, v20...)

// Önbelleğe alınacak dosyalar (HTML dosyanızdaki tüm CDN linkleri)
const STATIC_ASSETS = [
  '/',
  '/index.html',
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

// 1. KURULUM (INSTALL): Dosyaları önbelleğe al
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Yeni SW hemen aktif olsun
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Dosyalar önbelleğe alınıyor...');
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// 2. AKTİF OLMA (ACTIVATE): Eski versiyon önbellekleri temizle
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Eski cache temizlendi:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim(); // Tüm sekmeleri kontrol altına al
});

// 3. YAKALAMA (FETCH): İnternet yoksa Cache'den, varsa Network'ten getir
self.addEventListener('fetch', (event) => {
  const reqUrl = new URL(event.request.url);

  // Firebase Database isteklerini (API) önbelleğe alma, bırak SDK yönetsin
  if (reqUrl.href.includes('firebaseio.com') || reqUrl.href.includes('googleapis.com')) {
    return; // Standart tarayıcı davranışına bırak
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Cache'de varsa onu döndür, yoksa internete git
      return cachedResponse || fetch(event.request).then((networkResponse) => {
        // Dinamik olarak yeni yüklenen dosyaları (örn: font woff dosyaları) da cache'e atabiliriz
        // Ancak basitlik adına sadece statik listeyi ve var olanları kullanıyoruz.
        return networkResponse;
      });
    }).catch(() => {
        // Hem cache'de yok hem internet yoksa ve bu bir sayfa isteğiyse index.html dön
        if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
        }
    })
  );
});