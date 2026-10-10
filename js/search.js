/* search.js  Sheet "Cari & Unduh": kata kunci (iTunes) atau URL file audio. */
(function () {
  'use strict';
  const NP = window.NP;
  const { $, h, icon, hashHue, parseFileName } = NP.util;
  const { toast } = NP.ui;

  let input, status, results;

  const setStatus = (msg) => { status.textContent = msg || ''; };

  function progressBar() {
    const bar = h('div', { class: 'progress' }, h('i'));
    return { el: bar, set: (f) => bar.firstChild.style.setProperty('--v', f == null ? 0.15 : f) };
  }

  function thumbFor(item) {
    const t = h('span', { class: 'thumb' }, icon('music'));
    if (item.art) {
      const img = new Image();
      img.alt = '';
      img.onload = () => { t.style.backgroundImage = `url("${item.art}")`; t.classList.add('has-cover'); };
      img.src = item.art;
    }
    const hue = hashHue(item.title + item.artist);
    t.style.setProperty('--h1', hue);
    t.style.setProperty('--h2', (hue + 48) % 360);
    return t;
  }

  async function streamItem(item, btn) {
    btn.disabled = true;
    const cover = await NP.online.tryBlob(item.art);
    const t = await NP.library.addRemote({ title: item.title, artist: item.artist, album: item.album, url: item.previewUrl, duration: 30, cover });
    await NP.player.load(t, true);
    toast('Memutar cuplikan 30 detik.');
    NP.ui.close();
  }

  async function downloadItem(item, btn) {
    const label = btn.querySelector('span');
    btn.disabled = true;
    try {
      const blob = await NP.online.downloadAudio(item.previewUrl, (f) => { label.textContent = f == null ? 'Mengunduh' : `Mengunduh ${Math.round(f * 100)}%`; });
      const cover = await NP.online.tryBlob(item.art);
      await NP.library.addBlob(blob, { title: item.title, artist: item.artist, album: item.album, duration: 30, cover });
      label.textContent = 'Tersimpan';
      toast('Tersimpan ke pustaka.');
    } catch (e) {
      const cover = await NP.online.tryBlob(item.art);
      await NP.library.addRemote({ title: item.title, artist: item.artist, album: item.album, url: item.previewUrl, duration: 30, cover });
      label.textContent = 'Ditambahkan (stream)';
      toast('Browser memblokir unduhan (CORS). Lagu ditambahkan sebagai streaming.', 'warn');
    }
  }

  function renderResults(items) {
    results.replaceChildren(...items.map((item) => {
      const play = h('button', { class: 'btn-pill', type: 'button' }, icon('play', 'f tint-warm'), h('span', { text: 'Putar' }));
      const dl = h('button', { class: 'btn-pill', type: 'button' }, icon('download', 'tint-blue'), h('span', { text: 'Unduh' }));
      play.addEventListener('click', () => streamItem(item, play));
      dl.addEventListener('click', () => downloadItem(item, dl));
      return h('li', { class: 'result' },
        thumbFor(item),
        h('div', { class: 'row-meta' },
          h('span', { class: 'row-title', text: item.title }),
          h('span', { class: 'row-sub' }, h('span', { class: 't', text: item.artist }), h('span', { class: 'tag', text: '30 DTK' }))),
        h('div', { class: 'result-actions' }, play, dl));
    }));
  }

  async function handleQuery(q) {
    setStatus('Mencari…');
    results.replaceChildren();
    try {
      const items = await NP.online.searchSongs(q);
      setStatus(items.length ? `${items.length} hasil. Semua berupa cuplikan 30 detik.` : 'Tidak ada hasil. Coba kata kunci lain.');
      renderResults(items);
    } catch (e) {
      setStatus('Pencarian gagal. Periksa koneksi internet, atau browser memblokir permintaan ini.');
    }
  }

  async function handleUrl(url) {
    results.replaceChildren();
    const bar = progressBar();
    results.append(h('li', null, bar.el));
    setStatus('Mengunduh…');
    try {
      const blob = await NP.online.downloadAudio(url, (f) => {
        bar.set(f);
        setStatus(f == null ? 'Mengunduh…' : `Mengunduh ${Math.round(f * 100)}%`);
      });
      const guess = parseFileName(NP.online.nameFromUrl(url));
      const t = await NP.library.addBlob(blob, guess);
      setStatus('Tersimpan ke pustaka.');
      toast('Lagu diunduh dan disimpan.');
      await NP.player.load(t, true);
      NP.ui.close();
    } catch (e) {
      results.replaceChildren();
      setStatus('');
      const stream = h('button', { class: 'btn-pill', type: 'button' }, icon('cloud', 'tint-blue'), 'Putar sebagai stream');
      stream.addEventListener('click', async () => {
        const guess = parseFileName(NP.online.nameFromUrl(url));
        const t = await NP.library.addRemote({ title: guess.title, artist: guess.artist, url });
        await NP.player.load(t, true);
        NP.ui.close();
      });
      results.append(h('li', { class: 'result' },
        h('span', { class: 'thumb' }, icon('cloud')),
        h('div', { class: 'row-meta' },
          h('span', { class: 'row-title', text: 'Tidak bisa diunduh langsung' }),
          h('span', { class: 'row-sub' }, h('span', { text: 'Server menolak akses lintas-origin (CORS) atau tautan bukan file audio. Tautan masih bisa dicoba diputar sebagai streaming.', style: 'white-space:normal' }))),
        h('div', { class: 'result-actions' }, stream)));
    }
  }

  function init() {
    input = $('#searchInput');
    status = $('#searchStatus');
    results = $('#searchResults');
    $('#searchForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = input.value.trim();
      if (!v) return;
      if (/^https?:\/\//i.test(v)) handleUrl(v); else handleQuery(v);
    });
  }

  NP.search = { init, focus: () => setTimeout(() => input && input.focus(), 380) };
})();
