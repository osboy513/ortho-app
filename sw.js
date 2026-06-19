const CACHE_NAME = 'ortho-paper-v20';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './scripts/ai_search_service.js',
  './scripts/journal_data.js?v=18',
  './scripts/main.js?v=20',
  './scripts/api_service.js',
  './scripts/summary_service.js',
  './scripts/ui_manager.js?v=20',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];

// 서비스 워커 설치 및 캐시
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// 네트워크 요청 가로채기
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;
  const isApiRequest = requestUrl.pathname.startsWith('/api/');

  if (!isSameOrigin || isApiRequest || event.request.method !== 'GET') {
    return;
  }

  event.respondWith(handleFetch(event.request, requestUrl));
});

function shouldUseNetworkFirst(request, requestUrl) {
  return (
    request.mode === 'navigate' ||
    requestUrl.pathname.endsWith('.html') ||
    requestUrl.pathname.endsWith('.js') ||
    requestUrl.pathname.endsWith('.css') ||
    requestUrl.pathname.endsWith('.json')
  );
}

async function cacheResponse(request, response) {
  if (
    response &&
    response.status === 200 &&
    response.type === 'basic'
  ) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone()).catch(() => undefined);
  }
}

async function handleFetch(request, requestUrl) {
  try {
    if (shouldUseNetworkFirst(request, requestUrl)) {
      const networkResponse = await fetch(request);
      await cacheResponse(request, networkResponse);
      return networkResponse || createOfflineResponse();
    }

    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    await cacheResponse(request, networkResponse);
    return networkResponse || createOfflineResponse();
  } catch {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    if (request.mode === 'navigate') {
      const offlinePage = await caches.match('./index.html');
      if (offlinePage) {
        return offlinePage;
      }
    }

    return createOfflineResponse();
  }
}

function createOfflineResponse() {
  return new Response('오프라인 상태입니다. 네트워크 연결을 확인하세요.', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// 이전 캐시 정리
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});
