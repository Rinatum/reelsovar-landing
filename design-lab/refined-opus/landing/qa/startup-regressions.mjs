import{chromium}from'/usr/lib/node_modules/playwright-core/index.mjs';import{writeFile}from'node:fs/promises';
const b=await chromium.connectOverCDP('http://127.0.0.1:9222'),p=await b.contexts()[0].newPage(),results=[],errors=[];
function check(name,ok,data){results.push({name,ok,data});if(!ok)throw Error(name+': '+JSON.stringify(data))}
p.on('pageerror',e=>errors.push(e.message));
const url='http://127.0.0.1:8720/design-lab/refined-opus/landing/';
try{
 await p.setViewportSize({width:1440,height:960});
 // A slow result is allowed to keep its poster; it must never hold the source or the story hostage.
 await p.route('**/full-audience-02-m0*/preview.mp4',async route=>{await new Promise(r=>setTimeout(r,5000));try{await route.continue()}catch{}});
 await p.addInitScript(()=>{window.firstSourcePlay=null;document.addEventListener('playing',e=>{if(e.target.matches('.cut-src')&&window.firstSourcePlay===null)window.firstSourcePlay=performance.now()},true)});
 await p.goto(url+'?delayed-results=4',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>window.firstSourcePlay!==null);
 const early=await p.evaluate(()=>({sourcePlay:window.firstSourcePlay,results:[...document.querySelectorAll('.slice video')].map(v=>v.readyState),distant:[...document.querySelectorAll('#how-scene,#drum,#rf,#layers,#price')].map(e=>({id:e.id,built:!!e.dataset.initialized})),firstSceneRate:gsap.getById('cut').timeScale()}));
 check('Source starts while all results are still blocked',early.results.every(x=>x===0),early);
 check('Distant scenes do not initialize during startup',early.distant.every(x=>!x.built),early.distant);
 await p.waitForFunction(()=>document.querySelector('#cut').dataset.phase==='clips');
 const covers=await p.evaluate(()=>[...document.querySelectorAll('.slice .back')].map(box=>({poster:getComputedStyle(box).backgroundImage,opacity:getComputedStyle(box.querySelector('video')).opacity,ready:box.querySelector('video').readyState})));
 check('Blocked results show posters instead of black video',covers.every(x=>x.poster!=='none'&&x.ready===0&&x.opacity==='0'),covers);
 await p.locator('#cut').screenshot({path:'landing/shots/v4-delayed-results.png'});
 await p.unrouteAll({behavior:'ignoreErrors'});
 await p.goto(url,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.gsap?.getById('cut'));
 // User scrolling initializes each scene and keeps its native behavior.
 for(const id of ['how-scene','drum','rf','layers','price']){await p.locator('#'+id).scrollIntoViewIfNeeded();await p.waitForFunction(id=>document.getElementById(id).dataset.initialized==='true',id)}
 const rates=await p.evaluate(()=>({cut:gsap.getById('cut').timeScale(),burst:gsap.getById('rf').timeScale(),layers:gsap.getById('layers').timeScale(),how:gsap.getById('how').duration(),drumTransition:getComputedStyle(document.querySelector('.drum-ring')).transitionDuration}));
 check('Large scenes use the faster approved motion',rates.cut===1.22&&rates.burst===1.25&&rates.layers===1.25&&rates.how<12.1&&rates.drumTransition==='0.65s',rates);
 await p.setViewportSize({width:390,height:844});await p.goto(url,{waitUntil:'domcontentloaded'});await p.locator('#how-scene').scrollIntoViewIfNeeded();await p.waitForFunction(()=>document.querySelector('#how-scene').dataset.initialized==='true');await p.locator('[data-pause=how]').click();await p.locator('button[data-step="2"]').click();
 const before=await p.evaluate(()=>({step:document.querySelector('#how-scene').dataset.step,time:gsap.getById('how').time()}));await p.setViewportSize({width:390,height:760});await p.waitForTimeout(180);const after=await p.evaluate(()=>({step:document.querySelector('#how-scene').dataset.step,time:gsap.getById('how').time()}));check('Mobile address-bar resize preserves selected step',before.step===after.step&&before.time===after.time,{before,after});
 for(const [width,height]of [[1440,960],[768,1000],[390,844],[320,844]]){await p.setViewportSize({width,height});await p.goto(url,{waitUntil:'domcontentloaded'});await p.evaluate(()=>document.fonts.ready);for(const id of ['hero','familiar','how','examples','benefits','offer']){await p.locator('#'+id).scrollIntoViewIfNeeded();await p.waitForTimeout(250)}const size=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));check('No overflow at '+width,size.scroll<=size.width,size)}
 check('No runtime errors',errors.length===0,errors);
}finally{await writeFile('landing/qa/startup-regressions.json',JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors}));await p.close();await b.close()}
