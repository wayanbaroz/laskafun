# Soft Player

Pemutar musik dan editor lirik bergaya Soft Neumorphism terang. HTML, CSS, dan JavaScript murni, tanpa framework dan tanpa build wajib.

## Menjalankan

- **Satu file:** buka `dist/soft-player.html` di browser HP atau desktop.
- **Versi modular:** buka `index.html`. Semua modul berupa skrip biasa, jadi tidak perlu server lokal.
- Buat ulang file tunggal setelah mengubah kode: `node tools/build-single.js`
- Uji parser LRC: `node tools/test-lrc.js`

## Struktur

```
index.html          kerangka halaman + sprite ikon
css/theme.css       token warna, bayangan neumorphism, tombol dan kolom dasar
css/app.css         layout dan komponen (cakram, dial, slider, sheet, editor)
js/util.js          helper DOM, format waktu, event bus
js/store.js         IndexedDB (lagu) + localStorage (preferensi)
js/lrc.js           parser dan penulis .lrc
js/id3.js           pembaca tag ID3 (judul, artis, sampul)
js/ui.js            toast, sheet/drawer, konfirmasi dua ketukan
js/player.js        mesin audio, antrean, acak, ulangi, media session
js/library.js       pustaka lagu: tambah, hapus, urutkan
js/lyrics.js        tampilan lirik, auto-scroll, highlight
js/sliders.js       seekbar, dial progres, volume melengkung
js/editor.js        Tap Sync dan ekspor .lrc
js/online.js        iTunes Search, unduh URL, lirik LRCLIB
js/search.js        sheet Cari & Unduh
js/app.js           perakitan dan boot
```

## Catatan

- Lagu disimpan di IndexedDB browser. Di mode privat atau jika IndexedDB tidak ada, lagu hanya hidup selama sesi.
- Pencarian memakai iTunes Search dan hanya memberi cuplikan 30 detik. Untuk lagu utuh, tempel URL langsung ke file audio. Server yang tidak mengizinkan CORS tidak bisa diunduh, tetapi tautannya masih bisa diputar sebagai streaming.
- Cari lirik online memakai LRCLIB. Hasilnya bisa tersinkron atau polos.
- Pakai hanya audio dan lirik yang kamu punya haknya.
