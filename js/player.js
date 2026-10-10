/* player.js  Mesin audio: antrean, acak, ulangi, media session. */
(function () {
  'use strict';
  const NP = window.NP;
  const { bus, clamp } = NP.util;
  const store = NP.store;

  const audio = new Audio();
  audio.preload = 'metadata';
  audio.setAttribute('playsinline', '');

  const s = {
    repeat: store.pref('repeat', 'off'), // off | all | one
    shuffle: !!store.pref('shuffle', false),
    volume: clamp(Number(store.pref('volume', 0.8)), 0, 1),
    muted: false,
  };
  let current = null;
  let objUrl = null;
  let hist = [];
  let raf = 0;
  let pendingPlay = false; // apakah lagu yang sedang dimuat harus langsung diputar
  let retried = null;      // id lagu yang sudah dicoba ulang dari memori

  audio.volume = s.volume;

  function revoke() { if (objUrl) { URL.revokeObjectURL(objUrl); objUrl = null; } }

  function sourceFor(t) {
    if (t.blob) { objUrl = URL.createObjectURL(t.blob); return objUrl; }
    return t.url || '';
  }

  async function load(track, autoplay) {
    if (!track) return unload();
    revoke();
    current = track;
    retried = null;
    pendingPlay = autoplay !== false;
    audio.src = sourceFor(track);
    audio.load();
    bus.emit('track', track);
    mediaSession(track);
    if (autoplay !== false) await play();
  }

  function unload() {
    audio.pause();
    revoke();
    current = null;
    audio.removeAttribute('src');
    audio.load();
    bus.emit('track', null);
    bus.emit('playing', false);
    bus.emit('tick', 0);
  }

  async function play() {
    if (!current) {
      const list = NP.library.list();
      if (list.length) return load(list[0], true);
      bus.emit('need-track');
      return;
    }
    try { await audio.play(); } catch (e) {
      if (e && e.name === 'NotAllowedError') bus.emit('error', 'Ketuk tombol putar untuk memulai.');
      // NotSupportedError ditangani oleh event 'error' audio (pemulihan otomatis + pesan rinci).
      else if (e && e.name !== 'AbortError' && e.name !== 'NotSupportedError') bus.emit('error', 'Lagu ini tidak bisa diputar di browser ini.');
    }
  }

  const pause = () => audio.pause();
  const toggle = () => (audio.paused ? play() : audio.pause());

  function seek(t) {
    if (!current) return;
    const d = audio.duration;
    audio.currentTime = isFinite(d) ? clamp(t, 0, d) : Math.max(0, t);
  }

  function indexOfCurrent(list) { return current ? list.findIndex((t) => t.id === current.id) : -1; }

  function next(auto) {
    const list = NP.library.list();
    if (!list.length) return;
    const i = indexOfCurrent(list);
    let n;
    if (s.shuffle && list.length > 1) {
      do { n = Math.floor(Math.random() * list.length); } while (n === i);
    } else {
      n = i + 1;
      if (n >= list.length) {
        if (auto === true && s.repeat === 'off') { audio.pause(); audio.currentTime = 0; return; }
        n = 0;
      }
    }
    if (current) { hist.push(current.id); hist = hist.slice(-50); }
    return load(list[n], true);
  }

  function prev() {
    if (audio.currentTime > 3) { seek(0); return; }
    const list = NP.library.list();
    if (!list.length) return;
    if (s.shuffle && hist.length) {
      const id = hist.pop();
      const t = list.find((x) => x.id === id);
      if (t) return load(t, true);
    }
    const i = indexOfCurrent(list);
    return load(list[(i - 1 + list.length) % list.length], true);
  }

  function emitModes() { bus.emit('modes', { repeat: s.repeat, shuffle: s.shuffle }); }
  function toggleShuffle() { s.shuffle = !s.shuffle; store.setPref('shuffle', s.shuffle); emitModes(); }
  function cycleRepeat() {
    s.repeat = s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off';
    store.setPref('repeat', s.repeat);
    emitModes();
  }

  function setVolume(v) {
    s.volume = clamp(v, 0, 1);
    s.muted = false;
    audio.muted = false;
    audio.volume = s.volume;
    store.setPref('volume', s.volume);
    bus.emit('volume', { volume: s.volume, muted: false });
  }
  function toggleMute() {
    s.muted = !s.muted;
    audio.muted = s.muted;
    bus.emit('volume', { volume: s.volume, muted: s.muted });
  }

  /* --- event audio --- */
  audio.addEventListener('play', () => {
    bus.emit('playing', true);
    cancelAnimationFrame(raf);
    const loop = () => { bus.emit('tick', audio.currentTime); raf = requestAnimationFrame(loop); };
    loop();
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
  });
  audio.addEventListener('pause', () => {
    cancelAnimationFrame(raf);
    bus.emit('playing', false);
    bus.emit('tick', audio.currentTime);
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
  });
  audio.addEventListener('ended', () => {
    if (s.repeat === 'one') { audio.currentTime = 0; play(); return; }
    next(true);
  });
  ['seeked', 'durationchange', 'timeupdate'].forEach((ev) => audio.addEventListener(ev, () => bus.emit('tick', audio.currentTime)));
  audio.addEventListener('loadedmetadata', () => {
    if (current && isFinite(audio.duration) && Math.abs((current.duration || 0) - audio.duration) > 0.5) {
      NP.library.setDuration(current.id, audio.duration);
    }
    bus.emit('tick', audio.currentTime);
  });
  function describeError(code) {
    const t = current;
    if (!t) return 'Gagal memuat audio.';
    if (code === 4) {
      const type = (t.blob && t.blob.type) || '';
      const size = t.blob ? (t.blob.size / 1048576).toFixed(1) + ' MB' : 'stream';
      const can = type ? audio.canPlayType(type) || 'tidak' : '-';
      return `Format tidak didukung browser ini (${type || 'tipe tak dikenal'}, ${size}, canPlayType: ${can}).`;
    }
    if (code === 3) return 'File audio rusak atau tidak bisa didekode.';
    if (code === 2) return 'Gagal memuat audio (jaringan terputus).';
    return 'Gagal memuat audio.';
  }

  audio.addEventListener('error', async () => {
    if (!current) return;
    const code = audio.error ? audio.error.code : 0;

    // Percobaan pemulihan: blob yang ditunjuk bisa file-backed (dari IndexedDB atau pemilih file)
    // dan sebagian browser HP gagal memutarnya. Baca penuh ke memori, beri MIME dari isi file, coba sekali lagi.
    if (current.blob && retried !== current.id) {
      const t = current;
      retried = t.id;
      try {
        const mime = (await NP.mime.sniff(t.blob)) || NP.mime.fromType(t.blob.type) || 'audio/mpeg';
        const buf = await NP.mime.readBuffer(t.blob);
        if (current !== t) return;
        revoke();
        objUrl = URL.createObjectURL(new Blob([buf], { type: mime }));
        audio.src = objUrl;
        audio.load();
        if (pendingPlay) await play();
        return;
      } catch (e) { /* lanjut ke pesan kesalahan */ }
    }
    bus.emit('error', describeError(code));
  });

  /* Jika lagu yang diputar dihapus, lanjut ke lagu di posisi yang sama */
  bus.on('library:removed', ({ id, index }) => {
    if (!current || current.id !== id) return;
    const wasPlaying = !audio.paused;
    const list = NP.library.list();
    if (list.length) load(list[Math.min(index, list.length - 1)], wasPlaying);
    else unload();
  });

  function mediaSession(t) {
    if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
    try {
      const cover = NP.library.coverUrl(t);
      navigator.mediaSession.metadata = new MediaMetadata({
        title: t.title, artist: t.artist || '', album: t.album || 'Soft Player',
        artwork: cover ? [{ src: cover, sizes: '512x512', type: (t.cover && t.cover.type) || 'image/jpeg' }] : [],
      });
    } catch (e) { /* abaikan */ }
  }
  if ('mediaSession' in navigator) {
    const set = (a, fn) => { try { navigator.mediaSession.setActionHandler(a, fn); } catch (e) { /* tidak didukung */ } };
    set('play', () => play());
    set('pause', () => pause());
    set('previoustrack', () => prev());
    set('nexttrack', () => next());
    set('seekto', (d) => seek(d.seekTime));
    set('seekbackward', () => seek(audio.currentTime - 10));
    set('seekforward', () => seek(audio.currentTime + 10));
  }

  NP.player = {
    load, unload, play, pause, toggle, seek, next, prev,
    toggleShuffle, cycleRepeat, setVolume, toggleMute,
    track: () => current,
    time: () => audio.currentTime,
    duration: () => (isFinite(audio.duration) ? audio.duration : (current && current.duration) || 0),
    isPlaying: () => !audio.paused,
    state: () => ({ repeat: s.repeat, shuffle: s.shuffle, volume: s.volume, muted: s.muted }),
  };
})();
