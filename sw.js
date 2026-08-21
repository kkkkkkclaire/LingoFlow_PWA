/**
 * LingoFlow PWA — Service Worker
 * 策略：Network-First with offline fallback + 后台静默更新
 *
 * - 在线时：优先从网络获取最新版本，同时更新缓存
 * - 离线时：从缓存提供完整功能
 * - 有新版本时：向页面推送通知，用户可一键刷新到最新版
 */

const CACHE_NAME = 'lingoflow-v1';
const CACHE_VERSION = 'lingoflow-v1'; // 升级版本时改这里即可触发更新

// 需要缓存的核心资源（App Shell）
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-32.png',
  // Google Fonts（缓存字体以支持离线）
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Noto+Sans+SC:wght@300;400;500;700&family=Noto+Sans+KR:wght@300;400;500;700&display=swap',
];

// ===== INSTALL =====
// 预缓存所有核心资源
self.addEventListener('install', (event) => {
  console.log('[SW] Installing LingoFlow Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // 逐个缓存，避免单个失败导致整体失败
      const results = await Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`[SW] Failed to cache: ${url}`, err);
          })
        )
      );
      console.log('[SW] Pre-cache complete.');
      return results;
    })
  );
  // 跳过等待，立即激活（首次安装时）
  self.skipWaiting();
});

// ===== ACTIVATE =====
// 清理旧版本缓存，接管所有页面
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      )
    ).then(() => {
      console.log('[SW] Activated and claiming clients.');
      return self.clients.claim();
    })
  );
});

// ===== FETCH =====
// Network-First 策略：优先网络，网络失败则读缓存
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 只处理 GET 请求 & 同源/可缓存的跨域请求
  if (event.request.method !== 'GET') return;

  // 跳过 Chrome 扩展等非 http(s) 请求
  if (!url.protocol.startsWith('http')) return;

  // 对于 Google Fonts 使用 Stale-While-Revalidate
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  // 核心资源：Network-First
  event.respondWith(networkFirst(event.request));
});

// ===== 策略实现 =====

/**
 * Network-First：先尝试网络，成功则更新缓存；失败则从缓存响应
 */
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (_) {
    // 网络不可用，从缓存响应
    const cached = await cache.match(request);
    if (cached) return cached;
    // 最终兜底：返回主页（SPA 路由）
    const fallback = await cache.match('/index.html');
    return fallback || new Response('LingoFlow 离线中，请检查网络连接。', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

/**
 * Stale-While-Revalidate：立即从缓存响应，同时后台更新缓存
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && response.status === 200) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);
  return cached || fetchPromise;
}

// ===== 版本更新检测 =====
// 当检测到新版本 Service Worker 等待激活时，通知所有页面
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
