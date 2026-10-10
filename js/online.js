/* online.js  Akses jaringan: pencarian iTunes, unduh audio dari URL, lirik dari LRCLIB.
   Semua gagal dengan anggun bila server tidak mengizinkan akses lintas-origin (CORS). */
(function () {
  'use strict';
  const NP = window.NP;

  async function getJSON(url, ms) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), ms || 10000);
    try {
      const r = await fetch(url, { signal: ctl.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally { clearTimeout(timer); }
  }

  /** Cari lagu di iTunes. Hasilnya cuplikan 30 detik. */
  async function searchSongs(q) {
    const j = await getJSON(`https://itunes.apple.com/search?media=music&entity=song&limit=20&term=${encodeURIComponent(q)}`);
    return (j.results || []).filter((x) => x.previewUrl).map((x) => ({
      id: x.trackId,
      title: x.trackName,
      artist: x.artistName,
      album: x.collectionName || '',
      art: (x.artworkUrl100 || '').replace('100x100', '300x300'),
      previewUrl: x.previewUrl,
    }));
  }

  /** Unduh audio sebagai Blob, dengan progres bila ukuran diketahui. */
  async function downloadAudio(url, onProgress) {
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const type = (r.headers.get('content-type') || '').toLowerCase();
    if (type.startsWith('text/') || type.includes('json')) throw new Error('URL ini bukan file audio.');
    const total = Number(r.headers.get('content-length')) || 0;
    const mime = type.startsWith('audio/') ? type : 'audio/mpeg';
    if (!r.body || !r.body.getReader) return new Blob([await r.blob()], { type: mime });
    const reader = r.body.getReader();
    const chunks = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      got += value.length;
      if (onProgress) onProgress(total ? got / total : null, got);
    }
    return new Blob(chunks, { type: mime });
  }

  /** Ambil gambar sebagai Blob (opsional, gagal -> null). */
  async function tryBlob(url, ms) {
    if (!url) return null;
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), ms || 4000);
      const r = await fetch(url, { signal: ctl.signal });
      clearTimeout(timer);
      if (!r.ok) return null;
      const b = await r.blob();
      return b.type.startsWith('image/') ? b : null;
    } catch (e) { return null; }
  }

  function nameFromUrl(url) {
    try {
      const seg = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() || '');
      return seg || 'Lagu unduhan';
    } catch (e) { return 'Lagu unduhan'; }
  }

  /** Cari lirik di LRCLIB. Mengutamakan versi tersinkron dengan durasi paling dekat. */
  async function findLyrics(track) {
    const base = 'https://lrclib.net/api/search?';
    const tries = [];
    const p1 = new URLSearchParams({ track_name: track.title });
    if (track.artist) p1.set('artist_name', track.artist);
    tries.push(p1);
    if (track.artist) tries.push(new URLSearchParams({ q: `${track.artist} ${track.title}` }));
    tries.push(new URLSearchParams({ q: track.title }));

    let lastErr = null;
    let failed = 0;
    for (const p of tries) {
      let list;
      try { list = await getJSON(base + p.toString()); } catch (e) { lastErr = e; failed++; continue; }
      if (!Array.isArray(list) || !list.length) continue;
      const withSync = list.filter((x) => x.syncedLyrics);
      const pool = withSync.length ? withSync : list.filter((x) => x.plainLyrics);
      if (!pool.length) continue;
      const dur = track.duration || 0;
      if (dur > 40) pool.sort((a, b) => Math.abs((a.duration || 0) - dur) - Math.abs((b.duration || 0) - dur));
      const best = pool[0];
      return {
        text: best.syncedLyrics || best.plainLyrics,
        synced: !!best.syncedLyrics,
        name: `${best.artistName || ''} - ${best.trackName || ''}`,
      };
    }
    if (failed === tries.length && lastErr) throw lastErr;
    return null;
  }

  NP.online = { searchSongs, downloadAudio, tryBlob, nameFromUrl, findLyrics };
})();
