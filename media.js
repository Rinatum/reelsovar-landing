// All showcase clips autoplay together; retained hero players switch without reloading.
(() => {
  const hero = [...document.querySelectorAll('.hero-loop')];
  const examples = [...document.querySelectorAll('.real-example video, .result-clip video')];
  const videos = [...hero, ...examples];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const pausedByUser = new Set();
  let activeHero = hero[0], soundWanted = false, heroVisible = false, manual = null;
  const sound = document.querySelector('.desk-sound');
  const pause = document.querySelector('.hero-motion');
  const controls = new Map();
  const safelyPlay = video => video.play().catch(() => {});
  function syncButtons(video) {
    const c = controls.get(video); if (!c) return;
    c.sound.textContent = video.muted ? 'Со звуком' : 'Без звука';
    c.sound.setAttribute('aria-pressed', String(!video.muted));
    c.pause.textContent = video.paused ? 'Смотреть' : 'Пауза';
    c.pause.setAttribute('aria-pressed', String(!video.paused));
  }
  function choose() {
    if (document.hidden) {videos.forEach(v => v.pause());return;}
    videos.forEach(v => {
      const selected = !hero.includes(v) || v === activeHero;
      if (selected && !pausedByUser.has(v) && (!reduced.matches || v===manual)) safelyPlay(v);
      else v.pause();
    });
  }
  examples.forEach(video => {
    video.controls = false; video.muted = true; video.loop = true; video.preload = 'auto';
    // Workflow examples use the same complete low-bandwidth renditions.
    const bar=document.createElement('div');bar.className='media-controls';
    const soundButton=document.createElement('button');soundButton.type='button';soundButton.textContent='Со звуком';soundButton.setAttribute('aria-pressed','false');
    const pauseButton=document.createElement('button');pauseButton.type='button';pauseButton.textContent='Смотреть';pauseButton.setAttribute('aria-pressed','false');
    bar.append(soundButton,pauseButton);video.insertAdjacentElement('afterend',bar);controls.set(video,{sound:soundButton,pause:pauseButton});
    soundButton.addEventListener('click',()=>{
      const unmute=video.muted; if(unmute){soundWanted=false;sound.textContent="Включить звук";sound.setAttribute("aria-pressed","false");}videos.forEach(v=>{if(v!==video){v.muted=true;}});
      video.muted=!unmute;video.controls=unmute;manual=video;pausedByUser.delete(video);pauseDemo();choose();syncButtons(video);
    });
    pauseButton.addEventListener('click',()=>{if(!video.paused){pausedByUser.add(video);video.pause();}else{pausedByUser.delete(video);manual=video;choose();}syncButtons(video);});
    ['play','pause','volumechange'].forEach(event=>video.addEventListener(event,()=>syncButtons(video)));
  });
  heroVisible = true;
  document.querySelectorAll('.moment-choice').forEach(button=>button.addEventListener('click',()=>{
    const next=hero.find(v=>v.dataset.clip===button.dataset.clip);if(next===activeHero)return;
    const wasPaused=pausedByUser.has(activeHero);activeHero.pause();activeHero=next;manual=null;
    if(wasPaused)pausedByUser.add(next);else pausedByUser.delete(next);
    hero.forEach(v=>{v.classList.toggle('is-active',v===next);v.setAttribute('aria-hidden',String(v!==next));v.muted=!(soundWanted && v===next);});
    document.querySelectorAll('.moment-choice').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    document.querySelector('.desk-range').textContent=button.dataset.range;
    choose();
  }));
  sound.addEventListener('click',()=>{soundWanted=!soundWanted;activeHero.muted=!soundWanted;manual=reduced.matches?activeHero:null;pausedByUser.delete(activeHero);sound.textContent=soundWanted?'Выключить звук':'Включить звук';sound.setAttribute('aria-pressed',String(soundWanted));examples.forEach(v=>{v.muted=true;});choose();});
  pause.addEventListener('click',()=>{const stop=!activeHero.paused;if(stop){pausedByUser.add(activeHero);manual=null;}else{pausedByUser.delete(activeHero);manual=activeHero;}choose();});
  function syncHeroPause(){pause.textContent=activeHero.paused?'Смотреть':'Пауза';pause.setAttribute('aria-pressed',String(!activeHero.paused));}
  hero.forEach(video=>{
    ['play','pause'].forEach(event=>video.addEventListener(event,syncHeroPause));
    video.addEventListener('play',()=>{if(reduced.matches && manual!==video)video.pause();});
  });
  syncHeroPause();
  choose();
  // Warm only the other small hero files, after the first player has a decoded frame.
  function warmHero() {
    if(navigator.connection?.saveData || /2g/.test(navigator.connection?.effectiveType||''))return;
    hero.slice(1).forEach(v=>{v.preload='auto';v.load();});
  }
  if (activeHero.readyState >= 2) warmHero();
  else activeHero.addEventListener('loadeddata', warmHero, {once:true});
  choose();
  document.addEventListener('visibilitychange',choose);
  reduced.addEventListener('change',()=>{manual=null;choose();});
  // Native controls remain available once the viewer asks to listen.
  examples.forEach(video=>video.addEventListener('play',()=>{
    if(!video.muted){manual=video;videos.forEach(v=>{if(v!==video)v.muted=true;});pauseDemo();}
  }));
})();
