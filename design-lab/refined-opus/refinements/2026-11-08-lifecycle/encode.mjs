import{chromium}from'/usr/lib/node_modules/playwright-core/index.mjs';import{readFile,writeFile,stat}from'node:fs/promises';
const base='refinements/2026-11-08-lifecycle',html=await readFile('landing/index.html','utf8'),section=html.split('<div class="pipe-results">')[1].split('<svg class="cursor"')[0];
const list=[...section.matchAll(/data-src="([^"]+\/preview\.mp4)"/g)].map(m=>({source:m[1],id:m[1].split('/').at(-2)}));
const b=await chromium.connectOverCDP('http://127.0.0.1:9222'),p=await b.contexts()[0].newPage(),report=[];
try{
 await p.bringToFront();await p.goto('http://127.0.0.1:8720/design-lab/refined-opus/landing/soon.html',{waitUntil:'domcontentloaded'});
 console.log('Encoder support',await p.evaluate(()=>({mp4:MediaRecorder.isTypeSupported('video/mp4;codecs=avc1.42001f'),plain:MediaRecorder.isTypeSupported('video/mp4')})));
 for(const item of list.slice(0,+(process.env.LIMIT||list.length))){
  const output=`${base}/previews/${item.id}.mp4`;
  try{const s=await stat(output);if(s.size>20000&&!process.env.FORCE){console.log(JSON.stringify({id:item.id,skipped:s.size}));continue}}catch{}
  const data=await p.evaluate(async({source})=>{
   document.body.innerHTML='<video muted playsinline style="width:180px"></video><canvas width="360" height="640" style="width:180px"></canvas>';
   const v=document.querySelector('video'),c=document.querySelector('canvas'),ctx=c.getContext('2d',{alpha:false});v.muted=true;v.src='http://127.0.0.1:8720/design-lab/refined-opus/landing/'+source;
   await new Promise((resolve,reject)=>{v.onloadeddata=resolve;v.onerror=()=>reject(Error('source error'));setTimeout(()=>reject(Error('load timeout')),20000)});
   ctx.drawImage(v,0,0,360,640);const stream=c.captureStream(25),mime='video/mp4;codecs=avc1.42001f';
   const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:600000}),chunks=[];
   const stopped=new Promise((resolve,reject)=>{recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};recorder.onstop=resolve;recorder.onerror=reject});
   const duration=Math.min(8,v.duration-.05);let frames=0,handle,done=false;
   const stop=()=>{if(done)return;done=true;v.pause();v.cancelVideoFrameCallback(handle);recorder.stop()};
   const frame=()=>{ctx.drawImage(v,0,0,360,640);frames++;if(v.currentTime>=duration)stop();else handle=v.requestVideoFrameCallback(frame)};
   recorder.start(1000);handle=v.requestVideoFrameCallback(frame);await v.play();const timer=setTimeout(stop,11000);await stopped;clearTimeout(timer);stream.getTracks().forEach(t=>t.stop());
   const blob=new Blob(chunks,{type:mime}),b64=await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.readAsDataURL(blob)});
   return{b64,frames,duration,currentTime:v.currentTime,width:v.videoWidth,height:v.videoHeight,mime,bytes:blob.size};
  },item);
  await writeFile(output,Buffer.from(data.b64,'base64'));delete data.b64;report.push({...item,...data,output});await writeFile(`${base}/encode-report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({id:item.id,...data}));
 }
}finally{await p.close();await b.close()}
