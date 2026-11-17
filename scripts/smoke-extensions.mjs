// Real extension loading in temporary profiles. A QA-only loopback host grant
// replaces the physical toolbar click's activeTab grant; never packaged/shipped.
import { createServer } from 'node:http';
import { mkdtemp, cp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium, firefox } from '@playwright/test';
import webExt from 'web-ext';
import assert from 'node:assert/strict';
const temp = await mkdtemp(join(tmpdir(), 'gaplighter-qa-'));
let finish;
const server = createServer((req,res)=>{
  if(req.url.startsWith('/?error=')){finish?.({ok:false,error:decodeURIComponent(req.url.slice(8))});res.end('QA injection failed');return;}
  if(req.url==='/report' && req.method==='POST') {let body='';req.on('data',b=>body+=b);req.on('end',()=>{finish?.(JSON.parse(body));res.end('ok')});return;}
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'");
  if(req.url==='/probe.js') {res.setHeader('Content-Type','text/javascript');res.end(`
(async()=>{const wait=ms=>new Promise(r=>setTimeout(r,ms));try{
let root;for(let i=0;i<100;i++){root=document.querySelector('#gaplighter-inspector')?.shadowRoot;if(root)break;await wait(100)}if(!root)throw Error('Inspector not mounted');
const sample=document.querySelector('#sample');const r=sample.getBoundingClientRect();sample.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,composed:true,clientX:r.x+2,clientY:r.y+2}));await wait(350);
const gaps=[...root.querySelectorAll('.band[data-kind="space"]')].map(e=>Number(e.dataset.value));if(gaps.length!==1||gaps[0]!==16)throw Error('Wrong spacing: '+JSON.stringify(gaps));
if(getComputedStyle(root.querySelector('.panel')).pointerEvents!=='auto')throw Error('Toolbar styles blocked by CSP');
sample.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));await wait(150);if(root.querySelector('.state').textContent!=='Selection frozen')throw Error('Freeze failed');
document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));if(document.querySelector('#gaplighter-inspector'))throw Error('Escape did not clean up');
fetch('/report',{method:'POST',body:JSON.stringify({ok:true,gaps,csp:true,freeze:true,cleanup:true})});
}catch(e){fetch('/report',{method:'POST',body:JSON.stringify({ok:false,error:e.message})})}})();`);return;}
  if(req.url==='/probe.css'){res.setHeader('Content-Type','text/css');res.end('body{font:16px system-ui}#sample{display:flex;flex-direction:column;gap:16px;padding:20px;width:320px}#sample>div{height:40px;background:#ddd}');return;}
  res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="en"><meta charset="utf-8"><title>Gaplighter isolated extension QA</title><link rel="stylesheet" href="/probe.css"><h1>Extension smoke test</h1><section id="sample"><div>A</div><div>B</div></section><script src="/probe.js"></script></html>');
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=`http://127.0.0.1:${server.address().port}/`;
try {
  for (const browser of ['chrome','firefox']) {
    const dir=join(temp,browser);await cp(`dist/${browser}`,dir,{recursive:true});
    const manifest=JSON.parse(await readFile(join(dir,'manifest.json'),'utf8'));
    manifest.host_permissions=['http://127.0.0.1/*'];
    manifest.background=browser==='chrome'?{service_worker:'qa-background.js'}:{scripts:['qa-background.js']};
    await writeFile(join(dir,'manifest.json'),JSON.stringify(manifest));
    await writeFile(join(dir,'qa-background.js'),`const api=globalThis.browser||globalThis.chrome;let busy=false;async function inject(id,change,tab){if(busy||change.status!=='complete'||tab.url!==${JSON.stringify(url)})return;busy=true;try{await api.scripting.executeScript({target:{tabId:id},files:['content.js']});await api.tabs.sendMessage(id,{type:'gaplighter:toggle'},{frameId:0});}catch(e){api.tabs.update(id,{url:${JSON.stringify(url)}+'?error='+encodeURIComponent(e.message)})}};api.tabs.onUpdated.addListener(inject);api.tabs.query({}).then(tabs=>tabs.forEach(t=>inject(t.id,{status:t.status},t)));`);
    let timer;
    const report=new Promise((r,j)=>{finish=r;timer=setTimeout(()=>j(new Error(`${browser}: extension smoke timed out`)),45000)});
    // Avoid an unhandled timeout if browser startup itself fails.
    report.catch(()=>{});
    let runner,context;
    try {
      if(browser==='chrome') {
        context=await chromium.launchPersistentContext(join(temp,'chrome-profile'),{headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{channel:'chromium'}),args:[`--disable-extensions-except=${resolve(dir)}`,`--load-extension=${resolve(dir)}`]});
        // Wait for the QA background listener before navigating to the fixture.
        if(!context.serviceWorkers().length)await context.waitForEvent('serviceworker');
        const worker=context.serviceWorkers()[0];await worker.evaluate(()=>new Promise(r=>setTimeout(r,300)));
        await context.pages()[0].goto(url);
      } else {
        runner=await webExt.cmd.run({sourceDir:dir,firefox:firefox.executablePath(),args:['-headless'],startUrl:[url],noReload:true,keepProfileChanges:false},{shouldExitProgram:false});
      }
      const result=await report;assert.equal(result.ok,true,JSON.stringify(result));
      console.log(`PASS ${browser}: installed MV3 bundle, real scripting/messaging, CSP, 16px spacing, freeze and cleanup.`);
    } finally {clearTimeout(timer);finish=null;if(context)await context.close();if(runner)await runner.exit();}
  }
} finally {await new Promise(r=>server.close(r));await rm(temp,{recursive:true,force:true});}
