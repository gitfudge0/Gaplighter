import { build } from 'esbuild';
import { mkdir, readFile, writeFile, rm, copyFile } from 'node:fs/promises';
import { zlibSync } from 'fflate';
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const icons = Object.fromEntries([16, 32, 48, 128].map(size => [size, `icons/${size}.png`]));
export const manifest = {
  manifest_version: 3, name: 'Gaplighter', version: pkg.version,
  description: 'Reveal padding and visible spacing while hovering over web page components.',
  permissions: ['activeTab', 'scripting'],
  action: { default_title: 'Inspect spacing with Gaplighter', default_popup: 'popup.html', default_icon: icons },
  icons,
};
if (!/^\d+\.\d+\.\d+$/.test(pkg.version)) throw new Error('Use a three-part numeric extension version.');
function crc(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) { c ^= b; for (let i = 0; i < 8; i++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0); }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, bytes) {
  const data = Buffer.concat([Buffer.from(type), bytes]), n = Buffer.alloc(4), hash = Buffer.alloc(4);
  n.writeUInt32BE(bytes.length); hash.writeUInt32BE(crc(data)); return Buffer.concat([n, data, hash]);
}
function icon(size) {
  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const px = x / size, py = y / size, i = y * (1 + size * 4) + 1 + x * 4;
    const band = px > .18 && px < .82 && ((py > .2 && py < .29) || (py > .46 && py < .55) || (py > .72 && py < .81));
    raw.set(band ? [255, 80, 164, 255] : [28, 22, 31, 255], i);
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', Buffer.from(zlibSync(raw))), chunk('IEND', Buffer.alloc(0))]);
}
for (const browser of ['chrome', 'firefox']) {
  const out = `dist/${browser}`;
  await rm(out, { recursive: true, force: true }); await mkdir(`${out}/icons`, { recursive: true });
  await build({ entryPoints: ['src/content.js', 'src/popup.js'], bundle: true, outdir: out, format: 'iife', target: ['chrome114', 'firefox140'], loader: { '.css': 'text' }, legalComments: 'none' });
  for (const file of ['popup.html', 'popup.css']) await copyFile(`src/${file}`, `${out}/${file}`);
  for (const size of [16, 32, 48, 128]) await writeFile(`${out}/icons/${size}.png`, icon(size));
  const m = structuredClone(manifest);
  if (browser === 'chrome') m.minimum_chrome_version = '114';
  else m.browser_specific_settings = { gecko: { id: 'gaplighter@extensions.local', strict_min_version: '142.0', data_collection_permissions: { required: ['none'] } } };
  await writeFile(`${out}/manifest.json`, JSON.stringify(m, null, 2) + '\n');
}
console.log(`Built Chrome and Firefox ${pkg.version}`);
