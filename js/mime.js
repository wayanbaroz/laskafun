/* mime.js  Deteksi jenis audio dari ISI file (magic bytes), bukan dari nama atau tipe yang dilaporkan HP.
   Safari dan WebView menolak blob audio bila MIME kosong atau keliru ("format tidak didukung"),
   padahal filenya sendiri sehat. Blob yang dibuat di sini selalu punya MIME yang benar. */
(function () {
  'use strict';
  const NP = window.NP;

  const EXT = {
    mp3: 'audio/mpeg', m4a: 'audio/mp4', mp4: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav',
    ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', flac: 'audio/flac',
    weba: 'audio/webm', webm: 'audio/webm', aif: 'audio/aiff', aiff: 'audio/aiff',
  };
  const ALIAS = {
    'audio/mp3': 'audio/mpeg', 'audio/x-mpeg': 'audio/mpeg', 'audio/mpeg3': 'audio/mpeg', 'audio/x-mp3': 'audio/mpeg',
    'audio/x-m4a': 'audio/mp4', 'audio/m4a': 'audio/mp4', 'audio/x-wav': 'audio/wav', 'audio/wave': 'audio/wav',
    'audio/vnd.wave': 'audio/wav', 'audio/x-flac': 'audio/flac', 'audio/x-aac': 'audio/aac',
  };
  const MAX_MEMORY = 150 * 1024 * 1024; // di atas ini tetap file-backed agar memori aman

  function readBuffer(blob) {
    if (blob.arrayBuffer) return blob.arrayBuffer();
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(fr.error);
      fr.readAsArrayBuffer(blob);
    });
  }

  /** Jenis audio dari byte awal file, atau '' bila tidak dikenali. */
  async function sniff(blob) {
    try {
      const b = new Uint8Array(await readBuffer(blob.slice(0, 16)));
      const s = (o, n) => String.fromCharCode.apply(null, Array.from(b.slice(o, o + n)));
      if (s(0, 3) === 'ID3') return 'audio/mpeg';
      if (s(0, 4) === 'RIFF' && s(8, 4) === 'WAVE') return 'audio/wav';
      if (s(4, 4) === 'ftyp') return 'audio/mp4';
      if (s(0, 4) === 'OggS') return 'audio/ogg';
      if (s(0, 4) === 'fLaC') return 'audio/flac';
      if (s(0, 4) === 'FORM' && s(8, 4) === 'AIFF') return 'audio/aiff';
      if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return ((b[1] >> 1) & 3) === 0 ? 'audio/aac' : 'audio/mpeg';
    } catch (e) { /* abaikan */ }
    return '';
  }

  const fromName = (name) => {
    const m = /\.([a-z0-9]+)$/i.exec(name || '');
    return m ? EXT[m[1].toLowerCase()] || '' : '';
  };
  const fromType = (t) => {
    t = String(t || '').toLowerCase().split(';')[0].trim();
    if (ALIAS[t]) return ALIAS[t];
    return t.startsWith('audio/') ? t : '';
  };

  /** File -> {blob, mime, sniffed}. blob berada di memori dan ber-MIME benar. */
  async function normalize(file) {
    const sniffed = await sniff(file);
    const mime = sniffed || fromType(file.type) || fromName(file.name) || '';
    let blob = file;
    try {
      if (mime && file.size <= MAX_MEMORY) blob = new Blob([await readBuffer(file)], { type: mime });
      else if (mime) blob = file.slice(0, file.size, mime);
    } catch (e) {
      if (mime) blob = file.slice(0, file.size, mime);
    }
    return { blob, mime, sniffed: !!sniffed };
  }

  NP.mime = { sniff, normalize, readBuffer, fromName, fromType };
})();
