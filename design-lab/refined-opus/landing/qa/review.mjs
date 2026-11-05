import{chromium}from'/usr/lib/node_modules/playwright-core/index.mjs';
import{writeFile}from'node:fs/promises';
const b=await chromium.connectOverCDP('http://127.0.0.1:9222'),p=await b.contexts()[0].newPage();
const errors=[],bad=[],report=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)bad.push([r.status(),r.url()])});
try{for(const width of [1440,768,390,320]){await p.setViewportSize({width,height:width<760?844:1000});await p.goto('http://127.0.0.1:8720/design-lab/refined-opus/landing/');await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(3400);
 await p.screenshot({path:`landing/shots/hero-${width}.png`});
 for(const id of ['familiar','how','examples','benefits','offer']){await p.locator('#'+id).scrollIntoViewIfNeeded();await p.waitForTimeout(id==='benefits'?3800:1400);await p.locator('#'+id).screenshot({path:`landing/shots/${id}-${width}.png`});}
 report.push(await p.evaluate(()=>({width:innerWidth,body:document.documentElement.scrollWidth,sections:[...document.querySelectorAll('main>section')].map(s=>({id:s.id,height:s.offsetHeight})),overflow:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.left<-1&&getComputedStyle(e).position!=='absolute'&&!e.closest('.stage')}).map(e=>e.className),title:document.querySelector('h1').getAttribute('aria-label')})));
 await p.screenshot({path:`landing/shots/full-${width}.png`,fullPage:true});
 }
 await writeFile('landing/qa/review.json',JSON.stringify({report,errors,bad},null,2));console.log(JSON.stringify({report,errors,bad}));
}finally{await p.close();await b.close()}
