/**
 * LingoFlow PWA — Service Worker
 * 策略：Stale-While-Revalidate（缓存优先 + 后台静默更新）
 *
 * 解决问题：Vercel 在中国大陆被墙，Network-First 策略会导致每次都要 VPN
 * 本策略：首次访问需要 VPN 缓存资源，之后免 VPN 秒开，后台静默更新
 *
 * - 有缓存时：立即返回缓存（秒开），同时后台尝试从网络更新缓存
 * - 无缓存时：从网络获取（首次访问，需要 VPN）
 * - 网络不可用：静默忽略，不影响已缓存页面的使用
 */

const CACHE_NAME = 'lingoflow-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-32.png',
  // Google Fonts
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Noto+Sans+SC:wght@300;400;500;700&family=Noto+Sans+KR:wght@300;400;500;700&display=swap',
];

// ===== INSTALL =====
// 预缓存所有核心资源
self.addEventListener('install', (event) => {
  console.log('[SW] Installing LingoFlow Service Worker...');
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        ASSETS.map(url => {
          return fetch(url).then(response => {
            if (!response.ok) return;
            return cache.put(url, response);
          }).catch(err => console.log('[SW] Precache failed for', url, err));
        })
      );
    })
  );
});

// ===== ACTIVATE =====
// 清理旧版本缓存，接管所有页面
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  self.clients.claim();
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME && key.startsWith('lingoflow-')) {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
});

// ===== FETCH =====
// Stale-While-Revalidate：有缓存立即返回，后台静默更新
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      // 后台静默尝试从网络更新缓存（不阻塞用户）
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.ok) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return networkResponse;
      }).catch((e) => {
        // 网络失败（被墙了），静默忽略，不影响用户体验
        console.log('[SW] Network fetch failed (offline or blocked):', e);
      });

      // 1. 有缓存 → 立即返回，不等网络（秒开！）
      if (cachedResponse) {
        return cachedResponse;
      }

      // 2. 没缓存 → 等网络（首次访问，此时必须有 VPN）
      return fetchPromise.then(response => {
        if (response) return response;
        // 3. 网络也失败了 → 尝试返回首页作为兜底
        if (event.request.mode === 'navigate') {
          return caches.match('/', { ignoreSearch: true })
            .then(res => res || caches.match('/index.html', { ignoreSearch: true }));
        }
        return new Response('LingoFlow 离线中，请检查网络连接。', {
          status: 408,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      });
    })
  );
});

// ===== 版本更新检测 =====
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
