/* ui.js  Toast, sheet/drawer (dengan tombol Back), konfirmasi dua ketukan. */
(function () {
  'use strict';
  const NP = window.NP;
  const { $, $$, h } = NP.util;

  let current = null;
  let pushed = false;
  let lastFocus = null;

  function toast(msg, kind) {
    const box = $('#toasts');
    if (!box) return;
    Array.from(box.children).forEach((c) => { if (c.textContent === msg) c.remove(); });
    const el = h('div', { class: 'toast' + (kind ? ' toast--' + kind : ''), role: 'status', text: msg });
    box.append(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => { el.classList.add('is-out'); setTimeout(() => el.remove(), 320); }, kind === 'warn' ? 4400 : 2600);
  }

  function chrome() {
    const on = !!current;
    $('#scrim').classList.toggle('is-on', on);
    document.body.classList.toggle('no-scroll', on);
    $('#app').inert = on;
  }

  function reveal(name) {
    const el = $(`[data-sheet="${name}"]`);
    if (!el) return;
    el.inert = false;
    el.setAttribute('aria-hidden', 'false');
    el.classList.add('is-open');
    chrome();
    const f = $('[data-close]', el);
    if (f) setTimeout(() => f.focus({ preventScroll: true }), 80);
    NP.bus.emit('sheet', name);
  }

  function hide(name) {
    const el = $(`[data-sheet="${name}"]`);
    if (!el) return;
    el.classList.remove('is-open');
    el.inert = true;
    el.setAttribute('aria-hidden', 'true');
  }

  function hideCurrent() {
    if (!current) return;
    const name = current;
    hide(name);
    current = null;
    pushed = false;
    chrome();
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    lastFocus = null;
    NP.bus.emit('sheet-closed', name);
  }

  function open(name) {
    if (current === name) return;
    if (current) {
      hide(current); // pindah sheet: pertahankan satu entri riwayat
    } else {
      lastFocus = document.activeElement;
      try { history.pushState({ np: name }, ''); pushed = true; } catch (e) { pushed = false; }
    }
    current = name;
    reveal(name);
  }

  function close() {
    if (!current) return;
    if (pushed) {
      try {
        history.back();
        setTimeout(() => { if (current) hideCurrent(); }, 450);
        return;
      } catch (e) { /* jatuh ke hideCurrent */ }
    }
    hideCurrent();
  }

  /** Ketukan pertama menandai tombol, ketukan kedua (dalam 3 dtk) menjalankan fn. */
  function arm(btn, fn, hint) {
    let timer = 0;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (btn.classList.contains('is-armed')) {
        clearTimeout(timer);
        btn.classList.remove('is-armed');
        fn();
      } else {
        btn.classList.add('is-armed');
        toast(hint || 'Ketuk sekali lagi untuk konfirmasi');
        timer = setTimeout(() => btn.classList.remove('is-armed'), 3000);
      }
    });
  }

  function init() {
    $$('[data-sheet]').forEach((el) => { el.inert = true; });
    $$('[data-close]').forEach((b) => b.addEventListener('click', close));
    $('#scrim').addEventListener('click', close);
    window.addEventListener('popstate', () => { if (current) { pushed = false; hideCurrent(); } });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && current) close(); });
  }

  NP.ui = { init, toast, open, close, arm, current: () => current };
})();
