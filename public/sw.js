const CACHE_NAME = 'cgp-v6';

// キャッシュするアセット（アプリシェル）
const SHELL_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

// インストール: アプリシェルをキャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

// アクティベート: 古いキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// フェッチ戦略:
// - 地図タイル / 気象API: ネットワーク優先（リアルタイムデータ）
// - その他: キャッシュ優先 → ネットワーク フォールバック
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // リアルタイムAPIはキャッシュしない
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
    // ネットワーク優先（失敗してもキャッシュは使わない）
    event.respondWith(fetch(request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // アプリシェル: キャッシュ優先
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // 成功したレスポンスをキャッシュに追加
        if (response.ok && request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
