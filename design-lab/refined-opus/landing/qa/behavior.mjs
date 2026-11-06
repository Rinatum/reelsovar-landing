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
 await p.locator('#examples').scrollIntoViewIfNeeded();await p.locator('[data-pause=drum]').click();await p.waitForTimeout(950);
 const gallery=await p.evaluate(()=>[...document.querySelectorAll('.drum-item video')].map(v=>v.poster));check('Twelve source recordings',gallery.length===12&&new Set(gallery.map(u=>u.match(/examples\/([^/]+)/)?.[1])).size===12,gallery);
 for(const [front,genre]of [[1,'Стрим'],[3,'Аниме']]){
  let current=await p.locator('#drum').getAttribute('data-front');while(+current!==front){await p.locator('[data-drum="1"]').click();await p.waitForFunction(previous=>document.querySelector('#drum').dataset.front!==previous,current);current=await p.locator('#drum').getAttribute('data-front')}
  await p.waitForTimeout(950);check('Genre '+genre,(await p.locator('.drum-caption').textContent()).includes(genre));await p.locator('.watch-clip').click();await p.waitForFunction(()=>document.querySelector('.clip-dialog video').readyState>=2);
  const modal=await p.evaluate(()=>{const d=document.querySelector('dialog'),v=d.querySelector('video');return{open:d.open,src:v.currentSrc,muted:v.muted,controls:v.controls,ready:v.readyState,previewsPaused:[...document.querySelectorAll('.drum-item video')].every(x=>x.paused)}});check('Full clip '+genre,modal.open&&modal.src.endsWith('/final.mp4')&&!modal.muted&&modal.controls&&modal.previewsPaused,modal);
  await p.screenshot({path:`landing/shots/dialog-${front}.png`});await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.querySelector('dialog').open);check('Close preserves manual pause',(await p.locator('[data-pause=drum]').getAttribute('aria-pressed'))==='true');
 }
 await p.locator('[data-pause=drum]').click();await p.locator('.watch-clip').click();await p.waitForTimeout(300);await p.locator('.dialog-close').click();await p.waitForFunction(()=>document.querySelector('[data-pause=drum]').getAttribute('aria-pressed')==='false');check('Close resumes automatic drum',(await p.locator('[data-pause=drum]').getAttribute('aria-pressed'))==='false');
 await p.locator('#offer').scrollIntoViewIfNeeded();await p.waitForTimeout(1600);let paused=await p.evaluate(()=>[...document.querySelectorAll('#cut video,#drum video,#rf video,#how-scene video')].every(v=>v.paused));check('Offscreen videos pause',paused);const off=await p.evaluate(()=>new Promise(r=>{const t=gsap.getById('title'),a=t.time();setTimeout(()=>r({moved:t.time()-a}),600)}));check('Title pauses offscreen',off.moved===0,off);
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
