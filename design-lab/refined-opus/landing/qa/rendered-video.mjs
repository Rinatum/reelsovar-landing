import{chromium}from'/usr/lib/node_modules/playwright-core/index.mjs';import{writeFile,mkdir}from'node:fs/promises';
const b=await chromium.connectOverCDP('http://127.0.0.1:9222'),p=await b.contexts()[0].newPage(),report={samples:[],checks:[],errors:[]};
const root=process.env.LANDING_QA_URL||'http://127.0.0.1:8720/design-lab/refined-opus/landing/';await mkdir('landing/shots/live',{recursive:true});
function check(name,ok,data){report.checks.push({name,ok,data});if(!ok)throw Error(name+': '+JSON.stringify(data))}
p.on('pageerror',e=>report.errors.push(e.message));p.on('response',r=>{if(r.status()>=400)report.errors.push(r.status()+' '+r.url())});
async function sample(name,selector,expected){
 const read=()=>p.evaluate(selector=>[...document.querySelectorAll(selector)].filter(v=>{const r=v.getBoundingClientRect(),c=v.closest('.drum-item');return r.width>10&&r.height>20&&(!c||(getComputedStyle(c).visibility==='visible'&&+getComputedStyle(c).opacity>.1&&!c.classList.contains('is-ghost')))}).map(v=>{const r=v.getBoundingClientRect(),q=v.getVideoPlaybackQuality?.();return{src:v.currentSrc,time:v.currentTime,paused:v.paused,ready:v.readyState,waiting:v.classList.contains('v-wait'),frames:q?.totalVideoFrames,dropped:q?.droppedVideoFrames,rect:{x:r.x,y:r.y,w:r.width,h:r.height}}}),selector);
 const before=await read();check(name+' visible video count',before.length===expected,before.map(v=>v.src));
 await p.screenshot({path:`landing/shots/live/${name}-a.png`});await p.waitForTimeout(700);await p.screenshot({path:`landing/shots/live/${name}-b.png`});const after=await read();
 const rows=before.map(v=>{const n=after.find(x=>x.src===v.src);return{...v,advance:n?(n.time-v.time+60)%60:null,newFrames:n?.frames-v.frames}});
 check(name+' every player advances',rows.every(v=>!v.paused&&!v.waiting&&v.ready>=2&&v.advance>.3&&v.newFrames>=3),rows.map(({rect,...x})=>x));
 report.samples.push({name,before,after});
}
try{
 await p.setViewportSize({width:1440,height:960});await p.goto(root+'?rendered-qa=6',{waitUntil:'domcontentloaded'});await p.evaluate(()=>window.__qaOwner='rendered-video-v6');
 await p.waitForFunction(()=>document.querySelector('#cut').dataset.phase==='clips');await p.evaluate(()=>{gsap.getById('cut').pause()});await sample('hero','.slice video',3);
 check('Hero uses wide three-person recording',(await p.locator('.cut-src').getAttribute('src')).includes('hero-wide.mp4'));
 await p.locator('#examples').scrollIntoViewIfNeeded();await p.waitForFunction(()=>document.querySelectorAll('.drum-item').length===12);await p.waitForTimeout(1300);
 // A user turn postpones autoplay so screenshots measure video, not card travel.
 for(let group=0;group<4;group++){
  const target=group*3;
  while(+(await p.locator('#drum').getAttribute('data-front'))!==target){const from=await p.locator('#drum').getAttribute('data-front');await p.locator('[data-drum="1"]').click();await p.waitForFunction(from=>document.querySelector('#drum').dataset.front!==from,from)}
  // Clicking to the current target again would open a dialog; the next/prev pair only resets the autoplay dwell.
  const from=await p.locator('#drum').getAttribute('data-front');await p.locator('[data-drum="1"]').click();await p.waitForFunction(from=>document.querySelector('#drum').dataset.front!==from,from);const next=await p.locator('#drum').getAttribute('data-front');await p.locator('[data-drum="-1"]').click();await p.waitForFunction(from=>document.querySelector('#drum').dataset.front!==from,next);
  await p.waitForTimeout(650);await sample('gallery-'+group,'.drum-item video',5);
 }
 check('Drum uses flat video surfaces',await p.evaluate(()=>getComputedStyle(document.querySelector('.drum-ring')).transformStyle==='flat'));
 const galleryIds=new Set(report.samples.filter(x=>x.name.startsWith('gallery')).flatMap(x=>x.before.map(v=>v.src)));check('All twelve gallery clips were actually seen moving',galleryIds.size===12,[...galleryIds]);
 check('Drum is wider: edge poster cards on both sides',await p.evaluate(()=>{const g=[...document.querySelectorAll('.drum-item.is-ghost')],st=document.querySelector('#drum').getBoundingClientRect();return g.length===2&&g.every(e=>{const r=e.getBoundingClientRect();return r.left>=st.left-1&&r.right<=st.right+1})}));
 await p.locator('#rf').scrollIntoViewIfNeeded();await p.waitForFunction(()=>document.querySelectorAll('.pipe-deck').length===3);
 check('No source switcher or genre labels',await p.evaluate(()=>!document.querySelector('.pipe-switcher,[data-pipeline]')&&![...document.querySelectorAll('.pipe-meta span')].some(e=>/Бизнес|Подкаст|Интервью/.test(e.textContent))));
 // Automatic source rotation: each recording shows its own real results, as many as exist.
 const expect={'audience-02':['full-audience-02-m01','full-audience-02-m02','full-audience-02-m03','full-audience-02-m04','full-audience-02-m05'],'biz-cafe':['full-biz-cafe-m01','full-biz-cafe-m02','full-biz-cafe-m03'],'biz-hr':['full-biz-hr-m01','full-biz-hr-m02','full-biz-hr-m03']};
 for(let group=0;group<3;group++){
  await p.waitForFunction(g=>{const s=document.querySelector('#rf');return s.dataset.group===String(g)&&s.dataset.phase==='results'},group,{timeout:40000});await p.waitForTimeout(500);await p.evaluate(()=>{gsap.getById('rf').pause()});
  const pair=await p.evaluate(()=>{const d=document.querySelector('.pipe-deck.is-active');return{source:document.querySelector('#rf').dataset.source,deck:d.dataset.sourceId,count:+d.dataset.count,label:document.querySelector('.pipe-button>span').textContent,ids:[...d.querySelectorAll('video')].map(v=>(v.currentSrc||v.dataset.src).match(/examples\/([^/]+)/)[1]),bg:getComputedStyle(document.querySelector('#rf')).backgroundColor}});
  check('Pipeline '+group+' shows exactly its real results',pair.source===pair.deck&&JSON.stringify(pair.ids)===JSON.stringify(expect[pair.source])&&pair.count===pair.ids.length&&pair.label.startsWith(pair.count+' ')&&pair.bg==='rgb(233, 236, 227)',pair);
  await sample('pipeline-'+pair.source,'.pipe-deck.is-active video',pair.count);
  await p.evaluate(()=>{gsap.getById('rf').resume()});
 }
 await p.setViewportSize({width:390,height:844});await p.goto(root,{waitUntil:'domcontentloaded'});await p.evaluate(()=>window.__qaOwner='rendered-video-v6');await p.locator('#rf').scrollIntoViewIfNeeded();await p.waitForFunction(()=>document.querySelector('#rf').dataset.phase==='results');await p.waitForTimeout(500);await p.evaluate(()=>{gsap.getById('rf').pause()});await sample('pipeline-mobile','.pipe-deck.is-active video',+(await p.locator('.pipe-deck.is-active').getAttribute('data-count')));
 const fit=await p.evaluate(()=>{const st=document.querySelector('#rf').getBoundingClientRect();return [...document.querySelectorAll('.pipe-deck.is-active .pipe-card')].every(e=>{const r=e.getBoundingClientRect();return r.left>=st.left&&r.right<=st.right&&r.bottom<=st.bottom+1})});check('Mobile results fit inside stage',fit);
 const bounds=await p.locator('.pipe-origin').first().boundingBox(),stage=await p.locator('#rf').boundingBox();check('Mobile original stays inside stage',bounds.x>=stage.x&&bounds.x+bounds.width<=stage.x+stage.width,{bounds,stage});
 check('No runtime or HTTP errors',report.errors.length===0,report.errors);
}finally{await writeFile('landing/qa/rendered-video.json',JSON.stringify(report,null,2));console.log(JSON.stringify({checks:report.checks,errors:report.errors}));await p.close();await b.close()}
