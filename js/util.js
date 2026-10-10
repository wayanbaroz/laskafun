/* util.js  Helper umum + event bus. Semua modul menempel ke window.NP. */
(function () {
  'use strict';
  const NP = (window.NP = window.NP || {});

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /** Buat elemen: h('div', {class:'x', onclick:fn}, child, ...) */
  function h(tag, attrs, ...kids) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'dataset') Object.assign(node.dataset, v);
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return node;
  }

  /** Ikon dari sprite di index.html */
  function icon(name, cls) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'ico ' + (cls || ''));
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(NS, 'use');
    use.setAttribute('href', '#i-' + name);
    svg.append(use);
    return svg;
  }

  function setIcon(svg, name) {
    const use = svg && svg.querySelector('use');
    if (use) use.setAttribute('href', '#i-' + name);
  }

  const clamp = (n, a, b) => Math.min(b === undefined ? 1 : b, Math.max(a === undefined ? 0 : a, n));

  function fmtTime(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    sec = Math.floor(sec);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m >= 60) return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function hashHue(str) {
    let x = 7;
    const s = String(str || '');
    for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) >>> 0;
    return x % 360;
  }

  /** "01 - Artis - Judul.mp3" -> {artist, title} */
  function parseFileName(name) {
    const base = String(name || '')
      .replace(/\.[^.]+$/, '')
      .replace(/_+/g, ' ')
      .replace(/^\d{1,3}[\s.\-)]+(?=\D)/, '')
      .trim();
    const parts = base.split(/\s+[-–—]\s+/);
    if (parts.length >= 2) return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };
    return { artist: '', title: base || String(name || 'Tanpa judul') };
  }

  const safeName = (s) => String(s || 'lirik').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim() || 'lirik';

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function readText(file) {
    if (file.text) return file.text();
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(fr.error);
      fr.readAsText(file);
    });
  }

  function debounce(fn, ms) {
    let t = 0;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  }

  /** Bus event sederhana */
  const listeners = new Map();
  const bus = {
    on(evt, fn) {
      if (!listeners.has(evt)) listeners.set(evt, new Set());
      listeners.get(evt).add(fn);
      return () => listeners.get(evt).delete(fn);
    },
    emit(evt, data) {
      const set = listeners.get(evt);
      if (set) Array.from(set).forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } });
    },
  };

  NP.util = { $, $$, h, icon, setIcon, clamp, fmtTime, uid, hashHue, parseFileName, safeName, downloadBlob, readText, debounce, bus };
  NP.bus = bus;
})();
