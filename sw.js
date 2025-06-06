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
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // 캐시에 있으면 캐시된 응답 반환
        if (response) {
          return response;
        }
        
        // 없으면 네트워크 요청
        return fetch(event.request)
          .then(response => {
            // 유효한 응답이 아니면 그냥 반환
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // 응답 복제 (스트림은 한 번만 사용 가능)
            const responseToCache = response.clone();
            
            // 응답 캐싱
            caches.open(CACHE_NAME)
              .then(cache => {
                // API 요청은 캐시하지 않음
                if (!event.request.url.includes('/api/')) {
                  cache.put(event.request, responseToCache);
                }
              });
            
            return response;
          })
          .catch(() => {
            // 네트워크 오류 시 오프라인 페이지 제공 (API 요청인 경우)
            if (event.request.url.includes('/api/')) {
              return new Response(JSON.stringify({ 
                error: true, 
                message: '오프라인 상태입니다. 네트워크 연결을 확인하세요.' 
              }), {
                headers: { 'Content-Type': 'application/json' }
              });
            }
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