// Gabungkan index.html + css/*.css + js/*.js menjadi satu file:  node tools/build-single.js
// Hasil: dist/soft-player.html (bisa dibuka langsung di browser HP tanpa server)
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

let html = read('index.html');
html = html.replace(/<link rel="stylesheet" href="(css\/[^"]+)">/g, (m, f) => `<style>\n${read(f)}\n</style>`);
html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g, (m, f) => `<script>\n${read(f).replace(/<\/script/gi, '<\\/script')}\n</script>`);

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', 'soft-player.html');
fs.writeFileSync(out, html);
console.log('Dibuat:', out, `(${Math.round(html.length / 1024)} KB)`);
