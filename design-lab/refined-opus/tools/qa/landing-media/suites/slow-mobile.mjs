// Promoted from refinements/2026-11-08-recovery/; original fixtures and evidence retained.
import {root,out,target} from '../config.mjs';
import{chromium}from'/usr/lib/node_modules/playwright-core/index.mjs';import{writeFile}from'node:fs/promises';
const b=await chromium.connectOverCDP('http://127.0.0.1:9222'),p=await b.contexts()[0].newPage(),side=await b.contexts()[0].newPage();
const cdp=await p.context().newCDPSession(p);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:350,downloadThroughput:1.5*1024*1024/8,uploadThroughput:1024*1024/8});
const result={url:root,network:'1.5Mbps/350ms/cache disabled',runs:[],errors:[]};p.on('pageerror',e=>result.errors.push(e.message));
await p.addInitScript(()=>{
 window.__motion={events:[],samples:[],marks:[]};const log=(kind,v,extra)=>{if(window.__motion.events.length<5000)window.__motion.events.push({at:performance.now(),kind,src:v.currentSrc||v.dataset.src,scene:v.closest('.stage')?.id,paused:v.paused,ready:v.readyState,time:v.currentTime,...extra})};
 const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){log('play-call',this);const x=play.call(this);x?.then(()=>log('play-resolved',this),e=>log('play-rejected',this,{error:e.name}));return x};
 const pause=HTMLMediaElement.prototype.pause;HTMLMediaElement.prototype.pause=function(){if(!this.paused)log('pause-call',this,{stack:new Error().stack.split('\n').slice(1,4)});return pause.call(this)};
 for(const name of['playing','pause','waiting','stalled','error','abort','emptied'])document.addEventListener(name,e=>{if(e.target instanceof HTMLVideoElement)log(name,e.target)},true);
 setInterval(()=>{const s=document.querySelector('#rf');if(!s?.dataset.initialized)return;const g=+s.dataset.group,r=s.getBoundingClientRect();window.__motion.samples.push({at:performance.now(),phase:s.dataset.phase,group:g,tl:window.gsap?.getById('rf')?.time(),active:s.classList.contains('is-running'),hidden:document.hidden,vis:Math.max(0,Math.min(innerHeight,r.bottom)-Math.max(0,r.top)),height:r.height,videos:[s.querySelectorAll('.pipe-source')[g],...s.querySelectorAll('.pipe-deck.is-active video')].filter(Boolean).map(v=>({src:v.currentSrc||v.dataset.src,paused:v.paused,ready:v.readyState,time:v.currentTime,waiting:v.classList.contains('v-wait'),frames:v.getVideoPlaybackQuality().totalVideoFrames})),scenes:[...document.querySelectorAll('.stage.is-running')].map(x=>x.id)})},100);
});
async function mark(name){await p.evaluate(name=>{window.__motion.marks.push({name,at:performance.now()})},name)}
try{
 for(const width of[412]){
  await p.setViewportSize({width,height:915});await p.bringToFront();await p.goto(root+'?lifecycle-repro',{waitUntil:'domcontentloaded'});await p.waitForTimeout(1800);
  const top=await p.locator('#rf').evaluate(e=>e.getBoundingClientRect().top+scrollY);
  await mark('ordinary-scroll');for(let y=0;y<top-110;y+=330){await p.evaluate(y=>{scrollTo({top:y,behavior:'instant'})},y);await p.waitForTimeout(65)}
  await p.evaluate(top=>{scrollTo({top:top-70,behavior:'instant'})},top);await mark('hold-full-cycles');await p.waitForTimeout(32000);
  await mark('rapid-out-back');for(let i=0;i<8;i++){await p.evaluate(()=>{scrollTo({top:document.querySelector('#offer').offsetTop,behavior:'instant'})});await p.waitForTimeout(30+i*7);await p.evaluate(top=>{scrollTo({top:top-70,behavior:'instant'})},top);await p.waitForTimeout(50+i*11)}await p.waitForTimeout(3000);
  await mark('partial-boundary');for(const d of[-540,-420,-300,-180,-50,150,320,420,150,-70]){await p.evaluate(y=>{scrollTo({top:y,behavior:'instant'})},top+d);await p.waitForTimeout(250)}await p.waitForTimeout(2000);
  await mark('actual-tab-away');await side.bringToFront();await p.waitForTimeout(1200);await p.bringToFront();await mark('tab-back');await p.waitForTimeout(4000);
  const data=await p.evaluate(()=>window.__motion);result.runs.push({width,...data});await writeFile(`${out}/slow/trace-${width}.json`,JSON.stringify(data,null,2));console.log(JSON.stringify({width,samples:data.samples.length,events:data.events.length,rejections:data.events.filter(x=>x.kind==='play-rejected').length}));
 }
}finally{await writeFile(`${out}/slow/report.json`,JSON.stringify(result,null,2));await side.close();await p.close();await b.close()}
