/* editor.js  Editor lirik manual: tempel teks, TAP SYNC saat lagu berputar, ekspor .lrc. */
(function () {
  'use strict';
  const NP = window.NP;
  const { $, h, setIcon, safeName, downloadBlob, bus } = NP.util;
  const { toast } = NP.ui;

  let lines = [];        // [{text, t|null}]
  let cursor = 0;        // baris yang menunggu ketukan
  let stage = 'text';    // text | sync
  let comp = Number(NP.store.pref('tapComp', 0.15)); // kompensasi jeda ketuk (dtk)
  let sessionTrack = null;
  const el = {};

  function showStage(name) {
    stage = name;
    el.stageText.hidden = name !== 'text';
    el.stageSync.hidden = name !== 'sync';
    if (name === 'sync') render();
  }

  function render() {
    const done = lines.filter((l) => l.t != null).length;
    el.count.textContent = `${done} / ${lines.length}`;
    el.prev.textContent = cursor > 0 ? lines[cursor - 1].text || '♪' : '';
    el.next.textContent = cursor < lines.length ? lines[cursor].text || '♪' : 'Selesai';

    el.list.replaceChildren(...lines.map((l, i) => {
      const cls = 'sync-line' + (i === cursor ? ' is-cursor' : '') + (l.t != null ? ' is-done' : '');
      return h('li', null, h('button', { class: cls, type: 'button', onclick: () => setCursor(i) },
        h('span', { class: 'sync-time', text: l.t != null ? NP.lrc.stamp(l.t) : '[--:--.--]' }),
        h('span', { class: 'sync-text', text: l.text || '♪' })));
    }));
    const cur = el.list.querySelector('.is-cursor');
    if (cur) el.list.scrollTo({ top: cur.offsetTop - el.list.clientHeight / 2 + cur.offsetHeight / 2 });
    else el.list.scrollTo({ top: el.list.scrollHeight });
    el.comp.textContent = `${comp.toFixed(2)} dtk`;
  }

  function loadFromTrack(t) {
    const parsed = NP.lrc.parse(t.lyrics);
    if (!parsed.lines.length) { showStage('text'); return; }
    el.text.value = parsed.lines.map((l) => l.text).join('\n');
    lines = parsed.lines.map((l) => ({ text: l.text, t: parsed.synced ? l.t : null }));
    const firstEmpty = lines.findIndex((l) => l.t == null);
    cursor = firstEmpty < 0 ? lines.length : firstEmpty;
    showStage('sync');
  }

  function open() {
    const t = NP.player.track();
    if (!t) { toast('Putar atau pilih lagu dulu, lalu buka editor.'); return; }
    el.track.textContent = t.title;
    if (sessionTrack !== t.id) {
      sessionTrack = t.id;
      lines = [];
      cursor = 0;
      el.text.value = '';
      if (t.lyrics) loadFromTrack(t); else showStage('text');
    } else {
      showStage(stage);
    }
    NP.ui.open('editor');
  }

  function startSync() {
    const arr = NP.lrc.plainLines(el.text.value);
    if (!arr.length) { toast('Tempel teks lirik dulu.'); return; }
    const same = arr.length === lines.length && arr.every((x, i) => x === lines[i].text);
    if (!same) { lines = arr.map((text) => ({ text, t: null })); cursor = 0; }
    showStage('sync');
  }

  function flash() {
    el.tap.classList.add('is-hit');
    setTimeout(() => el.tap.classList.remove('is-hit'), 140);
    if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) { /* abaikan */ } }
  }

  function tap() {
    if (stage !== 'sync' || !lines.length) return;
    const p = NP.player;
    if (!p.track()) { toast('Pilih lagu dulu.'); return; }
    if (!p.isPlaying()) {
      p.play();
      toast('Lagu diputar. Ketuk lagi saat baris pertama dinyanyikan.');
      return;
    }
    if (cursor >= lines.length) { toast('Semua baris sudah punya waktu. Ketuk sebuah baris untuk menyinkron ulang.'); return; }
    let t = Math.max(0, p.time() - comp);
    const before = cursor > 0 ? lines[cursor - 1].t : null;
    if (before != null && t < before) t = before;
    lines[cursor].t = t;
    cursor++;
    flash();
    render();
    if (cursor >= lines.length) toast('Selesai. Periksa hasilnya, lalu terapkan atau ekspor.');
  }

  function undo() {
    if (cursor <= 0) return;
    cursor--;
    const old = lines[cursor].t;
    lines[cursor].t = null;
    if (old != null) NP.player.seek(Math.max(0, old - 2));
    render();
  }

  function setCursor(i) {
    cursor = i;
    const t = lines[i].t;
    if (t != null) NP.player.seek(Math.max(0, t - 1.5));
    render();
  }

  function restart() {
    lines.forEach((l) => { l.t = null; });
    cursor = 0;
    NP.player.seek(0);
    render();
    toast('Sinkron diulang dari awal.');
  }

  function buildLRC() {
    const t = NP.player.track();
    const stamped = lines.filter((l) => l.t != null);
    if (!stamped.length) { toast('Belum ada baris yang diberi waktu.'); return null; }
    const missing = lines.length - stamped.length;
    if (missing) toast(`${missing} baris belum bertanda waktu dan dilewati.`, 'warn');
    return NP.lrc.toLRC({ lines: stamped, title: t && t.title, artist: t && t.artist, album: t && t.album, length: NP.player.duration() });
  }

  async function apply() {
    const t = NP.player.track();
    if (!t) return;
    const text = buildLRC();
    if (!text) return;
    await NP.library.setLyrics(t.id, text);
    toast('Lirik tersimpan ke lagu ini.');
    NP.ui.close();
    NP.actions.showMode('lyrics');
  }

  function exportLrc() {
    const text = buildLRC();
    if (!text) return;
    const t = NP.player.track();
    const base = t ? (t.artist ? `${t.artist} - ${t.title}` : t.title) : 'lirik';
    downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), safeName(base) + '.lrc');
    toast('File .lrc diunduh.');
  }

  function init() {
    Object.assign(el, {
      text: $('#edText'), stageText: $('#edStageText'), stageSync: $('#edStageSync'), track: $('#edTrack'),
      prev: $('#edPrevLine'), next: $('#edNextLine'), count: $('#edCount'), tap: $('#edTap'), list: $('#edList'),
      time: $('#edTime'), comp: $('#edComp'), playIcon: $('#edPlayIcon'),
    });

    // pointerdown agar jeda ketuk sekecil mungkin; click dengan detail 0 = keyboard
    el.tap.addEventListener('pointerdown', (e) => { e.preventDefault(); tap(); });
    el.tap.addEventListener('click', (e) => { if (e.detail === 0) tap(); });

    $('#edStart').addEventListener('click', startSync);
    $('#edLoadCurrent').addEventListener('click', () => {
      const t = NP.player.track();
      if (!t || !t.lyrics) { toast('Lagu ini belum punya lirik.'); return; }
      el.text.value = NP.lrc.parse(t.lyrics).lines.map((l) => l.text).join('\n');
    });
    $('#edBack').addEventListener('click', () => { el.text.value = lines.map((l) => l.text).join('\n'); showStage('text'); });
    $('#edUndo').addEventListener('click', undo);
    $('#edRestart').addEventListener('click', restart);
    $('#edRew').addEventListener('click', () => NP.player.seek(NP.player.time() - 5));
    $('#edFwd').addEventListener('click', () => NP.player.seek(NP.player.time() + 5));
    $('#edPlay').addEventListener('click', () => NP.player.toggle());
    $('#edApply').addEventListener('click', apply);
    $('#edExport').addEventListener('click', exportLrc);
    $('#edCompMinus').addEventListener('click', () => { comp = Math.max(0, Math.round((comp - 0.05) * 100) / 100); NP.store.setPref('tapComp', comp); el.comp.textContent = `${comp.toFixed(2)} dtk`; });
    $('#edCompPlus').addEventListener('click', () => { comp = Math.min(0.6, Math.round((comp + 0.05) * 100) / 100); NP.store.setPref('tapComp', comp); el.comp.textContent = `${comp.toFixed(2)} dtk`; });

    document.addEventListener('keydown', (e) => {
      if (NP.ui.current() !== 'editor' || stage !== 'sync') return;
      if (e.code !== 'Space' && e.code !== 'Enter') return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'textarea' || tag === 'input' || tag === 'button') return;
      e.preventDefault();
      tap();
    });

    bus.on('tick', (t) => {
      if (NP.ui.current() !== 'editor') return;
      el.time.textContent = `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
    });
    bus.on('playing', (p) => setIcon(el.playIcon, p ? 'pause' : 'play'));
    el.comp.textContent = `${comp.toFixed(2)} dtk`;
  }

  NP.editor = { init, open };
})();
