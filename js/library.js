/* library.js  Daftar lagu: tambah, hapus, urutkan, simpan ke IndexedDB, render sheet Pustaka. */
(function () {
  'use strict';
  const NP = window.NP;
  const { $, h, icon, fmtTime, uid, hashHue, parseFileName, bus } = NP.util;

  let tracks = [];
  const covers = new Map(); // id -> object URL

  const AUDIO_EXT = /\.(mp3|wav|m4a|aac|ogg|oga|opus|flac|weba|mp4)$/i;
  const isAudio = (f) => (f.type && f.type.startsWith('audio/')) || AUDIO_EXT.test(f.name || '');

  const list = () => tracks;
  const get = (id) => tracks.find((t) => t.id === id) || null;
  const nextOrder = () => tracks.reduce((m, t) => Math.max(m, t.order), 0) + 1;

  function coverUrl(t) {
    if (!t || !t.cover) return null;
    if (!covers.has(t.id)) covers.set(t.id, URL.createObjectURL(t.cover));
    return covers.get(t.id);
  }

  async function persist(t) {
    try { await NP.store.put(t); return true; } catch (e) {
      NP.ui.toast('Penyimpanan penuh. Lagu hanya tersedia selama sesi ini.', 'warn');
      return false;
    }
  }

  function probeDuration(blob) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const a = new Audio();
      let done = false;
      const finish = (d) => { if (done) return; done = true; URL.revokeObjectURL(url); resolve(isFinite(d) ? d : 0); };
      a.preload = 'metadata';
      a.onloadedmetadata = () => finish(a.duration);
      a.onerror = () => finish(0);
      setTimeout(() => finish(a.duration), 5000);
      a.src = url;
    });
  }

  async function addTrack(t) {
    t.order = nextOrder();
    tracks.push(t);
    renderList();
    bus.emit('library:changed');
    await persist(t);
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    return t;
  }

  /** File audio dari perangkat */
  async function addFiles(files) {
    const added = [];
    let skipped = 0;
    for (const file of files) {
      if (!isAudio(file)) { skipped++; continue; }
      const tags = await NP.id3.read(file);
      const guess = parseFileName(file.name);
      const t = {
        id: uid(),
        title: (tags && tags.title) || guess.title,
        artist: (tags && tags.artist) || guess.artist,
        album: (tags && tags.album) || '',
        duration: await probeDuration(file),
        blob: file,
        url: null,
        cover: (tags && tags.cover) || null,
        lyrics: null,
        added: Date.now(),
      };
      added.push(await addTrack(t));
    }
    if (skipped) NP.ui.toast(`${skipped} file dilewati karena bukan audio.`, 'warn');
    return added;
  }

  /** Audio hasil unduhan (Blob) */
  function addBlob(blob, meta) {
    return addTrack({
      id: uid(), title: meta.title || 'Tanpa judul', artist: meta.artist || '', album: meta.album || '',
      duration: meta.duration || 0, blob, url: null, cover: meta.cover || null, lyrics: null, added: Date.now(),
    });
  }

  /** Tautan streaming (tanpa menyimpan berkas) */
  function addRemote(meta) {
    return addTrack({
      id: uid(), title: meta.title || 'Tanpa judul', artist: meta.artist || '', album: meta.album || '',
      duration: meta.duration || 0, blob: null, url: meta.url, cover: meta.cover || null, lyrics: null, added: Date.now(),
    });
  }

  async function remove(id) {
    const index = tracks.findIndex((t) => t.id === id);
    if (index < 0) return;
    tracks.splice(index, 1);
    if (covers.has(id)) { URL.revokeObjectURL(covers.get(id)); covers.delete(id); }
    try { await NP.store.remove(id); } catch (e) { /* abaikan */ }
    renderList();
    bus.emit('library:removed', { id, index });
    bus.emit('library:changed');
  }

  async function move(id, dir) {
    const i = tracks.findIndex((t) => t.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= tracks.length) return;
    const a = tracks[i], b = tracks[j];
    const o = a.order; a.order = b.order; b.order = o;
    tracks[i] = b; tracks[j] = a;
    renderList();
    bus.emit('library:changed');
    await persist(a);
    await persist(b);
  }

  async function setLyrics(id, text) {
    const t = get(id);
    if (!t) return;
    t.lyrics = text && text.trim() ? text : null;
    renderList();
    bus.emit('lyrics:changed', id);
    await persist(t);
  }

  function setDuration(id, d) {
    const t = get(id);
    if (!t) return;
    t.duration = d;
    persist(t);
    renderList();
  }

  /* ---------- Render sheet Pustaka ---------- */
  function applyThumb(el, t) {
    const url = coverUrl(t);
    if (url) {
      el.style.backgroundImage = `url("${url}")`;
      el.classList.add('has-cover');
    } else {
      const hue = hashHue(t.title + t.artist);
      el.style.setProperty('--h1', hue);
      el.style.setProperty('--h2', (hue + 48) % 360);
      el.classList.remove('has-cover');
      el.style.backgroundImage = '';
    }
  }

  function rowFor(t, i) {
    const thumb = h('span', { class: 'thumb' }, icon('music'), h('span', { class: 'eq', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')));
    applyThumb(thumb, t);

    const tags = [];
    if (t.lyrics) tags.push(h('span', { class: 'tag', text: /\[\d{1,3}:\d{1,2}/.test(t.lyrics) ? 'LRC' : 'TXT' }));
    if (!t.blob) tags.push(h('span', { class: 'tag', text: 'STREAM' }));

    const main = h('button', { class: 'row-main', type: 'button', 'aria-label': `Putar ${t.title}`, onclick: () => NP.player.load(t, true) },
      thumb,
      h('span', { class: 'row-meta' },
        h('span', { class: 'row-title', text: t.title }),
        h('span', { class: 'row-sub' },
          h('span', { class: 't', text: `${t.artist || 'Artis tidak diketahui'}${t.duration ? ' · ' + fmtTime(t.duration) : ''}` }),
          ...tags)));

    const up = h('button', { class: 'btn btn-round btn-xs', type: 'button', 'aria-label': 'Naikkan urutan', onclick: () => move(t.id, -1) }, icon('up'));
    const down = h('button', { class: 'btn btn-round btn-xs', type: 'button', 'aria-label': 'Turunkan urutan', onclick: () => move(t.id, 1) }, icon('down'));
    const del = h('button', { class: 'btn btn-round btn-xs', type: 'button', 'aria-label': `Hapus ${t.title}` }, icon('trash'));
    if (i === 0) up.disabled = true;
    if (i === tracks.length - 1) down.disabled = true;
    NP.ui.arm(del, () => remove(t.id), 'Ketuk lagi untuk menghapus lagu ini');

    return h('li', { class: 'track-row', dataset: { id: t.id } }, main, h('div', { class: 'row-actions' }, up, down, del));
  }

  function renderList() {
    const ul = $('#libraryList');
    if (!ul) return;
    ul.replaceChildren(...tracks.map(rowFor));
    $('#libEmpty').hidden = tracks.length > 0;
    $('#libMeta').textContent = tracks.length ? `${tracks.length} lagu` : '';
    markCurrent();
  }

  function markCurrent() {
    const cur = NP.player && NP.player.track();
    const playing = NP.player && NP.player.isPlaying();
    document.querySelectorAll('#libraryList .track-row').forEach((li) => {
      const on = !!cur && li.dataset.id === cur.id;
      li.classList.toggle('is-current', on);
      li.classList.toggle('is-playing', on && playing);
    });
  }

  async function init() {
    const all = await NP.store.all();
    tracks = all.sort((a, b) => a.order - b.order);
    renderList();
    bus.emit('library:changed');
    bus.on('track', markCurrent);
    bus.on('playing', markCurrent);
  }

  NP.library = { init, list, get, coverUrl, addFiles, addBlob, addRemote, remove, move, setLyrics, setDuration, applyThumb, markCurrent };
})();
