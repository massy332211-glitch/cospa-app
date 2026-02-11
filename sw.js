// Service Worker for コスパ比較アプリ
const CACHE_NAME = 'cospa-v7';
const ASSETS = [
    './',
    './index.html',
    './src/index.css',
    './src/styles/scan.css',
    './src/styles/list.css',
    './src/styles/edit.css',
    './src/main.js',
    './src/core/units.js',
    './src/core/calculator.js',
    './src/core/store.js',
    './src/ocr/engine.js',
    './src/ocr/extractor.js',
    './src/ocr/scorer.js',
    './src/ocr/live-controller.js',
    './src/ui/scan-view.js',
    './src/ui/list-view.js',
    './src/ui/edit-view.js',
    './src/ui/settings-view.js',
    './src/ui/components/chip.js',
    './src/ui/components/product-card.js',
    './src/ui/components/toast.js',
];

// Install - キャッシュ
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Activate - 古いキャッシュ削除
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

// Fetch - キャッシュ優先、ネットワークフォールバック
self.addEventListener('fetch', (event) => {
    // CDNリクエスト（Tesseract.js等）はネットワーク優先
    if (event.request.url.includes('cdn.jsdelivr.net')) {
        event.respondWith(
            caches.open(CACHE_NAME).then(cache =>
                fetch(event.request)
                    .then(response => {
                        cache.put(event.request, response.clone());
                        return response;
                    })
                    .catch(() => cache.match(event.request))
            )
        );
        return;
    }

    // アプリアセットはキャッシュ優先
    event.respondWith(
        caches.match(event.request)
            .then(cached => cached || fetch(event.request))
    );
});
