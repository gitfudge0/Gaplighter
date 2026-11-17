import { test, expect } from '@playwright/test';
test.beforeEach(async ({page}) => { await page.goto('/tests/fixtures/layouts.html'); });
async function measure(page, id) {
  await page.locator('#'+id).scrollIntoViewIfNeeded();
  return page.evaluate(async id => (await import('/src/geometry.js')).measure(document.getElementById(id)), id);
}
for (const [id, count, value] of [['column',1,16],['row',1,16],['block',1,24],['grid',4,16],['wrap',4,16],['reverse',1,16],['order',1,16],['contents',2,16]]) {
  test(`${id}: measures actual empty spacing`, async ({page}) => {
    const result = await measure(page,id), spaces = result.bands.filter(b => b.kind === 'space');
    expect(result.warnings).toEqual([]); expect(spaces).toHaveLength(count);
    for(const space of spaces) expect(space.value).toBeCloseTo(value,1);
    // All bands must be empty: not merely the right count or canned labels.
    const boxes = await page.locator(`#${id} > div`).evaluateAll(els=>els.filter(e=>getComputedStyle(e).display!=='contents').map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom}}));
    for(const {rect:r} of spaces) for(const box of boxes) {
      const area = Math.max(0,Math.min(r.right,box.right)-Math.max(r.x,box.x))*Math.max(0,Math.min(r.bottom,box.bottom)-Math.max(r.y,box.y));
      expect(area).toBeLessThan(1);
    }
  });
}
test('border padding begins inside the border',async({page})=>{
  const result=await measure(page,'border');
  const top=result.bands.find(b=>b.kind==='padding'&&b.axis==='y');
  expect(top.rect.y-result.outer.y).toBeCloseTo(10); expect(top.rect.height).toBeCloseTo(20);
});
test('scale affects band geometry but labels remain CSS pixels',async({page})=>{
  const result=await measure(page,'scaled');const space=result.bands.find(b=>b.kind==='space');
  expect(space.value).toBeCloseTo(16);expect(space.rect.height).toBeCloseTo(24);
  const padding=result.bands.find(b=>b.kind==='padding'&&b.axis==='y');expect(padding.value).toBe(20);expect(padding.rect.height).toBeCloseTo(30);
});
test('rotation explicitly warns instead of reporting false spacing',async({page})=>{
  const result=await measure(page,'rotate');expect(result.bands).toEqual([]);expect(result.warnings.join()).toMatch(/not supported/);
});
test('display contents, text, large layouts and open shadow roots are safe',async({page})=>{
  await page.evaluate(()=>{const root=document.querySelector('#shadow').attachShadow({mode:'open'});root.innerHTML='<section style="display:flex;gap:18px"><div style="width:40px;height:40px">A</div><div style="width:40px;height:40px">B</div></section>';});
  await page.locator('#shadow').scrollIntoViewIfNeeded();
  const result=await page.evaluate(async()=>{const m=await import('/src/geometry.js');return m.measure(document.querySelector('#shadow').shadowRoot.querySelector('section'))});
  expect(result.bands.filter(b=>b.kind==='space').map(b=>b.value)).toEqual([18]);
  await page.locator('#column').evaluate(e=>e.append('Direct text'));
  expect((await measure(page,'column')).warnings.join()).toMatch(/Direct text/);
  await page.locator('#column').evaluate(e=>e.innerHTML='<div>A</div>'.repeat(81));
  expect((await measure(page,'column')).warnings.join()).toMatch(/More than 80/);
});
test('positioned children obstruct bands without creating extra spacing',async({page})=>{
  await page.locator('#column').evaluate(e=>{e.style.position='relative';const obstacle=document.createElement('div');obstacle.style.cssText='position:absolute;top:64px;left:20px;width:100px;min-height:4px;height:4px';e.append(obstacle)});
  const result=await measure(page,'column');expect(result.bands.filter(b=>b.kind==='space')).toEqual([]);
});
test('generated content is reported instead of painted over',async({page})=>{
  await page.addStyleTag({content:'#column::before{content:"Extra item";display:block;height:40px}'});
  const result=await measure(page,'column');expect(result.warnings.join()).toMatch(/Generated content/);expect(result.bands.filter(b=>b.kind==='space')).toEqual([]);
});
test('overflowing target does not pin bottom padding to its viewport edge',async({page})=>{
  const result=await measure(page,'scroll');expect(result.warnings.join()).toMatch(/Scrollable container/);expect(result.bands.filter(b=>b.kind==='padding')).toEqual([]);
});
