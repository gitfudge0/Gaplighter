import { readFile, readdir, writeFile, mkdir, rm } from 'node:fs/promises';
import { zipSync } from 'fflate';
import { createHash } from 'node:crypto';
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid release version.');
await rm('release', { recursive: true, force: true }); await mkdir('release');
const sums = [];
for (const browser of ['chrome', 'firefox']) {
  const dir = `dist/${browser}`, entries = {};
  const manifest = JSON.parse(await readFile(`${dir}/manifest.json`, 'utf8'));
  if (manifest.version !== version) throw new Error('Stale build. Run npm run build first.');
  async function walk(base = '') {
    for (const entry of (await readdir(`${dir}/${base}`, { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name))) {
      const p = base ? `${base}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(p);
      else entries[p] = [new Uint8Array(await readFile(`${dir}/${p}`)), { mtime: new Date(1980, 0, 1, 0, 0, 0) }];
    }
  }
  await walk();
  const filename = `gaplighter-${browser}-${version}.zip`, bytes = zipSync(entries, { level: 9 });
  await writeFile(`release/${filename}`, bytes);
  sums.push(`${createHash('sha256').update(bytes).digest('hex')}  ${filename}`);
}
await writeFile('release/SHA256SUMS', sums.join('\n') + '\n');
console.log(`Packaged ${version}; checksums saved in release/SHA256SUMS`);
