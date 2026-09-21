/* ============================================================
   VOL. II — SIEVE THEORY · interactive figures
   Depends on notes.js (fit, scene, view, drag, pal, primesTo…)
   ============================================================ */
(function () {
'use strict';

const GAMMA = 0.5772156649015329;
const C2 = 0.66016181584686957;          // twin prime constant
const SMALL = primesTo(4096);            // enough for every "sift by small p" figure

/* ---------------------------------------------------------------
   0.  The big sieve — built once, on demand.
   --------------------------------------------------------------- */
const BIG = { N: 2000000, ready: false, chk: [] };
function buildBig() {
  if (BIG.ready) return BIG;
  const N = BIG.N;
  /* Ω(n) counted in place: when we reach p with Ω still 0, p is prime. */
  const OM = new Uint8Array(N + 1);
  const pr = [];
  for (let p = 2; p <= N; p++) {
    if (OM[p] !== 0) continue;
    pr.push(p);
    for (let q = p; ; q *= p) {
      for (let m = q; m <= N; m += q) OM[m]++;
      if (q > N / p) break;
    }
  }
  BIG.OM = OM; BIG.pr = pr;
  const isP = new Uint8Array(N + 3);
  for (const p of pr) isP[p] = 1;

  /* Checkpoints: 240 log-spaced values of x, each carrying every running total. */
  const M = 240, xs = [];
  for (let i = 0; i < M; i++) xs.push(Math.round(Math.exp(Math.log(1000) + i / (M - 1) * (Math.log(N) - Math.log(1000)))));
  const chk = xs.map(x => ({ x, pi: 0, pi2: 0, s1: 0, B: 0, L: 0, d: new Float64Array(13) }));

  let k = 0, pi = 0, pi2 = 0, s1 = 0, B = 0;
  for (const p of pr) {
    while (k < M && p > chk[k].x) { Object.assign(chk[k], { pi, pi2, s1, B }); k++; }
    pi++; s1 += 1 / p;
    if (p + 2 <= N && isP[p + 2]) { pi2++; B += 1 / p + 1 / (p + 2); }
  }
  while (k < M) { Object.assign(chk[k], { pi, pi2, s1, B }); k++; }

  /* Liouville: L(x) overall, plus the per-residue-class bias Σ_{n≤x, d|n} λ(n). */
  for (let d = 1; d <= 12; d++) {
    let acc = 0, j = 0;
    for (let n = d; n <= N; n += d) {
      while (j < M && n > chk[j].x) { chk[j].d[d] = acc; j++; }
      acc += (OM[n] & 1) ? -1 : 1;
    }
    while (j < M) { chk[j].d[d] = acc; j++; }
  }
  for (const c of chk) c.L = c.d[1];
  BIG.chk = chk; BIG.ready = true;
  return BIG;
}
const atX = x => { const c = BIG.chk; let lo = 0, hi = c.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; c[m].x < x ? lo = m + 1 : hi = m; } return c[lo]; };
const grp = n => n.toLocaleString('en-US');

/** Run `fn` once the plate is on screen, showing a note while the sieve builds. */
function whenVisible(el, fn) {
  new IntersectionObserver((es, o) => {
    if (!es[0].isIntersecting) return;
    o.disconnect();
    setTimeout(() => { buildBig(); fn(); }, 0);
  }, { rootMargin: '400px' }).observe(el);
}

/* ---------------------------------------------------------------
   FIG 1 — Eratosthenes, animated
   --------------------------------------------------------------- */
(function fig1() {
  const cv = document.getElementById('eraCanvas'); if (!cv) return;
  const N = 900, COLS = 36, ROWS = N / COLS;
  const SIFT = SMALL.filter(p => p * p <= N);          // 2,3,5,7,11,13,17,19,23,29
  let st, speed = 1, playing = false, last = 0;
  const reset = () => { st = { mark: new Uint8Array(N + 1), pi: -1, cur: 0, done: false }; };
  reset();

  function advance() {
    if (st.done) return;
    if (st.pi < 0 || st.cur > N) {
      st.pi++;
      if (st.pi >= SIFT.length) { st.done = true; playing = false; return; }
      st.cur = 2 * SIFT[st.pi];
      return;
    }
    st.mark[st.cur] = 1;
    st.cur += SIFT[st.pi];
  }

  const S = scene(cv, {
    aspect: 36 / 27,
    draw(ctx, P, t) {
      if (playing && t - last > 0.035 / speed) { last = t; for (let i = 0; i < Math.max(1, speed * 2); i++) advance(); }
      const w = cv._w, h = cv._h, pad = 6;
      const cw = (w - 2 * pad) / COLS, ch = (h - 2 * pad) / ROWS;
      ctx.fillStyle = P.paper2; ctx.fillRect(0, 0, w, h);
      const p = st.pi >= 0 && !st.done ? SIFT[st.pi] : (st.done ? SIFT[SIFT.length - 1] : 0);
      const isSifter = n => st.pi >= 0 && SIFT.slice(0, st.pi + 1).indexOf(n) >= 0;
      ctx.font = Math.min(10, ch * 0.5) + 'px ui-monospace, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let n = 1; n <= N; n++) {
        const c = (n - 1) % COLS, r = ((n - 1) / COLS) | 0;
        const x = pad + c * cw, y = pad + r * ch;
        const dead = st.mark[n] === 1 || n === 1;
        const live = !dead;
        if (n === st.cur && playing) { ctx.fillStyle = P.acc; ctx.fillRect(x, y, cw - 1, ch - 1); }
        else if (isSifter(n)) { ctx.fillStyle = P.acc2; ctx.globalAlpha = .35; ctx.fillRect(x, y, cw - 1, ch - 1); ctx.globalAlpha = 1; }
        else if (live) { ctx.fillStyle = P.paper3; ctx.fillRect(x, y, cw - 1, ch - 1); }
        if (cw > 11) {
          ctx.fillStyle = dead ? P.ink4 : (n === st.cur && playing ? P.paper2 : P.ink);
          ctx.globalAlpha = dead ? .35 : 1;
          ctx.fillText(n, x + cw / 2, y + ch / 2);
          ctx.globalAlpha = 1;
        } else if (dead) { ctx.fillStyle = P.rule; ctx.fillRect(x + 1, y + 1, cw - 3, ch - 3); }
      }
      let surv = 0; for (let n = 1; n <= N; n++) if (!st.mark[n]) surv++;
      let prod = 1; for (let i = 0; i <= st.pi && i < SIFT.length; i++) prod *= (1 - 1 / SIFT[i]);
      document.getElementById('era-z').textContent = st.pi < 0 ? 'not started' : (st.done ? 'done (p ≤ 29)' : 'p = ' + p);
      document.getElementById('era-surv').textContent = grp(surv);
      document.getElementById('era-pred').textContent = (N * prod).toFixed(1);
      const rr = document.getElementById('era-ratio');
      rr.textContent = st.pi < 0 ? '—' : (N * prod / surv).toFixed(4);
      rr.style.color = st.pi < 0 ? css('--ink') : css('--acc-2');
    }
  });
  document.getElementById('era-play').addEventListener('click', e => {
    if (st.done) reset();
    playing = !playing; e.target.textContent = playing ? '❙❙ Pause' : '▶ Sift'; S.kick();
  });
  document.getElementById('era-reset').addEventListener('click', () => {
    reset(); playing = false; document.getElementById('era-play').textContent = '▶ Sift'; S.kick();
  });
  document.getElementById('era-s').addEventListener('input', e => {
    speed = +e.target.value; document.getElementById('era-sv').textContent = speed.toFixed(2) + '×';
  });
})();

/* ---------------------------------------------------------------
   FIG 2 — the Legendre catastrophe
   --------------------------------------------------------------- */
(function fig2() {
  const cv = document.getElementById('legCanvas'); if (!cv) return;
  const PZ = SMALL.filter(p => p <= 640);
  let ex = 6, z = 30;

  /* log10 of the main term x·∏_{p<z}(1−1/p), and of the error budget 2^{π(z)}. */
  const logMain = (ex, z) => { let s = ex; for (const p of PZ) { if (p >= z) break; s += Math.log10(1 - 1 / p); } return s; };
  const piOf = z => { let c = 0; for (const p of PZ) { if (p >= z) break; c++; } return c; };
  const logErr = z => piOf(z) * Math.log10(2);

  const S = scene(cv, {
    aspect: 2.5, still: true,
    draw(ctx, P) {
      const w = cv._w, h = cv._h, padL = 46, padB = 24, padT = 12, padR = 10;
      ctx.fillStyle = P.paper2; ctx.fillRect(0, 0, w, h);
      const zmax = 620;
      const yhi = Math.max(ex + 1, logErr(zmax) * 0.55), ylo = Math.min(0, logMain(ex, zmax) - 1);
      const X = zz => padL + (zz - 2) / (zmax - 2) * (w - padL - padR);
      const Y = v => h - padB - (v - ylo) / (yhi - ylo) * (h - padT - padB);
      ctx.strokeStyle = P.ruleSoft; ctx.lineWidth = 1; ctx.beginPath();
      for (let v = Math.ceil(ylo / 5) * 5; v <= yhi; v += 5) { const py = Math.round(Y(v)) + .5; ctx.moveTo(padL, py); ctx.lineTo(w - padR, py); }
      ctx.stroke();
      ctx.fillStyle = P.ink4; ctx.font = '9px ui-monospace, monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (let v = Math.ceil(ylo / 5) * 5; v <= yhi; v += 5) ctx.fillText('10^' + v, padL - 5, Y(v));
      const line = (f, color, wd) => {
        ctx.beginPath();
        for (let zz = 2; zz <= zmax; zz++) { const py = Y(f(zz)); zz === 2 ? ctx.moveTo(X(zz), py) : ctx.lineTo(X(zz), py); }
        ctx.strokeStyle = color; ctx.lineWidth = wd; ctx.lineJoin = 'round'; ctx.stroke();
      };
      line(zz => logErr(zz), P.bad, 2);
      line(zz => logMain(ex, zz), P.acc, 2.2);
      // crossing
      let cross = null;
      for (let zz = 2; zz <= zmax; zz++) if (logErr(zz) > logMain(ex, zz)) { cross = zz; break; }
      if (cross) {
        ctx.strokeStyle = P.ink3; ctx.setLineDash([3, 4]); ctx.beginPath();
        ctx.moveTo(X(cross), padT); ctx.lineTo(X(cross), h - padB); ctx.stroke(); ctx.setLineDash([]);
        label(ctx, 'useless beyond z ≈ ' + cross, X(cross) + 5, padT + 10, P.ink3);
      }
      // current z
      ctx.strokeStyle = P.acc2; ctx.lineWidth = 1.6; ctx.beginPath();
      ctx.moveTo(X(z), padT); ctx.lineTo(X(z), h - padB); ctx.stroke();
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = P.ink4;
      for (let zz = 100; zz <= zmax; zz += 100) ctx.fillText(String(zz), X(zz), h - padB + 5);
      label(ctx, 'error budget  2^π(z)', w - padR - 4, padT + 8, P.bad, '10px ui-monospace, monospace', 'right');
      label(ctx, 'main term  x·∏(1−1/p)', w - padR - 4, padT + 21, P.acc, '10px ui-monospace, monospace', 'right');
      label(ctx, 'z →', X(zmax) - 10, h - 4, P.ink4, '9px ui-monospace, monospace', 'right');

      const lm = logMain(ex, z), le = logErr(z);
      document.getElementById('leg-pz').textContent = piOf(z);
      document.getElementById('leg-main').textContent = '10^' + lm.toFixed(2);
      document.getElementById('leg-err').textContent = '10^' + le.toFixed(2);
      const ok = document.getElementById('leg-ok');
      ok.textContent = le < lm ? 'yes — error < main' : 'NO — error swamps it';
      ok.style.color = le < lm ? css('--ok') : css('--bad');
      document.getElementById('leg-zmax').textContent = cross ? '≈ ' + cross : '> ' + zmax;
      document.getElementById('leg-want').textContent = '10^' + (ex / 2).toFixed(1);
    }
  });
  document.getElementById('leg-x').addEventListener('input', e => {
    ex = +e.target.value; document.getElementById('leg-xv').textContent = ex; S.redraw();
  });
  document.getElementById('leg-z').addEventListener('input', e => {
    z = +e.target.value; document.getElementById('leg-zv').textContent = z; S.redraw();
  });
})();

/* ---------------------------------------------------------------
   FIG 3 — the Bonferroni sandwich
   --------------------------------------------------------------- */
(function fig3() {
  const cv = document.getElementById('bonCanvas'); if (!cv) return;
  let x = 100000, z = 30, m = 3, T = [], full = 0, nterms = [];

  /** Σ_{d|P(z)} μ(d)⌊x/d⌋ split by ω(d).  Divisors above x contribute nothing, so prune. */
  function compute() {
    const ps = SMALL.filter(p => p < z);
    T = new Array(ps.length + 1).fill(0);
    nterms = new Array(ps.length + 1).fill(0);
    (function dfs(i, d, w) {
      T[w] += (w & 1 ? -1 : 1) * Math.floor(x / d);
      nterms[w]++;
      for (let j = i; j < ps.length; j++) {
        const nd = d * ps[j];
        if (nd > x) break;                       // ⌊x/nd⌋ = 0 from here on
        dfs(j + 1, nd, w + 1);
      }
    })(0, 1, 0);
    full = T.reduce((a, b) => a + b, 0);
    return ps.length;
  }

  const S = scene(cv, {
    aspect: 2.6, still: true,
    draw(ctx, P) {
      const K = compute();
      const w = cv._w, h = cv._h, padL = 52, padB = 22, padT = 12, padR = 10;
      ctx.fillStyle = P.paper2; ctx.fillRect(0, 0, w, h);
      const part = []; let acc = 0;
      for (let j = 0; j <= K; j++) { acc += T[j]; part.push(acc); }
      const vals = part.map(v => Math.sign(v) * Math.log10(1 + Math.abs(v)));
      const trueV = Math.sign(full) * Math.log10(1 + Math.abs(full));
      let lo = Math.min(0, ...vals), hi = Math.max(0, ...vals, trueV);
      const pad = (hi - lo) * 0.08 || 1; lo -= pad; hi += pad;
      const X = j => padL + (j + .5) / (K + 1) * (w - padL - padR);
      const Y = v => h - padB - (v - lo) / (hi - lo) * (h - padT - padB);
      ctx.strokeStyle = P.rule; ctx.beginPath(); ctx.moveTo(padL, Y(0) + .5); ctx.lineTo(w - padR, Y(0) + .5); ctx.stroke();
      const bw = Math.max(3, (w - padL - padR) / (K + 1) - 4);
      vals.forEach((v, j) => {
        const y = Y(v), y0 = Y(trueV);
        ctx.fillStyle = j === m ? P.acc : (j % 2 ? P.acc2 : P.ink3);
        ctx.globalAlpha = j === m ? 1 : .40;
        ctx.fillRect(X(j) - bw / 2, Math.min(y, y0), bw, Math.max(1.5, Math.abs(y - y0)));
        ctx.globalAlpha = 1;
        if (j % Math.ceil((K + 1) / 12) === 0) label(ctx, String(j), X(j), h - 6, P.ink4, '9px ui-monospace, monospace', 'center');
      });
      ctx.strokeStyle = P.ink; ctx.lineWidth = 1.6; ctx.setLineDash([5, 3]); ctx.beginPath();
      ctx.moveTo(padL, Y(trueV)); ctx.lineTo(w - padR, Y(trueV)); ctx.stroke(); ctx.setLineDash([]);
      label(ctx, 'true S(x,z)', w - padR - 4, Y(trueV) - 6, P.ink, '10px ui-monospace, monospace', 'right');
      label(ctx, 'signed log₁₀ of  T_m − S   (bars above the line = over-count)', padL + 4, padT + 8, P.ink4, '9px ui-monospace, monospace');
      label(ctx, 'm →', w - padR - 4, h - 6, P.ink4, '9px ui-monospace, monospace', 'right');

      const mm = Math.min(m, K), Tm = part[mm];
      const used = nterms.slice(0, mm + 1).reduce((a, b) => a + b, 0);
      document.getElementById('bon-true').textContent = grp(full);
      const e = document.getElementById('bon-tm'); e.textContent = grp(Tm);
      const isUp = mm % 2 === 0;
      e.style.color = (isUp ? Tm >= full : Tm <= full) ? css('--ok') : css('--bad');
      document.getElementById('bon-type').textContent = isUp ? 'm even → upper' : 'm odd → lower';
      document.getElementById('bon-terms').textContent = grp(used);
      document.getElementById('bon-full').textContent = '2^' + K + ' = ' + grp(Math.pow(2, K));
      const sl = document.getElementById('bon-slack');
      sl.textContent = full ? ((Tm - full) / Math.abs(full) * 100).toFixed(1) + ' %' : '—';
      sl.style.color = Math.abs((Tm - full) / (full || 1)) < 0.05 ? css('--ok') : css('--warn');
    }
  });
  const bind = (id, lbl, set, fmtv) => document.getElementById(id).addEventListener('input', e => {
    set(+e.target.value); document.getElementById(lbl).textContent = fmtv(+e.target.value); S.redraw();
  });
  bind('bon-x', 'bon-xv', v => x = v, grp);
  bind('bon-z', 'bon-zv', v => z = v, String);
  bind('bon-m', 'bon-mv', v => m = v, String);
})();

/* ---------------------------------------------------------------
   FIG 4 — Brun's constant vs Σ 1/p
   --------------------------------------------------------------- */
(function fig4() {
  const cv = document.getElementById('brunCanvas'); if (!cv) return;
  let x = 2000000;
  const li2 = X => { let s = 0; const n = 4000, h = (X - 2) / n; for (let i = 1; i <= n; i++) { const t = 2 + (i - .5) * h; s += h / (Math.log(t) ** 2); } return s; };

  const S = scene(cv, {
    aspect: 2.5, still: true,
    draw(ctx, P) {
      if (!BIG.ready) { ctx.fillStyle = P.paper2; ctx.fillRect(0, 0, cv._w, cv._h); label(ctx, 'sieving to 2 000 000…', 14, 22, P.acc); return; }
      const w = cv._w, h = cv._h, padL = 44, padB = 24, padT = 12, padR = 46;
      ctx.fillStyle = P.paper2; ctx.fillRect(0, 0, w, h);
      const c = BIG.chk, lx0 = Math.log10(c[0].x), lx1 = Math.log10(BIG.N);
      const X = xx => padL + (Math.log10(xx) - lx0) / (lx1 - lx0) * (w - padL - padR);
      const Y = v => h - padB - v / 3.2 * (h - padT - padB);
      ctx.strokeStyle = P.ruleSoft; ctx.beginPath();
      for (let v = 0.5; v <= 3; v += 0.5) { const py = Math.round(Y(v)) + .5; ctx.moveTo(padL, py); ctx.lineTo(w - padR, py); }
      ctx.stroke();
      ctx.fillStyle = P.ink4; ctx.font = '9px ui-monospace, monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (let v = 0.5; v <= 3; v += 0.5) ctx.fillText(v.toFixed(1), padL - 5, Y(v));
      const curve = (get, col) => {
        ctx.beginPath();
        c.forEach((p, i) => { const px = X(p.x), py = Y(get(p)); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
        ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.stroke();
      };
      curve(p => p.s1, P.acc);
      curve(p => p.B, P.acc2);
      // Brun's constant, the true value
      ctx.strokeStyle = P.ink3; ctx.setLineDash([4, 4]); ctx.beginPath();
      ctx.moveTo(padL, Y(1.90216)); ctx.lineTo(w - padR, Y(1.90216)); ctx.stroke(); ctx.setLineDash([]);
      label(ctx, 'B = 1.9022', w - padR + 4, Y(1.90216), P.ink3, '9px ui-monospace, monospace', 'left', 'middle');
      const cur = atX(x);
      ctx.strokeStyle = P.ink; ctx.lineWidth = 1; ctx.beginPath();
      ctx.moveTo(X(cur.x), padT); ctx.lineTo(X(cur.x), h - padB); ctx.stroke();
      dot(ctx, X(cur.x), Y(cur.s1), 4, P.acc); dot(ctx, X(cur.x), Y(cur.B), 4, P.acc2);
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (let e = 3; e <= 6; e++) { ctx.fillStyle = P.ink4; ctx.fillText('10^' + e, X(Math.pow(10, e)), h - padB + 5); }
      label(ctx, 'Σ 1/p  — diverges (∼ log log x)', padL + 6, padT + 10, P.acc, '10px ui-monospace, monospace');
      label(ctx, 'Σ over twins — converges', padL + 6, padT + 24, P.acc2, '10px ui-monospace, monospace');

      const hl = 2 * C2 * li2(cur.x);
      document.getElementById('brun-pi').textContent = grp(cur.pi);
      document.getElementById('brun-s1').textContent = cur.s1.toFixed(5);
      document.getElementById('brun-pi2').textContent = grp(cur.pi2);
      document.getElementById('brun-B').textContent = cur.B.toFixed(5);
      document.getElementById('brun-hl').textContent = hl.toFixed(0);
      const r = document.getElementById('brun-r');
      r.textContent = (cur.pi2 / hl).toFixed(4);
      r.style.color = Math.abs(cur.pi2 / hl - 1) < 0.05 ? css('--ok') : css('--warn');
    }
  });
  document.getElementById('brun-x').addEventListener('input', e => {
    x = +e.target.value; document.getElementById('brun-xv').textContent = grp(x); if (BIG.ready) S.redraw();
  });
  whenVisible(cv, () => S.redraw());
})();

/* ---------------------------------------------------------------
   FIG 5 — be Selberg
   --------------------------------------------------------------- */
(function fig5() {
  const host = document.getElementById('sel-lams'); if (!host) return;
  const DIVS = [1, 2, 3, 5, 6, 10, 15, 30];
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  const M = (a, b) => 1 / (a / gcd(a, b) * b);
  let D = 6, lam = {};
  DIVS.forEach(d => lam[d] = d === 1 ? 1 : 0);

  const active = () => DIVS.filter(d => d <= D);
  const Q = () => { const V = active(); let s = 0; for (const a of V) for (const b of V) s += lam[a] * lam[b] * M(a, b); return s; };
  const G = () => active().reduce((s, d) => s + [2, 3, 5].filter(p => d % p === 0).reduce((t, p) => t * (1 / p) / (1 - 1 / p), 1), 0);

  /** Exact minimiser: solve the normal equations for the free λ's. */
  function optimum() {
    const V = active(), n = V.length;
    if (n === 1) return { 1: 1 };
    const A = [], b = [];
    for (let i = 1; i < n; i++) { const row = []; for (let j = 1; j < n; j++) row.push(M(V[i], V[j])); A.push(row); b.push(-M(V[i], V[0])); }
    const m = n - 1;
    for (let c = 0; c < m; c++) {
      let p = c; for (let r = c + 1; r < m; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
      for (let r = 0; r < m; r++) { if (r === c) continue; const f = A[r][c] / A[c][c]; for (let k = c; k < m; k++) A[r][k] -= f * A[c][k]; b[r] -= f * b[c]; }
    }
    const out = { 1: 1 };
    for (let i = 0; i < m; i++) out[V[i + 1]] = b[i] / A[i][i];
    return out;
  }

  function buildSliders() {
    host.innerHTML = DIVS.map(d => d === 1
      ? `<label><span>λ₁ <span class="v">= 1 (fixed)</span></span><input type="range" disabled value="100" min="-150" max="150"></label>`
      : `<label data-d="${d}" class="${d > D ? 'off' : ''}"><span>λ<sub>${d}</sub> <span class="v" id="lv${d}">0.000</span></span>
         <input type="range" id="ls${d}" min="-150" max="150" step="1" value="0" ${d > D ? 'disabled' : ''}></label>`
    ).join('');
    DIVS.filter(d => d > 1).forEach(d => document.getElementById('ls' + d).addEventListener('input', e => {
      lam[d] = +e.target.value / 100; paint();
    }));
  }
  function push() {
    DIVS.filter(d => d > 1).forEach(d => { const s = document.getElementById('ls' + d); if (s) s.value = Math.round(lam[d] * 100); });
  }
  function paint() {
    DIVS.filter(d => d > 1).forEach(d => { const e = document.getElementById('lv' + d); if (e) e.textContent = (d > D ? 0 : lam[d]).toFixed(3); });
    const q = Q(), g = G(), o = 1 / g;
    document.getElementById('sel-q').textContent = q.toFixed(6);
    document.getElementById('sel-o').textContent = o.toFixed(6);
    document.getElementById('sel-g').textContent = g.toFixed(5);
    const loss = document.getElementById('sel-loss');
    loss.textContent = ((q / o - 1) * 100).toFixed(2) + ' %';
    loss.style.color = q / o < 1.0005 ? css('--ok') : q / o < 1.2 ? css('--warn') : css('--bad');
    const scale = 1.05;
    document.getElementById('sel-fill').style.width = clamp(q / scale, 0, 1) * 100 + '%';
    document.getElementById('sel-opt').style.left = clamp(o / scale, 0, 1) * 100 + '%';
    document.getElementById('sel-lab').textContent = 'Q = ' + q.toFixed(4) + '   ·   optimum ' + o.toFixed(4);
    document.getElementById('sel-note').innerHTML =
      D === 30 && Math.abs(q - 4 / 15) < 1e-9
        ? '<strong style="color:' + css('--ok') + '">Exactly the true density.</strong> At full level the optimal λ is the Möbius function and the square becomes an equality — Selberg\'s sieve degenerates into inclusion–exclusion, losing nothing at all. <em>Every</em> loss in a real application is the price of the restriction d ≤ D.'
        : 'Level D = ' + D + ' allows the divisors {' + active().join(', ') + '}. The optimum Q = 1/G(D) = ' + o.toFixed(5) +
          ' is an upper bound for the density of integers coprime to 30, whose true value is 0.266667. Slack here: ' + ((o / (4 / 15) - 1) * 100).toFixed(1) +
          ' % — <strong>and that slack is caused entirely by the level, not by the sieve</strong>.';
  }
  document.getElementById('sel-D').addEventListener('change', e => {
    D = +e.target.value; DIVS.forEach(d => { if (d > D) lam[d] = 0; }); buildSliders(); push(); paint();
  });
  document.getElementById('sel-solve').addEventListener('click', () => { Object.assign(lam, optimum()); push(); paint(); });
  document.getElementById('sel-mu').addEventListener('click', () => {
    DIVS.forEach(d => lam[d] = d > D ? 0 : mobius(d, spfTo(31)));
    push(); paint();
  });
  document.getElementById('sel-zero').addEventListener('click', () => { DIVS.forEach(d => lam[d] = d === 1 ? 1 : 0); push(); paint(); });
  buildSliders(); paint();
})();

/* ---------------------------------------------------------------
   FIG 6 — the parity problem, numerically
   --------------------------------------------------------------- */
(function fig6() {
  const cv = document.getElementById('parCanvas'); if (!cv) return;
  let x = 1000000;

  const S = scene(cv, {
    aspect: 3.0, still: true,
    draw(ctx, P) {
      if (!BIG.ready) { ctx.fillStyle = P.paper2; ctx.fillRect(0, 0, cv._w, cv._h); label(ctx, 'computing Ω(n) to 2 000 000…', 14, 22, P.acc); return; }
      const w = cv._w, h = cv._h, padL = 52, padB = 22, padT = 12, padR = 10;
      ctx.fillStyle = P.paper2; ctx.fillRect(0, 0, w, h);
      const c = BIG.chk;
      let mx = 0; c.forEach(p => mx = Math.max(mx, Math.abs(p.L)));
      mx = Math.max(mx, Math.sqrt(BIG.N)) * 1.15;
      const X = xx => padL + xx / BIG.N * (w - padL - padR);
      const Y = v => padT + (1 - (v + mx) / (2 * mx)) * (h - padT - padB);
      ctx.strokeStyle = P.rule; ctx.beginPath(); ctx.moveTo(padL, Y(0) + .5); ctx.lineTo(w - padR, Y(0) + .5); ctx.stroke();
      // the ±√x envelope, for scale
      ctx.strokeStyle = P.ruleSoft; ctx.setLineDash([3, 3]);
      [1, -1].forEach(s => { ctx.beginPath(); for (let i = 0; i <= 200; i++) { const xx = i / 200 * BIG.N; const py = Y(s * Math.sqrt(xx)); i ? ctx.lineTo(X(xx), py) : ctx.moveTo(X(xx), py); } ctx.stroke(); });
      ctx.setLineDash([]);
      ctx.beginPath();
      c.forEach((p, i) => { const px = X(p.x), py = Y(p.L); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
      ctx.strokeStyle = P.acc; ctx.lineWidth = 2; ctx.stroke();
      const cur = atX(x);
      dot(ctx, X(cur.x), Y(cur.L), 4.5, P.acc2);
      label(ctx, 'L(x) = Σ λ(n)   — the entire bias between the two sets', padL + 6, padT + 10, P.ink4, '9px ui-monospace, monospace');
      label(ctx, '±√x', X(BIG.N) - 8, Y(Math.sqrt(BIG.N)) - 6, P.ink4, '9px ui-monospace, monospace', 'right');
      label(ctx, 'x →', w - padR - 4, h - 6, P.ink4, '9px ui-monospace, monospace', 'right');
      ctx.fillStyle = P.ink4; ctx.font = '9px ui-monospace, monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText('+' + Math.round(mx), padL - 5, Y(mx * 0.96));
      ctx.fillText('0', padL - 5, Y(0));
      ctx.fillText('−' + Math.round(mx), padL - 5, Y(-mx * 0.96));

      let rows = '<tr><th>d</th><th>|A⁺_d| (Ω even)</th><th>|A⁻_d| (Ω odd)</th><th>x/2d</th><th>bias</th><th>bias ÷ (x/d)</th></tr>';
      for (let d = 1; d <= 8; d++) {
        const tot = Math.floor(cur.x / d), bias = cur.d[d];
        const plus = (tot + bias) / 2, minus = (tot - bias) / 2;
        rows += `<tr><td>${d}</td><td>${grp(Math.round(plus))}</td><td>${grp(Math.round(minus))}</td><td>${grp(Math.round(tot / 2))}</td>` +
          `<td>${grp(bias)}</td><td style="color:${css('--ok')}">${(Math.abs(bias) / tot).toExponential(1)}</td></tr>`;
      }
      document.getElementById('par-table').innerHTML = rows;
      const sifted = cur.pi - atX(Math.sqrt(cur.x)).pi;
      document.getElementById('par-verdict').innerHTML =
        `At x = ${grp(cur.x)} the two sets agree in every residue class to within a relative error of about ` +
        `<strong>${(Math.abs(cur.L) / cur.x).toExponential(1)}</strong>. A sieve sees only those counts, so it must return the <em>same</em> answer for both. ` +
        `Yet sifting by all primes up to √x leaves <strong style="color:${css('--bad')}">0</strong> elements of A⁺ ` +
        `(a product of two primes both exceeding √x would exceed x) and <strong style="color:${css('--ok')}">${grp(sifted)}</strong> elements of A⁻ — every prime in (√x, x]. ` +
        `<br><br>Therefore any correct lower bound this method can output is <strong>≤ 0</strong>, and any correct upper bound is <strong>≥ ${grp(sifted)}</strong>. ` +
        `The factor-of-two slack in every sieve upper bound is not sloppiness; it is exactly this.`;
    }
  });
  document.getElementById('par-x').addEventListener('input', e => {
    x = +e.target.value; document.getElementById('par-xv').textContent = grp(x); if (BIG.ready) S.redraw();
  });
  whenVisible(cv, () => S.redraw());
})();

/* ---------------------------------------------------------------
   FIG 7 — the linear sieve functions F and f
   --------------------------------------------------------------- */
(function fig7() {
  const cv = document.getElementById('fflCanvas'); if (!cv) return;
  const H = 0.01, SMAXX = 12, NPT = Math.round((SMAXX - 1) / H) + 1, STEP = Math.round(1 / H);
  const K = 2 * Math.exp(GAMMA);
  const Fa = new Float64Array(NPT), fa = new Float64Array(NPT);
  const sOf = i => 1 + i * H;
  (function build() {
    for (let i = 0; i < NPT; i++) {
      const s = sOf(i);
      if (s <= 3) Fa[i] = K / s;
      if (s <= 2) fa[i] = 0; else if (s <= 4) fa[i] = K * Math.log(s - 1) / s;
    }
    // continue by (sF)' = f(s−1), (sf)' = F(s−1)
    let accF = 3 * (K / 3), accf = 4 * (K * Math.log(3) / 4);
    for (let i = Math.round(2 / H) + 1; i < NPT; i++) {
      const s = sOf(i);
      if (s > 3) { accF += H * (fa[i - STEP] + fa[i - 1 - STEP]) / 2; Fa[i] = accF / s; }
      if (s > 4) { accf += H * (Fa[i - STEP] + Fa[i - 1 - STEP]) / 2; fa[i] = accf / s; }
    }
  })();
  const at = (a, s) => a[clamp(Math.round((s - 1) / H), 0, NPT - 1)];
  let s = 3;

  const S = scene(cv, {
    aspect: 2.5, still: true,
    draw(ctx, P) {
      const w = cv._w, h = cv._h, padL = 40, padB = 24, padT = 12, padR = 10;
      ctx.fillStyle = P.paper2; ctx.fillRect(0, 0, w, h);
      const ylo = -0.15, yhi = 3.8;
      const X = ss => padL + (ss - 1) / (SMAXX - 1) * (w - padL - padR);
      const Y = v => h - padB - (v - ylo) / (yhi - ylo) * (h - padT - padB);
      ctx.strokeStyle = P.ruleSoft; ctx.beginPath();
      for (let v = 0; v <= 3.5; v += 0.5) { const py = Math.round(Y(v)) + .5; ctx.moveTo(padL, py); ctx.lineTo(w - padR, py); }
      ctx.stroke();
      ctx.fillStyle = P.ink4; ctx.font = '9px ui-monospace, monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (let v = 0; v <= 3.5; v += 0.5) ctx.fillText(v.toFixed(1), padL - 5, Y(v));
      // the line at 1 — where both functions are heading
      ctx.strokeStyle = P.ink3; ctx.setLineDash([4, 4]); ctx.beginPath();
      ctx.moveTo(padL, Y(1)); ctx.lineTo(w - padR, Y(1)); ctx.stroke(); ctx.setLineDash([]);
      const curve = (a, col) => {
        ctx.beginPath();
        for (let i = 0; i < NPT; i++) { const px = X(sOf(i)), py = Y(a[i]); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
        ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.stroke();
      };
      curve(Fa, P.acc); curve(fa, P.acc2);
      // the s = 2 threshold
      ctx.strokeStyle = P.bad; ctx.setLineDash([3, 3]); ctx.lineWidth = 1.4; ctx.beginPath();
      ctx.moveTo(X(2), padT); ctx.lineTo(X(2), h - padB); ctx.stroke(); ctx.setLineDash([]);
      label(ctx, 's = 2: lower bounds switch on', X(2) + 6, padT + 12, P.bad);
      ctx.fillStyle = P.bad; ctx.globalAlpha = .07; ctx.fillRect(padL, padT, X(2) - padL, h - padT - padB); ctx.globalAlpha = 1;
      ctx.strokeStyle = P.ink; ctx.lineWidth = 1; ctx.beginPath();
      ctx.moveTo(X(s), padT); ctx.lineTo(X(s), h - padB); ctx.stroke();
      dot(ctx, X(s), Y(at(Fa, s)), 4, P.acc); dot(ctx, X(s), Y(at(fa, s)), 4, P.acc2);
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = P.ink4;
      for (let ss = 2; ss <= SMAXX; ss += 2) ctx.fillText(String(ss), X(ss), h - padB + 5);
      label(ctx, 'F(s) — upper', w - padR - 4, padT + 8, P.acc, '10px ui-monospace, monospace', 'right');
      label(ctx, 'f(s) — lower', w - padR - 4, padT + 21, P.acc2, '10px ui-monospace, monospace', 'right');
      label(ctx, 's = log D / log z →', w - padR - 4, h - 6, P.ink4, '9px ui-monospace, monospace', 'right');

      const Fv = at(Fa, s), fv = at(fa, s);
      document.getElementById('ffl-F').textContent = Fv.toFixed(5);
      const fe = document.getElementById('ffl-f'); fe.textContent = fv.toFixed(5);
      fe.style.color = fv > 0 ? css('--ok') : css('--bad');
      const u = document.getElementById('ffl-use');
      u.textContent = fv > 0 ? 'yes' : 'no — f(s) = 0';
      u.style.color = fv > 0 ? css('--ok') : css('--bad');
      document.getElementById('ffl-z').textContent = 'D^(1/' + s.toFixed(2) + ')';
      document.getElementById('ffl-p').textContent = '≤ ' + Math.floor(s) + ' prime factors';
    }
  });
  document.getElementById('ffl-s').addEventListener('input', e => {
    s = +e.target.value; document.getElementById('ffl-sv').textContent = s.toFixed(2); S.redraw();
  });
})();

})();
