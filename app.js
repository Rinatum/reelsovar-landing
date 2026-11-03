gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const rel = (el, base) => { const r = el.getBoundingClientRect(), b = base.getBoundingClientRect(); return { x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height }; };

// Плёнка из двух реальных исходных эпизодов (по 7 кадров). Это иллюстрация процесса, не запись интерфейса.
const N_FRAMES = 14;
const HITS = [
  { frame: 1, crop: .34, label: '1' },
  { frame: 9, crop: .34, label: '2' },
];
const CROP_W = 607 / 1920;        // ширина окна 9:16 в исходнике 16:9
const SCREEN_AR = 9 / 16;       // экран телефона
const LAPTOP_AR = 1.672;          // ноутбук целиком, с основанием

const phones = $$('.phone');
phones.forEach(p => {
  const bz = document.createElement('div'); bz.className = 'bezel'; p.prepend(bz);
  const cam = document.createElement('i'); cam.className = 'cam'; $('.screen', p).appendChild(cam);
});
let playing = false;
function setPhonesPlaying(on) {
  if (on === playing) return; playing = on;
  phones.forEach(p => { const v = $('video', p); if (on) { if (!v.src) v.src = v.dataset.src; if (!v.ended) v.play().catch(() => {}); } else v.pause(); });
}

let tl;
function build() {
  if (tl) { tl.scrollTrigger && tl.scrollTrigger.kill(); tl.progress(0).kill(); }
  const stage = $('#stage'), tv = $('#tv'), strip = $('#strip'), stripIn = $('#stripIn'), sc = $('#scissors'), flyers = $('#flyers');
  const col = $('#howCol'), steps = $$('.steps li', col);
  gsap.set(['#pwr i', tv, strip, stripIn, '.cover', sc, '.phone', '.bezel', '.cam', '.hook', '.meta', '.blade', '.subs span', '#tvPic', '#tvUI', '#tvSnap'], { clearProps: 'all' });
  steps.forEach((li, i) => { li.classList.toggle('on', i === 0); li.classList.toggle('cur', i === 0); });

  const S = { w: stage.clientWidth, h: stage.clientHeight };
  const mobile = S.w < 700;
  const pad = mobile ? 16 : col.offsetLeft;   // поле колонки контента (на широких экранах контент не шире 1440 px)

  // Шаги слева (на телефоне — сверху), анимация справа (на телефоне — под шагами)
  const colTop = mobile ? 20 : 56;
  col.style.top = colTop + 'px';
  const mTop = colTop + col.offsetHeight + 12;
  const A = mobile
    ? { x: 0, y: mTop, w: S.w, h: S.h - mTop }
    : { x: pad + (S.w - 2 * pad) * .36, y: 24, w: (S.w - 2 * pad) * .64, h: S.h - 24 };

  // Плёнка: все кадры помещаются в ширину области (на телефоне — через один)
  const list = mobile ? [0, 1, 4, 7, 9, 11, 13] : [...Array(N_FRAMES).keys()];
  const gap = mobile ? 4 : 6;
  const fw = Math.min(120, (A.w - 16 - gap * (list.length - 1)) / list.length), fh = fw * 9 / 16;
  const sH = fh / .56, sGap = mobile ? 12 : 24;

  // Ноутбук: крупно, сколько позволяет высота (под ним ещё плёнка)
  const tvY = mobile ? A.y + 6 : 32;   // верх ноутбука на одной линии с заголовком
  const hRoom = S.h - tvY - sGap - sH - (mobile ? 24 : 48);
  const tvW = Math.min(mobile ? S.w - 32 : A.w * .86, mobile ? 9999 : 980, hRoom * LAPTOP_AR);
  const tvH = tvW / LAPTOP_AR;
  const tvX = A.x + (A.w - tvW) / 2;
  Object.assign(tv.style, { left: tvX + 'px', top: tvY + 'px', width: tvW + 'px' });
  const sY = tvY + tvH + sGap;
  // В финале ноутбук уменьшается и встаёт наверх, под ним — телефоны
  const lW = mobile ? Math.min(S.w * .34, tvW) : Math.min(col.offsetWidth, 310), lH = lW / LAPTOP_AR;
  const lX = mobile ? A.x + (A.w - lW) / 2 : pad;
  const lY = mobile ? A.y + 4 : colTop + col.offsetHeight + 28;
  Object.assign(strip.style, { left: A.x + 'px', top: sY + 'px', width: A.w + 'px', height: sH + 'px' });
  stripIn.innerHTML = '';
  list.forEach(i => {
    const d = document.createElement('div'); d.className = 'fr';
    d.innerHTML = `<img src="media/examples/animation-talks/s${i}.jpg" alt="" loading="lazy"><i class="ring"></i><span class="lab"></span>`;
    stripIn.appendChild(d);
  });
  stripIn.style.gap = gap + 'px';
  const offset = (A.w - (list.length * (fw + gap) - gap)) / 2;
  stripIn.style.left = offset + 'px';
  const frs = $$('.fr', stripIn);
  const pos = HITS.map(h => list.indexOf(h.frame));
  const hitFr = HITS.map((h, k) => { const f = frs[pos[k]]; $('.lab', f).textContent = h.label; return f; });
  const hitR = HITS.map((h, k) => ({ x: A.x + offset + pos[k] * (fw + gap), y: sY + sH * .22, w: fw, h: fh }));

  // Телефоны: ряд под поднятой плёнкой
  const pGap = mobile ? 12 : Math.max(28, A.w * .045);
  let pW = mobile ? (S.w - 32 - (phones.length - 1) * pGap) / phones.length : Math.min(270, A.w * .38);
  const pTopMin = mobile ? lY + lH + 18 : 28;
  const room = S.h - pTopMin - 32;   // снизу место под оценку и подпись
  const hOf = w => (w * .93) / SCREEN_AR + w * .07;   // высота корпуса по ширине (рамка 3,5% с каждой стороны)
  if (hOf(pW) > room) pW = room / ((.93 / SCREEN_AR) + .07);
  const pH = hOf(pW);
  const pX0 = A.x + (A.w - (phones.length * pW + (phones.length - 1) * pGap)) / 2;
  const pY = pTopMin + Math.max(0, room - pH) * .35;
  const bez = pW * .035;
  const scr = phones.map((p, i) => {
    Object.assign(p.style, { left: pX0 + i * (pW + pGap) + 'px', top: pY + 'px', width: pW + 'px', height: pH + 'px' });
    p.style.setProperty('--bz', bez + 'px');   // для «выключенного» экрана внутри корпуса
    const s = $('.screen', p);
    const sw = pW - 2 * bez, sh = pH - 2 * bez;
    Object.assign(s.style, { left: bez + 'px', top: bez + 'px', width: sw + 'px', height: sh + 'px', borderRadius: getComputedStyle($('.bezel', p)).borderRadius });
    gsap.set(s, { opacity: 0 });
    return { x: pX0 + i * (pW + pGap) + bez, y: pY + bez, w: sw, h: sh };
  });

  // Вырезанные кадры: 16:9 → маска 9:16 по лицу → экран телефона
  flyers.innerHTML = '';
  const fl = HITS.map((h, i) => {
    const r = hitR[i];
    const d = document.createElement('div'); d.className = 'flyer';
    d.innerHTML = `<img src="assets/story-start-${i}.png" alt="">`;
    // базовый размер — финальный (чтобы картинка не мылилась при увеличении), стартуем уменьшенными
    const k = scr[i].h / r.h;
    Object.assign(d.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
    gsap.set(d, { scale: 1 });
    flyers.appendChild(d); return d;
  });

  // Ножницы
  const scW = mobile ? 90 : 150, scH = scW * 120 / 160;
  sc.style.width = scW + 'px';
  gsap.set(sc, { x: A.x + A.w + 30, y: sY + sH / 2 - scH / 2 });
  gsap.set('.b1', { rotate: -16 }); gsap.set('.b2', { rotate: 16 });

  // Моменты времени шагов и надписей на экране — заполняются ниже
  let SNAP_AT = 99, snapped = false;
  const drawSnap = () => {
    const c = $('#tvSnap'), v = $('#tvVideo'), ctx = c.getContext('2d');
    const vw = v.videoWidth, vh = v.videoHeight; if (!vw) return;
    const ar = c.width / c.height, sw = Math.min(vw, vh * ar), sh = sw / ar;   // как object-fit: cover
    ctx.drawImage(v, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, c.width, c.height);
  };
  let STEP_T = [0, 99, 99, 99], OSD_T = [[0, 'Интервью о тренировках']], END_T = 99, OFF_T = 99, PLAY_T = 99;
  const osd = $('#osd'), tvVideo = $('#tvVideo');
  tl = gsap.timeline({
    defaults: { ease: 'none' },
    onUpdate() {
      const tt = this.time();
      let txt = OSD_T[0][1]; OSD_T.forEach(([a, x]) => { if (tt >= a) txt = x; });
      if (osd.textContent !== txt) osd.textContent = txt;
      const n = STEP_T.filter(a => tt >= a).length;
      steps.forEach((li, i) => { li.classList.toggle('on', i < n); li.classList.toggle('cur', i === n - 1 && tt < END_T); });
      if (tt >= SNAP_AT && !snapped) { drawSnap(); snapped = true; } else if (tt < SNAP_AT) snapped = false;
      // Begin each clip as its still frame hands over to the video, without waiting for trailing UI tweens.
      phones.forEach((phone, i) => {
        const video = $('video', phone);
        if (tt >= PLAY_T + i * .12 && canRunStory() && video.paused && !video.ended) {
          if (!video.getAttribute('src')) video.src = video.dataset.src;
          video.play().catch(() => {});
        }
      });
      if (tt > OFF_T || !storyVisible || document.hidden || reducedMotion.matches) tvVideo.pause(); else if (tvVideo.paused) tvVideo.play().catch(() => {});
    },
    paused: true,
    onComplete() {
      tvVideo.pause();
      finishStoryIntro();
    }
  });

  // Сохраняем историю нарезки, но запускаем её по кнопке, без перехвата прокрутки.
  const T2 = .45;
  tl.set(strip, { visibility: 'visible' }, T2)
    .to('.cl', { xPercent: -100, duration: .9, ease: 'power2.inOut' }, T2)
    .to('.cr', { xPercent: 100, duration: .9, ease: 'power2.inOut' }, T2)
    .fromTo(stripIn, { x: fw * 1.5 }, { x: 0, duration: 1.2, ease: 'power2.out' }, T2);
  // Reveal the available fragments first; then mark only the chosen pair.
  tl.to(frs.map(f => $('img', f)), { filter: 'grayscale(0) brightness(.85)', duration: .5, stagger: .035 }, T2 + .6);
  HITS.forEach((h, k) => {
    const at = T2 + 1.8 + k * .35, f = hitFr[k];
    tl.to([$('.ring', f), $('.lab', f)], { opacity: 1, duration: .3 }, at)
      .to($('img', f), { filter: 'grayscale(0) brightness(1)', duration: .15 }, at);
  });

  // Шаг 3 — выбранные моменты вырезаются: в ленте остаётся пустое окно, кадр приподнимается
  const T3 = T2 + 3.2;
  // Запись «загружается» в Reelsovar: стоп-кадр уменьшается в плеер интерфейса, вокруг проявляется интерфейс.
  // Анимируем стоп-кадр на canvas, а не само видео: Safari криво рисует видео внутри трансформаций.
  const snap = $('#tvSnap'), scrEl = $('#tvScreen');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  snap.width = Math.round(scrEl.offsetWidth * dpr); snap.height = Math.round(scrEl.offsetHeight * dpr);
  const PLAYER = { x: 28 / 1440, y: 84 / 900, w: 864 / 1440, h: 486 / 900 };   // плеер на макете интерфейса
  const SNAP_T = T3 - .45;
  tl.set('#tvSnap', { opacity: 1 }, SNAP_T)
    .fromTo('#tvSnap', { xPercent: 0, yPercent: 0, scaleX: 1, scaleY: 1 },
      { xPercent: PLAYER.x * 100, yPercent: PLAYER.y * 100, scaleX: PLAYER.w, scaleY: PLAYER.h, duration: .6, ease: 'power3.inOut' }, SNAP_T)
    .to('#tvUI', { opacity: 1, duration: .45, ease: 'power2.out' }, SNAP_T + .2)
    .to('#tvSnap', { opacity: 0, duration: .2 }, SNAP_T + .62);
  let t = T3 + .1;
  tl.to(sc, { opacity: 1, duration: .08 }, t);
  HITS.map((_, i) => i).reverse().forEach(i => {
    const r = hitR[i], f = hitFr[i];
    tl.to(sc, { x: r.x + r.w - scW * .5, duration: .36, ease: 'power3.inOut' }, t)
      .to('.b1', { rotate: 1, duration: .09, ease: 'power2.in' }, t + .36)
      .to('.b2', { rotate: -1, duration: .09, ease: 'power2.in' }, t + .36)
      .to('.b1', { rotate: -16, duration: .1 }, t + .47)
      .to('.b2', { rotate: 16, duration: .1 }, t + .47)
      .set(fl[i], { opacity: 1 }, t + .44)
      .set([$('img', f), $('.lab', f)], { opacity: 0 }, t + .44)
      .to($('.ring', f), { opacity: .45, duration: .1 }, t + .44)
      .to(fl[i], { y: -sH * .55, duration: .3, ease: 'power3.out' }, t + .46);
    t += .6;
  });
  tl.to(sc, { x: A.x - scW * .4, opacity: 0, duration: .4, ease: 'power3.in' }, t);

  // Шаг 4 — ноутбук с интерфейсом уходит наверх, плёнка исчезает, кадры становятся клипами
  const T4 = t;
  const O = t + .15;
  tl.to(tv, { x: lX - tvX, y: lY - tvY, scale: lW / tvW, duration: .7, ease: 'power2.inOut' }, O)
    .to(strip, { autoAlpha: 0, y: 16, duration: .4, ease: 'power2.in' }, O + .1);

  const M = O + .55;
  fl.forEach((f, i) => {
    const r = hitR[i], target = scr[i], shell = phones[i];
    const y0 = r.y - sH * .55;
    const state = {p:0};
    const draw = () => {
      const t=state.p;
      const x=r.x+(target.x-r.x)*t, y=y0+(target.y-y0)*t;
      const w=r.w+(target.w-r.w)*t, h=r.h+(target.h-r.h)*t;
      gsap.set(f,{x:x-r.x,y:y-r.y,width:w,height:h,scale:1,clipPath:'none',borderRadius:3+13*t});
      const sx=w/target.w,sy=h/target.h;
      gsap.set(shell,{transformOrigin:'0 0',x:x-bez*sx-parseFloat(shell.style.left),y:y-bez*sy-parseFloat(shell.style.top),scaleX:sx,scaleY:sy});
      gsap.set($('.bezel',shell),{opacity:t});
    };
    draw();
    const at=M+i*.12;
    tl.to(state,{p:1,duration:.9,ease:'power3.inOut',onUpdate:draw},at)
      .to($('.cam',shell),{opacity:1,duration:.2},at+.75)
      .to($('.screen',shell),{opacity:1,duration:.16},at+.86)
      .to(f,{opacity:0,duration:.16},at+.94);
  });

  // Хук, субтитры по словам, оценка и причина — итоговая картинка
  const E = M + 1.3;
  tl.to('.meta', { opacity: 1, duration: .3, stagger: .08 }, E);
  tl.to({}, { duration: .6 });

  STEP_T = [0, T2, T3, T4];
  OSD_T = [[0, 'Интервью о тренировках'], [T2, 'Ищу самые сильные моменты…'], [T3, '']];
  END_T = E + .5; OFF_T = T3 + .2; PLAY_T = M + .94; SNAP_AT = SNAP_T - .02;
}

// Плавная прокрутка колесом на десктопе
let lenis = null;
if (!matchMedia('(pointer: coarse)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches && window.Lenis) {
  lenis = new Lenis({ lerp: .12, wheelMultiplier: .9 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(tt => lenis.raf(tt * 1000));
  gsap.ticker.lagSmoothing(0);
}

const ready = document.fonts ? document.fonts.ready : Promise.resolve();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
if (reducedMotion.matches) {
  document.documentElement.classList.add('motion-reduced');
  $$('video').forEach(v => { v.removeAttribute('autoplay'); v.pause(); });
}

// A cycle consists of the illustration, both complete clips, then a gentle reset.
const demo = $('#story');
let storyVisible = false;
let storyPhase = 'intro';
let cycleFade = null;
let storyCycles = 0;
const storyVideos = () => $$('.phone video', demo);
const canRunStory = () => storyVisible && !document.hidden && !reducedMotion.matches;
function pauseDemo() {
  tl?.pause(); cycleFade?.pause();
  setPhonesPlaying(false);
  $$('video', demo).forEach(v => v.pause());
}
function finishStoryIntro() {
  storyPhase = 'clips';
  if (canRunStory()) setPhonesPlaying(true);
}
function resetStory() {
  setPhonesPlaying(false);
  storyVideos().forEach(v => {v.currentTime = 0;});
  $('#tvVideo').currentTime = 0;
  storyPhase = 'intro'; storyCycles++;
  build(); tl.timeScale(tl.duration() / 8);
}
function checkStoryEnded() {
  if (storyPhase !== 'clips' || !storyVideos().every(v => v.ended) || !canRunStory()) return;
  storyPhase = 'transition';
  cycleFade = gsap.timeline({onComplete() {cycleFade = null; resumeVisibleStory();}})
    .to('#stage', {opacity: 0, duration: .7, delay: .8, ease: 'power2.inOut'})
    .call(resetStory)
    .to('#stage', {opacity: 1, duration: .7, ease: 'power2.inOut'});
}
storyVideos().forEach(v => v.addEventListener('ended', checkStoryEnded));
function resumeVisibleStory() {
  if (!canRunStory() || !tl) return;
  storyVideos().forEach(v => {if (!v.getAttribute('src')) {v.preload='auto';v.src=v.dataset.src;v.load();}});
  if (cycleFade) {cycleFade.resume();return;}
  if (storyPhase === 'intro') tl.play();
  else if (storyPhase === 'clips') {
    if (storyVideos().every(v => v.ended)) checkStoryEnded();
    else {playing = false; setPhonesPlaying(true);}
  }
}
ready.then(() => {
  build(); tl.timeScale(tl.duration() / 8);
  if (reducedMotion.matches) {tl.progress(1); storyPhase = 'clips'; pauseDemo();}
  const observer = new IntersectionObserver(entries => {
    const entry = entries[0];
    if (entry.intersectionRatio >= .6) {storyVisible = true; resumeVisibleStory();}
    else if (entry.intersectionRatio < .25) {storyVisible = false; pauseDemo();}
  }, {threshold: [0, .25, .6]});
  observer.observe($('#stage'));
});
let resizeTimer;
let storyWidth = innerWidth;
addEventListener('resize', () => {
  if (!tl || Math.abs(innerWidth - storyWidth) < 20) return;
  storyWidth = innerWidth;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const progress = tl.progress();
    pauseDemo();
    cycleFade?.kill(); cycleFade = null; gsap.set('#stage', {opacity:1});
    if (storyPhase === 'transition') {resetStory();}
    else {build(); tl.timeScale(tl.duration() / 8).progress(progress);}
    resumeVisibleStory();
  }, 180);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseDemo(); else resumeVisibleStory();
});

// Одно целевое действие: переход в продукт. Ссылка или файл добавляются уже внутри него.
document.querySelectorAll('.js-product').forEach(a => a.href = PRODUCT_URL);

// Ссылки на разделы (#how, #offer…) — плавно, с поправкой на фиксированную шапку
const NAV_H = 64;
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || a.classList.contains('js-product')) return;
  const id = a.getAttribute('href').slice(1);
  const el = id ? document.getElementById(id) : (a.classList.contains('logo') ? document.body : null);   // логотип — наверх
  if (!el) return;
  e.preventDefault();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const top = el.getBoundingClientRect().top + scrollY - NAV_H;   // блок продукта теперь прокручивается как обычный раздел
  if (lenis) lenis.scrollTo(top, { duration: 1.1, immediate: reduce });
  else scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
  history.replaceState(null, '', id ? '#' + id : location.pathname);
});

// Media playback and hero switching are managed together in media.js.
reducedMotion.addEventListener('change', () => {
  document.documentElement.classList.toggle('motion-reduced', reducedMotion.matches);
  if (reducedMotion.matches && tl) {
    cycleFade?.kill(); cycleFade = null; gsap.set('#stage', {opacity:1});
    tl.progress(1); storyPhase = 'clips'; pauseDemo();
  } else resumeVisibleStory();
});
