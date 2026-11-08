import {chromium} from '/usr/lib/node_modules/playwright-core/index.mjs';
import {writeFile} from 'node:fs/promises';
import {out,target} from '../config.mjs';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = await browser.contexts()[0].newPage();
const report = {checks:[], errors:[]};
page.on('pageerror', error => report.errors.push(error.message));
function check(name, ok, data) {
  report.checks.push({name,ok,data});
  if (!ok) throw Error(name);
}
try {
  await page.setViewportSize({width:412,height:915});
  await page.bringToFront();
  await page.goto(target('resources=gate'), {waitUntil:'domcontentloaded'});
  for (const id of ['cut','how-scene','drum','rf']) {
    await page.evaluate(id => {
      scrollTo({top:document.getElementById(id).getBoundingClientRect().top+scrollY-80,behavior:'instant'});
    }, id);
    await page.waitForTimeout(id==='rf'?13000:id==='drum'?8000:2500);
  }
  const snapshot = () => page.evaluate(() => [...document.querySelectorAll('video')].map(v => ({
    scene:v.closest('.stage')?.id,
    loaded:!!v.getAttribute('src'), ready:v.readyState, paused:v.paused
  })));
  const current = await snapshot();
  check('After page traversal only the active scene retains video sources',
    current.filter(v=>v.loaded).length>0 && current.filter(v=>v.loaded).every(v=>v.scene==='rf'), current);
  check('Weekly retains at most its current source and five results', current.filter(v=>v.loaded).length<=6, current);
  await page.locator('#offer').scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  const offscreen = await snapshot();
  check('Leaving all media releases every source and pauses every player', offscreen.every(v=>!v.loaded&&v.paused), offscreen);
  check('No runtime errors', report.errors.length===0, report.errors);
} finally {
  await writeFile(out+'/resources.json',JSON.stringify(report,null,2));
  await page.close();
  await browser.close();
}
