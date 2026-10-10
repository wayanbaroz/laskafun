/* id3.js  Pembaca tag ID3v2.3/2.4 minimal: judul, artis, album, sampul. */
(function () {
  'use strict';
  const NP = window.NP;

  const synch = (b, o) => ((b[o] & 0x7f) << 21) | ((b[o + 1] & 0x7f) << 14) | ((b[o + 2] & 0x7f) << 7) | (b[o + 3] & 0x7f);
  const be32 = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
  const ascii = (b, o, n) => { let s = ''; for (let i = o; i < o + n && i < b.length; i++) s += String.fromCharCode(b[i]); return s; };

  function decode(enc, bytes) {
    try {
      if (enc === 3) return new TextDecoder('utf-8').decode(bytes);
      if (enc === 1 || enc === 2) {
        let le = enc === 1;
        let start = 0;
        if (bytes.length >= 2) {
          if (bytes[0] === 0xff && bytes[1] === 0xfe) { le = true; start = 2; }
          else if (bytes[0] === 0xfe && bytes[1] === 0xff) { le = false; start = 2; }
        }
        return new TextDecoder(le ? 'utf-16le' : 'utf-16be').decode(bytes.subarray(start));
      }
      return new TextDecoder('iso-8859-1').decode(bytes);
    } catch (e) { return ''; }
  }

  const clean = (s) => String(s).split('\u0000')[0].trim();
  const textFrame = (body) => clean(decode(body[0], body.subarray(1)));

  function pictureFrame(body) {
    const enc = body[0];
    let i = 1;
    while (i < body.length && body[i] !== 0) i++;
    let mime = ascii(body, 1, i - 1).toLowerCase();
    i += 2; // lewati null + tipe gambar
    if (enc === 1 || enc === 2) {
      while (i + 1 < body.length && !(body[i] === 0 && body[i + 1] === 0)) i += 2;
      i += 2;
    } else {
      while (i < body.length && body[i] !== 0) i++;
      i += 1;
    }
    if (i >= body.length) return null;
    if (!mime.startsWith('image/')) mime = 'image/jpeg';
    if (mime === 'image/jpg') mime = 'image/jpeg';
    return new Blob([body.subarray(i)], { type: mime });
  }

  /** @returns {Promise<{title?:string, artist?:string, album?:string, cover?:Blob}|null>} */
  async function read(file) {
    try {
      const head = new Uint8Array(await file.slice(0, 10).arrayBuffer());
      if (head[0] !== 0x49 || head[1] !== 0x44 || head[2] !== 0x33) return null;
      const ver = head[3];
      if (ver < 3) return null;
      const size = Math.min(synch(head, 6), 8 * 1024 * 1024);
      const buf = new Uint8Array(await file.slice(10, 10 + size).arrayBuffer());
      let pos = 0;
      if (head[5] & 0x40) pos = ver === 4 ? synch(buf, 0) : be32(buf, 0) + 4;

      const out = {};
      while (pos + 10 <= buf.length) {
        const id = ascii(buf, pos, 4);
        if (!/^[A-Z0-9]{4}$/.test(id)) break;
        const fsize = ver === 4 ? synch(buf, pos + 4) : be32(buf, pos + 4);
        if (fsize <= 0 || pos + 10 + fsize > buf.length) break;
        const body = buf.subarray(pos + 10, pos + 10 + fsize);
        if (id === 'TIT2') out.title = textFrame(body);
        else if (id === 'TPE1') out.artist = textFrame(body);
        else if (id === 'TALB') out.album = textFrame(body);
        else if (id === 'APIC' && !out.cover) out.cover = pictureFrame(body);
        pos += 10 + fsize;
      }
      return out;
    } catch (e) { return null; }
  }

  NP.id3 = { read };
})();
