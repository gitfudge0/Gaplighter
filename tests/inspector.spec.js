import { test, expect } from '@playwright/test';
async function inject(page) {
  // Only the runtime messaging transport is simulated in these browser UI tests.
  // Installed-extension smoke tests exercise real messaging and scripting APIs.
  await page.evaluate(()=>{globalThis.chrome={runtime:{onMessage:{addListener(fn){globalThis.receiveInspectorMessage=fn}}}};});
  await page.addScriptTag({path:'dist/chrome/content.js'});
  await page.evaluate(()=>globalThis.receiveInspectorMessage({type:'gaplighter:toggle'},null,()=>{}));
}
const overlay = page => page.locator('#gaplighter-inspector');
test.beforeEach(async({page})=>{await page.goto('/tests/fixtures/layouts.html');await inject(page);});
test('hover, freeze, parent, mode and exit restore the page',async({page})=>{
  const root=overlay(page);
  await page.locator('#column > div').first().hover();
  await expect(root.locator('.selected')).toHaveText('section#column');
  await expect(root.locator('.band[data-kind="space"]')).toHaveAttribute('data-value','16');
  await page.locator('#column > div').first().click();
  await page.locator('#row').hover();await expect(root.locator('.selected')).toHaveText('section#column');
  await expect(root.getByRole('status')).toHaveText('Selection frozen');
  await root.getByRole('button',{name:'Resume',exact:true}).click();
  await root.getByLabel('Targeting mode').selectOption('element');
  await page.locator('#row > div').first().hover();await expect(root.locator('.selected')).toHaveText('div');
  await root.getByRole('button',{name:'Parent ↑',exact:true}).click();await expect(root.locator('.selected')).toHaveText('section#row');
  await page.keyboard.press('Escape');await expect(root).toHaveCount(0);
  await page.locator('#link').click();await expect(page).toHaveURL(/should-not-navigate/);
});
test('inspection clicks cannot navigate; repeated injection has one inspector',async({page})=>{
  await page.locator('#link').scrollIntoViewIfNeeded();await page.locator('#link').click();
  await expect(page).toHaveURL(/layouts.html/);
  await page.addScriptTag({path:'dist/chrome/content.js'});await expect(overlay(page)).toHaveCount(1);
  await page.evaluate(()=>globalThis.receiveInspectorMessage({type:'gaplighter:toggle'},null,()=>{}));await expect(overlay(page)).toHaveCount(0);
  await page.evaluate(()=>globalThis.receiveInspectorMessage({type:'gaplighter:toggle'},null,()=>{}));await expect(overlay(page)).toHaveCount(1);
});
test('frozen child follows dynamic fixed-height layout changes',async({page})=>{
  const root=overlay(page);await root.getByLabel('Targeting mode').selectOption('element');
  const child=page.locator('#dynamic > div').last();await child.scrollIntoViewIfNeeded();await child.hover();await child.click();
  const before=await child.boundingBox();await page.locator('#dynamic > div').first().evaluate(e=>e.style.height='80px');
  await expect.poll(async()=>{const r=await root.locator('.outline').boundingBox();const c=await child.boundingBox();return Math.abs(r.y-c.y)}).toBeLessThan(1);
  expect((await child.boundingBox()).y-before.y).toBeCloseTo(40);
});
test('scroll clipping and open shadow targeting',async({page})=>{
  await page.locator('#scroll').scrollIntoViewIfNeeded();
  await page.evaluate(()=>{document.querySelector('#scroll').scrollTop=100;});
  await page.locator('#scroll').hover();
  await expect(overlay(page).locator('.warning')).toContainText('Scrolled container');
  const box=await page.locator('#scroll').boundingBox();
  for(const band of await overlay(page).locator('.band').all()) {const r=await band.boundingBox();expect(r.y).toBeGreaterThanOrEqual(box.y);expect(r.y+r.height).toBeLessThanOrEqual(box.y+box.height+1);}
  await page.evaluate(()=>{document.querySelector('#shadow').attachShadow({mode:'open'}).innerHTML='<section id="inside" style="display:flex;gap:18px"><div style="width:40px;height:40px">A</div><div style="width:40px;height:40px">B</div></section>';});
  await page.locator('#shadow').locator('section > div').first().hover();
  await expect(overlay(page).locator('.selected')).toHaveText('section#inside');
  await expect(overlay(page).locator('.band[data-kind="space"]')).toHaveAttribute('data-value','18');
});
test('hostile page styles cannot restyle shadow controls; narrow keyboard exit works',async({page})=>{
  await page.addStyleTag({content:'button,span,section {font-size:70px!important;background:red!important}'});
  await expect(overlay(page).getByRole('button',{name:'Freeze',exact:true})).toHaveCSS('font-size','12px');
  await page.setViewportSize({width:390,height:844});
  const panel=await overlay(page).locator('.panel').boundingBox();expect(panel.x).toBeGreaterThanOrEqual(0);expect(panel.x+panel.width).toBeLessThanOrEqual(390);
  await overlay(page).getByLabel('Targeting mode').focus();await page.keyboard.press('Escape');await expect(overlay(page)).toHaveCount(0);
});
test('controls can move away from the inspected area',async({page})=>{
  const panel=overlay(page).locator('.panel'),before=await panel.boundingBox();
  await overlay(page).getByRole('button',{name:'Move controls'}).click();
  const moved=await panel.boundingBox();expect(moved.x).toBeLessThan(before.x);expect(moved.y).toBeGreaterThan(before.y);
  await overlay(page).getByRole('button',{name:'Move controls'}).click();const restored=await panel.boundingBox();expect(restored.x).toBeCloseTo(before.x);expect(restored.y).toBeCloseTo(before.y);
});
