/* app.js  Perakitan: bind tombol, sinkronisasi UI dengan event pemutar, boot. */
(function () {
  'use strict';
  const NP = window.NP;
  const { $, $$, hashHue, setIcon, bus, readText } = NP.util;
  const ui = NP.ui;
  const player = NP.player;
  const library = NP.library;
  const toast = ui.toast;

  const el = {};

  /* ---------- Aksi (dipakai menu dan modul lain) ---------- */
  const actions = (NP.actions = {
    importSongs() { $('#fileSongs').click(); },
    importLyrics() {
      if (!player.track()) { toast('Putar atau pilih lagu dulu, lalu impor liriknya.'); return; }
      $('#fileLyrics').click();
    },
    openSearch() { ui.open('search'); NP.search.focus(); },
    openLibrary() { ui.open('library'); },
    openEditor() { NP.editor.open(); },
    async findLyricsOnline() {
      const t = player.track();
      if (!t) { toast('Putar atau pilih lagu dulu.'); return; }
      toast('Mencari lirik…');
      try {
        const r = await NP.online.findLyrics(t);
        if (!r) { toast('Lirik tidak ditemukan.'); return; }
        await library.setLyrics(t.id, r.text);
        toast(r.synced ? 'Lirik tersinkron ditemukan.' : 'Lirik polos ditemukan. Sinkronkan dengan Tap Sync.');
      } catch (e) {
        toast('Gagal mencari lirik. Periksa koneksi internet.', 'warn');
      }
    },
    showMode(mode) {
      const lyr = mode === 'lyrics';
      $('#viewPlayer').hidden = lyr;
      $('#viewLyrics').hidden = !lyr;
      $$('.seg-btn').forEach((b) => {
        const on = b.dataset.mode === mode;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-selected', String(on));
      });
      NP.lyricsView.onShow(lyr);
      NP.store.setPref('mode', mode);
    },
  });

  /* ---------- Sinkronisasi UI ---------- */
  function updateNow(t) {
    el.title.textContent = t ? t.title : 'Belum ada lagu';
    el.artist.textContent = t ? (t.artist || 'Artis tidak diketahui') : 'Impor lagu lewat menu';
    document.title = t ? `${t.title} · Soft Player` : 'Soft Player';

    const art = el.art;
    const cover = t && library.coverUrl(t);
    if (cover) {
      art.style.backgroundImage = `url("${cover}")`;
      art.classList.add('has-cover');
    } else {
      art.style.backgroundImage = '';
      art.classList.remove('has-cover');
      const hue = t ? hashHue(t.title + t.artist) : 8;
      art.style.setProperty('--h1', hue);
      art.style.setProperty('--h2', (hue + 48) % 360);
    }
    updateQueue();
  }

  function updateQueue() {
    const list = library.list();
    const t = player.track();
    if (!list.length) el.queue.textContent = 'Belum ada lagu';
    else {
      const i = t ? list.findIndex((x) => x.id === t.id) : -1;
      el.queue.textContent = i >= 0 ? `Lagu ${i + 1} dari ${list.length}` : `${list.length} lagu di pustaka`;
    }
    $('#libCount').textContent = String(list.length);
    $('#btnEmptyImport').hidden = list.length > 0;
  }

  function updateModes(m) {
    const sh = $('#btnShuffle');
    sh.setAttribute('aria-pressed', String(m.shuffle));
    sh.setAttribute('aria-label', m.shuffle ? 'Acak: hidup' : 'Acak: mati');
    const rp = $('#btnRepeat');
    rp.setAttribute('aria-pressed', String(m.repeat !== 'off'));
    rp.setAttribute('aria-label', 'Ulangi: ' + (m.repeat === 'off' ? 'mati' : m.repeat === 'all' ? 'semua lagu' : 'satu lagu'));
    $('#repeatBadge').hidden = m.repeat !== 'one';
  }

  async function updateStorageInfo() {
    let text = 'Lagu disimpan di browser ini.';
    try {
      if (!NP.store.isPersistent()) text = 'Penyimpanan permanen tidak tersedia. Lagu hilang saat halaman ditutup.';
      else if (navigator.storage && navigator.storage.estimate) {
        const e = await navigator.storage.estimate();
        const mb = (n) => Math.round((n || 0) / 1048576);
        text = `Penyimpanan perangkat: ${mb(e.usage)} MB terpakai dari ${mb(e.quota)} MB.`;
      }
    } catch (e) { /* biarkan teks bawaan */ }
    $('#storageInfo').textContent = text;
  }

  /* ---------- Input berkas ---------- */
  async function onSongs(files, input) {
    if (!files.length) return;
    try {
      toast(files.length === 1 ? 'Mengimpor 1 file…' : `Mengimpor ${files.length} file…`);
      const added = await library.addFiles(files);
      if (!added.length) return;
      toast(added.length === 1 ? 'Lagu ditambahkan.' : `${added.length} lagu ditambahkan.`);
      if (!player.track() || !player.isPlaying()) await player.load(added[0], true);
    } catch (e) {
      toast('Gagal mengimpor: ' + ((e && e.message) || e), 'warn');
    } finally {
      if (input) input.value = ''; // dikosongkan setelah selesai agar file yang sama bisa dipilih lagi
    }
  }

  async function onLyrics(file) {
    const t = player.track();
    if (!file || !t) return;
    try {
      const text = await readText(file);
      const parsed = NP.lrc.parse(text);
      if (!parsed.lines.length) { toast('File lirik kosong atau tidak terbaca.', 'warn'); return; }
      await library.setLyrics(t.id, text);
      toast(parsed.synced ? 'Lirik tersinkron diimpor.' : 'Lirik polos diimpor. Sinkronkan dengan Tap Sync.');
      actions.showMode('lyrics');
    } catch (e) { toast('Gagal membaca file lirik.', 'warn'); }
  }

  /* ---------- Bind ---------- */
  function bind() {
    $('#btnMenu').addEventListener('click', () => ui.open('drawer'));
    $('#btnSearch').addEventListener('click', actions.openSearch);
    // Menu tidak ditutup sebelum picker terbuka: input.click() harus langsung di dalam ketukan pengguna.
    $$('.menu-item').forEach((b) => b.addEventListener('click', () => actions[b.dataset.action]()));
    $('#btnLibAdd').addEventListener('click', actions.importSongs);
    $('#btnEmptyImport').addEventListener('click', actions.importSongs);
    $$('.seg-btn').forEach((b) => b.addEventListener('click', () => actions.showMode(b.dataset.mode)));

    $('#btnPlay').addEventListener('click', () => player.toggle());
    $('#btnNext').addEventListener('click', () => player.next());
    $('#btnPrev').addEventListener('click', () => player.prev());
    $('#btnShuffle').addEventListener('click', () => player.toggleShuffle());
    $('#btnRepeat').addEventListener('click', () => player.cycleRepeat());
    $('#disk').addEventListener('click', () => player.toggle());

    $('#fileSongs').addEventListener('change', (e) => {
      const input = e.target;
      const files = Array.from(input.files || []);
      if (ui.current() === 'drawer') ui.close();
      onSongs(files, input);
    });
    $('#fileLyrics').addEventListener('change', async (e) => {
      const input = e.target;
      const file = input.files && input.files[0];
      if (ui.current() === 'drawer') ui.close();
      try { await onLyrics(file); } finally { input.value = ''; }
    });

    document.addEventListener('keydown', (e) => {
      if (ui.current()) return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (['input', 'textarea', 'button'].includes(tag) || e.target.getAttribute('role') === 'slider') return;
      if (e.code === 'Space') { e.preventDefault(); player.toggle(); }
      else if (e.code === 'ArrowRight') player.seek(player.time() + 5);
      else if (e.code === 'ArrowLeft') player.seek(player.time() - 5);
    });

    bus.on('track', (t) => { updateNow(t); if (t) NP.store.setPref('last', t.id); });
    bus.on('playing', (p) => {
      setIcon($('#playIcon'), p ? 'pause' : 'play');
      $('#btnPlay').setAttribute('aria-label', p ? 'Jeda' : 'Putar');
      el.disk.dataset.playing = String(p);
    });
    bus.on('modes', updateModes);
    bus.on('library:changed', updateQueue);
    bus.on('error', (m) => toast(m, 'warn'));
    bus.on('need-track', () => { toast('Impor lagu dulu lewat menu.'); ui.open('drawer'); });
    bus.on('sheet', (n) => { if (n === 'drawer') updateStorageInfo(); });
  }

  /* ---------- Boot ---------- */
  async function boot() {
    Object.assign(el, { title: $('#nowTitle'), artist: $('#nowArtist'), art: $('#diskArt'), disk: $('#disk'), queue: $('#queueInfo') });
    ui.init();
    bind();
    NP.sliders.init();
    NP.lyricsView.init();
    NP.editor.init();
    NP.search.init();
    updateModes(player.state());

    await NP.store.init();
    await library.init();

    const last = NP.store.pref('last', null);
    const t = last && library.get(last);
    if (t) await player.load(t, false);
    actions.showMode(NP.store.pref('mode', 'player'));
    if (!NP.store.isPersistent()) toast('Penyimpanan permanen tidak tersedia. Lagu hanya tersimpan selama sesi ini.', 'warn');
  }

  // Tampilkan kesalahan tak terduga sebagai toast supaya mudah dilaporkan.
  window.addEventListener('error', (e) => toast('Kesalahan: ' + (e.message || 'tidak diketahui'), 'warn'));
  window.addEventListener('unhandledrejection', (e) => toast('Kesalahan: ' + ((e.reason && e.reason.message) || e.reason || 'tidak diketahui'), 'warn'));

  const start = () => boot().catch((e) => toast('Gagal memulai: ' + ((e && e.message) || e), 'warn'));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
