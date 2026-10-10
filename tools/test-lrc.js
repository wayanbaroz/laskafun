// Uji cepat parser LRC:  node tools/test-lrc.js
const assert = require('assert');
const lrc = require('../js/lrc.js');

// 1. LRC tersinkron + meta + multi-timestamp + tag kata
const src = [
  '﻿[ti:Judul]', '[ar:Artis]', '[offset:500]',
  '[00:12.30]Baris satu',
  '[00:05.00][01:20.50]Reff <00:05.20>kata',
  '[00:30]',
  '[Chorus]',
].join('\n');
const a = lrc.parse(src);
assert.strictEqual(a.synced, true);
assert.strictEqual(a.meta.ti, 'Judul');
assert.deepStrictEqual(a.lines.map((l) => l.text), ['Reff kata', 'Baris satu', '', 'Reff kata']);
assert.ok(Math.abs(a.lines[0].t - 4.5) < 1e-9, 'offset 500ms menggeser 0.5 dtk lebih awal');
assert.ok(a.lines.every((l, i, arr) => i === 0 || arr[i - 1].t <= l.t), 'terurut');

// 2. Teks polos
const b = lrc.parse('Halo dunia\n\n[Verse 1]\nBaris dua');
assert.strictEqual(b.synced, false);
assert.deepStrictEqual(b.lines.map((l) => l.text), ['Halo dunia', '[Verse 1]', 'Baris dua']);

// 3. Format waktu
assert.strictEqual(lrc.stamp(83.456), '[01:23.46]');
assert.strictEqual(lrc.stamp(0), '[00:00.00]');
assert.strictEqual(lrc.stamp(599.999), '[10:00.00]');

// 4. Round trip
const out = lrc.toLRC({ title: 'T', artist: 'A', length: 185, lines: [{ t: 1.5, text: 'x' }, { t: null, text: 'skip' }, { t: 62.25, text: 'y' }] });
assert.strictEqual(out, '[ti:T]\n[ar:A]\n[length:03:05]\n[by:Soft Player]\n[00:01.50]x\n[01:02.25]y\n');
const back = lrc.parse(out);
assert.deepStrictEqual(back.lines.map((l) => l.text), ['x', 'y']);

// 5. Baris aktif
const ls = [{ t: 1 }, { t: 5 }, { t: 9 }];
assert.strictEqual(lrc.activeIndex(ls, 0.5), -1);
assert.strictEqual(lrc.activeIndex(ls, 1), 0);
assert.strictEqual(lrc.activeIndex(ls, 8.99), 1);
assert.strictEqual(lrc.activeIndex(ls, 100), 2);

console.log('LRC: semua uji lulus');
