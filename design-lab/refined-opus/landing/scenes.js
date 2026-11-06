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
  // Only build distant scenes when they approach the viewport. Keep the first paint small.
  function deferScene(selector, init, margin = 240) {
    const el = $(selector);
    new IntersectionObserver(([entry], observer) => {
      if (!entry.isIntersecting) return;
      observer.disconnect(); el.querySelectorAll('video:not([data-lazy-poster])').forEach(underlay); init(); el.dataset.initialized = 'true';
    }, { rootMargin: `${margin}px 0px` }).observe(el);
  }
  const hms = s => { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`; };
  const mediaFrames = new WeakMap();
  const underlay = v => {
    if (mediaFrames.has(v)) return;
    const poster = v.getAttribute('poster') || v.dataset.poster, box = v.parentElement;
    if (poster) { v.poster = poster; box.style.backgroundImage = `url("${poster}")`; box.classList.add('has-under'); v.classList.add('v-wait'); }
    const frames = { count: 0, at: 0, media: -1, watching: false, callback: null };
    mediaFrames.set(v, frames);
    const monitor = () => {
      if (frames.watching || !v.requestVideoFrameCallback) return;
      frames.watching = true;
      const presented = (now, info) => {
        frames.watching = false; frames.count++; frames.at = now; frames.media = info.mediaTime;
        if(v.classList.contains('v-wait'))v.classList.remove('v-wait');
        if (!v.paused && !v.ended) monitor();
      };
      frames.callback = v.requestVideoFrameCallback(presented);
    };
    v.addEventListener('playing', monitor);
    v.addEventListener('pause', () => { if (frames.watching && v.cancelVideoFrameCallback) v.cancelVideoFrameCallback(frames.callback); frames.watching = false; });
    if (!v.requestVideoFrameCallback) v.addEventListener('timeupdate', () => { if (v.currentTime > 0) { frames.count++; frames.at = performance.now(); v.classList.remove('v-wait'); } });
  };
  document.querySelectorAll('.cut-src,.slice video').forEach(underlay);
  const load = v => { underlay(v); if (!v.getAttribute('src') && v.dataset.src) { v.src = v.dataset.src; v.preload = 'auto'; } };
  const play = v => {
    load(v); v.muted = true; v.defaultMuted = true; v.playsInline = true;
    return v.play().then(() => true).catch(error => { v.dataset.playError = error.name; return false; });
  };
  async function liveTogether(videos, valid) {
    const starts = videos.map(v => ({ time: v.currentTime, count: mediaFrames.get(v)?.count || 0, playing: !v.paused && v.readyState>=2 }));
    await Promise.all(videos.map(play));
    return new Promise(resolve => {
      const check = () => {
        if (!valid()) { resolve(false); return; }
        if (videos.every((v, i) => {
          const f = mediaFrames.get(v), advanced = v.currentTime - starts[i].time;
          return !v.paused && v.readyState >= 2 && ((f && f.count > (starts[i].playing?0:starts[i].count+1) && performance.now() - f.at < 500) || advanced > .12);
        })) { videos.forEach(v=>v.classList.remove('v-wait')); resolve(true); return; }
        videos.forEach(v => { if (v.paused && !v.error) play(v); });
        setTimeout(check, 60);
      };
      check();
    });
  }
  const prepare = v => {
    load(v);
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
    const label = () => { if (!btn) return; btn.textContent = st.paused ? 'Смотреть' : 'Пауза'; btn.setAttribute('aria-pressed', String(st.paused)); };
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
    btn?.addEventListener('click', () => { st.paused = !st.paused; label(); run(); });
    st.run = run; scenes.push(st);
    new IntersectionObserver(([e]) => { st.inView = e.isIntersecting && e.intersectionRatio >= .2; st.area = e.intersectionRect.height; arbitrate(); }, { threshold: THRESHOLDS }).observe(el);
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
    let tl, state, geometry;
    const lerp = (a,b,t) => a+(b-a)*t;
    let resultsWarm = false;
    const warmResults = () => { if (resultsWarm) return; resultsWarm = true; videos.forEach(load); };
    let gateRevision = 0;
    async function awaitResults() {
      if (reduced || !state?.running()) return;
      const revision = ++gateRevision;
      tl.pause(); st.dataset.phase = 'buffering';
      const ready = await liveTogether(videos, () => revision === gateRevision && state.running());
      if (ready) { st.dataset.phase = 'input'; tl.resume(); }
    }

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
      gsap.set(cards[i],{x:lerp(g.x,0,u)+(i-1)*wave*g.S.width*.045,y:lerp(g.y,0,u)-wave*g.S.height*.08,
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
        .call(awaitResults,null,1.8)
        .to(lines,{scaleY:1,duration:.16,stagger:.07,ease:'power2.in'},1.9)
        .call(()=>{src.pause();snapshot();st.dataset.phase='cut'},null,2.12)
        .set(cards,{opacity:1},2.13).set(frame,{opacity:0},2.13)
        .to([input,lineBox],{opacity:0,duration:.2},2.14)
        .to(portal,{opacity:.8,scale:1.6,duration:.45,ease:'sine.out'},2.2);
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
        .call(()=>{videos.forEach(v=>v.pause());if(state?.running())play(src)},null,6.65)
        .to(portal,{opacity:0,duration:.4},6.45)
        .set(lines,{scaleY:0},6.65).set(pins,{scale:0},6.65).set(progress,{scaleX:0},6.65)
        .to(input,{opacity:1,duration:.3},6.7).set(lineBox,{opacity:1},6.7)
        .to({}, {duration:.55},7);
      tl.timeScale(TEMPO.cut);
      reset();
      if(reduced){tl.time(4).pause();cards.forEach((e,i)=>mode(i,'clip'));src.pause();videos.forEach(v=>v.pause())}
    }
    state=loopScene(st,'cut',{
      warm(){if(src.readyState>=2)warmResults()},
      prime(){if(tl.time()<2.12||tl.time()>=6.65)play(src)},
      ready(){return prepare(src)},
      play(){if(st.dataset.phase==='buffering'){awaitResults();return}if(tl.progress()===1)tl.restart();else tl.resume();if(tl.time()>=1.8&&tl.time()<6.65)videos.forEach(play);if(tl.time()<2.1||tl.time()>=6.65)play(src);},
      pause(){gateRevision++;tl.pause();src.pause();videos.forEach(v=>v.pause())},
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
      function pose(i,v){const e=pieces[i],mix=Math.max(0,Math.min(1,(v-.42)/.16));
        gsap.set(e,{rotationY:Math.sin(v*Math.PI)*78,x:(i-1.5)*fs*.11*v,y:-Math.sin(v*Math.PI)*fs*.07});
        gsap.set($('.front',e),{opacity:1-mix});gsap.set($('.back',e),{opacity:mix});
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
    const vids = $$('.md-clip video', st), chips = $$('.md-platforms li', st);
    const URL = 'youtube.com/watch?v=np2Az44NJMY', STEP = 2.85;
    // На телефоне шаги идут столбиком: каждый проигрывается, когда посетитель до него доскроллил.
    const vertical = () => mobile();
    let tl, state, xs = [], segs = [], lastVertical = null;
    const seen = stations.map(() => false);
    const stepButtons = $$('[data-step]', st);
    const syncVideos = () => vids.forEach(v => {
      const on = state?.running() && (vertical() ? seen[3] : (+st.dataset.step === 3 || !mobile()));
      if (on) play(v); else v.pause();
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
      if (inView && !stationView[i]) { seen[i] = true; playStation(i); }
      if (i === 3) seen[3] = e.isIntersecting && e.intersectionRatio >= .25;
      stationView[i] = inView; syncVideos();
    }), { threshold: [0, .25, .55, .8] });
    stations.forEach(s => watcher.observe(s));
    state = loopScene(st, 'how', {
      warm() { vids.forEach(load); },
      play() {
        if (vertical()) { segs.forEach((T, i) => { if (stationView[i] && T.progress() < 1) T.resume(); }); syncVideos(); return; }
        if (tl.progress() === 1) tl.restart(); else tl.resume(); activate(+st.dataset.step || 0);
      },
      pause() { tl.pause(); segs.forEach(T => T.pause()); vids.forEach(v => v.pause()); },
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
    const all=[...sources,...videos.flat()], N=origins.length;
    const clipsWord=n=>{const a=n%10,b=n%100;return a===1&&b!==11?'готовый клип':a>=2&&a<=4&&(b<12||b>14)?'готовых клипа':'готовых клипов'};
    let current=0, tl, state, revision=0;
    function warm(i){load(sources[i]);videos[i].forEach(load)}
    function pauseAll(){all.forEach(v=>v.pause())}
    function paintQueue(){
      origins.forEach((e,i)=>{const active=i===current,side=((i-current+N)%N)===1?1:-1;
        gsap.set(e,{xPercent:-50,x:active?0:side*st.clientWidth*.17,y:active?0:-28,scale:active?1:.72,rotation:active?0:side*7,opacity:active?1:.38,zIndex:active?3:1});
      });
      decks.forEach((e,i)=>e.classList.toggle('is-active',i===current));
      st.dataset.group=current; st.dataset.source=origins[current].dataset.sourceId; st.dataset.count=cards[current].length;
    }
    // Веер под фактическое число клипов: на desktop один ряд, на телефоне по три в ряд.
    function layout(){
      const W=st.clientWidth,H=st.clientHeight,small=W<600;
      cards.forEach(group=>{
        const n=group.length,perRow=small?Math.min(3,n):n,rows=Math.ceil(n/perRow),gap=small?8:18;
        const w=small?Math.min(rows>1?80:100,(W-40-(perRow-1)*gap)/perRow):Math.min(n>3?112:118,(W-80-(n-1)*gap)/n),h=w*16/9;
        const top=H*(small?.52:.575),avail=H-top-(small?14:22),block=rows*h+(rows-1)*gap,y0=top+Math.max(0,(avail-block)/2);
        group.forEach((e,i)=>{
          const row=Math.floor(i/perRow),inRow=Math.min(perRow,n-row*perRow),col=i-row*perRow,off=col-(inRow-1)/2;
          const x=(W-inRow*w-(inRow-1)*gap)/2+col*(w+gap),y=y0+row*(h+gap)+Math.abs(off)*(small?3:9);
          Object.assign(e.style,{left:x+'px',top:y+'px',width:w+'px',height:h+'px'});e.dataset.fan=String(off*(small?1.5:2.5));
        });
      });
      paintQueue();
    }
    async function gate(){
      if(reduced||!state?.running())return;
      const token=++revision,group=current;tl.pause();st.dataset.phase='buffering';label.textContent='Находим моменты';
      const ready=await liveTogether(videos[group],()=>token===revision&&group===current&&state.running());
      if(ready){st.dataset.phase='processing';tl.resume()}
    }
    function build(){
      tl?.kill();layout();gsap.set(cards.flat(),{opacity:0,y:0,scale:1,rotation:0});
      gsap.set(cursor,{opacity:0});gsap.set(meter,{scaleX:0});label.textContent='Нарезать запись';
      const active=cards[current],n=active.length;
      gsap.set(origins[current],{y:-135,opacity:0,scale:.88});
      tl=gsap.timeline({id:'rf',paused:true,onComplete(){if(state?.running())select((current+1)%N)}})
        .call(()=>{st.dataset.phase='input';label.textContent='Нарезать запись'},null,0)
        .fromTo(origins[current],{y:-135,opacity:0,scale:.88},{y:0,opacity:1,scale:1,duration:.55,ease:'power3.out',immediateRender:false},0);
      cursorTo(tl,cursor,st,button,.1,{x:st.clientWidth*.8,y:st.clientHeight*.53});
      tl.call(()=>{label.textContent='Находим моменты';if(state?.running())videos[current].forEach(play)},null,.95)
        .to(meter,{scaleX:1,duration:.65,ease:'power2.inOut'},.95)
        .to(cursor,{opacity:0,duration:.16},1.05)
        .call(gate,null,1.4)
        .call(()=>{st.dataset.phase='results';label.textContent=`${n} ${clipsWord(n)}`;sources[current].pause()},null,1.55)
        .fromTo(active,{y:-60,scale:.72,opacity:0,rotation:0},{y:0,scale:1,opacity:1,rotation:(i,e)=>+e.dataset.fan,duration:.6,stagger:.045,ease:'power3.out',immediateRender:false},1.55)
        .call(()=>{if(!reduced)warm((current+1)%N)},null,2.2)
        .to({}, {duration:2.15+(n-3)*.25},2.2);
      const out=4.35+(n-3)*.25;
      tl.call(()=>{st.dataset.phase='return'},null,out)
        .to(active,{y:50,opacity:0,scale:.94,duration:.4,stagger:.03,ease:'power2.in'},out)
        .to(origins[current],{y:-100,opacity:0,duration:.4,ease:'power2.in'},out+.3)
        .call(()=>videos[current].forEach(v=>v.pause()),null,out+.45)
        .to({}, {duration:.2},out+.6).timeScale(TEMPO.rf);
      st.dataset.out=out+.45;
      if(reduced){tl.time(3).pause();pauseAll()}
    }
    function select(i){
      revision++;pauseAll();current=(i+N)%N;st.dataset.phase='input';
      sources.forEach(underlay);videos[current].forEach(underlay);warm(current);build();
      if(state?.running()){play(sources[current]);tl.play()}
      else if(state?.paused){tl.time(3).pause();pauseAll()}
    }
    state=loopScene(st,'rf',{
      warm(){warm(current)},prime(){if(tl.time()<1.55)play(sources[current])},
      play(){if(st.dataset.phase==='buffering'){gate();return}if(tl.progress()===1){select((current+1)%N);return}tl.resume();if(tl.time()<1.55)play(sources[current]);if(tl.time()>.95&&tl.time()<+st.dataset.out)videos[current].forEach(play)},
      pause(){revision++;tl.pause();pauseAll()}
    },true);
    select(0);
    let width=innerWidth;addEventListener('resize',()=>{if(Math.abs(innerWidth-width)>20){width=innerWidth;const t=tl.time();build();tl.time(t);if(state.running())tl.resume()}});
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

  /* ── 3. Барабан: все видимые клипы играют, рядом всегда разные люди ── */
  deferScene('#drum', function drum() {
    // Разные записи; каждый видимый ролик воспроизводится, входящий готовится до поворота.
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
      ['full-biz-startup-m02', 'Почему отказался от миллиона рублей за 20%', 'Стартапы'],
    ];    const st = $('#drum'), ring = $('.drum-ring', st), cap = $('.drum-caption', st);
    const N = CLIPS.length;
    let k=0,targetK=0,turnRevision=0,timer,lastUser=0,moved=false,state,watchdog,cardWidth=190,settleTimer;
    let activeArc=new Set(),warmingArc=new Set();
    const front=()=>((k%N)+N)%N;
    const items=CLIPS.map(([id,title,genre,base='media/examples'],i)=>{
      const d=document.createElement('button');d.type='button';d.className='drum-item';d.setAttribute('aria-label',title);
      d.innerHTML=`<video muted loop playsinline preload="none" poster="${base}/${id}/poster.jpg" data-src="${base}/${id}/preview.mp4"></video>`;
      d.addEventListener('click',()=>{if(!moved){if(i===front())openClip();else turn(((i-front())%N+N+N/2)%N-N/2,true)}});
      ring.appendChild(d);return d;
    });
    const vids=items.map(d=>$('video',d));vids.forEach(underlay);
    const relative=(i,p)=>((i-p+N*1.5)%N)-N/2;
    const dist=i=>Math.abs(relative(i,front()));
    let warmed=false;
    const preload=()=>{if(warmed)vids.forEach((v,i)=>{if(dist(i)<=(mobile()?1:2)+1)load(v)})};
    function syncVideos(){vids.forEach((v,i)=>{if(state?.running()&&(activeArc.has(i)||warmingArc.has(i)))play(v);else v.pause()})}
    // The cylinder is projected onto a flat plane. Video never lives on a culled 3-D backface.
    // Шире размах: больший радиус и ещё по одной карточке-постеру с каждого края (без видео).
    const ghost=i=>!mobile()&&dist(i)===3;
    function paint(){
      const span=st.clientWidth,R=mobile()?Math.min(cardWidth*1.75,span*.62):Math.min(cardWidth*2.45,span*.36);
      items.forEach((d,i)=>{
        if(!activeArc.has(i)&&!warmingArc.has(i)&&!ghost(i)){d.style.visibility='hidden';d.classList.remove('is-ghost');return}
        const r=relative(i,k),angle=r*.47,depth=Math.cos(angle),scale=.72+.28*Math.max(0,depth);
        d.style.transform=`translate(${Math.sin(angle)*R}px,${(1-depth)*22}px) scale(${Math.max(.2,depth)*scale},${scale})`;
        d.style.opacity=String(warmingArc.has(i)&&!activeArc.has(i)?.015:ghost(i)&&!activeArc.has(i)?.42:Math.max(.1,1-Math.abs(r)*.1));d.style.zIndex=String(Math.round(depth*100));d.style.visibility='visible';
        d.classList.toggle('is-ghost',ghost(i)&&!activeArc.has(i)&&!warmingArc.has(i));
      });
    }
    function apply(moving=false){
      const next=new Set(items.map((_,i)=>i).filter(i=>dist(i)<=(mobile()?1:2)));
      activeArc=moving?new Set([...activeArc,...next]):next;clearTimeout(settleTimer);
      items.forEach((d,i)=>{d.classList.toggle('is-front',i===front());d.tabIndex=i===front()?0:-1});
      cap.textContent=CLIPS[front()][2]+' · '+CLIPS[front()][1];st.dataset.front=front();st.dataset.projection='flat';
      preload();syncVideos();
      paint();
      if(moving&&!reduced)settleTimer=setTimeout(()=>{activeArc=next;paint();syncVideos()},550);
      else{activeArc=next;paint()}

    }
    function layout(){cardWidth=ring.getBoundingClientRect().width||190;apply()}
    function turn(d,user){
      targetK+=d;if(user)lastUser=Date.now();const goal=targetK,token=++turnRevision;
      const next=new Set(items.map((_,i)=>i).filter(i=>Math.abs(relative(i,((goal%N)+N)%N))<=(mobile()?1:2)));
      const commit=()=>{warmingArc.clear();k=goal;apply(true)};
      if(!state?.running()){commit();return}
      warmingArc=new Set([...next].filter(i=>!activeArc.has(i)));paint();syncVideos();
      if(!warmingArc.size){commit();return}
      liveTogether([...warmingArc].map(i=>vids[i]),()=>token===turnRevision&&state.running()).then(ready=>{if(ready&&token===turnRevision)commit()});
    }
    function tick(){clearTimeout(timer);timer=setTimeout(()=>{if(!state?.running())return;if(Date.now()-lastUser>5000)turn(1);tick()},1350)}
    function checkPlayback(){
      clearTimeout(watchdog);if(!state?.running())return;
      vids.forEach((v,i)=>{if(activeArc.has(i)&&v.paused&&!v.error)play(v)});
      watchdog=setTimeout(checkPlayback,450);
    }
    $$('[data-drum]').forEach(b=>b.addEventListener('click',()=>turn(+b.dataset.drum,true)));
    st.addEventListener('keydown',e=>{if(e.key==='ArrowRight'){turn(1,true);e.preventDefault()}if(e.key==='ArrowLeft'){turn(-1,true);e.preventDefault()}});
    let x0=null;st.addEventListener('pointerdown',e=>{x0=e.clientX;moved=false});
    st.addEventListener('pointerup',e=>{if(x0===null)return;const dx=e.clientX-x0;x0=null;if(Math.abs(dx)>30){moved=true;turn(dx<0?1:-1,true);setTimeout(()=>moved=false,50)}});
    state=loopScene(st,'drum',{warm(){warmed=true;preload()},play(){syncVideos();tick();checkPlayback()},pause(){turnRevision++;targetK=k;warmingArc.clear();vids.forEach(v=>v.pause());clearTimeout(timer);clearTimeout(watchdog)}},true);
    const dialog=$('.clip-dialog'), viewer=$('video',dialog);let wasPaused=true;
    function openClip(){
      if(dialog.open)return;
      const [id,title,,base='media/examples']=CLIPS[front()];
      wasPaused=state.paused;state.pause();lastUser=Date.now();
      $('#clip-heading').textContent=title;viewer.poster=`${base}/${id}/poster.jpg`;viewer.src=`${base}/${id}/final.mp4`;
      dialog.showModal();viewer.play().catch(()=>{});
    }
    $('.watch-clip').addEventListener('click',openClip);
    $('.dialog-close',dialog).addEventListener('click',()=>dialog.close());
    dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();dialog.close()}},true);
    dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}});
    dialog.addEventListener('close',()=>{viewer.pause();viewer.removeAttribute('src');viewer.load();if(!wasPaused)state.resume()});
    let resumeViewer=false;
    document.addEventListener('visibilitychange',()=>{if(document.hidden){resumeViewer=dialog.open&&!viewer.paused;viewer.pause()}else if(resumeViewer&&dialog.open){resumeViewer=false;viewer.play().catch(()=>{})}});
    let width = innerWidth;
    addEventListener('resize', () => { if (innerWidth !== width) { width = innerWidth; layout(); } });
    layout();warmed=true;preload();
  }, 640);


  /* ── 6. Лента боли ── */
  deferScene('#pain', function pain() {
    const st = $('#pain'), time = $('.pc-time', st), fill = $('.pb-fill', st), cut = $('.pb-cut', st), lis = $$('.pain-lines li', st), bridge = $('.pain-bridge', st);
    const TOTAL = 6859, o = { s: 0 };
    const thick = () => Math.max(6, Math.round(parseFloat(getComputedStyle(lis[0]).fontSize) * .3)) + 'px';
    lis.forEach(li => { const mark=document.createElement('i');mark.className='strike-head';mark.setAttribute('aria-hidden','true');$('span',li).appendChild(mark); });
    const tl = gsap.timeline({ id:'pain', paused: true })
      .call(() => { lis.forEach(li => li.classList.remove('cut','is-striking')); }, null, 0)
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
    tl.fromTo(bridge, { opacity: .35, y: 6 }, { opacity: 1, y: 0, duration: .65, ease: EXPO }, 5.5);
    if(reduced)tl.progress(1).pause();
    loopScene(st,'pain',{play(){if(tl.progress()===1)tl.restart();else tl.resume()},pause(){tl.pause()}});
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
})();
