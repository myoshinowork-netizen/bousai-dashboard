const CACHE_NAME = 'cgp-v12';

const SHELL_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

// インストール: アプリシェルをキャッシュ＋即座に制御を取得
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

// アクティベート: 古いキャッシュ削除 → 全クライアントに更新通知
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
      .then(() =>
        // 全クライアントに「新バージョン適用済み」を通知
        self.clients.matchAll({ type: 'window' }).then((clients) => {
          clients.forEach((client) => {
            // localhostでは通知しない（開発中のHMR競合を防ぐ）
            const url = new URL(client.url);
            if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
              client.postMessage({ type: 'NEW_VERSION', version: CACHE_NAME });
            }
          });
        })
      )
  );
});

// フェッチ戦略:
// - リアルタイムAPI / 地図タイル: ネットワーク優先（常に最新）
// - アプリシェル: キャッシュ優先 → ネットワーク フォールバック
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  const isRealtimeApi =
    url.hostname.includes('api.p2pquake') ||
    url.hostname.includes('weather.tsukumijima') ||
    url.hostname.includes('www.jma.go.jp') ||
    url.hostname.includes('tile.openstreetmap') ||
    url.hostname.includes('cyberjapandata') ||
    url.hostname.includes('disaportal.gsi') ||
    url.hostname.includes('gsi.go.jp') ||
    request.url.includes('/tiles/') ||
    request.url.includes('nowcast');

  if (isRealtimeApi) {
    event.respondWith(fetch(request).catch(() => new Response('', { status: 503 })));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
