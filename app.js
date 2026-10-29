gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const rel = (el, base) => { const r = el.getBoundingClientRect(), b = base.getBoundingClientRect(); return { x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height }; };

// Кадры плёнки: s0…s13 сняты с исходника каждые 1,38 с. Хиты — те же моменты, что и клипы.
const N_FRAMES = 14;
const HITS = [
  { frame: 1, crop: .6167, score: 93, label: '93/100' },
  { frame: 7, crop: .2818, score: 88, label: '88/100' },
  { frame: 11, crop: .6417, score: 81, label: '81/100' },
];
const CROP_W = 607 / 1920;        // ширина окна 9:16 в исходнике 16:9
const SCREEN_AR = 9 / 19.5;       // экран телефона
const LAPTOP_AR = 1.672;          // ноутбук целиком, с основанием

const phones = $$('.phone');
phones.forEach(p => {
  const bz = document.createElement('div'); bz.className = 'bezel'; p.prepend(bz);
  const cam = document.createElement('i'); cam.className = 'cam'; $('.screen', p).appendChild(cam);
});
let playing = false;
function setPhonesPlaying(on) {
  if (on === playing) return; playing = on;
  phones.forEach(p => { const v = $('video', p); if (on) { if (!v.src) v.src = v.dataset.src; v.play().catch(() => {}); } else v.pause(); });
}

let tl, powerTl;
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
  const colTop = mobile ? 76 : Math.max(84, (S.h - col.offsetHeight) / 2 + 20);
  col.style.top = colTop + 'px';
  const mTop = colTop + col.offsetHeight + 12;
  const A = mobile
    ? { x: 0, y: mTop, w: S.w, h: S.h - mTop }
    : { x: pad + (S.w - 2 * pad) * .36, y: 64, w: (S.w - 2 * pad) * .64, h: S.h - 64 };

  // Плёнка: все кадры помещаются в ширину области (на телефоне — через один)
  const list = mobile ? [0, 1, 4, 7, 9, 11, 13] : [...Array(N_FRAMES).keys()];
  const gap = mobile ? 4 : 6;
  const fw = Math.min(120, (A.w - 16 - gap * (list.length - 1)) / list.length), fh = fw * 9 / 16;
  const sH = fh / .56, sGap = mobile ? 12 : 24;

  // Ноутбук: крупно, сколько позволяет высота (под ним ещё плёнка)
  const tvY = mobile ? A.y + 6 : colTop - 6;   // верх ноутбука на одной линии с заголовком
  const hRoom = S.h - tvY - sGap - sH - (mobile ? 24 : 48);
  const tvW = Math.min(mobile ? S.w - 32 : A.w * .86, mobile ? 9999 : 980, hRoom * LAPTOP_AR);
  const tvH = tvW / LAPTOP_AR;
  const tvX = A.x + (A.w - tvW) / 2;
  Object.assign(tv.style, { left: tvX + 'px', top: tvY + 'px', width: tvW + 'px' });
  const sY = tvY + tvH + sGap;
  // В финале ноутбук уменьшается и встаёт наверх, под ним — телефоны
  const lW = mobile ? Math.min(S.w * .44, tvW) : Math.min(A.w * .46, tvW), lH = lW / LAPTOP_AR;
  const lX = A.x + (A.w - lW) / 2, lY = A.y + (mobile ? 4 : A.h * .03);
  Object.assign(strip.style, { left: A.x + 'px', top: sY + 'px', width: A.w + 'px', height: sH + 'px' });
  stripIn.innerHTML = '';
  list.forEach(i => {
    const d = document.createElement('div'); d.className = 'fr';
    d.innerHTML = `<img src="media/strip/s${i}.jpg" alt="" loading="lazy"><i class="ring"></i><span class="lab"></span>`;
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
  let pW = mobile ? (S.w - 32 - 2 * pGap) / 3 : Math.min(270, A.w * .25);
  const pTopMin = lY + lH + (mobile ? 18 : 34);
  const room = S.h - pTopMin - (mobile ? 96 : 150);   // снизу место под оценку и подпись
  const hOf = w => (w * .93) / SCREEN_AR + w * .07;   // высота корпуса по ширине (рамка 3,5% с каждой стороны)
  if (hOf(pW) > room) pW = room / ((.93 / SCREEN_AR) + .07);
  const pH = hOf(pW);
  const pX0 = A.x + (A.w - (3 * pW + 2 * pGap)) / 2;
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
    d.innerHTML = `<img src="media/strip/h${h.frame}.jpg" alt="" loading="lazy">`;
    // базовый размер — финальный (чтобы картинка не мылилась при увеличении), стартуем уменьшенными
    const k = scr[i].h / r.h;
    Object.assign(d.style, { left: r.x + 'px', top: r.y + 'px', width: r.w * k + 'px', height: r.h * k + 'px' });
    gsap.set(d, { scale: 1 / k });
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
  let STEP_T = [0, 99, 99, 99], OSD_T = [[0, 'Подкаст о росте канала, 1:12:40']], END_T = 99, OFF_T = 99, PLAY_T = 99;
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
      setPhonesPlaying(tt > PLAY_T);
      if (tt > OFF_T && !tvVideo.paused) tvVideo.pause(); else if (tt <= OFF_T && tvVideo.paused) tvVideo.play().catch(() => {});
    },
    scrollTrigger: { trigger: stage, start: 'top top', end: () => '+=' + innerHeight * 2.6, scrub: true, pin: true, anticipatePin: 1 }
  });

  // Шаг 1 — запись на экране. Шаг 2 — нейросеть ищет: плёнка раскрывается, сильные моменты подсвечиваются
  // Шаг 1 — ноутбук открывается, на нём запись
  // экран включается как старый телевизор, пока сцена въезжает: линия по центру → кадр
  if (powerTl) { powerTl.scrollTrigger && powerTl.scrollTrigger.kill(); powerTl.kill(); }
  powerTl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: {
      trigger: stage, scrub: true,
      // начинаем, когда низ ноутбука уже на экране, и заканчиваем вскоре после закрепления сцены
      start: () => 'top ' + Math.round(innerHeight - (tvY + tvH) - 8) + 'px',
      end: () => 'top ' + Math.round(Math.min(innerHeight - (tvY + tvH) - 8 - 260, -40)) + 'px' } })
    .fromTo('#pwr .pwr-line', { scaleX: 0, opacity: 1 }, { scaleX: 1, duration: .35, ease: 'power2.out' })
    .fromTo(['#pwr .sh-t', '#pwr .sh-b'], { scaleY: 1 }, { scaleY: 0, duration: .6, ease: 'power3.out' }, .35)
    .to('#pwr .pwr-line', { opacity: 0, scaleY: 30, duration: .45, ease: 'power2.out' }, .35);
  const T2 = .45;
  tl.set(strip, { visibility: 'visible' }, T2)
    .to('.cl', { xPercent: -100, duration: .9, ease: 'power2.inOut' }, T2)
    .to('.cr', { xPercent: 100, duration: .9, ease: 'power2.inOut' }, T2)
    .fromTo(stripIn, { x: fw * 1.5 }, { x: 0, duration: 1.2, ease: 'power2.out' }, T2);
  HITS.forEach((h, k) => {
    const at = T2 + .85 + k * .25, f = hitFr[k];
    tl.to([$('.ring', f), $('.lab', f)], { opacity: 1, duration: .15 }, at)
      .to($('img', f), { filter: 'grayscale(0) brightness(1)', duration: .15 }, at);
  });

  // Шаг 3 — выбранные моменты вырезаются: в ленте остаётся пустое окно, кадр приподнимается
  const T3 = T2 + 1.75;
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
  [2, 1, 0].forEach(i => {
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
    const r = hitR[i], h = HITS[i], s = scr[i];
    const k = s.h / r.h;                          // базовый размер кадра — высота экрана
    const W = r.w * k, H = r.h * k;
    const visEnd = s.w / W;                       // доля ширины кадра, видимая в экране
    const center = h.crop + CROP_W / 2;
    const Lend = Math.min(Math.max(center - visEnd / 2, 0), 1 - visEnd);
    const y0 = r.y - sH * .55;                    // кадр уже приподнят ножницами
    // Видимое окно идёт по прямой из кадра на плёнке в экран телефона и никуда не раздувается
    const st = { p: 0 };
    const draw = () => {
      const e = st.p;
      const vx = r.x + (s.x - r.x) * e, vy = y0 + (s.y - y0) * e;
      const vw = r.w + (s.w - r.w) * e, vh = r.h + (s.h - r.h) * e;
      const sc = vh / H, vf = Math.min(1, vw / (W * sc));
      const lf = visEnd < 1 ? Lend * (1 - vf) / (1 - visEnd) : 0;
      const rf = Math.max(0, 1 - lf - vf);
      const rad = (3 + 13 * e) / sc;
      gsap.set(f, { x: vx - lf * W * sc - r.x, y: vy - r.y, scale: sc,
        clipPath: `inset(0% ${(rf * 100).toFixed(3)}% 0% ${(lf * 100).toFixed(3)}% round ${rad.toFixed(1)}px)` });
    };
    const at = M + i * .12;
    // корпуса телефонов появляются сразу, кадр летит в уже стоящий телефон и с ходу становится клипом
    tl.to([$('.bezel', phones[i]), $('.cam', phones[i])], { opacity: 1, duration: .3 }, M - .15 + i * .05)
      .to(st, { p: 1, duration: .9, ease: 'power3.inOut', onUpdate: draw }, at)
      .to($('.screen', phones[i]), { opacity: 1, duration: .2 }, at + .85)
      .to(f, { opacity: 0, duration: .15 }, at + .95)
      .to($('.hook', phones[i]), { opacity: 1, duration: .2 }, at + .9)
      .to($$('.subs span', phones[i]), { opacity: 1, duration: .06, stagger: .06 }, at + .95);
  });

  // Хук, субтитры по словам, оценка и причина — итоговая картинка
  const E = M + 1.3;
  tl.to('.meta', { opacity: 1, duration: .3, stagger: .08 }, E);
  tl.to({}, { duration: .6 });

  STEP_T = [0, T2, T3, T4];
  OSD_T = [[0, 'Подкаст о росте канала, 1:12:40'], [T2, 'Ищу самые сильные моменты…'], [T3, '']];
  END_T = E + .5; OFF_T = T3 + .2; PLAY_T = M + .9; SNAP_AT = SNAP_T - .02;
}

// Плавная прокрутка колесом на десктопе
if (!matchMedia('(pointer: coarse)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches && window.Lenis) {
  const lenis = new Lenis({ lerp: .12, wheelMultiplier: .9 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(tt => lenis.raf(tt * 1000));
  gsap.ticker.lagSmoothing(0);
}

const ready = document.fonts ? document.fonts.ready : Promise.resolve();
if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.documentElement.classList.add('reduced');
  $$('.steps li').forEach(li => { li.classList.add('on'); li.classList.remove('cur'); });
  $$('.phone').forEach(p => { $('.screen', p).style.inset = '3%'; });
  // уменьшенное движение: видео не запускаются сами, видны обложки
  $$('video').forEach(v => { v.removeAttribute('autoplay'); v.pause(); });
} else {
  ready.then(() => { build(); ScrollTrigger.refresh(); });
  let tm, lastW = innerWidth;
  addEventListener('resize', () => { if (Math.abs(innerWidth - lastW) < 40) return; lastW = innerWidth; clearTimeout(tm); tm = setTimeout(() => { build(); ScrollTrigger.refresh(); }, 250); });
}

// Кнопки и поле ссылки ведут в продукт
document.querySelectorAll('.js-product').forEach(a => a.href = PRODUCT_URL);
document.querySelectorAll('form.drop').forEach(f => f.addEventListener('submit', e => {
  e.preventDefault();
  const v = f.querySelector('input').value.trim();
  location.href = PRODUCT_URL + (v ? (PRODUCT_URL.includes('?') ? '&' : '?') + 'url=' + encodeURIComponent(v) : '');
}));
