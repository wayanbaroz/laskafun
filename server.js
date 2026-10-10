// Server chat privat tanpa dependensi (Node 18+).
// Hanya meneruskan pesan terenkripsi lewat SSE; tidak menyimpan apa pun.
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const MAX_PER_ROOM = 2;
const rooms = new Map(); // id ruang -> Map<clientId, res>

const sendEvent = (res, obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');

  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    return fs.createReadStream(path.join(__dirname, 'public', 'index.html')).pipe(res);
  }

  const room = (url.searchParams.get('room') || '').slice(0, 64);
  const cid = (url.searchParams.get('c') || '').slice(0, 32);
  if (!room || !cid) return res.writeHead(400).end();

  // Aliran realtime
  if (req.method === 'GET' && url.pathname === '/events') {
    const members = rooms.get(room) || new Map();
    if (!members.has(cid) && members.size >= MAX_PER_ROOM) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      sendEvent(res, { t: 'full' });
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    members.set(cid, res);
    rooms.set(room, members);
    sendEvent(res, { t: 'joined', peers: members.size - 1 });
    members.forEach((r, id) => id !== cid && sendEvent(r, { t: 'peer', online: true }));
    const ping = setInterval(() => res.write(': ping\n\n'), 20000);
    req.on('close', () => {
      clearInterval(ping);
      const m = rooms.get(room);
      if (!m || m.get(cid) !== res) return;
      m.delete(cid);
      if (m.size === 0) rooms.delete(room);
      else m.forEach((r) => sendEvent(r, { t: 'peer', online: false }));
    });
    return;
  }

  // Kirim pesan / status mengetik (isi sudah terenkripsi di klien)
  if (req.method === 'POST' && url.pathname === '/send') {
    let body = '';
    req.on('data', (d) => { body += d; if (body.length > 64 * 1024) req.destroy(); });
    req.on('end', () => {
      let msg;
      try { msg = JSON.parse(body); } catch { return res.writeHead(400).end(); }
      if (msg.t !== 'msg' && msg.t !== 'typing') return res.writeHead(400).end();
      rooms.get(room)?.forEach((r, id) => id !== cid && sendEvent(r, msg));
      res.writeHead(204).end();
    });
    return;
  }

  res.writeHead(404).end();
});

server.listen(PORT, () => console.log(`Chat jalan di http://localhost:${PORT}`));
