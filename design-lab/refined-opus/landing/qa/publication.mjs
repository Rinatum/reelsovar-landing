import {chromium} from '/usr/lib/node_modules/playwright-core/index.mjs';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
const root=process.env.LANDING_QA_URL||'http://127.0.0.1:8720/design-lab/refined-opus/landing/site/';
const browser=await chromium.connectOverCDP('http://127.0.0.1:9222');
const page=await browser.contexts()[0].newPage();
const result={url:root,checks:[],errors:[]};
const check=(name,ok,data)=>{result.checks.push({name,ok,data});if(!ok)throw Error(name+': '+JSON.stringify(data));};
page.on('pageerror',e=>result.errors.push(e.message));
page.on('response',r=>{if(r.status()>=400)result.errors.push(r.status()+' '+r.url());});
async function files(dir,prefix=''){let all=[];for(const e of await readdir(dir,{withFileTypes:true})){const name=prefix+e.name;if(e.isDirectory())all.push(...await files(dir+'/'+e.name,name+'/'));else all.push(name)}return all;}
try{
 await page.setViewportSize({width:1440,height:960});
 const response=await page.goto(root+'?release=v5',{waitUntil:'domcontentloaded'});
 check('Published entry returns 200',response.status()===200,response.status());
 const release=await page.evaluate(()=>fetch('release.json',{cache:'no-store'}).then(r=>r.json()));
 check('Published release is v5',release.version==='v5',release);
 const required=(await files('landing/site')).filter(p=>p!=='.nojekyll');
 const resources=await page.evaluate(async paths=>{let index=0,bad=[];await Promise.all(Array.from({length:6},async()=>{while(index<paths.length){const path=paths[index++];const r=await fetch(path,{method:'HEAD'});if(!r.ok)bad.push({path,status:r.status()});}}));return{count:paths.length,bad};},required);
 check('All published files return success',resources.bad.length===0,resources);
 await page.waitForFunction(()=>document.querySelector('#cut').dataset.phase==='clips',{timeout:45000});
 await page.evaluate(()=>{gsap.getById('cut').pause()});
 const times=await page.locator('.slice video').evaluateAll(vs=>vs.map(v=>v.currentTime));await page.waitForTimeout(600);
 const hero=await page.locator('.slice video').evaluateAll(vs=>vs.map(v=>({time:v.currentTime,ready:v.readyState,paused:v.paused})));
 check('Published hero has three moving results',hero.length===3&&hero.every((v,i)=>!v.paused&&v.ready>=2&&v.time>times[i]+.25),hero);
 await page.locator('#examples').scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelectorAll('.drum-item').length===12);
 await page.waitForTimeout(2000);
 check('Published gallery contains 12 sources',await page.locator('.drum-item').count()===12);
 await page.locator('#rf').scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('#rf').dataset.initialized==='true');await page.waitForTimeout(3000);
 check('Published pipeline has three source/result pairs',await page.locator('.pipe-origin').count()===3&&await page.locator('.pipe-deck').count()===3);
 await mkdir('landing/shots/publication',{recursive:true});
 await page.screenshot({path:'landing/shots/publication/desktop.png',fullPage:true});
 for(const width of [1440,390,320]){await page.setViewportSize({width,height:900});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const bounds=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));check('No horizontal overflow '+width,bounds.scroll<=bounds.width,bounds);}
 await page.screenshot({path:'landing/shots/publication/mobile.png',fullPage:true});
 await page.goto(new URL('soon.html',root).href,{waitUntil:'domcontentloaded'});
 check('CTA destination works',await page.locator('h1').textContent()==='Reelsovar скоро откроется.');
 check('No JS/HTTP failures',result.errors.length===0,result.errors);
}finally{await writeFile('landing/qa/publication.json',JSON.stringify(result,null,2));await page.close();await browser.close();}
console.log(JSON.stringify(result,null,2));
