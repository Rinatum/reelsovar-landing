import{chromium}from'/usr/lib/node_modules/playwright-core/index.mjs';
import{writeFile,stat}from'node:fs/promises';
const b=await chromium.connectOverCDP('http://127.0.0.1:9222'),p=await b.contexts()[0].newPage();
const results=[],errors=[];p.on('pageerror',e=>errors.push(e.message));
function check(name,ok,details){results.push({name,ok,details});if(!ok)throw Error(name+': '+JSON.stringify(details))}
const url=process.env.LANDING_QA_URL||'http://127.0.0.1:8720/design-lab/refined-opus/landing/';
try{
 await p.setViewportSize({width:1440,height:1000});await p.goto(url);await p.evaluate(()=>{window.__qaOwner='behavior-v6'});await p.waitForFunction(()=>window.gsap?.getById('cut')&&gsap.getById('title'));await p.waitForTimeout(3100);
 let native=await p.evaluate(async()=>{const t=gsap.getById('cut');t.time(2.9).pause();const v=[...document.querySelectorAll('#cut .slice video')];let frames=0;await Promise.all(v.map(x=>new Promise(r=>{if(!x.requestVideoFrameCallback){r();return}x.requestVideoFrameCallback(()=>{frames++;r()});setTimeout(r,500)})));return{timelineTime:t.time(),phase:document.querySelector('#cut').dataset.phase,frames,live:v.map(x=>({ready:x.readyState,paused:x.paused,time:x.currentTime,w:x.videoWidth,h:x.videoHeight})),clipCovers:[...document.querySelectorAll('.slice')].every(x=>x.classList.contains('is-clip'))}});
 check('Live results revealed during flight',native.timelineTime<3.35&&native.frames===3&&native.live.every(v=>v.ready>=2&&!v.paused)&&native.clipCovers,native);
 // v6: the "до 20 коротких рилсов" cut repeats while visible; front+back faces always add up to a solid word (no blink).
 const title=await p.evaluate(()=>new Promise(resolve=>{const t=gsap.getById('title');let wraps=0,last=t.time(),minSum=2,words=0,frames=0;const start=performance.now();
  const step=()=>{const now=t.time();if(now<last-.5)wraps++;last=now;frames++;
   document.querySelectorAll('.tp').forEach(e=>{const f=+getComputedStyle(e.querySelector('.front')).opacity,b=+getComputedStyle(e.querySelector('.back')).opacity;minSum=Math.min(minSum,f+b)});
   if([...document.querySelectorAll('.tp .back')].every(e=>getComputedStyle(e).opacity==='1'))words++;
   if(performance.now()-start<15500)requestAnimationFrame(step);else resolve({wraps,minSum:+minSum.toFixed(3),wordFrames:words,frames})};requestAnimationFrame(step)}));
 check('Title cut repeats at least twice without blank frames',title.wraps>=2&&title.minSum>=.99&&title.wordFrames>title.frames*.4,title);
 const hidden=await p.evaluate(()=>new Promise(r=>{const t=gsap.getById('title');Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));const a=t.time();
  setTimeout(()=>{const res={titleMoved:t.time()-a,playing:[...document.querySelectorAll('video')].filter(v=>!v.paused).length};delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));r(res)},700)}));
 check('Hidden tab stops title and all videos',hidden.titleMoved===0&&hidden.playing===0,hidden);
 // Seam: inside the right edge of the middle hero card the browser hits the middle card, not a neighbour.
 for(const width of [1180,1440]){await p.setViewportSize({width,height:900});await p.waitForTimeout(700);
  const seam=await p.evaluate(()=>{const t=gsap.getById('cut');t.time(4.1).pause();const probe=document.createElement('style');probe.textContent='#cut .slices,#cut .slice,#cut .slice *{pointer-events:auto!important}';document.head.append(probe);const s=[...document.querySelectorAll('#cut .slice')],r=s[1].getBoundingClientRect();
   const hits=[.97,.92,.06].map(fx=>{const e=document.elementFromPoint(r.left+r.width*fx,r.top+r.height*.5);return e?.closest('.slice')===s[1]});probe.remove();return hits});
  check('Middle hero card is never covered '+width,seam.every(Boolean),seam)}
 await p.setViewportSize({width:1440,height:1000});await p.waitForTimeout(500);await p.evaluate(()=>gsap.getById('cut').resume());
 // v7: the drum has no controls; it turns on its own, keeps turning after a click, and the blurry close-up clip is gone.
 await p.locator('#examples').scrollIntoViewIfNeeded();await p.waitForFunction(()=>document.querySelectorAll('.drum-item').length>0,null,{polling:200});await p.waitForTimeout(800);
 const gallery=await p.evaluate(()=>({posters:[...document.querySelectorAll('.drum-item video')].map(v=>(v.getAttribute('poster')||v.dataset.poster||'').match(/examples\/([^/]+)/)?.[1]),controls:document.querySelectorAll('[data-drum],.watch-clip,.clip-dialog,.drum-item button,button.drum-item').length,pointer:getComputedStyle(document.querySelector('.drum-item')).pointerEvents}));
 check('Drum: eleven sources, no controls, startup close-up removed',gallery.posters.length===11&&new Set(gallery.posters).size===11&&!gallery.posters.includes('full-biz-startup-m02')&&gallery.controls===0&&gallery.pointer==='none',gallery);
 const fronts=[];for(let n=0;n<4;n++){fronts.push(await p.locator('#drum').getAttribute('data-front'));const box=await p.locator('#drum').boundingBox();await p.mouse.click(box.x+box.width/2,box.y+box.height*.45);await p.mouse.click(box.x+box.width*.3,box.y+box.height*.45);await p.waitForTimeout(2400)}
 check('Drum keeps turning by itself after clicks',new Set(fronts).size>=3,fronts);
 // Smooth arc: sample one turn frame by frame; the front card moves monotonically, edge cards fade instead of popping.
 const arc=await p.evaluate(()=>new Promise(r=>{const st=document.querySelector('#drum'),start=st.dataset.front,xs=[],ops=[];const t0=performance.now();
  const f=()=>{const it=[...document.querySelectorAll('.drum-item')][+start],b=it.getBoundingClientRect();xs.push(Math.round(b.left+b.width/2));
   ops.push(...[...document.querySelectorAll('.drum-item')].filter(e=>e.style.visibility==='visible').map(e=>+e.style.opacity));
   if(performance.now()-t0<2600)requestAnimationFrame(f);else{let back=0;for(let i=1;i<xs.length;i++)if(xs[i]>xs[i-1]+1)back++;let jumps=0;for(let i=1;i<xs.length;i++)if(Math.abs(xs[i]-xs[i-1])>60)jumps++;r({frames:xs.length,moved:xs[0]-xs.at(-1),back,jumps})}};requestAnimationFrame(f)}));
 check('Drum turn is a continuous arc (no reversals or jumps)',arc.moved>80&&arc.back===0&&arc.jumps===0,arc);
 await p.locator('#offer').scrollIntoViewIfNeeded();await p.waitForTimeout(1600);let paused=await p.evaluate(()=>[...document.querySelectorAll('#cut video,#drum video,#rf video,#how-scene video')].every(v=>v.paused));check('Offscreen videos pause',paused);const off=await p.evaluate(()=>new Promise(r=>{const t=gsap.getById('title'),a=t.time();setTimeout(()=>r({moved:t.time()-a}),600)}));check('Title pauses offscreen',off.moved===0,off);
 await p.locator('#familiar').scrollIntoViewIfNeeded();await p.waitForTimeout(600);
 const pain=await p.evaluate(()=>new Promise(r=>{const t=gsap.getById('pain');let wraps=0,last=t.time(),dur=t.duration();const t0=performance.now();const f=()=>{const n=t.time();if(n<last-1)wraps++;last=n;if(performance.now()-t0<16000)requestAnimationFrame(f);else r({wraps,cycle:+dur.toFixed(2)})};requestAnimationFrame(f)}));
 check('Pain strike repeats while visible (cycle under 8 s)',pain.wraps>=1&&pain.cycle<8,pain);
 const links=await p.evaluate(()=>[...document.querySelectorAll('a')].map(a=>a.getAttribute('href')));check('CTA destinations exist',links.filter(x=>x==='soon.html').length===5,links);await p.goto(url+'soon.html');check('Coming soon page',await p.locator('h1').textContent()==='Reelsovar скоро откроется.');
 await p.setViewportSize({width:390,height:844});await p.emulateMedia({reducedMotion:'reduce'});await p.goto(url);await p.bringToFront();await p.waitForFunction(()=>document.querySelectorAll('.tp .back').length===4,null,{polling:250});await p.waitForTimeout(500);
 let reduced=await p.evaluate(()=>({playing:[...document.querySelectorAll('video')].filter(v=>!v.paused).length,hero:document.querySelectorAll('#cut .is-clip').length,scene:[...document.querySelectorAll('.tp .back')].every(e=>getComputedStyle(e).opacity==='1')}));check('Reduced motion has no autoplay and a readable title',reduced.playing===0&&reduced.hero===3&&reduced.scene,reduced);
 // v6: on phones all four steps are in the vertical flow (no tabs), each with its final readable state in reduced motion.
 await p.locator('#how').scrollIntoViewIfNeeded();await p.waitForFunction(()=>document.querySelector('#how-scene').dataset.initialized==='true',null,{polling:200});await p.waitForTimeout(400);const column=await p.evaluate(()=>{const st=[...document.querySelectorAll('.station')].map(e=>{const r=e.getBoundingClientRect(),c=getComputedStyle(e);return{top:r.top+scrollY,h:r.height,vis:c.visibility,op:+c.opacity}});
  return{st,tabs:getComputedStyle(document.querySelector('.how-tabs')).display,picked:document.querySelectorAll('.mrow.picked').length,count:document.querySelector('.mc-n').textContent,outputs:document.querySelectorAll('.md-clip').length,interactive:document.querySelectorAll('.mini-search input,.tick input,.md-outputs button').length,overflow:document.documentElement.scrollWidth-innerWidth}});
 check('Mobile steps are a vertical sequence',column.tabs==='none'&&column.st.length===4&&column.st.every((x,i)=>x.vis==='visible'&&x.op===1&&x.h>200&&(i===0||x.top>=column.st[i-1].top+column.st[i-1].h-1))&&column.picked===2&&column.count==='23'&&column.outputs===2&&column.interactive===0&&column.overflow<=0,column);
 await p.locator('#layers').scrollIntoViewIfNeeded();await p.screenshot({path:'landing/shots/layers-reduced-390.png'});await p.locator('#hero').scrollIntoViewIfNeeded();await p.screenshot({path:'landing/shots/hero-reduced-390.png'});
 await p.emulateMedia({reducedMotion:'no-preference'});await p.setViewportSize({width:1440,height:1000});await p.goto(url);await p.locator('#layers').scrollIntoViewIfNeeded();await p.waitForTimeout(2800);await p.locator('#layers').screenshot({path:'landing/shots/layers-1440.png'});
 await p.setViewportSize({width:390,height:844});await p.goto(url+'?mobile-steps=1');await p.waitForTimeout(1500);
 const top=await p.evaluate(()=>document.querySelector('#how').getBoundingClientRect().top+scrollY);await p.evaluate(y=>scrollTo(0,y-200),top);await p.waitForTimeout(600);
 const seen=[];for(let i=0;i<4;i++){
  for(let n=0;n<40;n++){const pos=await p.evaluate(i=>{const r=document.querySelectorAll('.station')[i].getBoundingClientRect();return r.top+r.height/2-innerHeight/2},i);if(pos<=40)break;await p.mouse.move(195,400);await p.mouse.wheel(0,Math.min(160,pos));await p.waitForTimeout(90)}
  const early=await p.evaluate(i=>({played:+document.querySelectorAll('.station')[i].dataset.played||0,box:(r=>[Math.round(r.top),Math.round(r.bottom)])(document.querySelectorAll('.station')[i].getBoundingClientRect()),count:document.querySelector('.mc-n').textContent,picked:document.querySelectorAll('.mrow.picked').length,url:document.querySelector('.mu-text').textContent.length,chips:document.querySelectorAll('.md-platforms li.on').length}),i);
  await p.waitForTimeout(2900);
  const late=await p.evaluate(()=>({count:document.querySelector('.mc-n').textContent,picked:document.querySelectorAll('.mrow.picked').length,tall:+getComputedStyle(document.querySelector('.mf-tall')).opacity,chips:document.querySelectorAll('.md-platforms li.on').length,playing:[...document.querySelectorAll('.md-clip video')].filter(v=>!v.paused).length}));
  seen.push({i,early,late});}
 check('Normal phone scroll plays every step in the flow',seen.every(x=>x.early.played>=1&&x.early.box[0]<844&&x.early.box[1]>0)&&seen.every(x=>x.late.count==='23'&&x.late.picked===2&&x.late.tall===1&&x.late.chips===5)&&seen[3].late.playing===2,seen);
 await p.screenshot({path:'landing/shots/how-scroll-390.png'});
 check('No runtime errors',errors.length===0,errors);
}finally{await writeFile('landing/qa/behavior.json',JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors}));await p.close();await b.close()}
