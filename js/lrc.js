/* lrc.js  Parser dan penulis format .lrc (bisa dites di Node). */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const NP = (root.NP = root.NP || {});

  const STAMP = /^\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/;
  const META = /^\[([A-Za-z#]+):(.*)\]$/;
  const META_KEYS = new Set(['ti', 'ar', 'al', 'au', 'by', 'length', 'offset', 're', 've', 'id', 'la', 'tool']);
  const pad = (n) => String(n).padStart(2, '0');

  function toSeconds(m) {
    const frac = m[3] ? parseFloat('0.' + m[3]) : 0;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + frac;
  }

  /** Teks -> baris non-kosong */
  function plainLines(text) {
    return String(text || '').replace(/^﻿/, '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  }

  /** Parse LRC atau teks polos -> {lines:[{t,text}], synced, meta} */
  function parse(text) {
    const meta = {};
    const out = [];
    let synced = false;

    for (const row of plainLines(text)) {
      const mm = row.match(META);
      if (mm && META_KEYS.has(mm[1].toLowerCase())) { meta[mm[1].toLowerCase()] = mm[2].trim(); continue; }

      const stamps = [];
      let rest = row;
      let m;
      while ((m = rest.match(STAMP))) {
        stamps.push(toSeconds(m));
        rest = rest.slice(m[0].length).replace(/^\s+/, '');
      }
      rest = rest.replace(/<\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?>/g, '').trim();

      if (stamps.length) {
        synced = true;
        for (const t of stamps) out.push({ t, text: rest });
      } else {
        out.push({ t: null, text: row });
      }
    }

    let lines = out;
    if (synced) {
      const off = parseInt(meta.offset, 10);
      const shift = isNaN(off) ? 0 : off / 1000;
      lines = out.filter((l) => l.t !== null).map((l) => ({ t: Math.max(0, l.t - shift), text: l.text }));
      lines.sort((a, b) => a.t - b.t);
    }
    return { lines, synced, meta };
  }

  /** Detik -> "[mm:ss.xx]" */
  function stamp(t) {
    const cs = Math.max(0, Math.round(t * 100));
    const m = Math.floor(cs / 6000);
    const s = Math.floor((cs % 6000) / 100);
    return `[${pad(m)}:${pad(s)}.${pad(cs % 100)}]`;
  }

  /** Susun file .lrc. Baris tanpa waktu dilewati. */
  function toLRC(opts) {
    const head = [];
    if (opts.title) head.push(`[ti:${opts.title}]`);
    if (opts.artist) head.push(`[ar:${opts.artist}]`);
    if (opts.album) head.push(`[al:${opts.album}]`);
    if (opts.length) {
      const L = Math.round(opts.length);
      head.push(`[length:${pad(Math.floor(L / 60))}:${pad(L % 60)}]`);
    }
    head.push('[by:Soft Player]');
    const body = opts.lines.filter((l) => l.t != null).map((l) => `${stamp(l.t)}${l.text}`);
    return head.concat(body).join('\n') + '\n';
  }

  /** Indeks baris aktif (terakhir yang t <= waktu), -1 bila belum ada */
  function activeIndex(lines, t) {
    let lo = 0, hi = lines.length - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (lines[mid].t <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return ans;
  }

  NP.lrc = { parse, plainLines, stamp, toLRC, activeIndex };
  if (typeof module !== 'undefined' && module.exports) module.exports = NP.lrc;
})();
