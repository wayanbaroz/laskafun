/* sliders.js  Seekbar neumorphic + dial progres + volume melengkung (busur SVG). */
(function () {
  'use strict';
  const NP = window.NP;
  const { $, clamp, fmtTime, setIcon, bus } = NP.util;

  function initSeek() {
    const seek = $('#seek');
    const cur = $('#tCur');
    const dur = $('#tDur');
    const dial = $('#dial');
    let drag = false;
    let frac = 0;
    let lastDeg = -1;
    let lastSec = -1;

    const setFrac = (f) => { frac = clamp(f); seek.style.setProperty('--f', frac.toFixed(4)); };
    const evFrac = (e) => { const r = seek.getBoundingClientRect(); return clamp((e.clientX - r.left) / r.width); };

    function paint(t, d) {
      const sec = Math.floor(t);
      if (sec !== lastSec || drag) {
        lastSec = sec;
        cur.textContent = fmtTime(t);
        dur.textContent = fmtTime(d);
        seek.setAttribute('aria-valuenow', String(Math.round(frac * 100)));
        seek.setAttribute('aria-valuetext', `${fmtTime(t)} dari ${fmtTime(d)}`);
      }
      const deg = Math.round(frac * 3600) / 10;
      if (deg !== lastDeg) { dial.style.setProperty('--p', deg + 'deg'); lastDeg = deg; }
    }

    seek.addEventListener('pointerdown', (e) => {
      const d = NP.player.duration();
      if (!d) return;
      drag = true;
      seek.setPointerCapture(e.pointerId);
      setFrac(evFrac(e));
      paint(frac * d, d);
      e.preventDefault();
    });
    seek.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const d = NP.player.duration();
      setFrac(evFrac(e));
      paint(frac * d, d);
    });
    seek.addEventListener('pointerup', () => {
      if (!drag) return;
      drag = false;
      NP.player.seek(frac * NP.player.duration());
    });
    seek.addEventListener('pointercancel', () => { drag = false; });
    seek.addEventListener('keydown', (e) => {
      const step = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 5 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -5 : 0;
      if (step) { e.preventDefault(); NP.player.seek(NP.player.time() + step); }
    });

    bus.on('tick', (t) => {
      if (drag) return;
      const d = NP.player.duration();
      setFrac(d ? t / d : 0);
      paint(t, d);
    });
  }

  function initVolume() {
    const svg = $('#volSvg');
    const path = $('#volGroove');
    const fill = $('#volFill');
    const knob = $('#volKnob');
    const label = $('#volLabel');
    const mute = $('#btnMute');
    const muteIcon = $('#muteIcon');
    const VBW = 300, VBH = 96, N = 240;

    const len = path.getTotalLength();
    const pts = [];
    for (let i = 0; i <= N; i++) pts.push(path.getPointAtLength((len * i) / N));

    let v = NP.player.state().volume;
    let muted = false;
    let drag = false;

    function draw() {
      const shown = muted ? 0 : v;
      const p = path.getPointAtLength(len * shown);
      knob.style.left = (p.x / VBW) * 100 + '%';
      knob.style.top = (p.y / VBH) * 100 + '%';
      fill.style.strokeDasharray = `${len * shown} ${len + 2}`;
      fill.style.opacity = shown <= 0.001 ? '0' : '1';
      label.textContent = muted ? 'Senyap' : Math.round(v * 100) + '%';
      svg.setAttribute('aria-valuenow', String(Math.round(v * 100)));
      setIcon(muteIcon, muted || v === 0 ? 'mute' : 'volume');
      mute.setAttribute('aria-label', muted ? 'Aktifkan suara' : 'Bisukan');
    }

    function fromEvent(e) {
      const r = svg.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * VBW;
      const y = ((e.clientY - r.top) / r.height) * VBH;
      let best = 0, bd = Infinity;
      for (let i = 0; i <= N; i++) {
        const dx = pts[i].x - x, dy = pts[i].y - y, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = i; }
      }
      return best / N;
    }

    svg.addEventListener('pointerdown', (e) => { drag = true; svg.setPointerCapture(e.pointerId); NP.player.setVolume(fromEvent(e)); e.preventDefault(); });
    svg.addEventListener('pointermove', (e) => { if (drag) NP.player.setVolume(fromEvent(e)); });
    const stop = () => { drag = false; };
    svg.addEventListener('pointerup', stop);
    svg.addEventListener('pointercancel', stop);
    svg.addEventListener('keydown', (e) => {
      const step = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 0.05 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -0.05 : 0;
      if (step) { e.preventDefault(); NP.player.setVolume(v + step); }
    });
    mute.addEventListener('click', () => NP.player.toggleMute());

    bus.on('volume', (s) => { v = s.volume; muted = s.muted; draw(); });
    draw();
  }

  NP.sliders = { init() { initSeek(); initVolume(); } };
})();
