// Service Worker for 每日书旅 PWA
// 版本号：用于缓存更新
const CACHE_VERSION = 'v1.0.1';
const CACHE_NAME = `book-journey-${CACHE_VERSION}`;

// 需要缓存的资源
const STATIC_CACHE_URLS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/logo.svg',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500;600;700&family=Inter:wght@300;400;500&display=swap',
  'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'
];

// 安装 Service Worker
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...', CACHE_NAME);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching static assets');
        // 缓存静态资源，忽略失败的请求
        return cache.addAll(STATIC_CACHE_URLS).catch((err) => {
          console.warn('[Service Worker] Some assets failed to cache:', err);
        });
      })
      .then(() => {
        // 强制激活新的 Service Worker
        return self.skipWaiting();
      })
  );
});

// 激活 Service Worker
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...', CACHE_NAME);
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // 删除旧版本的缓存
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // 立即控制所有客户端
      return self.clients.claim();
    })
  );
});

// 拦截网络请求
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // 只处理同源请求
  if (url.origin !== location.origin) {
    // 对于外部资源（如 CDN），使用网络优先策略
    event.respondWith(
      fetch(request)
        .catch(() => {
          // 如果网络失败，尝试从缓存获取
          return caches.match(request);
        })
    );
    return;
  }
  
  // API 请求：网络优先，失败时返回缓存
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // 克隆响应以便缓存
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // 网络失败时返回缓存
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // 如果没有缓存，返回离线页面或错误响应
            return new Response(
              JSON.stringify({ error: '网络连接失败，请检查网络后重试' }),
              {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
              }
            );
          });
        })
    );
    return;
  }
  
  // 静态资源：缓存优先，失败时使用网络
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // 缓存中没有，从网络获取
        return fetch(request).then((response) => {
          // 只缓存成功的响应
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        });
      })
      .catch(() => {
        // 如果请求失败且没有缓存，返回离线页面
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      })
  );
});

// 处理消息（用于手动更新缓存）
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_UPDATE') {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(STATIC_CACHE_URLS);
      })
    );
  }
});

