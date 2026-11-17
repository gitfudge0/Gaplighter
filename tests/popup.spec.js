import {test,expect} from '@playwright/test';
async function setup(page,{url='https://example.test/',active=false,fail=false}={}) {
  await page.addInitScript(({url,active,fail})=>{
    window.close=()=>{globalThis.popupClosed=true};globalThis.executed=[];
    const api={tabs:{query:async()=>[{id:7,url}],sendMessage:async(_id,message)=>({active:message.type==='gaplighter:toggle'?!active:active})},scripting:{executeScript:async args=>{if(fail)throw Error('Injection blocked');globalThis.executed.push(args)}}};
    globalThis.chrome=api;globalThis.browser=api;
  },{url,active,fail});
  await page.goto('/dist/chrome/popup.html');
}
test('activation injects the bundled script into only the selected top frame',async({page})=>{
  await setup(page);await page.getByRole('button',{name:'Start inspection'}).click();
  await expect.poll(()=>page.evaluate(()=>globalThis.popupClosed)).toBe(true);
  expect(await page.evaluate(()=>globalThis.executed)).toEqual([{target:{tabId:7,frameIds:[0]},files:['content.js']}]);
});
test('existing inspection can be stopped from the popup',async({page})=>{
  await setup(page,{active:true});await page.getByRole('button',{name:'Stop inspection'}).click();await expect(page.getByRole('button',{name:'Start inspection'})).toBeEnabled();
});
test('restricted pages and injection failures explain recovery',async({page})=>{
  await setup(page,{url:'about:config'});await expect(page.getByRole('button')).toBeDisabled();await expect(page.getByRole('status')).toContainText('Browser pages');
  await page.close();
});
test('injection failure allows retry',async({page})=>{
  await setup(page,{fail:true});await page.getByRole('button',{name:'Start inspection'}).click();await expect(page.getByRole('status')).toContainText('blocked inspection');await expect(page.getByRole('button',{name:'Start inspection'})).toBeEnabled();
});
