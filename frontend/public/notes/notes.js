/* ============================================================
   THE MARGINALIA SERIES — shared runtime
   Loaded BEFORE MathJax so the config below is picked up.
   ============================================================ */

window.MathJax = {
  tex: {
    inlineMath: [['\\(', '\\)']],
    displayMath: [['\\[', '\\]'], ['$$', '$$']],
    processEscapes: true,
    packages: { '[+]': ['ams', 'boldsymbol', 'mathtools', 'braket'] }
  },
  svg: { fontCache: 'local', scale: 1.04 },
  options: {
    skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
    ignoreHtmlClass: 'no-mathjax'
  },
  startup: {
    typeset: true,
    ready: function () {
      MathJax.startup.defaultReady();
      document.body.classList.add('mj-ready');
    }
  }
};

/* ---------- tiny helpers ------------------------------------------------ */
const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp  = (a, b, t) => a + (b - a) * t;
const fmt   = (x, n) => (Math.abs(x) < 1e-12 ? 0 : x).toFixed(n === undefined ? 3 : n);

/** Read a CSS custom property off :root (so canvases follow the theme). */
function css(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Palette snapshot for canvas drawing. Re-read on every frame/redraw. */
function pal() {
  return {
    ink: css('--ink'), ink2: css('--ink-2'), ink3: css('--ink-3'), ink4: css('--ink-4'),
    paper: css('--paper'), paper2: css('--paper-2'), paper3: css('--paper-3'),
    rule: css('--rule'), ruleSoft: css('--rule-soft'),
    acc: css('--acc'), acc2: css('--acc-2'), ok: css('--ok'), warn: css('--warn'), bad: css('--bad')
  };
}

/** HiDPI canvas sizing. Returns ctx; sets cv._w / cv._h to CSS pixel size. */
function fit(cv, aspect) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = cv.clientWidth || 600;
  const h = aspect ? Math.round(w / aspect) : (cv.clientHeight || 340);
  cv.style.height = aspect ? h + 'px' : cv.style.height;
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cv._w = w; cv._h = h;
  return ctx;
}

/**
 * Register a canvas scene.
 *   scene(cv, { draw(ctx,p,t), init?, aspect?, still? })
 * Animates only while on screen; redraws on resize and theme change.
 */
const _scenes = [];
function scene(cv, opts) {
  if (!cv) return null;
  const o = Object.assign({ aspect: 16 / 9, still: false }, opts);
  const s = { cv, o, ctx: fit(cv, o.aspect), t: 0, vis: false, running: false };
  if (o.init) o.init(s);
  const step = (ts) => {
    if (!s.vis) { s.running = false; return; }
    s.t = ts / 1000;
    o.draw(s.ctx, pal(), s.t, s);
    requestAnimationFrame(step);
  };
  s.kick = () => {
    if (o.still) { s.redraw(); return; }
    if (!s.running && s.vis) { s.running = true; requestAnimationFrame(step); }
  };
  s.redraw = () => { s.ctx = fit(cv, o.aspect); o.draw(s.ctx, pal(), s.t, s); };
  new IntersectionObserver((es) => {
    es.forEach(e => { s.vis = e.isIntersecting; if (s.vis) s.kick(); });
  }, { rootMargin: '120px' }).observe(cv);
  _scenes.push(s);
  return s;
}
let _rt;
addEventListener('resize', () => { clearTimeout(_rt); _rt = setTimeout(() => _scenes.forEach(s => s.redraw()), 140); });
function redrawAll() { _scenes.forEach(s => s.redraw()); }

/** Pointer position in CSS pixels relative to a canvas. */
function ptr(cv, e) {
  const r = cv.getBoundingClientRect();
  const t = e.touches ? e.touches[0] : e;
  return { x: t.clientX - r.left, y: t.clientY - r.top };
}

/** Attach mouse+touch drag handling to a canvas. */
function drag(cv, { down, move, up }) {
  let on = false;
  const d = e => { on = true; if (down) down(ptr(cv, e), e); e.preventDefault(); };
  const m = e => { if (move) move(ptr(cv, e), on, e); if (on) e.preventDefault(); };
  const u = e => { if (on && up) up(e); on = false; };
  cv.addEventListener('mousedown', d); cv.addEventListener('touchstart', d, { passive: false });
  addEventListener('mousemove', m);    cv.addEventListener('touchmove', m, { passive: false });
  addEventListener('mouseup', u);      addEventListener('touchend', u);
}

/* ---------- masthead: level, theme, progress, TOC ----------------------- */
function bootChrome() {
  const body = document.body;

  // reading level
  const lvl = localStorage.getItem('mg-level') || 'grad';
  setLevel(lvl);
  $$('[data-level-btn]').forEach(b => b.addEventListener('click', () => setLevel(b.dataset.levelBtn)));
  function setLevel(v) {
    body.dataset.level = v;
    localStorage.setItem('mg-level', v);
    $$('[data-level-btn]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.levelBtn === v)));
  }

  // theme
  const savedTheme = localStorage.getItem('mg-theme');
  if (savedTheme) document.documentElement.dataset.theme = savedTheme;
  const tb = $('#themeBtn');
  if (tb) {
    const paint = () => {
      const dark = document.documentElement.dataset.theme === 'dark' ||
        (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
      tb.textContent = dark ? '☾' : '☀';
    };
    paint();
    tb.addEventListener('click', () => {
      const dark = document.documentElement.dataset.theme === 'dark' ||
        (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.dataset.theme = dark ? 'light' : 'dark';
      localStorage.setItem('mg-theme', dark ? 'light' : 'dark');
      paint(); redrawAll();
    });
  }

  // progress bar
  const bar = $('#prog');
  const onScroll = () => {
    if (bar) {
      const h = document.documentElement.scrollHeight - innerHeight;
      bar.style.width = (h > 0 ? clamp(scrollY / h, 0, 1) * 100 : 0) + '%';
    }
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // TOC: build from sections + scrollspy
  const toc = $('#toc');
  if (toc) {
    const secs = $$('section[id]');
    secs.forEach(s => {
      const h2 = $('h2', s);
      if (!h2) return;
      const a = document.createElement('a');
      a.href = '#' + s.id;
      a.textContent = (h2.dataset.short || h2.textContent).replace(/§\s*[\d.]+\s*/, '').trim();
      toc.appendChild(a);
    });
    const links = $$('a', toc);
    const io = new IntersectionObserver((es) => {
      es.forEach(e => {
        if (!e.isIntersecting) return;
        links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id));
      });
    }, { rootMargin: '-80px 0px -66% 0px' });
    secs.forEach(s => io.observe(s));
  }

  // quizzes: <div class="q" data-a="2"> <button class="opt">… <p class="why">…
  $$('.q').forEach(q => {
    const right = +q.dataset.a;
    const opts = $$('.opt', q);
    opts.forEach((o, i) => o.addEventListener('click', () => {
      if (q.dataset.done) return;
      q.dataset.done = '1';
      o.classList.add(i === right ? 'right' : 'wrong');
      if (i !== right) opts[right].classList.add('right');
      const why = $('.why', q); if (why) why.classList.add('show');
    }));
  });

  // step-throughs: <div class="steps" data-steps> + [data-step-next]/[data-step-prev]
  $$('[data-steps]').forEach(wrap => {
    const steps = $$('.step', wrap);
    let i = 0;
    const paint = () => {
      steps.forEach((s, k) => s.classList.toggle('on', k <= i));
      const c = $('[data-step-count]', wrap.parentElement) || $('[data-step-count]', wrap);
      if (c) c.textContent = (i + 1) + ' / ' + steps.length;
    };
    const host = wrap.closest('figure, .plate, section') || document;
    const nx = $('[data-step-next]', host), pv = $('[data-step-prev]', host), rs = $('[data-step-reset]', host);
    if (nx) nx.addEventListener('click', () => { i = Math.min(i + 1, steps.length - 1); paint(); });
    if (pv) pv.addEventListener('click', () => { i = Math.max(i - 1, 0); paint(); });
    if (rs) rs.addEventListener('click', () => { i = 0; paint(); });
    paint();
  });
}
document.addEventListener('DOMContentLoaded', bootChrome);

/* ---------- number theory kit (used by several volumes) ----------------- */

/** Primes below n via a plain sieve. */
function primesTo(n) {
  const c = new Uint8Array(n + 1); const out = [];
  for (let i = 2; i <= n; i++) {
    if (!c[i]) { out.push(i); for (let j = i * i; j <= n; j += i) c[j] = 1; }
  }
  return out;
}
/** Smallest-prime-factor table — gives fast factorisation for m ≤ n. */
function spfTo(n) {
  const s = new Int32Array(n + 1);
  for (let i = 2; i <= n; i++) {
    if (!s[i]) for (let j = i; j <= n; j += i) if (!s[j]) s[j] = i;
  }
  return s;
}
function factor(m, spf) {
  const f = [];
  while (m > 1) { const p = spf[m]; let e = 0; while (m % p === 0) { m /= p; e++; } f.push([p, e]); }
  return f;
}
function mobius(n, spf) {
  if (n === 1) return 1;
  let s = 1;
  for (const [, e] of factor(n, spf)) { if (e > 1) return 0; s = -s; }
  return s;
}
function sigma(n, spf, k) {
  k = k === undefined ? 1 : k;
  let r = 1;
  for (const [p, e] of factor(n, spf)) {
    let t = 0; for (let i = 0; i <= e; i++) t += Math.pow(p, k * i);
    r *= t;
  }
  return r;
}

/* ---------- 2-D plotting kit -------------------------------------------- */

/**
 * A linear view mapping math coords -> canvas px.
 *   V = view(ctx.canvas, {xmin,xmax,ymin,ymax, pad})
 *   V.X(x) V.Y(y) V.ix(px) V.iy(py)
 */
function view(cv, b) {
  const w = cv._w, h = cv._h, p = b.pad || 0;
  const X = x => p + (x - b.xmin) / (b.xmax - b.xmin) * (w - 2 * p);
  const Y = y => h - p - (y - b.ymin) / (b.ymax - b.ymin) * (h - 2 * p);
  return {
    w, h, b, X, Y,
    ix: px => b.xmin + (px - p) / (w - 2 * p) * (b.xmax - b.xmin),
    iy: py => b.ymin + (h - p - py) / (h - 2 * p) * (b.ymax - b.ymin)
  };
}

/** Graph-paper grid + axes for a view. */
function grid(ctx, V, P, opt) {
  opt = opt || {};
  const { b, X, Y, w, h } = V;
  ctx.save();
  ctx.fillStyle = P.paper2; ctx.fillRect(0, 0, w, h);
  const stepFor = (span, target) => {
    const raw = span / target, e = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / e;
    return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * e;
  };
  const sx = opt.sx || stepFor(b.xmax - b.xmin, 8);
  const sy = opt.sy || stepFor(b.ymax - b.ymin, 6);
  ctx.lineWidth = 1;
  for (const [s, minor] of [[sx / 5, true], [sx, false]]) {
    ctx.strokeStyle = minor ? P.ruleSoft : P.rule;
    ctx.beginPath();
    for (let x = Math.ceil(b.xmin / s) * s; x <= b.xmax; x += s) {
      const px = Math.round(X(x)) + .5; ctx.moveTo(px, 0); ctx.lineTo(px, h);
    }
    ctx.stroke();
  }
  for (const [s, minor] of [[sy / 5, true], [sy, false]]) {
    ctx.strokeStyle = minor ? P.ruleSoft : P.rule;
    ctx.beginPath();
    for (let y = Math.ceil(b.ymin / s) * s; y <= b.ymax; y += s) {
      const py = Math.round(Y(y)) + .5; ctx.moveTo(0, py); ctx.lineTo(w, py);
    }
    ctx.stroke();
  }
  ctx.strokeStyle = P.ink3; ctx.lineWidth = 1.2; ctx.beginPath();
  if (b.ymin < 0 && b.ymax > 0) { ctx.moveTo(0, Y(0)); ctx.lineTo(w, Y(0)); }
  if (b.xmin < 0 && b.xmax > 0) { ctx.moveTo(X(0), 0); ctx.lineTo(X(0), h); }
  ctx.stroke();
  if (opt.labels !== false) {
    ctx.fillStyle = P.ink4; ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const y0 = (b.ymin < 0 && b.ymax > 0) ? Y(0) : h - 14;
    for (let x = Math.ceil(b.xmin / sx) * sx; x <= b.xmax; x += sx) {
      if (Math.abs(x) < 1e-9) continue;
      ctx.fillText(String(+x.toPrecision(4)), X(x), y0 + 4);
    }
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    const x0 = (b.xmin < 0 && b.xmax > 0) ? X(0) - 5 : w - 5;
    for (let y = Math.ceil(b.ymin / sy) * sy; y <= b.ymax; y += sy) {
      if (Math.abs(y) < 1e-9) continue;
      ctx.fillText(String(+y.toPrecision(4)), x0, Y(y));
    }
  }
  ctx.restore();
}

/** Plot y = f(x) across the view, skipping non-finite / huge values. */
function plot(ctx, V, f, color, width) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = width || 2;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath();
  let pen = false;
  for (let px = 0; px <= V.w; px++) {
    const x = V.ix(px), y = f(x);
    if (!isFinite(y) || Math.abs(y) > 1e7) { pen = false; continue; }
    const py = V.Y(y);
    if (py < -2000 || py > V.h + 2000) { pen = false; continue; }
    pen ? ctx.lineTo(px, py) : ctx.moveTo(px, py); pen = true;
  }
  ctx.stroke(); ctx.restore();
}

function dot(ctx, x, y, r, fill, stroke, sw) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = sw || 2; ctx.stroke(); }
}
function label(ctx, txt, x, y, color, font, align, baseline) {
  ctx.save();
  ctx.fillStyle = color; ctx.font = font || '11px ui-monospace, monospace';
  ctx.textAlign = align || 'left'; ctx.textBaseline = baseline || 'alphabetic';
  ctx.fillText(txt, x, y); ctx.restore();
}
