// ══════════════════════════════════════════════════════════════
//  Krenos — working without a signal
// ══════════════════════════════════════════════════════════════
//  Boiler houses and plant rooms are where the signal dies, and that
//  is exactly where the readings are taken. An engineer must be able
//  to finish a visit on a dead connection and walk out knowing the
//  report is safe.
//
//  Three things make that true:
//    · the page itself is cached, so it opens with no network
//    · the client list is remembered, so a visit can be started
//    · a finished report is held on the device and sent on its own
//      once the signal comes back
//
//  The report id is minted on the device before any of this, so a
//  queued report that is sent twice is rejected by the database on
//  its primary key rather than filed twice.
// ══════════════════════════════════════════════════════════════

const KRENOS_DB      = 'krenos';
const KRENOS_DB_VER  = 1;
const QUEUE_STORE    = 'pending_reports';
const CACHE_CLIENTS  = 'krenos.clients';
const CACHE_BOILERS  = 'krenos.boilers';

// ── The device's own store ──
// IndexedDB rather than localStorage: a queued report carries its PDF,
// which is far past what localStorage will hold for a day's visits.

let _dbPromise = null;

function offlineDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('no indexedDB')); return; }
    const req = indexedDB.open(KRENOS_DB, KRENOS_DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
  return _dbPromise;
}

function dbRun(mode, fn) {
  return offlineDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, mode);
    const store = tx.objectStore(QUEUE_STORE);
    let out;
    try { out = fn(store); } catch (e) { reject(e); return; }
    tx.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
    tx.onerror    = () => reject(tx.error);
  }));
}

async function queueReport(entry) {
  entry.queuedAt = new Date().toISOString();
  entry.attempts = 0;
  await dbRun('readwrite', s => s.put(entry));
}

async function queuedReports() {
  try {
    const req = await dbRun('readonly', s => s.getAll());
    return req || [];
  } catch (e) { return []; }
}

async function dropQueued(id) {
  try { await dbRun('readwrite', s => s.delete(id)); } catch (e) { /* nothing to drop */ }
}

async function markAttempt(entry, message) {
  entry.attempts = (entry.attempts || 0) + 1;
  entry.lastError = message || '';
  entry.lastTried = new Date().toISOString();
  try { await dbRun('readwrite', s => s.put(entry)); } catch (e) { /* best effort */ }
}

// ── The client list ──
// Written after every successful load, so the next visit can be started
// whether or not there is a signal. These are names and addresses, not
// readings; they are small and they change rarely.

function cacheClients(rows) {
  try { localStorage.setItem(CACHE_CLIENTS, JSON.stringify(rows || [])); }
  catch (e) { /* private window, or no room — the app still works online */ }
}

function cachedClients() {
  try { return JSON.parse(localStorage.getItem(CACHE_CLIENTS) || '[]'); }
  catch (e) { return []; }
}

function cacheBoilers(clientId, rows) {
  if (!clientId) return;
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_BOILERS) || '{}');
    all[clientId] = rows || [];
    localStorage.setItem(CACHE_BOILERS, JSON.stringify(all));
  } catch (e) { /* as above */ }
}

function cachedBoilers(clientId) {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_BOILERS) || '{}');
    return all[clientId] || [];
  } catch (e) { return []; }
}

// ── Telling the two apart ──
// A refused request and an unreachable server need different answers:
// one is a mistake to report, the other is a wait. Supabase surfaces a
// dropped connection as a TypeError from fetch, with no HTTP status.

function looksOffline(err) {
  if (!navigator.onLine) return true;
  if (!err) return false;
  const msg = String(err.message || err).toLowerCase();
  return msg.includes('failed to fetch') ||
         msg.includes('networkerror') ||
         msg.includes('network request failed') ||
         msg.includes('load failed') ||
         err.name === 'TypeError';
}

// ══════════════════════════════════════════
//  SENDING WHAT IS WAITING
// ══════════════════════════════════════════
// A queued report is a finished visit: the record and the PDF are both
// already made, so sending it is the same two calls the app would have
// made at the time, in the same order.

let _flushing = false;

async function flushQueue(sb, opts) {
  opts = opts || {};
  if (_flushing) return { sent: 0, left: 0 };
  if (!navigator.onLine) return { sent: 0, left: (await queuedReports()).length };

  _flushing = true;
  let sent = 0;
  try {
    const pending = await queuedReports();
    for (const entry of pending) {
      try {
        // The record first. A duplicate key means a previous attempt
        // got further than it reported — the visit is already filed,
        // so carry on to delivery rather than treating it as an error.
        const { error: insErr } = await sb.from('reports').insert(entry.row);
        if (insErr && insErr.code !== '23505') throw insErr;

        const { data, error: fnErr } = await sb.functions.invoke('deliver-report', {
          body: entry.delivery,
        });
        if (fnErr) throw fnErr;
        const ok = !!(data && (data.success === true ||
                     (data.sent > 0 && (!data.failed || data.failed.length === 0))));
        if (!ok) throw new Error('delivery reported a failure');

        await dropQueued(entry.id);
        sent++;
      } catch (err) {
        if (looksOffline(err)) break;         // signal gone again; stop and wait
        await markAttempt(entry, String(err && err.message || err));
        // A report the server keeps refusing is held, not dropped: the
        // office can see it and the engineer has not lost the visit.
      }
    }
  } finally {
    _flushing = false;
  }

  const left = (await queuedReports()).length;
  if (typeof opts.onDone === 'function') opts.onDone(sent, left);
  return { sent, left };
}

// ══════════════════════════════════════════
//  WHAT THE ENGINEER SEES
// ══════════════════════════════════════════
// Silence is the thing to avoid. An engineer who cannot tell whether a
// report went will either send it again or assume it did; the bar says
// which it is, without him having to ask.

function ensureOfflineBar() {
  let bar = document.getElementById('offlineBar');
  if (bar) return bar;
  bar = document.createElement('div');
  bar.id = 'offlineBar';
  bar.style.cssText =
    'position:fixed;left:0;right:0;bottom:0;z-index:300;display:none;' +
    'padding:9px 14px;font-size:12.5px;font-weight:600;text-align:center;' +
    'font-family:inherit;box-shadow:0 -2px 10px rgba(0,0,0,.12)';
  document.body.appendChild(bar);
  return bar;
}

async function refreshOfflineBar() {
  const bar = ensureOfflineBar();
  const left = (await queuedReports()).length;
  const online = navigator.onLine;

  if (!online && left) {
    bar.style.background = '#fef3c7'; bar.style.color = '#92400e';
    bar.textContent = `No signal — ${left} report${left > 1 ? 's' : ''} saved here, ` +
                      'will send on their own when you are back online.';
    bar.style.display = 'block';
  } else if (!online) {
    bar.style.background = '#f1f5f9'; bar.style.color = '#475569';
    bar.textContent = 'No signal — you can still write the report; it will send later.';
    bar.style.display = 'block';
  } else if (left) {
    bar.style.background = '#dbeafe'; bar.style.color = '#1e3a8a';
    bar.textContent = `Sending ${left} saved report${left > 1 ? 's' : ''}…`;
    bar.style.display = 'block';
  } else {
    bar.style.display = 'none';
  }
  return left;
}

// Tries the queue on reconnect, on load, and every couple of minutes —
// a phone can report itself online before the connection really works.
function startOfflineWatch(sb) {
  const run = () => flushQueue(sb, { onDone: () => refreshOfflineBar() })
                      .then(() => refreshOfflineBar())
                      .catch(() => refreshOfflineBar());
  window.addEventListener('online',  run);
  window.addEventListener('offline', refreshOfflineBar);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) run(); });
  setInterval(run, 120000);
  run();
}
