// Reelsovar · интегрированный лендинг, motion v6. GSAP из общего vendor/.
// Сюжетные сцены повторяются сами, пока видны, и имеют кнопку «Пауза» (WCAG 2.2.2).
// Короткие текстовые и цифровые сцены играют один раз при каждом появлении на экране.
// В скрытой вкладке всё стоит; при reduced motion — итоговый кадр, запуск кнопкой «Смотреть».
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = () => innerWidth < 760;
  const EXPO = 'expo.out';
  const TEMPO = { cut: 1.22, title: 1.12, rf: 1.25, layers: 1.25 };
  // transitions-polish: stagger startup work; keep authored scene durations intact.
  const MOTION = { stagger: .04 };
  // Only build distant scenes when they approach the viewport. Keep the first paint small.
  function deferScene(selector, init, margin = 240) {
    const el = $(selector);
    new IntersectionObserver(([entry], observer) => {
      if (!entry.isIntersecting) return;
      observer.disconnect(); el.querySelectorAll('video:not([data-lazy-poster])').forEach(underlay); init(); el.dataset.initialized = 'true';
    }, { rootMargin: `${margin}px 0px` }).observe(el);
  }
  const hms = s => { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`; };
  const mediaFrames = new WeakMap(), mediaPlayback = new WeakMap();
  const recoveryDelays = [450, 1200, 2600];
  function playback(v) {
    if (!mediaPlayback.has(v)) mediaPlayback.set(v, { wanted:false, attempts:0, retry:null, stall:null, blocked:false, exhausted:false, readyAt:0, progress:performance.now(), at:v.currentTime, failedAt:0 });
    return mediaPlayback.get(v);
  }
  function notifyMedia(v) { v.closest('.stage')?.dispatchEvent(new Event('media-state')); }
  function wantsPlayback(v) { return playback(v).wanted && !document.hidden && !!v.closest('.stage.is-running'); }
  function clearRecovery(m) { clearTimeout(m.retry); clearTimeout(m.stall); m.retry=null; m.stall=null; }
  function pauseVideo(v) {
    const m=playback(v),changed=m.wanted;m.wanted=false;clearRecovery(m);
    if(!v.paused)v.pause();
    if(changed)notifyMedia(v);
  }
  function reloadVideo(v) {
    const f=mediaFrames.get(v);
    if(f?.watching&&v.cancelVideoFrameCallback)v.cancelVideoFrameCallback(f.callback);
    if(f)f.watching=false;
    if(v.currentTime>0)resumePositions.set(v,v.currentTime);
    v.classList.add('v-wait');v.removeAttribute('src');v.load();
  }
  function recoverVideo(v, reason) {
    const m=playback(v);
    if(!wantsPlayback(v))return;
    if(reason==='NotAllowedError'){m.blocked=true;notifyMedia(v);return;}
    if(m.retry||m.blocked)return;
    if(m.attempts>=recoveryDelays.length){m.exhausted=true;notifyMedia(v);return;}
    m.failedAt=performance.now();
    m.retry=setTimeout(()=>{
      m.retry=null;if(!wantsPlayback(v))return;
      m.attempts++;m.progress=performance.now();reloadVideo(v);play(v);
    },recoveryDelays[m.attempts]);
  }
  function watchStall(v) {
    const m=playback(v);if(m.stall||!wantsPlayback(v))return;
    const at=v.currentTime;
    m.stall=setTimeout(()=>{
      m.stall=null;if(!wantsPlayback(v))return;
      if(v.currentTime<=at+.04&&performance.now()-m.progress>=7800)recoverVideo(v,'stalled');
      else if(v.readyState<3)watchStall(v);
    },8000);
  }
  function frameReady(v) {
    const m=playback(v);if(v.paused||!m.wanted)return;v.classList.remove('v-wait');m.readyAt=performance.now();m.attempts=0;m.blocked=false;m.exhausted=false;
    clearTimeout(m.retry);m.retry=null;notifyMedia(v);
  }
  const underlay = v => {
    if (mediaFrames.has(v)) return;
    const poster = v.getAttribute('poster') || v.dataset.poster, box = v.parentElement;
    if (poster) { v.poster = poster; box.style.backgroundImage = `url("${poster}")`; box.classList.add('has-under'); v.classList.add('v-wait'); }
    const frames = { watching: false, callback: null };
    mediaFrames.set(v, frames);
    const monitor = () => {
      if (frames.watching || !v.requestVideoFrameCallback || !v.classList.contains('v-wait')) return;
      frames.watching = true;
      const presented = () => {
        frames.watching = false;
        frameReady(v);
      };
      frames.callback = v.requestVideoFrameCallback(presented);
    };
    v.addEventListener('playing',()=>{monitor();notifyMedia(v)});
    v.addEventListener('pause', () => {
      // A queued pause event may arrive after the user has already resumed.
      if (!v.paused) return;
      if (frames.watching && v.cancelVideoFrameCallback) v.cancelVideoFrameCallback(frames.callback);
      frames.watching = false;
      // Release an abandoned cold request so it cannot occupy the connection
      // pool while the next visible scene waits. Keep decoded/cached videos.
      if (v.readyState < 2 && v.getAttribute('src')) {
        v.preload = 'none'; v.removeAttribute('src'); v.load();
      }
    });
    v.addEventListener('error', () => {if(v.error){v.classList.add('v-wait');recoverVideo(v,'media-error')}});
    v.addEventListener('waiting',()=>{watchStall(v);notifyMedia(v)});v.addEventListener('stalled',()=>{watchStall(v);notifyMedia(v)});
    v.addEventListener('progress',()=>{playback(v).progress=performance.now()});
    // Persistent fallback: eviction/reload may need another first-frame reveal.
    v.addEventListener('timeupdate',()=>{
      const m=playback(v);
      if(v.currentTime>m.at+.01){clearTimeout(m.stall);m.stall=null;}
      m.at=v.currentTime;
      if(v.readyState>=2&&v.currentTime>0&&v.classList.contains('v-wait'))frameReady(v);
    });
  };
  document.querySelectorAll('.cut-src,.slice video').forEach(underlay);
  const resumePositions = new WeakMap();
  function discardVideo(v) {
    if (!v.paused || !v.getAttribute('src')) return;
    const m=playback(v);m.wanted=false;clearRecovery(m);
    const f=mediaFrames.get(v);
    if(f?.watching&&v.cancelVideoFrameCallback)v.cancelVideoFrameCallback(f.callback);
    if(f)f.watching=false;
    if(v.currentTime>0)resumePositions.set(v,v.currentTime);
    if(!v.dataset.src)v.dataset.src=v.getAttribute('src');
    v.classList.add('v-wait');v.removeAttribute('src');v.load();
  }
  function releaseOffscreenMedia(el) {
    const r=el.getBoundingClientRect();
    if(r.bottom>0&&r.top<innerHeight)return;
    // Paused decoded players still retain media resources on phones.
    el.querySelectorAll('video').forEach(discardVideo);
  }
  // Offscreen files stay unrequested. Scenes attach only their visible posters;
  // fetch video when it will actually play.
  const load = (v, eager = false) => {
    if (!eager) return;
    underlay(v);
    if(v.preload!=='auto')v.preload='auto';
    const url=mobile()&&v.dataset.mobileSrc?v.dataset.mobileSrc:v.dataset.src;
    if (!v.getAttribute('src') && url) {
      v.src = url;
      if (resumePositions.has(v)) {
        const at = resumePositions.get(v); resumePositions.delete(v);
        v.addEventListener('loadedmetadata', () => { v.currentTime = Math.min(at, Math.max(0, v.duration - .06)); }, { once: true });
      }
    }
  };
  const play = v => {
    const m=playback(v),wasWanted=m.wanted;m.wanted=true;
    if(m.blocked){notifyMedia(v);return Promise.resolve(false);}
    if(m.exhausted&&performance.now()-m.failedAt>30000){m.attempts=0;m.exhausted=false;}
    if(m.exhausted){notifyMedia(v);return Promise.resolve(false);}
    if(!wasWanted)m.progress=performance.now();
    load(v,true);if(!wasWanted)notifyMedia(v);if(!v.muted)v.muted=true;if(!v.defaultMuted)v.defaultMuted=true;if(!v.playsInline)v.playsInline=true;
    if(v.error){recoverVideo(v,'media-error');return Promise.resolve(false);}
    if(!v.paused&&!v.ended)return Promise.resolve(true);
    return v.play().then(()=>{delete v.dataset.playError;return true}).catch(error=>{
      v.dataset.playError=error.name;
      if(error.name!=='AbortError')recoverVideo(v,error.name);
      return false;
    });
  };
  addEventListener('online',()=>document.querySelectorAll('video').forEach(v=>{
    const m=playback(v);if(!wantsPlayback(v)||m.blocked)return;
    m.attempts=0;m.exhausted=false;
    if(v.paused||v.error||v.readyState<2)recoverVideo(v,'online');
  }));
  const prepare = v => {
    load(v, true);
    if (v.readyState >= 2 || v.error) return Promise.resolve();
    return new Promise(resolve => {
      let timer;
      const done = () => { clearTimeout(timer); v.removeEventListener('loadeddata', done); v.removeEventListener('error', done); resolve(); };
      v.addEventListener('loadeddata', done, { once: true }); v.addEventListener('error', done, { once: true });
      timer = setTimeout(done, 6000); // poster remains usable on a slow or failed request
    });
  };

  // Сцены с видео (exclusive) не играют одновременно: идёт только та, что больше всех видна на экране.
  const scenes = [];
  function arbitrate() {
    let best = null;
    scenes.forEach(s => { if (s.exclusive && s.inView && (!best || s.area > best.area)) best = s; });
    scenes.forEach(s => { const v = s.exclusive ? s === best : s.inView; if (v !== s.visible) { s.visible = v; s.run(); } });
  }
  // Страница сначала дорисовывает первый экран; остальные сцены подгружают видео позже.
  const loaded = new Promise(r => document.readyState === 'complete' ? r() : addEventListener('load', r, { once: true }));
  const settled = loaded.then(() => new Promise(r => setTimeout(r, 1500)));
  const THRESHOLDS = Array.from({ length: 11 }, (_, i) => i / 10);
  // Повторяющаяся сцена: идёт, только когда видна, вкладка активна и нет паузы от пользователя.
  function loopScene(el, name, api, exclusive = false) {
    const st = { visible: false, paused: reduced, inView: false, area: 0, exclusive };
    let revision = 0;
    const btn = $(`[data-pause="${name}"]`);
    let status=null;
    if(name==='rf'||name==='drum'){status=document.createElement('p');status.className='media-note';status.hidden=true;status.setAttribute('role','status');status.setAttribute('aria-live','polite');el.appendChild(status);}
    const issues=()=>[...el.querySelectorAll('video')].filter(v=>{const m=playback(v);return m.wanted&&(m.blocked||m.exhausted)});
    const label = () => { if (!btn) return; const issue=issues(),text=st.paused?'Смотреть':issue.length?'Запустить видео':'Пауза';if(btn.textContent!==text)btn.textContent=text;const pressed=String(st.paused);if(btn.getAttribute('aria-pressed')!==pressed)btn.setAttribute('aria-pressed',pressed);
      if(status){const loading=[...el.querySelectorAll('video')].some(v=>playback(v).wanted&&(v.readyState<3||v.classList.contains('v-wait')));const note=issue.length?(issue.some(v=>playback(v).blocked)?'Нажмите «Запустить видео»':'Не все примеры загрузились'):loading?'Загружаем примеры…':'';if(status.textContent!==note)status.textContent=note;const hidden=st.paused||!st.running()||!note;if(status.hidden!==hidden)status.hidden=hidden;}
    };
    el.addEventListener('media-state',label);
    st.running = () => st.visible && !st.paused && !document.hidden;
    const run = async () => {
      const rev = ++revision;
      el.classList.toggle('is-running', st.running());
      if (!st.running()) { api.pause(); return; }
      api.prime?.();
      // Ждём первые кадры недолго: на медленной сети сцена идёт на постерах, а не стоит.
      if (api.ready) await Promise.race([api.ready(), new Promise(r => setTimeout(r, api.wait || 1200))]);
      if (rev === revision && st.running()) api.play();
    };
    st.pause = () => { st.paused = true; label(); run(); };
    st.resume = () => { st.paused = false; label(); run(); };
    btn?.addEventListener('click', () => {
      const failed=issues();
      if(failed.length&&!st.paused){
        // These native play calls stay directly inside the user gesture.
        failed.forEach(v=>{const m=playback(v);clearRecovery(m);m.attempts=0;m.blocked=false;m.exhausted=false;if(v.error)reloadVideo(v);play(v)});
        label();run();return;
      }
      st.paused=!st.paused;label();run();
    });
    st.run = run; scenes.push(st);
    new IntersectionObserver(([e]) => { st.inView = e.isIntersecting && e.intersectionRatio >= .2; st.area = e.intersectionRect.height; arbitrate(); if (!e.isIntersecting) releaseOffscreenMedia(el); }, { threshold: THRESHOLDS }).observe(el);
    new IntersectionObserver(([e], observer) => { if (e.isIntersecting) { settled.then(() => api.warm?.()); observer.disconnect(); } }, { rootMargin: '500px 0px' }).observe(el);
    document.addEventListener('visibilitychange', run);
    label();
    return st;
  }
  // Разовая сцена: проигрывается заново, когда снова появляется после ухода с экрана.
  function onceOnEnter(el, tl, threshold = .5) {
    if (reduced) { tl.progress(1); return; }
    let inView = false;
    const run = () => { if (document.hidden || !inView) tl.pause(); else if (tl.progress() < 1) tl.resume(); };
    new IntersectionObserver(([e]) => { inView = e.isIntersecting && e.intersectionRatio >= threshold; if (inView && !document.hidden) tl.restart(); else tl.pause(); }, { threshold }).observe(el);
    document.addEventListener('visibilitychange', run);
  }
  // Курсор-подсказка «как у Get clips»: подъезжает к элементу и нажимает.
  function cursorTo(tl, cursor, stage, target, at, from) {
    const S = stage.getBoundingClientRect(), B = target.getBoundingClientRect();
    const x1 = B.left - S.left + B.width * .55, y1 = B.top - S.top + B.height * .55;
    if (from) tl.fromTo(cursor, { opacity: 0, x: from.x, y: from.y, scale: 1 }, { opacity: 1, duration: .2 }, at);
    tl.to(cursor, { x: x1, y: y1, duration: .7, ease: 'power2.inOut' }, at)
      .to(cursor, { scale: .8, duration: .08, yoyo: true, repeat: 1 }, at + .75)
      .to(target, { scale: .94, duration: .08, yoyo: true, repeat: 1 }, at + .75);
    return at + .85;
  }

  /* Static source covers a front-facing native video; reveal happens while the card is edge-on. */
  (function cut() {
    const st = $('#cut'), frame = $('.cut-frame', st), src = $('.cut-src', st), input = $('.cut-input', st);
    const cards = $$('.slice', st), videos = cards.map(e => $('video', e)), canvases = cards.map(e => $('canvas', e));
    const pins = $$('.pin', st), lines = $$('.cut-line', st), lineBox = $('.cut-lines', st), bar = $('.tl-play', st);
    const link = $('.ci-link', st), button = $('.ci-btn', st), label = $('.ci-label', st), progress = $('.ci-progress', st), cursor = $('.cursor', st);
    const portal = document.createElement('i'); portal.className = 'cut-portal'; portal.setAttribute('aria-hidden','true'); st.appendChild(portal);
    cards.forEach(e => e.appendChild($('.badge', e)));
    const URL = 'youtube.com/watch?v=np2Az44NJMY', poster = new Image(); poster.src = src.poster;
    const modes = cards.map(() => 'source');
    const values = cards.map(() => ({ t: 0 }));
    const contexts = canvases.map(c => c.getContext('2d', {alpha:false,desynchronized:true}));
    const setPose = cards.map(card => gsap.quickSetter(card, 'css'));
    let tl, state, geometry;
    const lerp = (a,b,t) => a+(b-a)*t;
    let resultsWarm = false;
    const warmResults = () => { if (resultsWarm) return; resultsWarm = true; videos.forEach(v=>load(v)); };

    src.addEventListener('playing', () => {
      if (src.requestVideoFrameCallback) src.requestVideoFrameCallback(warmResults);
      else warmResults();
    }, { once: true });
    function measure() {
      const S=st.getBoundingClientRect(),F=frame.getBoundingClientRect(),small=S.width<600;
      const h=small?S.width*.34*16/9:Math.min(S.height*.64,((S.width-120)/3)*16/9);
      const w=h*9/16, gap=small?-w*.12:S.width*.035, x0=(S.width-3*w-2*gap)/2;
      return cards.map((el,i)=>{
        // Карточки по центру свободного места над шкалой записи, без пустоты снизу.
        const x=x0+i*(w+gap),y=small?S.height*.13:Math.max(S.height*.05,(S.height*.8-h)/2),sx=F.width/3/w,sy=F.height/h;
        Object.assign(el.style,{left:x+'px',top:y+'px',width:w+'px',height:h+'px'});
        const dpr=Math.min(devicePixelRatio||1,1.5);canvases[i].width=Math.round(w*dpr);canvases[i].height=Math.round(h*dpr);
        el.style.zIndex=i===1?'3':'1';
        return {x:(F.left-S.left+i*F.width/3+F.width/6)-(x+w/2),y:(F.top-S.top+F.height/2)-(y+h/2),sx,sy,S,end:small&&i!==1?.9:1};
      });
    }
    function snapshot() {
      const image=src.readyState>=2?src:poster,iw=image.videoWidth||image.naturalWidth,ih=image.videoHeight||image.naturalHeight;
      if(!iw)return;
      canvases.forEach((c,i)=>contexts[i].drawImage(image,i*iw/3,0,iw/3,ih,0,0,c.width,c.height));
    }
    function mode(i,next) {
      if(modes[i]===next)return;
      modes[i]=next;cards[i].classList.toggle('is-clip',next==='clip');
      canvases[i].dataset.surface=next;
    }
    function pose(i,t,back=false) {
      const g=geometry[i],u=back?1-t:t,wave=Math.sin(Math.PI*u);
      // Continuous curved flight: no stop at the image handover.
      setPose[i]({x:lerp(g.x,0,u)+(i-1)*wave*g.S.width*.045,y:lerp(g.y,0,u)-wave*g.S.height*.08,
        z:wave*75+(i===1?6:-6)*u,scaleX:lerp(g.sx,g.end,u),scaleY:lerp(g.sy,g.end,u),rotationY:wave*84*(i===1?-1:1),
        rotation:lerp(0,[-6,0,6][i],u)+(i-1)*wave*11});
      mode(i,u>=.5?'clip':'source');
    }
    function reset() {
      st.dataset.phase='input';label.textContent='Нарезать';link.textContent='';
      cards.forEach((e,i)=>{modes[i]='source';e.classList.remove('is-clip');values[i].t=0;pose(i,0)});
      snapshot();
    }
    function build() {
      tl?.kill();geometry=measure();
      gsap.set(cards,{opacity:0,transformOrigin:'50% 50%',transformPerspective:0});
      gsap.set([frame,input,lineBox],{opacity:1});gsap.set(input,{y:0});gsap.set(lines,{scaleY:0,transformOrigin:'50% 0%'});
      gsap.set(pins,{scale:0});gsap.set(portal,{opacity:0,scale:.5});gsap.set(cursor,{opacity:0});
      const typing={n:0};
      tl=gsap.timeline({id:'cut',paused:true,onComplete(){if(state?.running())tl.restart()}})
        .call(reset,null,0).set(bar,{scaleX:0},0).set(progress,{scaleX:0},0)
        .to(typing,{n:URL.length,duration:.55,ease:'none',onStart(){typing.n=0},onUpdate(){link.textContent=URL.slice(0,Math.round(typing.n))}},.05);
      cursorTo(tl,cursor,st,button,.35,{x:geometry[0].S.width*.88,y:geometry[0].S.height*.94});
      tl.call(()=>{label.textContent='Ищем моменты'},null,1.2)
        .to(progress,{scaleX:1,duration:.85,ease:'power2.inOut'},1.2).to(bar,{scaleX:1,duration:.85,ease:'power1.inOut'},1.2)
        .to(cursor,{opacity:0,duration:.2},1.4).to(pins,{scale:1,duration:.2,stagger:.16,ease:'power3.out'},1.45)
        .to(lines,{scaleY:1,duration:.16,stagger:.07,ease:'power2.in'},1.9)
        .call(()=>{pauseVideo(src);snapshot();st.dataset.phase='cut'},null,2.12)
        .set(cards,{opacity:1},2.13).set(frame,{opacity:0},2.13)
        .to([input,lineBox],{opacity:0,duration:.2},2.14)
        .to(portal,{opacity:.8,scale:1.6,duration:.45,ease:'sine.out'},2.2);
      // Start decoders ahead of the flight, 40ms apart. Missing media keeps its
      // own poster; it never pauses the source→results timeline.
      videos.forEach((video, i) => tl.call(() => { if (state?.running()) play(video); }, null, 1.5 + i * MOTION.stagger));
      values.forEach((v,i)=>tl.fromTo(v,{t:0},{t:1,duration:1.05,ease:'power2.inOut',immediateRender:false,onUpdate(){pose(i,v.t)}},2.16+i*.065));
      tl.to(portal,{opacity:0,scale:2,duration:.55,ease:'sine.inOut'},2.8)
        .call(()=>{st.dataset.phase='clips'},null,3.35)
        .call(()=>{src.currentTime=0},null,4.2)
        .call(snapshot,null,5.45)
        .to({}, {duration:2.3},3.35)
        .call(()=>{st.dataset.phase='return'},null,5.65)
        .to(portal,{opacity:.65,scale:1.3,duration:.35},5.8);
      values.forEach((v,i)=>tl.fromTo(v,{t:0},{t:1,duration:.85,ease:'power2.inOut',immediateRender:false,onUpdate(){pose(i,v.t,true)}},5.65+i*.05));
      tl.set(frame,{opacity:1},6.64).set(cards,{opacity:0},6.64)
        .call(()=>{videos.forEach(v=>pauseVideo(v));if(state?.running())play(src)},null,6.65)
        .to(portal,{opacity:0,duration:.4},6.45)
        .set(lines,{scaleY:0},6.65).set(pins,{scale:0},6.65).set(progress,{scaleX:0},6.65)
        .to(input,{opacity:1,duration:.3},6.7).set(lineBox,{opacity:1},6.7)
        .to({}, {duration:.55},7);
      tl.timeScale(TEMPO.cut);
      reset();
      if(reduced){tl.time(4).pause();cards.forEach((e,i)=>mode(i,'clip'));pauseVideo(src);videos.forEach(v=>pauseVideo(v))}
    }
    state=loopScene(st,'cut',{
      warm(){if(src.readyState>=2)warmResults()},
      prime(){if(tl.time()<2.12||tl.time()>=6.65)play(src)},
      ready(){return prepare(src)},
      play(){if(tl.progress()===1)tl.restart();else tl.resume();if(tl.time()>=1.5&&tl.time()<6.65)videos.forEach(play);if(tl.time()<2.1||tl.time()>=6.65)play(src);},
      pause(){tl.pause();pauseVideo(src);videos.forEach(v=>pauseVideo(v))},
    },true);
    build();
    let width=innerWidth;addEventListener('resize',()=>{if(Math.abs(innerWidth-width)>20){width=innerWidth;build();if(state.running())tl.play()}});
  })();

  /* Film and words share a front-facing surface; no backface culling or blank restart. */
  document.fonts.ready.then(function title() {
    const st=$('#title'),line=$('.tt-line2',st),first=$$('.tt-line1 .w',st),words=['до','20','коротких','рилсов'];
    const frames=['02','05','04','03','01','02','05'].map(i=>`media/examples/full-audience-01-m${i}/source-thumb.jpg`);
    let tl,state,lastWidth=0;
    function build(){
      tl?.kill();line.innerHTML='';
      const available=st.clientWidth;st.style.setProperty('--title-size',Math.min(innerWidth<760?34:52,available/11.55)+'px');
      const fs=parseFloat(getComputedStyle(line).fontSize),measure=document.createElement('span');measure.style.cssText='position:absolute;visibility:hidden;white-space:nowrap;font:inherit';line.appendChild(measure);
      const widths=words.map(w=>{measure.textContent=w;return measure.getBoundingClientRect().width+fs*.2});measure.remove();
      let offset=0;
      const pieces=words.map((w,i)=>{const e=document.createElement('span');e.className='tp';e.style.width=widths[i]+'px';
        e.innerHTML=`<span class="face front"><span class="film" style="left:${-offset}px">${frames.map(src=>`<img src="${src}" alt="">`).join('')}</span></span><span class="face back${i===1?' hl':''}">${w}</span>`;
        offset+=widths[i];line.appendChild(e);return e});
      const playhead=document.createElement('i');playhead.className='tt-play';line.appendChild(playhead);
      let x=0;const cuts=widths.slice(0,-1).map(w=>{x+=w;const e=document.createElement('i');e.className='tt-cut';e.style.left=x+'px';line.appendChild(e);return e});
      const states=pieces.map(()=>({v:0}));
      const setters=pieces.map(e=>gsap.quickSetter(e,'css'));
      const fronts=pieces.map(e=>$('.front',e)),backs=pieces.map(e=>$('.back',e));
      const mixes=pieces.map(()=>-1);
      function pose(i,v){const e=pieces[i],mix=Math.max(0,Math.min(1,(v-.42)/.16));
        setters[i]({rotationY:Math.sin(v*Math.PI)*78,x:(i-1.5)*fs*.11*v,y:-Math.sin(v*Math.PI)*fs*.07});
        if(mixes[i]!==mix){fronts[i].style.opacity=1-mix;backs[i].style.opacity=mix;mixes[i]=mix;}
      }
      tl=gsap.timeline({id:'title',paused:true,onComplete(){if(state?.running())tl.restart()}})
        .set(playhead,{x:0,opacity:0},0).set(cuts,{scaleY:0,opacity:1},0)
        .to(playhead,{opacity:1,duration:.15},.1).to(playhead,{x:offset,duration:.65,ease:'power2.inOut'},.15)
        .to(playhead,{opacity:0,duration:.15},.8).to(cuts,{scaleY:1,duration:.14,stagger:.06},.85)
        .to(cuts,{opacity:0,duration:.16},1.12);
      states.forEach((v,i)=>{pose(i,0);tl.fromTo(v,{v:0},{v:1,duration:.72,ease:'power2.inOut',immediateRender:false,onUpdate(){pose(i,v.v)}},1.1+i*.055)});
      // Слова держатся ~4 с, затем мягко возвращаются в плёнку и рез повторяется: без пустого кадра.
      states.forEach((v,i)=>tl.fromTo(v,{v:1},{v:0,duration:.7,ease:'power2.inOut',immediateRender:false,onUpdate(){pose(i,v.v)}},6.1+i*.04));
      tl.to({}, {duration:.5},6.92).timeScale(TEMPO.title);
      if(reduced){tl.time(3).pause();states.forEach((v,i)=>pose(i,1))}
    }
    // Keep the complete title readable even before its first word arrives.
    const intro=gsap.timeline({paused:true});
    first.forEach((e,i)=>intro.fromTo(e,{y:'.18em',color:'#bda65b'},{y:0,color:'#22251f',duration:.35,ease:'power2.out',immediateRender:false},i*.14));
    let entered=false;
    state=loopScene(st,'title',{play(){if(!entered&&!reduced){entered=true;intro.play()}else if(!reduced&&intro.progress()<1)intro.resume();if(tl.progress()===1)tl.restart();else tl.resume()},pause(){tl.pause();intro.pause()}});
    build();lastWidth=st.clientWidth;
    addEventListener('resize',()=>{if(Math.abs(st.clientWidth-lastWidth)>2){lastWidth=st.clientWidth;build();if(state.running())tl.play()}});
  });

  /* ── 13. Как это работает: четыре станции ── */
  deferScene('#how-scene', function how() {
    const st = $('#how-scene'), stations = $$('.station', st), track = $('.how-track', st), fill = $('.ht-fill', st), token = $('.ht-token', st);
    const url = $('.mu-text', st), rec = $('.mini-rec', st), count = $('.mc-n', st);
    const rows = $$('.mrow', st), sel = $('.ms-n', st), frameBox = $('.st-frame', st), tall = $('.mf-tall', st);
    const vids = $$('video', st), chips = $$('.md-platforms li', st);
    const vidStation = v => stations.indexOf(v.closest('.station'));
    const URL = 'youtube.com/watch?v=np2Az44NJMY', STEP = 2.85;
    // На телефоне шаги идут столбиком: каждый проигрывается, когда посетитель до него доскроллил.
    const vertical = () => mobile();
    let tl, state, xs = [], segs = [], lastVertical = null;
    const stationLive = stations.map(() => false);
    const stepButtons = $$('[data-step]', st);
    const syncVideos = () => vids.forEach(v => {
      const on = state?.running() && (vertical() ? stationLive[vidStation(v)] : true);
      if (on) play(v); else pauseVideo(v);
    });
    const activate = i => {
      st.dataset.step = i;
      if (vertical()) stations.forEach(s => { s.classList.add('on'); s.classList.remove('dim'); s.removeAttribute('aria-hidden'); });
      else stations.forEach((s, k) => { s.classList.toggle('on', k === i); s.classList.toggle('dim', k !== i); s.setAttribute('aria-hidden', 'false'); });
      stepButtons.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
      syncVideos();
    };
    function measure() {
      xs = [];
      if (getComputedStyle(track).display === 'none') return;
      const S = st.getBoundingClientRect(), nums = stations.map(s => $('.st-n', s).getBoundingClientRect());
      const c = nums.map(r => r.left + r.width / 2 - S.left), top = nums[0].top - S.top - 22;
      Object.assign(track.style, { left: c[0] + 'px', right: 'auto', width: (c[3] - c[0]) + 'px', top: top + 'px' });
      xs = c.map(v => v - c[0]);
    }
    const finals = () => {   // итоговый вид всех станций (для неактивных и reduced motion)
      url.textContent = URL; gsap.set(rec, { opacity: 1, y: 0 }); count.textContent = '23';
      rows.forEach(r => { r.classList.toggle('picked', !!r.dataset.pick); gsap.set(r, { opacity: 1, y: 0 }); }); sel.textContent = '2';
      frameBox.classList.add('dimmed'); gsap.set(tall, { opacity: 1, scale: 1 });
      chips.forEach(c => c.classList.add('on'));
    };
    function station(T, i, t) {
      T.call(() => activate(i), null, t);
      if (xs.length) T.to(token, { x: xs[i], duration: .7, ease: 'power3.inOut' }, t).to(fill, { scaleX: i / 3, duration: .7, ease: 'power3.inOut' }, t);
      if (i === 0) {
        const o = { n: 0 }, c = { v: 0 };
        T.call(() => { url.textContent = ''; count.textContent = '0'; }, null, t)
          .fromTo(rec, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: .5, ease: EXPO, immediateRender: false }, t + 1)
          .fromTo(o, { n: 0 }, { n: URL.length, duration: .8, ease: 'none', immediateRender: false, onUpdate: () => { url.textContent = URL.slice(0, Math.round(o.n)); } }, t + .2)
          .fromTo(c, { v: 0 }, { v: 23, duration: .8, ease: 'power2.out', immediateRender: false, onUpdate: () => { count.textContent = Math.round(c.v); } }, t + 1.5);
      }
      if (i === 1) {
        T.call(() => { rows.forEach(r => r.classList.remove('picked')); sel.textContent = '0'; }, null, t)
          .fromTo(rows, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: .4, ease: EXPO, stagger: .08, immediateRender: false }, t + .1)
          .call(() => { rows[0].classList.add('picked'); sel.textContent = '1'; }, null, t + 1.1)
          .call(() => { rows[1].classList.add('picked'); sel.textContent = '2'; }, null, t + 1.6);
      }
      if (i === 2) {
        T.call(() => frameBox.classList.remove('dimmed'), null, t).set(tall, { opacity: 0 }, t)
          .call(() => frameBox.classList.add('dimmed'), null, t + .6)
          .fromTo(tall, { opacity: 0, scale: .58 }, { opacity: 1, scale: 1, duration: .8, ease: EXPO, immediateRender: false }, t + 1.4);
      }
      if (i === 3) {
        T.call(() => chips.forEach(c => c.classList.remove('on')), null, t);
        chips.forEach((c, k) => T.call(() => c.classList.add('on'), null, t + .6 + k * .3));
      }
    }
    function build() {
      tl?.kill(); segs.forEach(x => x.kill()); segs = []; measure();
      lastVertical = vertical(); st.dataset.layout = lastVertical ? 'column' : 'desk';
      tl = gsap.timeline({ id: 'how', paused: true, onComplete() { if (state?.running()) tl.restart(); } });
      finals(); activate(0);
      gsap.set(token, { x: 0 }); gsap.set(fill, { scaleX: 0 });
      if (lastVertical) {
        // Отдельный короткий сюжет на каждый шаг; итог шага остаётся на месте, ничего не прячется.
        segs = stations.map((_, i) => { const T = gsap.timeline({ paused: true, onStart() { stations[i].dataset.played = String((+stations[i].dataset.played || 0) + 1); } }); station(T, i, .02); T.to({}, { duration: .3 }, STEP - .3); return T; });
        tl.to({}, { duration: .1 });
      } else {
        [0, 1, 2, 3].forEach(i => station(tl, i, i * STEP));
        tl.to({}, { duration: .6 }, 4 * STEP);
      }
      if (reduced) { tl.progress(1).pause(); finals(); activate(0); stations.forEach(s => s.classList.remove('dim')); }
    }
    function playStation(i) {
      if (!vertical() || reduced || !state?.running()) return;
      segs[i]?.restart();
    }
    const stationView = stations.map(() => false);
    const watcher = new IntersectionObserver(entries => entries.forEach(e => {
      const i = stations.indexOf(e.target), inView = e.isIntersecting && e.intersectionRatio >= .55;
      if (inView && !stationView[i]) playStation(i);
      stationLive[i] = e.isIntersecting && e.intersectionRatio >= .25;
      stationView[i] = inView; syncVideos();
    }), { threshold: [0, .25, .55, .8] });
    stations.forEach(s => watcher.observe(s));
    state = loopScene(st, 'how', {
      warm() { vids.forEach(v=>load(v)); },
      play() {
        if (vertical()) { segs.forEach((T, i) => { if (stationView[i] && T.progress() < 1) T.resume(); }); syncVideos(); return; }
        if (tl.progress() === 1) tl.restart(); else tl.resume(); activate(+st.dataset.step || 0);
      },
      pause() { tl.pause(); segs.forEach(T => T.pause()); vids.forEach(v => pauseVideo(v)); },
    }, true);
    build();
    stepButtons.forEach((b, i) => b.addEventListener('click', () => {
      if (state.paused) { tl.time(i * STEP + 2.8).pause(); finals(); activate(i); }
      else { tl.time(i * STEP, false); activate(i); tl.play(); }
      if (reduced) stations.forEach(s => s.classList.remove('dim'));
    }));
    // На телефоне resize приходит при скрытии адресной строки: перестраиваем только при смене ширины.
    let width = innerWidth;
    addEventListener('resize', () => { if (innerWidth === width) return; width = innerWidth; build(); if (state.running()) state.run(); });
    addEventListener('load', () => { if (tl.time() > 0 || vertical()) return; build(); if (state.running()) tl.play(); });
  });

  /* Each long recording enters from above and produces only its own real clips (their real count). */
  deferScene('#rf', function pipeline() {
    const st=$('#rf'), origins=$$('.pipe-origin',st), sources=$$('.pipe-source',st), decks=$$('.pipe-deck',st);
    const cards=decks.map(d=>$$('.pipe-card',d)), videos=cards.map(group=>group.map(c=>$('video',c)));
    const button=$('.pipe-button',st), label=$('.pipe-button>span',st), meter=$('.pipe-meter',st), cursor=$('.cursor',st);
    const backs=$$('.pipe-stack-back',st), all=[...sources,...videos.flat()], N=origins.length;
    let current=0, tl, state, revision=0, hold=null, holdTimer=null;
    function warm(i){load(sources[i]);videos[i].forEach(v=>load(v))}
    const currentPlayers=()=>[sources[current],...videos[current]];
    const playersReady=()=>currentPlayers().every(v=>!v.paused&&v.readyState>=2&&!v.classList.contains('v-wait'));
    function stopHold(){clearTimeout(holdTimer);holdTimer=null;hold=null;}
    function pollHold(){
      clearTimeout(holdTimer);holdTimer=null;
      if(!hold||!state?.running())return;
      const now=performance.now(),dt=hold.last?now-hold.last:0;hold.last=now;hold.remaining-=dt;
      hold.readyFor=playersReady()?hold.readyFor+dt:0;
      if(hold.readyFor>=1600||hold.remaining<=0){hold=null;tl.resume();return;}
      holdTimer=setTimeout(pollHold,150);
    }
    function holdForMedia(){
      if(!state?.running())return;
      const now=performance.now(),ready=playersReady();
      const shown=ready?now-Math.max(...currentPlayers().map(v=>playback(v).readyAt||now)):0;
      if(ready&&shown>=1600)return;
      // Keep the current live set on screen while slow/retried files finish;
      // do not discard and replace it before the viewer has seen the results.
      hold={remaining:12000,last:0,readyFor:shown};tl.pause();pollHold();
    }
    // Невидимые записи не занимают сеть; текущий набор получает время на загрузку и показ.
    function pauseAll(){all.forEach(v=>pauseVideo(v))}
    function paintQueue(){
      // Видна только текущая запись; соседние в очереди не показываются.
      origins.forEach((e,i)=>{const active=i===current;
        gsap.set(e,{xPercent:-50,x:0,rotation:0,zIndex:active?3:1,visibility:active?'visible':'hidden'});
      });
      decks.forEach((e,i)=>e.classList.toggle('is-active',i===current));
      st.dataset.group=current; st.dataset.source=origins[current].dataset.sourceId; st.dataset.count=cards[current].length;
    }
    // A shallow circular stack: only the existing real clips have video surfaces.
    // Backing sheets supply depth, with no new decoders or invented clip counts.
    function layout(){
      const W=st.clientWidth,H=st.clientHeight,small=W<600,top=H*(small?.58:.56);
      cards.forEach(group=>{
        const n=group.length,half=(n-1)/2,w=Math.min(n>3?124:136,W*(n>3?.25:.285)),h=w*16/9;
        const angle=small?(n>3?8:11):8,rad=half*angle*Math.PI/180;
        const envelope=w*Math.cos(rad)+h*Math.sin(rad);
        const step=Math.min(w*(small?.83:1.03),(W-36-envelope)/(n-1));
        group.forEach((e,i)=>{
          const off=i-half,x=(W-w)/2+off*step,y=top+off*off*(small?4:5);
          Object.assign(e.style,{left:x+'px',top:y+'px',width:w+'px',height:h+'px',zIndex:String(20+Math.round((half-Math.abs(off))*2))});
          e.dataset.fan=String(off*angle);e.dataset.stackX=String(-off*step);
        });
      });
      const w=Math.min(116,W*.23),h=w*16/9,rad=34*Math.PI/180;
      const spread=Math.min(290,(W-28-w*Math.cos(rad)-h*Math.sin(rad))/2);
      backs.forEach((e,i)=>{
        const t=(i/(backs.length-1)-.5)*2,x=t*spread;
        Object.assign(e.style,{left:((W-w)/2+x)+'px',top:(top-18+t*t*14)+'px',width:w+'px',height:h+'px',zIndex:String(i)});
        e.dataset.fan=String(t*34);e.dataset.stackX=String(-x);
      });
      paintQueue();
    }
    function build(){
      stopHold();tl?.kill();layout();gsap.set([...cards.flat(),...backs],{opacity:0,x:0,y:0,scale:1,rotation:0});
      gsap.set(cursor,{opacity:0});gsap.set(meter,{scaleX:0});label.textContent='Ловите момент';
      const active=cards[current],n=active.length;
      gsap.set(origins[current],{y:-135,opacity:0,scale:.88});
      tl=gsap.timeline({id:'rf',paused:true,onComplete(){if(state?.running())select((current+1)%N)}})
        .call(()=>{st.dataset.phase='input';label.textContent='Ловите момент'},null,0)
        .fromTo(origins[current],{y:-135,opacity:0,scale:.88},{y:0,opacity:1,scale:1,duration:.55,ease:'power3.out',immediateRender:false},0);
      cursorTo(tl,cursor,st,button,.1,{x:st.clientWidth*.8,y:st.clientHeight*.53});
      tl.call(()=>{if(state?.running())videos[current].forEach(play)},null,.95)
        .to(meter,{scaleX:1,duration:.65,ease:'power2.inOut'},.95)
        .to(cursor,{opacity:0,duration:.16},1.05)
        .call(()=>{st.dataset.phase='results'},null,1.55)
        .fromTo(backs,{x:(i,e)=>+e.dataset.stackX,y:-28,scale:.76,opacity:0,rotation:0},{x:0,y:0,scale:1,opacity:1,rotation:(i,e)=>+e.dataset.fan,duration:.65,stagger:.015,ease:'power3.out',immediateRender:false},1.5)
        .fromTo(active,{x:(i,e)=>+e.dataset.stackX,y:-48,scale:.72,opacity:0,rotation:0},{x:0,y:0,scale:1,opacity:1,rotation:(i,e)=>+e.dataset.fan,duration:.65,stagger:.045,ease:'power3.out',immediateRender:false},1.55)
        .call(()=>{if(!reduced)warm((current+1)%N)},null,.6)
        .to({}, {duration:2.15+(n-3)*.25},2.2);
      const out=4.35+(n-3)*.25;
      tl.call(holdForMedia,null,out-.08)
        .call(()=>{st.dataset.phase='return'},null,out)
        .to(active,{x:(i,e)=>+e.dataset.stackX,y:28,rotation:0,opacity:0,scale:.9,duration:.4,stagger:.03,ease:'power2.in'},out)
        .to(backs,{x:(i,e)=>+e.dataset.stackX,y:28,rotation:0,opacity:0,scale:.9,duration:.35,stagger:.012,ease:'power2.in'},out+.08)
        .to(origins[current],{y:-100,opacity:0,duration:.4,ease:'power2.in'},out+.3)
        .call(()=>videos[current].forEach(v=>pauseVideo(v)),null,out+.45)
        .to({}, {duration:.2},out+.6).timeScale(TEMPO.rf);
      st.dataset.out=out+.45;
      if(reduced){tl.time(3).pause();pauseAll()}
    }
    function select(i){
      revision++;stopHold();pauseAll();all.forEach(discardVideo);current=(i+N)%N;st.dataset.phase='input';
      underlay(sources[current]);videos[current].forEach(underlay);warm(current);build();
      if(state?.running()){play(sources[current]);tl.play()}
      else if(state?.paused){tl.time(3).pause();pauseAll()}
    }
    state=loopScene(st,'rf',{
      warm(){warm(current)},prime(){play(sources[current])},
      play(){if(tl.progress()===1){select((current+1)%N);return}play(sources[current]);if(tl.time()>.95&&tl.time()<+st.dataset.out)videos[current].forEach(play);if(hold)pollHold();else tl.resume()},
      pause(){revision++;clearTimeout(holdTimer);holdTimer=null;if(hold)hold.last=0;tl.pause();pauseAll()}
    },true);
    select(0);
    let width=innerWidth;addEventListener('resize',()=>{if(Math.abs(innerWidth-width)>20){width=innerWidth;const t=tl.time();build();tl.time(t);if(state.running()){if(hold)pollHold();else tl.resume()}}});
  });

  /* ── 14. Слои клипа: плавно, без рывков ── */
  deferScene('#layers', function layers() {
    const st = $('#layers'), scene = $('.ly-scene', st), ls = $$('.ly', st), tags = $$('.ly-tag', st);
    tags.forEach(t => { t.style.transform = 'rotateX(-56deg) rotateZ(32deg)'; });   // подписи лицом к зрителю
    let state;
    const tl = gsap.timeline({ id: 'layers', paused: true, onComplete() { if (state?.running()) tl.restart(); } })
      .set(scene, { rotationX: 0, rotationZ: 0 }, 0).set(ls, { z: 0 }, 0)
      .to(scene, { rotationX: 56, rotationZ: -30, duration: .95, ease: 'power2.inOut' }, .3)
      .to(ls, { z: i => i * (mobile()?42:54), duration: 1, ease: 'power2.inOut', stagger: .035 }, .4)
      .to(scene, { rotationZ: -26, duration: 1.5, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 1.4)
      .to(ls, { z: 0, duration: .9, ease: 'power2.inOut' }, 4.3)
      .to(scene, { rotationX: 0, rotationZ: 0, duration: .9, ease: 'power2.inOut' }, 4.4)
      .to({}, { duration: .8 }, 5.3);
    tl.timeScale(TEMPO.layers);
    if (reduced) tl.time(3).pause();
    state = loopScene(st, 'layers', { play() { if (tl.progress() === 1) tl.restart(); else tl.resume(); }, pause() { tl.pause(); } });
  });

  /* ── 3. Барабан: сам крутится, без управления; карточки идут по дуге, а не по прямой ── */
  deferScene('#drum', function drum() {
    const CLIPS = [
      ['full-biz-hr-m01', 'Офис заправлял машины до утра', 'Интервью'],
      ['full-stream-02-m03', 'Зритель включил другого стримера', 'Стрим', 'assets/examples'],
      ['full-biz-cafe-m01', 'Год без выходных и за продуктами — на автобусе', 'Бизнес'],
      ['anime-01-hook-demons', 'Демоны могут войти? Давай спать', 'Аниме'],
      ['full-audience-02-m01', 'Хотел два сэндвича, заказал три и съел все', 'Подкаст'],
      ['full-biz-fonts-m03', 'Что должен давать короткий курс', 'Дизайн'],
      ['auto-01-hook-mileage', 'Пробег по треснувшей шпаклёвке', 'Авто'],
      ['full-audience-01-m05', 'Как мошенники используют актуальные новости', 'Подкаст'],
      ['full-biz-marketing-m02', 'Клиент не может сниматься: «Я зубы делаю»', 'Маркетинг'],
      ['full-biz-cg-m02', 'Знакомство привело к совместным проектам', 'CG'],
      ['full-audience-03-m01', 'Чем «сдаться» отличается от «опустить руки»', 'Интервью'],
    ];
    const st = $('#drum'), ring = $('.drum-ring', st), cap = $('.drum-caption', st);
    const N = CLIPS.length, TURN = .85, DWELL = 1.45;
    const pos = { k: 0 };              // непрерывная позиция барабана; целые значения — остановки
    let state, timer, tween, cardWidth = 190, radius = 0, videoBand = -1;
    const items = CLIPS.map(([id, title, genre, base = 'media/examples']) => {
      const d = document.createElement('div'); d.className = 'drum-item'; d.setAttribute('aria-hidden', 'true');
      d.innerHTML = `<video muted loop playsinline preload="none" data-poster="${base}/${id}/poster.jpg" data-src="${base}/${id}/preview.mp4" data-mobile-src="assets/mobile/examples/${id}/preview.mp4"></video>`;
      ring.appendChild(d); return d;
    });
    const vids = items.map(d => $('video', d));
    const rel = i => ((i - pos.k) % N + N * 1.5) % N - N / 2;           // −N/2 … N/2
    const reach = () => mobile() ? { play: 1.6, show: 2.6 } : { play: 2.6, show: 3.6 };
    // Каждую позицию считаем по углу цилиндра: x = sin, глубина = cos. Края плавно гаснут, ничего не «выскакивает».
    function paint() {
      const R = radius;
      const { show } = reach();
      items.forEach((d, i) => {
        const r = rel(i), a = Math.abs(r);
        if (a > show) { if (d.style.visibility !== 'hidden') d.style.visibility = 'hidden'; return; }
        underlay(vids[i]);
        const angle = r * .47, depth = Math.cos(angle), scale = .72 + .28 * Math.max(0, depth);
        const fade = Math.min(1, Math.max(0, show - a)) * Math.max(.18, 1 - a * .1);
        d.style.transform = `translate3d(${(Math.sin(angle) * R).toFixed(1)}px,${((1 - depth) * 22).toFixed(1)}px,0) scale(${(Math.max(.2, depth) * scale).toFixed(4)},${scale.toFixed(4)})`;
        d.style.opacity = fade.toFixed(3); d.style.zIndex = String(Math.round(depth * 100)); d.style.visibility = 'visible';
        d.classList.toggle('is-front', a < .5);
        d.classList.toggle('is-edge', a > reach().play);
      });
      // Update playback as an incoming card joins the visible arc, rather than
      // waiting until the turn has already finished. No media/network gate.
      const band = Math.floor(pos.k * 10);
      if (band !== videoBand) { videoBand = band; syncVideos(); }
    }
    function syncVideos() {
      const { play: near, show } = reach();
      vids.forEach((v, i) => {
        const a = Math.abs(rel(i));
        if (a <= show + 1) load(v);                                   // заранее, до появления на дуге
        if (state?.running() && a <= near) play(v); else { pauseVideo(v); if(a>show)discardVideo(v); }
      });
    }
    function front() { return ((Math.round(pos.k) % N) + N) % N; }
    function caption() { const [, title, genre] = CLIPS[front()]; cap.textContent = genre + ' · ' + title; st.dataset.front = front(); }
    function turn() {
      if (!state?.running()) return;
      const goal = Math.round(pos.k) + 1;
      tween?.kill();
      tween = gsap.to(pos, { k: goal, duration: TURN, ease: 'power2.inOut', onUpdate: paint,
        onStart: syncVideos, onComplete() { caption(); syncVideos(); schedule(); } });
      if (reduced) tween.progress(1);
    }
    function schedule() { clearTimeout(timer); if (state?.running()) timer = setTimeout(turn, DWELL * 1000); }
    state = loopScene(st, 'drum', {
      warm() { syncVideos(); },
      play() { tween?.resume(); syncVideos(); if (!tween?.isActive()) schedule(); },
      pause() { clearTimeout(timer); tween?.pause(); vids.forEach(v => pauseVideo(v)); },
    }, true);
    function layout() { cardWidth = ring.getBoundingClientRect().width || 190; const span = st.clientWidth; radius = mobile() ? Math.min(cardWidth * 1.75, span * .62) : Math.min(cardWidth * 2.45, span * .36); paint(); }
    let width = innerWidth;
    addEventListener('resize', () => { if (innerWidth !== width) { width = innerWidth; layout(); } });
    layout(); caption(); syncVideos();
  }, 640);


  /* ── 6. Лента боли ── */
  deferScene('#pain', function pain() {
    const st = $('#pain'), time = $('.pc-time', st), fill = $('.pb-fill', st), cut = $('.pb-cut', st), lis = $$('.pain-lines li', st), bridge = $('.pain-bridge', st);
    const TOTAL = 6859, o = { s: 0 };
    const thick = () => Math.max(6, Math.round(parseFloat(getComputedStyle(lis[0]).fontSize) * .3)) + 'px';
    lis.forEach(li => { const mark=document.createElement('i');mark.className='strike-head';mark.setAttribute('aria-hidden','true');$('span',li).appendChild(mark); });
    let painState;
    // Цикл повторяется сам после короткой паузы на итоге, а не только при новом появлении на экране.
    const tl = gsap.timeline({ id:'pain', paused: true, onComplete() { if (painState?.running()) tl.restart(); } })
      .call(() => { lis.forEach(li => li.classList.remove('cut','is-striking')); }, null, .01)
      .fromTo(o, { s: 0 }, { s: TOTAL, duration: 1.75, ease: 'power2.inOut', onUpdate: () => { time.textContent = hms(o.s); } }, 0)
      .fromTo(fill, { scaleX: 0 }, { scaleX: 1, duration: 1.75, ease: 'power2.inOut' }, 0)
      .fromTo(cut, { opacity: 0, scaleX: 2 }, { opacity: 1, scaleX: 1, duration: .4, ease: 'power3.out' }, 1.9)
      .call(() => { time.textContent = '0:00:40'; }, null, 2.3);
    lis.forEach((li, i) => {
      const span=$('span',li),head=$('.strike-head',li),at=2.65+i*1.05;
      tl.call(()=>li.classList.add('is-striking'),null,at)
        .fromTo(span, { backgroundSize: () => '0% ' + thick() }, { backgroundSize: () => '100% ' + thick(), duration: .95, ease: 'power2.inOut' }, at)
        .set(head,{opacity:1},at)
        .fromTo(head,{left:'0%'},{left:'100%',duration:.95,ease:'power2.inOut',immediateRender:false},at)
        .to(head,{opacity:0,duration:.2},at+.8)
        .call(() => {li.classList.add('cut');li.classList.remove('is-striking')}, null, at+.95);
    });
    tl.fromTo(bridge, { opacity: .35, y: 6 }, { opacity: 1, y: 0, duration: .65, ease: EXPO }, 5.5)
      .to({}, { duration: 1.4 }, 6.15);
    if(reduced)tl.progress(1).pause();
    painState = loopScene(st,'pain',{play(){if(tl.progress()===1)tl.restart();else tl.resume()},pause(){tl.pause()}});
  });

  /* Выгоды: жёлтая полоса, которой зачёркивались боли, проводится под главной фразой выгоды. */
  $$('.bf').forEach(article => {
    const mark = $('mark', article);
    if (!reduced) gsap.set(mark, { '--mark': '0%' });
    const tl = gsap.timeline({ paused: true }).fromTo(mark, { '--mark': '0%' }, { '--mark': '100%', duration: .9, ease: 'power2.inOut' });
    onceOnEnter(article, tl, .6);
  });

  /* ── 9–10. Одометр цены ── */
  deferScene('#price', function price() {
    const st = $('#price'), digits = $$('.odo .d', st), ticks = $('.ticks', st);
    for (let i = 0; i < 100; i++) { const t = document.createElement('i'); if (i < 25) t.className = 'free'; ticks.appendChild(t); }
    digits.forEach(d => { const n = +d.dataset.d; for (let i = 0; i <= 10 + n; i++) { const x = document.createElement('i'); x.textContent = i % 10; d.appendChild(x); } });
    const tl = gsap.timeline({ paused: true })
      .fromTo(digits, { yPercent: 0 }, { yPercent: (i, d) => -100 * (10 + +d.dataset.d) / (11 + +d.dataset.d), duration: 1.1, ease: 'power3.out', stagger: .12 }, 0)
      .fromTo($$('i', ticks), { scaleY: 0 }, { scaleY: 1, duration: .3, ease: 'power3.out', stagger: .006 }, .2);
    onceOnEnter(st, tl);
  });

  /* ── 7. Таймкод страницы ── */
  (function pagecode() {
    const bar = $('.pagecode'), track = $('.pc-track', bar), head = $('.pc-head', bar), now = $('.pc-now', bar);
    const TOTAL = 6859, secs = $$('[data-mark]');
    const marks = secs.map(s => {
      const m = document.createElement('button'); m.type = 'button'; m.className = 'pc-mark';
      m.innerHTML = `<span>${s.dataset.mark}</span>`; m.setAttribute('aria-label', s.dataset.mark);
      m.addEventListener('click', () => s.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' }));
      track.appendChild(m); return m;
    });
    function place() {
      const max = document.documentElement.scrollHeight - innerHeight || 1;
      secs.forEach((s, i) => { marks[i].style.left = Math.min(99, Math.max(1, (s.offsetTop / max) * 100)) + '%'; marks[i].dataset.p = s.offsetTop / max; });
      update();
    }
    function update() {
      const max = document.documentElement.scrollHeight - innerHeight || 1, p = Math.min(1, scrollY / max);
      head.style.transform = `scaleX(${p})`;
      const s = Math.round(p * TOTAL);
      now.textContent = `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
      marks.forEach(m => m.classList.toggle('on', p + .002 >= +m.dataset.p));
    }
    addEventListener('scroll', update, { passive: true });
    addEventListener('resize', place);
    addEventListener('load', place);
    place();
  })();
  // Opt-in, local-only phone diagnostics. Nothing is uploaded automatically.
  if(new URLSearchParams(location.search).has('media-debug')){
    const panel=document.createElement('details');panel.style.cssText='position:fixed;z-index:10000;bottom:10px;left:10px;max-width:calc(100vw - 20px);width:390px;padding:12px;background:#f4f4ef;color:#22251f;border:1px solid #aeb6a5;border-radius:14px;font:13px/1.4 sans-serif;box-shadow:0 6px 24px #0002';
    panel.innerHTML='<summary>Проверка видео</summary><button type="button" style="margin:12px 0;padding:10px 14px;background:#f9db53;color:#22251f;border:0;border-radius:12px">Скопировать отчёт</button><pre style="max-height:35vh;overflow:auto;white-space:pre-wrap;font:11px/1.4 monospace"></pre><small>Отчёт остаётся на устройстве. Автоматической отправки нет.</small>';
    const pre=panel.querySelector('pre'),button=panel.querySelector('button');let probe=null;
    const report=()=>{
      const c=navigator.connection;
      return{version:'8.1',probe,browser:navigator.userAgent,online:navigator.onLine,visibility:document.visibilityState,connection:c?{effectiveType:c.effectiveType,downlink:c.downlink,rtt:c.rtt,saveData:c.saveData}:null,
        retained:[...document.querySelectorAll('video')].filter(v=>v.getAttribute('src')).length,
        videos:[...document.querySelectorAll('video')].filter(v=>playback(v).wanted).map(v=>{
          const m=playback(v),q=v.getVideoPlaybackQuality?.();
          const url=new URL(v.currentSrc||v.dataset.src,location.href);
          return{scene:v.closest('.stage')?.id,file:url.pathname,paused:v.paused,ready:v.readyState,network:v.networkState,time:+v.currentTime.toFixed(2),frames:q?.totalVideoFrames,dropped:q?.droppedVideoFrames,poster:v.classList.contains('v-wait'),error:v.error?{code:v.error.code,message:v.error.message}:null,playError:v.dataset.playError||null,retries:m.attempts,blocked:m.blocked,exhausted:m.exhausted};
        })};
    };
    const refresh=()=>{if(panel.open&&!document.hidden)pre.textContent=JSON.stringify(report(),null,2)};
    panel.addEventListener('toggle',refresh);
    button.addEventListener('click',async()=>{
      const start=performance.now(),abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),5000);
      button.disabled=true;button.textContent='Проверяем соединение…';
      try{const r=await fetch('index.html?media-probe='+Date.now(),{method:'HEAD',cache:'no-store',signal:abort.signal});probe={status:r.status,ms:Math.round(performance.now()-start)}}
      catch(e){probe={error:e.name,ms:Math.round(performance.now()-start)}}finally{clearTimeout(timeout);button.disabled=false}
      const text=JSON.stringify(report(),null,2);pre.textContent=text;
      try{await navigator.clipboard.writeText(text);button.textContent='Скопировано'}
      catch{const selection=getSelection(),range=document.createRange();range.selectNodeContents(pre);selection.removeAllRanges();selection.addRange(range);button.textContent='Выделено — скопируйте текст'}
    });
    document.body.appendChild(panel);const timer=setInterval(refresh,1500);addEventListener('pagehide',()=>clearInterval(timer),{once:true});
  }

})();
