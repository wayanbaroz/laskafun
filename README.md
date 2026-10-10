# Chat Privat

Chat 2 orang, realtime, terenkripsi end-to-end, tanpa akun, tanpa database, tanpa dependensi.

## Jalankan
Butuh Node.js 18+.

    node server.js

Buka http://localhost:3000 di dua perangkat/tab, masukkan **kode ruang** dan **kata sandi** yang sama.

## Agar bisa dipakai dari HP berbeda
Deploy ke hosting Node apa saja (Render, Railway, Fly.io, VPS) dan pakai HTTPS. Atau untuk tes cepat: `cloudflared tunnel --url http://localhost:3000`.

## Cara kerja
- Pesan dienkripsi di browser (AES-256-GCM, kunci dari kata sandi lewat PBKDF2). Server hanya meneruskan teks acak.
- Kode ruang di-hash sebelum dikirim, jadi server tidak tahu kode aslinya.
- Server tidak menyimpan pesan sama sekali. Tutup tab = pesan hilang.
- Satu ruang maksimal 2 orang.
- Pesan bisa hilang otomatis (30 dtk / 5 mnt / 1 jam).

## Tips
- Bagikan kode ruang dan kata sandi lewat jalur terpisah.
- Pakai kode ruang dan kata sandi yang panjang dan unik.
