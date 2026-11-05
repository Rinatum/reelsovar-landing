import{chromium}from'/usr/lib/node_modules/playwright-core/index.mjs';
import{writeFile}from'node:fs/promises';
const b=await chromium.connectOverCDP('http://127.0.0.1:9222'),p=await b.contexts()[0].newPage();
try{await p.setViewportSize({width:1200,height:1000});for(const name of ['cafe-01']){
 await p.goto(`http://127.0.0.1:8720/design-lab/refined-opus/landing/assets/${name}-source.mp4`);await p.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
 await p.evaluate(()=>{const v=document.querySelector('video');v.pause();v.style.display='none';document.body.style.cssText='margin:16px;background:#242820;color:#fff;font:16px sans-serif;display:grid;grid-template-columns:1fr 1fr;gap:16px'});
 for(const t of [.1,1.1,3.1,6.1,9.1,12.1])await p.evaluate(async t=>{const v=document.querySelector('video');v.currentTime=t;await new Promise(r=>v.addEventListener('seeked',r,{once:true}));const c=document.createElement('canvas');c.width=560;c.height=315;c.getContext('2d').drawImage(v,0,0,560,315);const d=document.createElement('div');d.textContent=t+' с';d.appendChild(c);document.body.appendChild(d)},t);
 await p.screenshot({path:`landing/shots/${name}-sources.png`,fullPage:true});
 }
}finally{await p.close();await b.close()}
