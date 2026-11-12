// ══════════════════════════════════════════════════════════════
//  Krenos — service worker
// ══════════════════════════════════════════════════════════════
//  Holds the app itself on the device so it opens in a plant room
//  with no signal. It caches the program, never the data: readings,
//  clients and reports go through Supabase and are handled by the
//  offline queue, which knows when something is stale and this does
//  not.
//
//  Bump CACHE on every release. The old cache is deleted on activate,
//  so an engineer never ends up running last month's app against this
//  month's database.
// ══════════════════════════════════════════════════════════════

const CACHE = 'krenos-v5.1';

// Everything needed to open the app and produce a report with no
// network. jsPDF is here because a report must still be generated and
// shown to the engineer on site, signal or not.
const SHELL = [
  './krenos-app.html',
  './krenos-params.js',
  './krenos-offline.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.58.0/dist/umd/supabase.min.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // One missing file must not fail the whole install — a cached app
    // without its icon still gets the engineer through the visit.
    await Promise.all(SHELL.map(url =>
      cache.add(new Request(url, { cache: 'reload' })).catch(() => {})
    ));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never cache Supabase. A stale answer about a client or a report is
  // worse than no answer: the engineer would act on it believing it is
  // current. Those calls fail honestly when there is no signal, and the
  // app's queue takes over.
  if (url.hostname.endsWith('supabase.co')) return;

  // The program: serve from cache first so it opens instantly and works
  // with no signal, and refresh the copy in the background.
  e.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    const network = fetch(req).then(res => {
      if (res && res.ok && (url.origin === self.location.origin || res.type === 'basic' || res.type === 'cors')) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => null);

    if (cached) { network; return cached; }

    const res = await network;
    if (res) return res;

    // Nothing cached and nothing reachable.
    if (req.mode === 'navigate') {
      const shell = await caches.match('./krenos-app.html');
      if (shell) return shell;
    }
    return new Response('Offline and not cached yet.', {
      status: 503, headers: { 'Content-Type': 'text/plain' },
    });
  })());
});
