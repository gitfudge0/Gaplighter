import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { unzipSync } from 'fflate';
test('packages are deterministic, self-contained, and least-privilege',async()=>{
  const {version}=JSON.parse(await readFile('package.json','utf8'));
  const pack=(tz)=>{const r=spawnSync(process.execPath,['scripts/package.mjs'],{encoding:'utf8',env:{...process.env,TZ:tz}});assert.equal(r.status,0,r.stderr)};
  pack('UTC');const paths=['chrome','firefox'].map(b=>`release/gaplighter-${b}-${version}.zip`);
  const before=await Promise.all(paths.map(p=>readFile(p)));pack('Asia/Kolkata');
  for(let i=0;i<paths.length;i++) {
    const bytes=await readFile(paths[i]);assert.deepEqual(bytes,before[i]);
    const files=unzipSync(bytes),manifest=JSON.parse(new TextDecoder().decode(files['manifest.json']));
    assert.deepEqual(manifest.permissions,['activeTab','scripting']);assert.equal(manifest.host_permissions,undefined);assert.equal(manifest.background,undefined);
    assert.equal(manifest.version,version);assert.equal(manifest.action.default_popup,'popup.html');
    assert(files['content.js']);assert(files['popup.js']);assert(files['popup.css']);assert(files['icons/128.png']);
    assert(!Object.keys(files).some(p=>/qa-|node_modules|tests|\.map$/.test(p)));
  }
});
