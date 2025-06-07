const CACHE_NAME = 'ortho-paper-v1';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './scripts/main.js',
  './scripts/api_service.js',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];

// 서비스 워커 설치 및 캐시
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('캐시가 열렸습니다');
        return cache.addAll(urlsToCache);
      })
  );
});

// 네트워크 요청 가로채기
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  // 교차 출처 요청이나 GET 이외의 메소드는 처리하지 않음
  if (requestUrl.origin !== location.origin || event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }

        return fetch(event.request)
          .then(networkResponse => {
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          });
      })
  );
});

// 이전 캐시 정리
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
}); 