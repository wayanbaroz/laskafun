/* store.js  IndexedDB untuk lagu (blob) + localStorage untuk preferensi.
   Jika IndexedDB tidak tersedia, data disimpan di memori selama sesi. */
(function () {
  'use strict';
  const NP = window.NP;
  const DB_NAME = 'soft-player';
  const STORE = 'tracks';
  const PREF_KEY = 'softplayer.prefs';

  let db = null;
  let persistent = false;
  const mem = new Map();

  function open() {
    return new Promise((resolve) => {
      let req;
      try {
        // Di iframe ber-sandbox, mengakses window.indexedDB bisa melempar SecurityError.
        if (!window.indexedDB) return resolve(null);
        req = indexedDB.open(DB_NAME, 1);
      } catch (e) { return resolve(null); }
      setTimeout(() => resolve(null), 4000); // jangan menggantung bila browser tidak menjawab
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    });
  }

  function run(mode, fn) {
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req ? req.result : undefined);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('Transaksi dibatalkan'));
      } catch (e) { reject(e); }
    });
  }

  async function init() {
    db = await open();
    persistent = !!db;
    return persistent;
  }

  async function all() {
    if (!persistent) return Array.from(mem.values());
    try { return (await run('readonly', (s) => s.getAll())) || []; } catch (e) { return []; }
  }

  async function put(track) {
    if (!persistent) { mem.set(track.id, track); return; }
    await run('readwrite', (s) => s.put(track));
  }

  async function remove(id) {
    if (!persistent) { mem.delete(id); return; }
    await run('readwrite', (s) => s.delete(id));
  }

  function prefs() {
    try { return JSON.parse(localStorage.getItem(PREF_KEY)) || {}; } catch (e) { return {}; }
  }
  const pref = (k, d) => { const p = prefs(); return k in p ? p[k] : d; };
  function setPref(k, v) {
    try { const p = prefs(); p[k] = v; localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch (e) { /* abaikan */ }
  }

  NP.store = { init, all, put, remove, pref, setPref, isPersistent: () => persistent };
})();
