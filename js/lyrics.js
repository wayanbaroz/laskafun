/* lyrics.js  Tampilan lirik: auto-scroll, highlight baris aktif, klik untuk loncat. */
(function () {
  'use strict';
  const NP = window.NP;
  const { $, h, bus } = NP.util;

  let box, chip, peek;
  let parsed = { lines: [], synced: false, meta: {} };
  let els = [];
  let active = -2;
  let userScrollUntil = 0;
  let visible = false;

  const DEFAULT_PEEK = 'Lirik akan tampil di sini';

  function button(label, fn) {
    return h('button', { class: 'btn-pill', type: 'button', onclick: fn }, label);
  }

  function empty(title, text, actions) {
    return h('div', { class: 'lyrics-empty' },
      h('strong', { text: title }),
      h('p', { text }),
      h('div', { class: 'lyrics-actions' }, ...actions));
  }

  function render() {
    const track = NP.player.track();
    box.replaceChildren();
    box.classList.remove('lyrics-plain');
    els = [];
    active = -2;
    chip.hidden = true;

    if (!track) {
      box.append(empty('Belum ada lagu', 'Impor atau putar lagu terlebih dahulu.', [
        button('Impor lagu', () => NP.actions.importSongs()),
      ]));
      setPeek(DEFAULT_PEEK, false);
      return;
    }

    if (!parsed.lines.length) {
      box.append(empty('Lirik belum ada', 'Impor file .lrc atau .txt, cari online, atau tulis dan sinkronkan sendiri.', [
        button('Impor lirik', () => NP.actions.importLyrics()),
        button('Cari online', () => NP.actions.findLyricsOnline()),
        button('Tap Sync', () => NP.actions.openEditor()),
      ]));
      setPeek('Belum ada lirik untuk lagu ini', false);
      return;
    }

    chip.hidden = false;
    chip.textContent = parsed.synced ? 'Tersinkron' : 'Lirik polos';
    box.classList.toggle('lyrics-plain', !parsed.synced);

    box.append(h('div', { class: 'lyrics-pad' }));
    parsed.lines.forEach((line, i) => {
      const el = h('p', {
        class: 'lyric-line',
        text: line.text || '♪',
        onclick: () => {
          if (!parsed.synced) return;
          NP.player.seek(line.t);
          if (!NP.player.isPlaying()) NP.player.play();
        },
      });
      els.push(el);
      box.append(el);
    });
    if (!parsed.synced) {
      box.append(h('div', { class: 'lyrics-note' },
        h('span', { text: 'Lirik ini belum punya penanda waktu.' }),
        button('Sinkronkan dengan Tap Sync', () => NP.actions.openEditor())));
      setPeek('Lirik polos. Sinkronkan agar berjalan otomatis.', false);
    }
    box.append(h('div', { class: 'lyrics-pad' }));
    tick(NP.player.time());
  }

  function setPeek(text, live) {
    if (peek.textContent !== text) peek.textContent = text;
    peek.classList.toggle('is-live', !!live);
  }

  function setTrack(track) {
    const text = track && track.lyrics;
    parsed = text ? NP.lrc.parse(text) : { lines: [], synced: false, meta: {} };
    render();
  }

  function setActive(idx) {
    active = idx;
    for (let i = 0; i < els.length; i++) {
      els[i].classList.toggle('is-active', i === idx);
      els[i].classList.toggle('is-past', i < idx);
    }
    const line = parsed.lines[idx];
    setPeek(line ? (line.text || '♪') : 'Menunggu baris pertama', !!line);
    if (idx >= 0) scrollTo(idx, false);
  }

  function scrollTo(idx, instant) {
    if (!visible || !els[idx]) return;
    if (!instant && Date.now() < userScrollUntil) return;
    const el = els[idx];
    const top = el.offsetTop - box.clientHeight / 2 + el.offsetHeight / 2;
    box.scrollTo({ top, behavior: instant ? 'auto' : 'smooth' });
  }

  function tick(t) {
    if (!parsed.synced || !els.length) return;
    const idx = NP.lrc.activeIndex(parsed.lines, t + 0.05);
    if (idx !== active) setActive(idx);
  }

  function onShow(show) {
    visible = show;
    if (show) requestAnimationFrame(() => { if (active >= 0) scrollTo(active, true); });
  }

  function init() {
    box = $('#lyricsScroll');
    chip = $('#lyricsChip');
    peek = $('#peekLine');
    const hold = () => { userScrollUntil = Date.now() + 3500; };
    ['touchstart', 'wheel', 'pointerdown'].forEach((ev) => box.addEventListener(ev, hold, { passive: true }));
    bus.on('track', setTrack);
    bus.on('lyrics:changed', (id) => { const t = NP.player.track(); if (t && t.id === id) setTrack(t); });
    bus.on('tick', tick);
    render();
  }

  NP.lyricsView = { init, setTrack, onShow };
})();
