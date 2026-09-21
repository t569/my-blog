/* ============================================================
   VOL. I — MODULAR FORMS · interactive figures
   Depends on notes.js (fit, scene, view, grid, plot, drag, pal…)
   ============================================================ */
(function () {
'use strict';

/* ---------------------------------------------------------------
   0.  q-expansion machinery
   --------------------------------------------------------------- */
const NMAX = 64;                       // series length for the displays
const SPF  = spfTo(4096);

const BERN = { 4:-1/30, 6:1/42, 8:-1/30, 10:5/66, 12:-691/2730, 14:7/6 };

/** E_k = 1 - (2k/B_k) Σ σ_{k-1}(n) q^n, as a float array of length N+1. */
function E(k, N) {
  const c = -2 * k / BERN[k];
  const a = new Array(N + 1).fill(0);
  a[0] = 1;
  for (let n = 1; n <= N; n++) a[n] = c * sigma(n, SPF, k - 1);
  return a;
}
function smul(a, b, N) {
  const r = new Array(N + 1).fill(0);
  for (let i = 0; i <= N; i++) { if (!a[i]) continue; for (let j = 0; i + j <= N; j++) r[i + j] += a[i] * b[j]; }
  return r;
}
function ssub(a, b, N) { const r = []; for (let i = 0; i <= N; i++) r[i] = (a[i] || 0) - (b[i] || 0); return r; }
function sscale(a, s) { return a.map(x => x * s); }
/** Multiplicative inverse of a power series with a[0] = 1. */
function sinv(a, N) {
  const r = new Array(N + 1).fill(0); r[0] = 1 / a[0];
  for (let n = 1; n <= N; n++) { let s = 0; for (let i = 1; i <= n; i++) s += a[i] * r[n - i]; r[n] = -s / a[0]; }
  return r;
}

/**
 * Exact τ(n) via BigInt.  Δ = q·(∏(1−qⁿ)³)^8, and Jacobi's identity
 *   ∏(1−qⁿ)³ = Σ_{k≥0} (−1)^k (2k+1) q^{k(k+1)/2}
 * makes the cube *sparse* — so the first squaring is nearly free and only
 * two dense squarings remain.  τ(n) ≈ n^{11/2} blows past 2^53 around n = 45,
 * so every exact comparison below must stay in BigInt.
 */
let _tauBig = null, _tauN = 0;
function tauTable(N) {
  if (_tauBig && _tauN >= N) return _tauBig;
  const L = N;                                  // coefficients of q^0 … q^{L−1}
  const p3 = new Array(L).fill(0n);
  for (let k = 0; k * (k + 1) / 2 < L; k++) p3[k * (k + 1) / 2] = BigInt((k % 2 ? -1 : 1) * (2 * k + 1));
  const sq = (a) => {
    const r = new Array(L).fill(0n);
    for (let i = 0; i < L; i++) { if (a[i] === 0n) continue; for (let j = 0; i + j < L; j++) { if (a[j] === 0n) continue; r[i + j] += a[i] * a[j]; } }
    return r;
  };
  _tauBig = sq(sq(sq(p3)));                     // = ∏(1−qⁿ)^24 ;  τ(m) = [q^{m−1}]
  _tauN = N;
  return _tauBig;
}
const tauB = n => tauTable(Math.max(n + 1, NMAX + 1))[n - 1];
const tau  = n => Number(tauB(n));

/* Δ (exact), and j = E4³/Δ  (Laurent: JJ[n] is the coefficient of q^{n−1}). */
const E4 = E(4, NMAX), E6 = E(6, NMAX);
const E4c = smul(smul(E4, E4, NMAX), E4, NMAX);
const DEL = [0]; for (let n = 1; n <= NMAX; n++) DEL[n] = tau(n);
const DBAR = DEL.slice(1);                              // Δ = q·DBAR(q), DBAR[0] = 1
const JJ = smul(E4c, sinv(DBAR, NMAX - 1), NMAX - 1);   // j = q^{−1}·JJ(q)

/* ---------------------------------------------------------------
   1.  Complex helpers
   --------------------------------------------------------------- */
const C = {
  mul: (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]],
  add: (a, b) => [a[0] + b[0], a[1] + b[1]],
  div: (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; },
  abs: a => Math.hypot(a[0], a[1]),
  pow: (a, n) => { let r = [1, 0], b = a; while (n > 0) { if (n & 1) r = C.mul(r, b); b = C.mul(b, b); n >>= 1; } return r; }
};
const cstr = (a, d) => `${fmt(a[0], d || 4)}${a[1] < 0 ? '−' : '+'}${fmt(Math.abs(a[1]), d || 4)}i`;
/** Evaluate Σ a_n q^n by Horner. */
function evalSeries(a, q, N) {
  let r = [0, 0];
  for (let n = Math.min(N, a.length - 1); n >= 0; n--) r = C.add(C.mul(r, q), [a[n] || 0, 0]);
  return r;
}
const qOf = (x, y) => { const m = Math.exp(-2 * Math.PI * y), t = 2 * Math.PI * x; return [m * Math.cos(t), m * Math.sin(t)]; };

/* ---------------------------------------------------------------
   2.  The modular group: tiles and reduction
   --------------------------------------------------------------- */
const mmul = (A, B) => [A[0] * B[0] + A[1] * B[2], A[0] * B[1] + A[1] * B[3], A[2] * B[0] + A[3] * B[2], A[2] * B[1] + A[3] * B[3]];
const mact = (M, z) => { const n = [M[0] * z[0] + M[1], M[0] * z[1]], d = [M[2] * z[0] + M[3], M[2] * z[1]]; return C.div(n, d); };
const MS = [0, -1, 1, 0], MT = [1, 1, 0, 1], MTi = [1, -1, 0, 1];
const mkey = (M) => { const s = (M[2] > 0 || (M[2] === 0 && M[0] > 0)) ? 1 : -1; return M.map(x => x * s).join(','); };

/** BFS over words in S, T, T⁻¹ — the tiles γ𝓕 near the viewport. */
function tiles(depth) {
  const seen = new Map([[mkey([1, 0, 0, 1]), [1, 0, 0, 1]]]);
  let frontier = [[1, 0, 0, 1]];
  for (let d = 0; d < depth; d++) {
    const next = [];
    for (const M of frontier) for (const g of [MS, MT, MTi]) {
      const P = mmul(g, M), k = mkey(P);
      if (!seen.has(k) && Math.abs(P[0]) < 40 && Math.abs(P[2]) < 40) { seen.set(k, P); next.push(P); }
    }
    frontier = next;
  }
  return Array.from(seen.values());
}
const TILES = tiles(9);

/** Boundary of 𝓕 as a polyline in ℂ (vertical sides capped at height TOP). */
const FBOUND = (() => {
  const pts = [], TOP = 7, s3 = Math.sqrt(3) / 2, M = 46;
  for (let i = 0; i <= M; i++) { const t = i / M; pts.push([-0.5, s3 * Math.pow(TOP / s3, t)]); }
  for (let i = 0; i <= M; i++) { const t = i / M; pts.push([-0.5 + t, TOP]); }
  for (let i = 0; i <= M; i++) { const t = i / M; pts.push([0.5, TOP * Math.pow(s3 / TOP, t)]); }
  for (let i = 0; i <= M; i++) { const a = Math.PI / 3 + (i / M) * (Math.PI / 3); pts.push([Math.cos(a), Math.sin(a)]); }
  return pts;
})();

/* Möbius images of the boundary, computed once: redrawing is then pure scaling.
   ponytail: flat Float64 arrays, since this is ~170k points redrawn on every drag. */
const TILEPATH = TILES.map(M => {
  const xs = [], ys = [];
  for (const z of FBOUND) {
    const w = mact(M, z);
    xs.push(isFinite(w[0]) && isFinite(w[1]) && w[1] > 0 ? w[0] : NaN);
    ys.push(isFinite(w[1]) ? w[1] : NaN);
  }
  return [Float64Array.from(xs), Float64Array.from(ys)];
});

function strokeTiles(ctx, V, P, alpha) {
  ctx.save();
  ctx.lineWidth = 1; ctx.globalAlpha = alpha === undefined ? 1 : alpha;
  ctx.strokeStyle = P.rule;
  ctx.beginPath();
  for (const [xs, ys] of TILEPATH) {
    let pen = false;
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i], y = ys[i];
      if (!(y > 0) || Number.isNaN(x)) { pen = false; continue; }
      const px = V.X(x), py = V.Y(y);
      if (px < -600 || px > V.w + 600 || py < -600 || py > V.h + 600) { pen = false; continue; }
      pen ? ctx.lineTo(px, py) : ctx.moveTo(px, py); pen = true;
    }
  }
  ctx.stroke();
  ctx.restore();
}
function fillF(ctx, V, style) {
  ctx.save(); ctx.beginPath();
  FBOUND.forEach((z, i) => { const px = V.X(z[0]), py = V.Y(z[1]); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
  ctx.closePath(); ctx.fillStyle = style; ctx.fill(); ctx.restore();
}

/** One reduction step; returns {z, M, tag} or null when already reduced. */
function reduceStep(z, M) {
  const n = Math.round(z[0]);
  if (n !== 0) return { z: [z[0] - n, z[1]], M: mmul([1, -n, 0, 1], M), tag: n > 0 ? `T^-${n}` : `T^${-n}` };
  if (z[0] * z[0] + z[1] * z[1] < 1 - 1e-12) return { z: C.div([-1, 0], z), M: mmul(MS, M), tag: 'S' };
  return null;
}

/* ---------------------------------------------------------------
   FIG 1 — upper half-plane playground
   --------------------------------------------------------------- */
(function fig1() {
  const cv = document.getElementById('hpCanvas'); if (!cv) return;
  let z = [0.28, 0.42], M = [1, 0, 0, 1], word = [], path = [], showTess = true, showTrail = false;
  let anim = null;

  const Vof = (cv) => { const ys = 4.2 * (cv._h / cv._w); return view(cv, { xmin: -2.1, xmax: 2.1, ymin: 0, ymax: ys, pad: 0 }); };

  function out() {
    const inF = Math.abs(z[0]) <= 0.5 + 1e-9 && z[0] * z[0] + z[1] * z[1] >= 1 - 1e-9;
    document.getElementById('hp-z').textContent = cstr(z, 4);
    document.getElementById('hp-im').textContent = fmt(z[1], 4);
    document.getElementById('hp-abs').textContent = fmt(C.abs(z), 4);
    document.getElementById('hp-g').textContent = `( ${M[0]} ${M[1]} ; ${M[2]} ${M[3]} )`;
    document.getElementById('hp-w').textContent = word.length ? word.slice(-6).join(' · ') : 'identity';
    const el = document.getElementById('hp-in');
    el.textContent = inF ? 'yes' : 'no';
    el.style.color = inF ? css('--ok') : css('--warn');
  }

  const S = scene(cv, {
    aspect: 16 / 9, still: true,
    draw(ctx, P) {
      const V = Vof(cv);
      ctx.fillStyle = P.paper2; ctx.fillRect(0, 0, V.w, V.h);
      // real axis + light grid
      ctx.strokeStyle = P.ruleSoft; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = -2; x <= 2; x += 0.5) { const px = Math.round(V.X(x)) + .5; ctx.moveTo(px, 0); ctx.lineTo(px, V.h); }
      for (let y = 0.5; y <= V.b.ymax; y += 0.5) { const py = Math.round(V.Y(y)) + .5; ctx.moveTo(0, py); ctx.lineTo(V.w, py); }
      ctx.stroke();
      if (showTess) strokeTiles(ctx, V, P, 0.9);
      fillF(ctx, V, css('--acc-soft'));
      // unit circle
      ctx.strokeStyle = P.ink4; ctx.setLineDash([3, 4]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(V.X(0), V.Y(0), V.X(1) - V.X(0), Math.PI, 0); ctx.stroke(); ctx.setLineDash([]);
      // boundary of 𝓕 emphasised
      ctx.beginPath();
      FBOUND.forEach((p, i) => { const px = V.X(p[0]), py = V.Y(p[1]); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
      ctx.strokeStyle = P.acc; ctx.lineWidth = 1.8; ctx.stroke();
      // real axis
      ctx.beginPath(); ctx.moveTo(0, V.Y(0)); ctx.lineTo(V.w, V.Y(0));
      ctx.strokeStyle = P.ink3; ctx.lineWidth = 1.5; ctx.stroke();
      // orbit trail
      if (showTrail && path.length > 1) {
        ctx.beginPath();
        path.forEach((p, i) => { const px = V.X(p[0]), py = V.Y(p[1]); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
        ctx.strokeStyle = P.acc2; ctx.lineWidth = 1.4; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]);
        path.forEach(p => dot(ctx, V.X(p[0]), V.Y(p[1]), 2.6, P.acc2));
      }
      // elliptic points
      [[0, 1, 'i'], [-0.5, Math.sqrt(3) / 2, 'ρ'], [0.5, Math.sqrt(3) / 2, 'ρ+1']].forEach(([x, y, t]) => {
        dot(ctx, V.X(x), V.Y(y), 3, P.paper2, P.ink3, 1.4);
        label(ctx, t, V.X(x) + 7, V.Y(y) - 6, P.ink3, '11px ui-monospace, monospace');
      });
      // the point
      const px = V.X(z[0]), py = V.Y(z[1]);
      dot(ctx, px, py, 10, 'transparent', css('--acc-line'), 1.2);
      dot(ctx, px, py, 5.5, P.acc, P.paper2, 2);
      label(ctx, 'z', px + 11, py - 9, P.acc, '600 12px ui-monospace, monospace');
      label(ctx, 'ℱ', V.X(0) - 4, V.Y(1.5), P.acc, '600 15px ui-monospace, monospace');
      label(ctx, 'cusp  i∞  ↑', 10, 16, P.ink4);
      label(ctx, 'ℝ', V.w - 16, V.Y(0) - 8, P.ink3);
      out();
    }
  });

  drag(cv, {
    down: p => set(p), move: (p, on) => { if (on) set(p); }
  });
  function set(p) {
    const V = Vof(cv);
    z = [clamp(V.ix(p.x), -2.05, 2.05), clamp(V.iy(p.y), 0.035, V.b.ymax)];
    M = [1, 0, 0, 1]; word = []; path = [z.slice()]; if (anim) { clearInterval(anim); anim = null; }
    S.kick();
  }
  function apply(g, tag) {
    z = mact(g, z); M = mmul(g, M); word.push(tag); path.push(z.slice()); S.kick();
  }
  document.querySelectorAll('[data-hp]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.hp;
    if (k === 'T') apply(MT, 'T');
    else if (k === 'Ti') apply(MTi, 'T⁻¹');
    else if (k === 'S') apply(MS, 'S');
    else if (k === 'reset') { z = [0.28, 0.42]; M = [1, 0, 0, 1]; word = []; path = [z.slice()]; if (anim) clearInterval(anim); anim = null; S.kick(); }
    else if (k === 'tess') { showTess = !showTess; b.classList.toggle('on', showTess); S.kick(); }
    else if (k === 'trail') { showTrail = !showTrail; b.classList.toggle('on', showTrail); S.kick(); }
    else if (k === 'reduce') {
      if (anim) { clearInterval(anim); anim = null; return; }
      showTrail = true; document.querySelector('[data-hp="trail"]').classList.add('on');
      let guard = 0;
      anim = setInterval(() => {
        const st = reduceStep(z, M);
        if (!st || ++guard > 60) { clearInterval(anim); anim = null; S.kick(); return; }
        z = st.z; M = st.M; word.push(st.tag); path.push(z.slice()); S.kick();
      }, 420);
    }
  }));
  path = [z.slice()];
})();

/* ---------------------------------------------------------------
   FIG 2 — modularity from the raw lattice sum
   --------------------------------------------------------------- */
(function fig2() {
  const go = document.getElementById('mv-go'); if (!go) return;
  const LN = 160;
  function G(k, z) {
    let re = 0, im = 0;
    for (let m = -LN; m <= LN; m++) for (let n = -LN; n <= LN; n++) {
      if (!m && !n) continue;
      const w = C.pow([m * z[0] + n, m * z[1]], k);
      const d = w[0] * w[0] + w[1] * w[1];
      re += w[0] / d; im -= w[1] / d;                 // 1/w
    }
    return [re, im];
  }
  const X = document.getElementById('mv-x'), Y = document.getElementById('mv-y');
  const sync = () => {
    document.getElementById('mv-xv').textContent = (+X.value).toFixed(3);
    document.getElementById('mv-yv').textContent = (+Y.value).toFixed(3);
  };
  X.addEventListener('input', sync); Y.addEventListener('input', sync); sync();

  go.addEventListener('click', () => {
    const k = +document.getElementById('mv-k').value;
    const g = document.getElementById('mv-g').value.split(',').map(Number);
    const z = [+X.value, +Y.value], gz = mact(g, z);
    const msg = document.getElementById('mv-msg');
    msg.innerHTML = '<span class="spin" style="display:inline-block">◠</span> summing ' + ((2 * LN + 1) ** 2).toLocaleString() + ' lattice points…';
    setTimeout(() => {
      const A = G(k, z), B = G(k, gz);
      const cz = [g[2] * z[0] + g[3], g[2] * z[1]];
      const Cc = C.mul(C.pow(cz, k), A);
      const err = C.abs([B[0] - Cc[0], B[1] - Cc[1]]) / Math.max(C.abs(B), 1e-30);
      document.getElementById('mv-z').textContent = cstr(z, 4);
      document.getElementById('mv-gz').textContent = cstr(gz, 4);
      document.getElementById('mv-a').textContent = cstr(A, 5);
      document.getElementById('mv-b').textContent = cstr(B, 5);
      document.getElementById('mv-c').textContent = cstr(Cc, 5);
      const e = document.getElementById('mv-e');
      e.textContent = err.toExponential(2);
      e.style.color = err < 1e-3 ? css('--ok') : err < 1e-1 ? css('--warn') : css('--bad');
      msg.innerHTML = err < 1e-3
        ? '<strong style="color:' + css('--ok') + '">Match.</strong> Two numbers computed from completely different lattices agree to ' + (-Math.log10(err)).toFixed(1) + ' digits. Nothing about the summand knew it was supposed to be modular — the invariance is a consequence of the lattice being permuted.'
        : 'Agreement is only ' + (-Math.log10(err)).toFixed(1) + ' digits here: the truncated square |m|,|n| ≤ ' + LN + ' is a poor approximation to a disc once the lattice ℤ·γz + ℤ becomes very skewed. Raise Im z and try again.';
    }, 20);
  });
  new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { o.disconnect(); go.click(); } }, { rootMargin: '300px' }).observe(go);
})();

/* ---------------------------------------------------------------
   FIG 3 — q-expansion explorer
   --------------------------------------------------------------- */
(function fig3() {
  const cv = document.getElementById('qeCanvas'); if (!cv) return;
  const SER = {
    E4: { a: E4, k: 4, tex: 'E_4 = 1 + 240\\sum_{n\\ge1}\\sigma_3(n)q^n', note: 'Constant term 1; coefficients are 240·σ₃(n), growing like n³.' },
    E6: { a: E6, k: 6, tex: 'E_6 = 1 - 504\\sum_{n\\ge1}\\sigma_5(n)q^n', note: 'Alternating in sign convention only: every coefficient after the first is negative.' },
    E8: { a: E(8, NMAX), k: 8, tex: 'E_8 = 1 + 480\\sum_{n\\ge1}\\sigma_7(n)q^n', note: 'Equal to E₄² — see Fig. 4.' },
    E10: { a: E(10, NMAX), k: 10, tex: 'E_{10} = 1 - 264\\sum_{n\\ge1}\\sigma_9(n)q^n', note: 'Equal to E₄E₆.' },
    E12: { a: E(12, NMAX), k: 12, tex: 'E_{12} = 1 + \\tfrac{65520}{691}\\sum_{n\\ge1}\\sigma_{11}(n)q^n', note: 'The 691 in the denominator is where Ramanujan’s congruence τ(n) ≡ σ₁₁(n) mod 691 comes from.' },
    E14: { a: E(14, NMAX), k: 14, tex: 'E_{14} = 1 - 24\\sum_{n\\ge1}\\sigma_{13}(n)q^n', note: 'dim M₁₄ = 1, so E₁₄ = E₄²E₆ = E₆E₈ = E₄E₁₀.' },
    D: { a: DEL, k: 12, tex: '\\Delta = q\\prod_{n\\ge1}(1-q^n)^{24} = \\sum_{n\\ge1}\\tau(n)q^n', note: 'The first cusp form: a₀ = 0. Coefficients grow like n^{11/2}, not n^{11} — that square-root saving is Deligne’s theorem.' },
    J: { a: JJ, k: 0, laurent: true, tex: 'j = E_4^3/\\Delta = q^{-1} + 744 + 196884q + \\cdots', note: 'Weight 0 and genuinely SL₂(ℤ)-invariant, but with a pole at the cusp. 196884 = 196883 + 1 is monstrous moonshine.' }
  };
  let cur = 'E4', N = 20, logy = false;

  const S = scene(cv, {
    aspect: 2.7, still: true,
    draw(ctx, P) {
      const s = SER[cur], a = s.a, off = s.laurent ? -1 : 0;
      const w = cv._w, h = cv._h, padL = 44, padB = 20, padT = 12;
      ctx.fillStyle = P.paper2; ctx.fillRect(0, 0, w, h);
      const vals = [];
      for (let i = 0; i <= N; i++) { const v = a[i] || 0; vals.push(logy ? Math.sign(v) * Math.log10(1 + Math.abs(v)) : v); }
      let mx = 0; vals.forEach(v => mx = Math.max(mx, Math.abs(v))); if (!mx) mx = 1;
      const hasNeg = vals.some(v => v < 0);
      const y0 = hasNeg ? (padT + (h - padT - padB) * 0.55) : (h - padB);
      const sc = hasNeg ? (h - padT - padB) * 0.5 / mx : (h - padT - padB) / mx;
      ctx.strokeStyle = P.rule; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(padL, y0 + .5); ctx.lineTo(w - 6, y0 + .5); ctx.stroke();
      const bw = Math.max(2, (w - padL - 10) / (N + 1) - 3);
      vals.forEach((v, i) => {
        const x = padL + i * (w - padL - 10) / (N + 1) + 1.5;
        const hgt = v * sc;
        ctx.fillStyle = v >= 0 ? P.acc : P.acc2;
        ctx.fillRect(x, hgt >= 0 ? y0 - hgt : y0, bw, Math.max(1, Math.abs(hgt)));
        if (i % Math.ceil((N + 1) / 14) === 0)
          label(ctx, String(i + off), x + bw / 2, h - 6, P.ink4, '9px ui-monospace, monospace', 'center');
      });
      label(ctx, logy ? 'sgn·log₁₀(1+|aₙ|)' : 'aₙ', 6, padT + 8, P.ink4, '9px ui-monospace, monospace');
      label(ctx, 'n →', w - 24, y0 - 6, P.ink4, '9px ui-monospace, monospace');
    }
  });

  function render() {
    const s = SER[cur], a = s.a, off = s.laurent ? -1 : 0;
    document.getElementById('qe-nv').textContent = N;
    document.getElementById('qe-formula').innerHTML = '\\[' + s.tex + '\\]<p style="margin:6px 0 0">' + s.note + '</p>';
    let html = '<tr><th>n</th><th>aₙ</th>' + (s.k && !s.laurent && cur[0] === 'E' ? '<th>σ' + (s.k - 1) + '(n)</th>' : '') + '</tr>';
    for (let i = 0; i <= Math.min(N, 24); i++) {
      const v = a[i] || 0;
      const show = Number.isInteger(v) ? v.toLocaleString() : v.toFixed(4);
      html += '<tr><td>' + (i + off) + '</td><td>' + show + '</td>' +
        (s.k && !s.laurent && cur[0] === 'E' ? '<td>' + (i === 0 ? '—' : sigma(i, SPF, s.k - 1).toLocaleString()) + '</td>' : '') + '</tr>';
    }
    document.getElementById('qe-table').innerHTML = html;
    S.redraw();
    if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([document.getElementById('qe-formula')]);
  }
  document.querySelectorAll('#qe-pick .btn').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('#qe-pick .btn').forEach(x => x.classList.remove('on'));
    b.classList.add('on'); cur = b.dataset.f; render();
  }));
  document.getElementById('qe-n').addEventListener('input', e => { N = +e.target.value; render(); });
  document.getElementById('qe-log').addEventListener('click', e => { logy = !logy; e.target.classList.toggle('on', logy); render(); });
  render();
})();

/* ---------------------------------------------------------------
   FIG 4 — identities for free
   --------------------------------------------------------------- */
(function fig4() {
  const pick = document.getElementById('id-pick'); if (!pick) return;
  const sigBig = (n, k) => { let r = 0n; for (let d = 1; d <= n; d++) if (n % d === 0) r += BigInt(d) ** BigInt(k); return r; };
  const E8s = E(8, NMAX), E10s = E(10, NMAX), E14s = E(14, NMAX);

  const CASES = {
    E4sq: { n: 30, sturm: 0, lab: 'E₄² vs E₈',
      L: smul(E4, E4, NMAX), R: E8s,
      note: 'Both lie in M₈, which is <strong>one</strong>-dimensional, and both have constant term 1. Sturm bound ⌊8/12⌋ = 0: agreement of the constant term <em>alone</em> already forces equality. Every further chip is redundant — that is the point.' },
    E4E6: { n: 30, sturm: 0, lab: 'E₄E₆ vs E₁₀',
      L: smul(E4, E6, NMAX), R: E10s,
      note: 'dim M₁₀ = 1. Same story; the coefficient identity you get is a convolution formula relating σ₉ to σ₃ ∗ σ₅.' },
    disc: { n: 30, sturm: 1, lab: '1728Δ vs E₄³ − E₆²',
      L: sscale(DEL, 1728), R: ssub(E4c, smul(E6, E6, NMAX), NMAX),
      note: 'This one is a <em>definition</em> unpacked: Δ was defined as (E₄³ − E₆²)/1728, so the match is tautological. It is here so you can see the integrality — every coefficient of the difference of those two enormous series is divisible by 1728, which is not obvious from the formula.' },
    E6E8: { n: 30, sturm: 1, lab: 'E₆E₈ vs E₁₄',
      L: smul(E6, E8s, NMAX), R: E14s,
      note: 'dim M₁₄ = 1 (weight 14 ≡ 2 mod 12, the "stumble" weight), so E₆E₈ = E₄²E₆ = E₄E₁₀ = E₁₄ all at once.' },
    tau: { n: 30, sturm: null, lab: 'τ(n) − σ₁₁(n) mod 691', congruence: true,
      note: 'Not an equality — a <strong>congruence</strong>. dim M₁₂ = 2 with basis {E₁₂, Δ}. The coefficient 65520/691 of E₁₂ has a 691 in the denominator; clearing it modulo 691 collapses E₁₂ onto Δ. Ramanujan found this numerically; Serre and Ribet turned the phenomenon into a theory (Galois representations mod ℓ).' }
  };

  function render() {
    const key = pick.value, c = CASES[key], N = +document.getElementById('id-n').value;
    document.getElementById('id-nv').textContent = N;
    let html = '', bad = 0;
    for (let i = 0; i <= N; i++) {
      let ok, txt;
      if (c.congruence) {
        ok = i === 0 || (tauB(i) - sigBig(i, 11)) % 691n === 0n;
        txt = 'n=' + i;
      } else {
        const d = Math.abs((c.L[i] || 0) - (c.R[i] || 0));
        ok = d <= 1e-6 * Math.max(1, Math.abs(c.L[i] || 0));
        txt = 'a' + i;
      }
      if (!ok) bad++;
      html += '<span class="chip ' + (ok ? 'hit' : 'miss') + '">' + txt + ' ' + (ok ? '✓' : '✗') + '</span>';
    }
    document.getElementById('id-chips').innerHTML = html;
    document.getElementById('id-note').innerHTML =
      (bad ? '<strong style="color:' + css('--bad') + '">' + bad + ' mismatch(es)</strong> — ' : '<strong style="color:' + css('--ok') + '">All ' + (N + 1) + ' agree.</strong> ') +
      (c.sturm !== null && c.sturm !== undefined ? 'Sturm bound for this weight: <code>' + c.sturm + '</code>. ' : '') + c.note;
  }
  pick.addEventListener('change', render);
  document.getElementById('id-n').addEventListener('input', render);
  render();
})();

/* ---------------------------------------------------------------
   FIG 5 — domain colouring on ℍ
   --------------------------------------------------------------- */
(function fig5() {
  const cv = document.getElementById('dcCanvas'); if (!cv) return;
  const wrap = document.getElementById('dcwrap');
  const NT = 46;                                  // series terms
  const E12s = E(12, NMAX);

  /* Allocation-free complex Horner.  This runs ~250 000 times per render, so the
     2-element arrays that C.mul/evalSeries hand back are the whole cost; scalars
     make it roughly twenty times faster.  Results land in HR, HI. */
  let HR = 0, HI = 0;
  function horner(a, qr, qi, N) {
    let r = 0, i = 0;
    for (let n = N; n >= 0; n--) { const t = r * qr - i * qi + a[n]; i = r * qi + i * qr; r = t; }
    HR = r; HI = i;
  }
  /* Terms needed so that |q|^N · N^6 < 1e-9, since |a_n| ≲ n^{11/2}. */
  const termsFor = y => clamp(Math.ceil((20.7 + 6 * Math.log(NT)) / (2 * Math.PI * y)), 5, NT);

  /**
   * Δ via the eta product q·∏(1−qⁿ)^24, NOT via Στ(n)qⁿ.
   * Near the real axis Δ is astronomically small while the individual terms
   * τ(n)qⁿ are not, so the series loses every significant digit to cancellation
   * — at Im z = 0.08 the truncated series is wrong by a factor of 10^4.
   * The product has no cancellation at all: each factor is close to 1.
   */
  function deltaAt(qr, qi, M) {
    let pr = 1, pi = 0, nr = qr, ni = qi;                     // p = ∏(1−qⁿ), n = qⁿ
    for (let k = 1; k <= M; k++) {
      const tr = 1 - nr, ti = -ni;
      const a = pr * tr - pi * ti; pi = pr * ti + pi * tr; pr = a;
      const b = nr * qr - ni * qi; ni = nr * qi + ni * qr; nr = b;
    }
    let ar = pr * pr - pi * pi, ai = 2 * pr * pi;             // p²
    let br = ar * pr - ai * pi, bi = ar * pi + ai * pr;       // p³
    ar = br * br - bi * bi; ai = 2 * br * bi;                 // p⁶
    br = ar * ar - ai * ai; bi = 2 * ar * ai;                 // p¹²
    ar = br * br - bi * bi; ai = 2 * br * bi;                 // p²⁴
    HR = qr * ar - qi * ai; HI = qr * ai + qi * ar;           // ·q
  }
  /* Factors until |q|^M < 1e-12. */
  const factorsFor = y => clamp(Math.ceil(4.4 / y), 2, 80);

  const EVAL = {
    D:  (qr, qi, N, M) => deltaAt(qr, qi, M),
    E4: (qr, qi, N) => horner(E4, qr, qi, N),
    E6: (qr, qi, N) => horner(E6, qr, qi, N),
    E12:(qr, qi, N) => horner(E12s, qr, qi, N),
    J:  (qr, qi, N, M) => {
      horner(E4, qr, qi, N);
      const ar = HR, ai = HI;
      const cr = ar * ar - ai * ai, ci = 2 * ar * ai;         // E4²
      const nr = cr * ar - ci * ai, ni = cr * ai + ci * ar;   // E4³
      deltaAt(qr, qi, M);
      const dr = HR, di = HI, m = dr * dr + di * di;
      HR = (nr * dr + ni * di) / m; HI = (ni * dr - nr * di) / m;
    }
  };
  const FUN = {
    D: { cap: '<strong>Δ, weight 12.</strong> Scan the whole frame: there is no point where every hue converges. That is Jacobi’s theorem — Δ has <em>no zeros at all</em> on ℍ — and it is why dividing by Δ is an isomorphism M_k → S_{k+12}. Notice too how the colour freezes as you look upward: Δ ≈ q near the cusp, so the phase becomes exactly 2πx and the picture turns into clean vertical stripes.' },
    E4: { cap: '<strong>E₄, weight 4.</strong> Budget k/12 = 1/3, and a zero at the corner ρ = e^{2πi/3} costs exactly 1/3. So E₄ has one zero per orbit, sitting at the two bottom corners of 𝓕 (which are the same point after gluing) — and at the corresponding corner of every tile. Turn the overlay on and count.' },
    E6: { cap: '<strong>E₆, weight 6.</strong> Budget 1/2, and a zero at i costs 1/2. The pinwheel sits precisely at z = i, the top of the unit circle, where the arc of 𝓕 meets the imaginary axis. Its images under the group appear at the "mid-arc" point of every tile.' },
    E12: { cap: '<strong>E₁₂, weight 12.</strong> Budget 1. It has a single zero per orbit, but at an <em>irrational-looking</em> interior point of 𝓕 with no symmetry reason to be anywhere in particular — the generic case. Compare with Δ, same weight, which spends its whole budget at the cusp instead.' },
    J: { cap: '<strong>j, weight 0.</strong> A true invariant function: the colours are <em>identical</em> on every tile, not merely rearranged. The pole at the cusp makes the top of the frame blow out. j takes every value in ℂ exactly once per tile — it is the coordinate on the modular curve, which is why it is the uniformiser that turns "genus 0" into a usable fact.' }
  };
  let cur = 'D', ymin = 0.16, contrast = 1.0, overlay = true, token = 0;

  function hsl(h, s, l) {
    const a = s * Math.min(l, 1 - l);
    const f = n => { const k = (n + h * 12) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
    return [f(0) * 255, f(8) * 255, f(4) * 255];
  }

  const Vof = () => { const ys = 3.2 * (cv._h / cv._w); return { xmin: -1.6, xmax: 1.6, ymin, ymax: ymin + ys }; };

  function render() {
    const ctx = fit(cv, 16 / 9), w = cv._w, h = cv._h, P = pal();
    const b = Vof(), my = ++token;
    wrap.classList.add('busy-on');
    const img = ctx.createImageData(Math.round(w), Math.round(h));
    const d = img.data, f = EVAL[cur];
    let row = 0;
    const chunk = () => {
      if (my !== token) return;
      const t0 = performance.now();
      while (row < img.height && performance.now() - t0 < 14) {
        const y = b.ymax - (row / img.height) * (b.ymax - b.ymin);
        const qm = Math.exp(-2 * Math.PI * y), N = termsFor(y), M = factorsFor(y);
        for (let col = 0; col < img.width; col++) {
          const x = b.xmin + (col / img.width) * (b.xmax - b.xmin);
          const a = 2 * Math.PI * x;
          f(qm * Math.cos(a), qm * Math.sin(a), N, M);
          const m = Math.hypot(HR, HI);
          let r, g, bl;
          if (!isFinite(m) || m === 0) { r = g = bl = 20; }
          else {
            const hu = (Math.atan2(HI, HR) / (2 * Math.PI) + 1) % 1;
            const t = Math.log2(m) * contrast;
            const band = t - Math.floor(t);
            const L = 0.40 + 0.30 * band;
            const c = hsl(hu, 0.78, L); r = c[0]; g = c[1]; bl = c[2];
          }
          const i = (row * img.width + col) * 4;
          d[i] = r; d[i + 1] = g; d[i + 2] = bl; d[i + 3] = 255;
        }
        row++;
      }
      if (row < img.height) { requestAnimationFrame(chunk); return; }
      ctx.putImageData(img, 0, 0);
      if (overlay) {
        const V = view(cv, { xmin: b.xmin, xmax: b.xmax, ymin: b.ymin, ymax: b.ymax, pad: 0 });
        strokeTiles(ctx, V, { rule: 'rgba(255,255,255,.34)' }, 1);
        ctx.save(); ctx.beginPath();
        FBOUND.forEach((p, i) => { const px = V.X(p[0]), py = V.Y(p[1]); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        dot(ctx, V.X(0), V.Y(1), 4, 'transparent', '#fff', 1.6);
        label(ctx, 'i', V.X(0) + 8, V.Y(1) - 6, '#fff', '600 12px ui-monospace, monospace');
        dot(ctx, V.X(-0.5), V.Y(Math.sqrt(3) / 2), 4, 'transparent', '#fff', 1.6);
        label(ctx, 'ρ', V.X(-0.5) - 16, V.Y(Math.sqrt(3) / 2) - 6, '#fff', '600 12px ui-monospace, monospace');
        ctx.restore();
      }
      wrap.classList.remove('busy-on');
      const cap = document.getElementById('dc-cap');
      cap.innerHTML = FUN[cur].cap + ' <span style="opacity:.65">Hue = arg f, brightness bands at powers of 2 in |f|. Frame: Re z ∈ [−1.6, 1.6], Im z ∈ [' + ymin.toFixed(2) + ', ' + b.ymax.toFixed(2) + '].</span>';
    };
    requestAnimationFrame(chunk);
  }

  document.querySelectorAll('#dc-pick .btn').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('#dc-pick .btn').forEach(x => x.classList.remove('on'));
    b.classList.add('on'); cur = b.dataset.f; render();
  }));
  const yEl = document.getElementById('dc-y'), cEl = document.getElementById('dc-c');
  yEl.addEventListener('input', () => { ymin = +yEl.value; document.getElementById('dc-yv').textContent = ymin.toFixed(2); render(); });
  cEl.addEventListener('input', () => { contrast = +cEl.value; document.getElementById('dc-cv').textContent = contrast.toFixed(1); render(); });
  document.getElementById('dc-tess').addEventListener('click', e => { overlay = !overlay; e.target.classList.toggle('on', overlay); render(); });
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(render, 220); });
  new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { render(); o.disconnect(); } }, { rootMargin: '300px' }).observe(cv);
})();

/* ---------------------------------------------------------------
   FIG 6 — dimensions and bases
   --------------------------------------------------------------- */
(function fig6() {
  const cv = document.getElementById('dimCanvas'); if (!cv) return;
  const dimM = k => (k < 0 || k % 2) ? 0 : (k % 12 === 2 ? Math.floor(k / 12) : Math.floor(k / 12) + 1);
  let k = 12;
  const S = scene(cv, {
    aspect: 3.4, still: true,
    draw(ctx, P) {
      const w = cv._w, h = cv._h, padB = 18, padT = 10, KM = 72;
      ctx.fillStyle = P.paper2; ctx.fillRect(0, 0, w, h);
      const n = KM / 2 + 1, bw = (w - 12) / n;
      let mx = 1; for (let j = 0; j <= KM; j += 2) mx = Math.max(mx, dimM(j));
      for (let j = 0, i = 0; j <= KM; j += 2, i++) {
        const d = dimM(j), x = 6 + i * bw, hg = (h - padT - padB) * d / mx;
        ctx.fillStyle = j === k ? P.acc : (j % 12 === 2 ? P.acc2 : P.rule);
        ctx.globalAlpha = j === k ? 1 : (j % 12 === 2 ? 0.55 : 1);
        ctx.fillRect(x, h - padB - hg, Math.max(1.5, bw - 2), Math.max(1, hg));
        ctx.globalAlpha = 1;
        if (j % 12 === 0) label(ctx, String(j), x + bw / 2 - 1, h - 5, P.ink4, '9px ui-monospace, monospace', 'center');
      }
      label(ctx, 'dim M_k  (even k, orange = k ≡ 2 mod 12)', 8, padT + 6, P.ink4, '9px ui-monospace, monospace');
    }
  });
  function render() {
    document.getElementById('dim-kv').textContent = k;
    const d = dimM(k);
    document.getElementById('dim-m').textContent = d;
    document.getElementById('dim-s').textContent = Math.max(0, d - 1);
    document.getElementById('dim-b').textContent = (k / 12).toFixed(4);
    document.getElementById('dim-st').textContent = k < 0 ? '—' : Math.floor(k / 12);
    const mon = [];
    for (let b = 0; 6 * b <= k; b++) { const rem = k - 6 * b; if (rem % 4 === 0) mon.push([rem / 4, b]); }
    document.getElementById('dim-basis').innerHTML = mon.length
      ? mon.map(([a, b]) => '<span class="chip">' + (a ? 'E₄' + (a > 1 ? sup(a) : '') : '') + (a && b ? '·' : '') + (b ? 'E₆' + (b > 1 ? sup(b) : '') : '') + (a || b ? '' : '1') + '</span>').join('') +
        '<div style="font-family:var(--sans);font-size:13px;color:var(--ink-3);margin-top:10px">' + mon.length + ' monomial(s) — and dim M<sub>' + k + '</sub> = ' + d + '. They match because ℂ[E₄,E₆] is a <em>free</em> polynomial ring: no relation between E₄ and E₆ ever collapses two monomials onto each other.</div>'
      : '<span style="color:var(--ink-3);font-family:var(--sans)">No monomials — and indeed dim M<sub>' + k + '</sub> = 0. Weight ' + k + ' carries nothing but the zero form.</span>';
    S.redraw();
  }
  const sup = n => String(n).replace(/\d/g, c => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]);
  document.getElementById('dim-k').addEventListener('input', e => { k = +e.target.value; render(); });
  render();
})();

/* ---------------------------------------------------------------
   FIG 7 — τ(n): multiplicativity, recursion, Sato–Tate
   --------------------------------------------------------------- */
(function fig7() {
  const modeBox = document.getElementById('hk-mode'); if (!modeBox) return;
  const gcd = (a, b) => b ? gcd(b, a % b) : a;

  const TMAX = 1000;                       // one BigInt table serves all three modes
  const big = x => x.toLocaleString('en-US');

  function mult() {
    const m = +document.getElementById('hk-m').value, n = +document.getElementById('hk-n').value;
    document.getElementById('hk-mv').textContent = m; document.getElementById('hk-nv').textContent = n;
    const g = gcd(m, n), tm = tauB(m), tn = tauB(n), tmn = m * n <= TMAX ? tauB(m * n) : null;
    document.getElementById('hk-gcd').textContent = g;
    document.getElementById('hk-tm').textContent = big(tm);
    document.getElementById('hk-tn').textContent = big(tn);
    document.getElementById('hk-prod').textContent = big(tm * tn);
    document.getElementById('hk-tmn').textContent = tmn === null ? 'mn > ' + TMAX : big(tmn);
    const v = document.getElementById('hk-verdict');
    if (tmn === null) { v.textContent = 'out of table range'; v.style.color = css('--ink-3'); }
    else if (g === 1) { const ok = tm * tn === tmn; v.textContent = ok ? 'coprime → equal ✓' : 'coprime ✗'; v.style.color = ok ? css('--ok') : css('--bad'); }
    else { v.textContent = 'gcd ≠ 1 — no claim made'; v.style.color = css('--warn'); }
  }
  function rec() {
    const p = +document.getElementById('hk-p').value, r = +document.getElementById('hk-r').value;
    document.getElementById('hk-rv').textContent = r;
    const note = document.getElementById('hk-recnote');
    if (Math.pow(p, r + 1) > TMAX) {
      ['hk-lhs', 'hk-t1', 'hk-t2', 'hk-rhs'].forEach(i => document.getElementById(i).textContent = '—');
      note.innerHTML = 'p<sup>r+1</sup> = ' + p + '<sup>' + (r + 1) + '</sup> exceeds the precomputed range of ' + TMAX + '. Lower r, or pick a smaller p.';
      return;
    }
    const L = tauB(Math.pow(p, r + 1));
    const t1 = tauB(p) * tauB(Math.pow(p, r));
    const t2 = BigInt(p) ** 11n * (r >= 1 ? tauB(Math.pow(p, r - 1)) : 0n);
    const R = t1 - t2;
    document.getElementById('hk-lhs').textContent = big(L);
    document.getElementById('hk-t1').textContent = big(t1);
    document.getElementById('hk-t2').textContent = big(t2);
    const e = document.getElementById('hk-rhs'); e.textContent = big(R);
    const ok = L === R;
    e.style.color = ok ? css('--ok') : css('--bad');
    note.innerHTML = ok
      ? 'Exact, in integer arithmetic — these are BigInts, not floats. The recursion is the image of T<sub>p</sub>T<sub>p<sup>r</sup></sub> = T<sub>p<sup>r+1</sup></sub> + p<sup>k−1</sup>T<sub>p<sup>r−1</sup></sub>, a structural fact about how index-p sublattices of a lattice sit inside index-p<sup>r</sup> ones. It becomes an arithmetic identity between astronomically large integers only because Δ happens to span a one-dimensional space.'
      : 'Mismatch — that would be a bug, not mathematics.';
  }
  let satoS = null;
  function sato() {
    const N = +document.getElementById('hk-N').value;
    document.getElementById('hk-Nv').textContent = N;
    if (satoS) satoS.redraw();
  }
  const satoCv = document.getElementById('satoCanvas');
  if (satoCv) satoS = scene(satoCv, {
    aspect: 2.3, still: true,
    draw(ctx, P) {
      const N = +document.getElementById('hk-N').value;
      const T = tauTable(N + 2), ps = primesTo(N);
      const th = ps.map(p => {
        const c = Number(T[p - 1]) / (2 * Math.pow(p, 5.5));
        return Math.acos(clamp(c, -1, 1));
      });
      const w = satoCv._w, h = satoCv._h, padL = 34, padB = 22, padT = 10, padR = 8;
      ctx.fillStyle = P.paper2; ctx.fillRect(0, 0, w, h);
      const BINS = 18, hist = new Array(BINS).fill(0);
      th.forEach(t => hist[Math.min(BINS - 1, Math.floor(t / Math.PI * BINS))]++);
      const dens = i => { // expected count in bin i under (2/π)sin²θ
        const a = i * Math.PI / BINS, b = (i + 1) * Math.PI / BINS;
        return th.length * ((b - a) / Math.PI - (Math.sin(2 * b) - Math.sin(2 * a)) / (2 * Math.PI));
      };
      let mx = 1; for (let i = 0; i < BINS; i++) mx = Math.max(mx, hist[i], dens(i));
      const X = t => padL + t / Math.PI * (w - padL - padR);
      const Y = v => h - padB - v / (mx * 1.15) * (h - padT - padB);
      ctx.strokeStyle = P.rule; ctx.beginPath(); ctx.moveTo(padL, Y(0) + .5); ctx.lineTo(w - padR, Y(0) + .5); ctx.stroke();
      const bw = (w - padL - padR) / BINS;
      for (let i = 0; i < BINS; i++) {
        ctx.fillStyle = P.acc; ctx.globalAlpha = .55;
        ctx.fillRect(padL + i * bw + 1, Y(hist[i]), bw - 2, Y(0) - Y(hist[i])); ctx.globalAlpha = 1;
      }
      ctx.beginPath();
      for (let i = 0; i <= 200; i++) {
        const t = i / 200 * Math.PI;
        const v = th.length * (2 / Math.PI) * Math.sin(t) * Math.sin(t) * (Math.PI / BINS);
        i ? ctx.lineTo(X(t), Y(v)) : ctx.moveTo(X(t), Y(v));
      }
      ctx.strokeStyle = P.acc2; ctx.lineWidth = 2; ctx.stroke();
      label(ctx, '0', padL, h - 6, P.ink4, '9px ui-monospace, monospace', 'center');
      label(ctx, 'π/2', X(Math.PI / 2), h - 6, P.ink4, '9px ui-monospace, monospace', 'center');
      label(ctx, 'π', X(Math.PI), h - 6, P.ink4, '9px ui-monospace, monospace', 'center');
      label(ctx, 'θ_p  where  τ(p) = 2p^{11/2} cos θ_p', padL + 4, padT + 8, P.ink4, '9px ui-monospace, monospace');
      label(ctx, ps.length + ' primes', w - padR - 4, padT + 8, P.acc2, '9px ui-monospace, monospace', 'right');
      label(ctx, '(2/π)sin²θ', w - padR - 4, padT + 20, P.acc2, '9px ui-monospace, monospace', 'right');
    }
  });

  ['hk-m', 'hk-n'].forEach(id => document.getElementById(id).addEventListener('input', mult));
  document.getElementById('hk-p').addEventListener('change', rec);
  document.getElementById('hk-r').addEventListener('input', rec);
  document.getElementById('hk-N').addEventListener('input', sato);
  modeBox.querySelectorAll('.btn').forEach(b => b.addEventListener('click', () => {
    modeBox.querySelectorAll('.btn').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    const m = b.dataset.m;
    document.getElementById('hk-mult').hidden = m !== 'mult';
    document.getElementById('hk-rec').hidden = m !== 'rec';
    document.getElementById('hk-sato').hidden = m !== 'sato';
    if (m === 'rec') rec(); if (m === 'sato') sato();
  }));
  // Build the τ table once, off the critical path.
  new IntersectionObserver((es, o) => {
    if (!es[0].isIntersecting) return;
    o.disconnect();
    setTimeout(() => { tauTable(TMAX); mult(); }, 0);
  }, { rootMargin: '400px' }).observe(modeBox);
})();

/* ---------------------------------------------------------------
   FIG 8 — sums of squares
   --------------------------------------------------------------- */
(function fig8() {
  const cv = document.getElementById('sqCanvas'); if (!cv) return;
  const NM = 100;
  /** θ(z)^k coefficients by straight convolution — pure counting, no modularity used. */
  const theta = (() => { const t = new Array(NM + 1).fill(0); t[0] = 1; for (let m = 1; m * m <= NM; m++) t[m * m] = 2; return t; })();
  const TH = {}; { let cur = theta.slice(); TH[1] = cur; for (let k = 2; k <= 8; k++) { cur = smul(cur, theta, NM); TH[k] = cur; } }

  const chi = d => d % 2 === 0 ? 0 : (d % 4 === 1 ? 1 : -1);
  const divs = n => { const r = []; for (let d = 1; d <= n; d++) if (n % d === 0) r.push(d); return r; };
  const FORM = {
    2: { f: n => 4 * divs(n).reduce((s, d) => s + chi(d), 0), tex: 'r_2(n) = 4\\big(d_1(n) - d_3(n)\\big)', note: 'Divisors ≡ 1 mod 4 minus divisors ≡ 3 mod 4. This is Fermat’s two-square theorem with multiplicity: r₂(n) = 0 exactly when some prime ≡ 3 mod 4 divides n to an odd power.' },
    4: { f: n => 8 * divs(n).reduce((s, d) => s + (d % 4 ? d : 0), 0), tex: 'r_4(n) = 8\\!\\!\\sum_{d\\mid n,\\ 4\\nmid d}\\!\\! d', note: 'Jacobi 1829. The sum is never empty (d = 1 always qualifies), so r₄(n) &gt; 0 for every n — Lagrange’s four-square theorem, as a corollary of an exact formula rather than a clever descent.' },
    6: { f: n => 16 * divs(n).reduce((s, d) => s + chi(n / d) * d * d, 0) - 4 * divs(n).reduce((s, d) => s + chi(d) * d * d, 0), tex: 'r_6(n) = 16\\sum_{d\\mid n}\\chi(n/d)d^2 - 4\\sum_{d\\mid n}\\chi(d)d^2', note: 'χ is the non-trivial character mod 4. Two Eisenstein series are needed now, because the relevant space is two-dimensional — the formula grows a second term for exactly the reason the dimension grew.' },
    8: { f: n => 16 * divs(n).reduce((s, d) => s + (((n + d) % 2) ? -1 : 1) * d * d * d, 0), tex: 'r_8(n) = 16\\sum_{d\\mid n}(-1)^{n+d}d^3', note: 'Weight 4 on Γ₀(4), still pure Eisenstein, so still exact. At k = 10 a cusp form finally enters and the clean formula acquires an error term — that is where "main term + error" starts, structurally.' }
  };
  let K = 4, N = 40;

  const S = scene(cv, {
    aspect: 2.6, still: true,
    draw(ctx, P) {
      const w = cv._w, h = cv._h, padL = 48, padB = 20, padT = 12;
      ctx.fillStyle = P.paper2; ctx.fillRect(0, 0, w, h);
      let mx = 1; for (let n = 1; n <= N; n++) mx = Math.max(mx, TH[K][n] || 0);
      const X = n => padL + (n - 1) / (N - 1) * (w - padL - 12);
      const Y = v => h - padB - v / (mx * 1.06) * (h - padT - padB);
      ctx.strokeStyle = P.rule; ctx.beginPath(); ctx.moveTo(padL, Y(0) + .5); ctx.lineTo(w - 12, Y(0) + .5); ctx.stroke();
      // formula curve
      ctx.beginPath();
      for (let n = 1; n <= N; n++) { const v = FORM[K].f(n); n === 1 ? ctx.moveTo(X(n), Y(v)) : ctx.lineTo(X(n), Y(v)); }
      ctx.strokeStyle = P.acc2; ctx.lineWidth = 1.6; ctx.stroke();
      // counted dots
      for (let n = 1; n <= N; n++) dot(ctx, X(n), Y(TH[K][n] || 0), 2.7, P.acc);
      for (let n = 1; n <= N; n++) if (n % Math.ceil(N / 12) === 0) label(ctx, String(n), X(n), h - 6, P.ink4, '9px ui-monospace, monospace', 'center');
      label(ctx, 'r_' + K + '(n)', 6, padT + 8, P.ink4, '9px ui-monospace, monospace');
      label(ctx, 'dots = counted', w - 14, padT + 8, P.acc, '9px ui-monospace, monospace', 'right');
      label(ctx, 'line = formula', w - 14, padT + 20, P.acc2, '9px ui-monospace, monospace', 'right');
    }
  });
  function render() {
    document.getElementById('sq-nv').textContent = N;
    document.getElementById('sq-formula').innerHTML = '\\[' + FORM[K].tex + '\\]<p style="margin:6px 0 0">' + FORM[K].note + '</p>';
    let html = '<tr><th>n</th><th>counted</th><th>formula</th><th>Δ</th></tr>', bad = 0;
    for (let n = 1; n <= Math.min(N, 18); n++) {
      const a = TH[K][n] || 0, b = FORM[K].f(n); if (a !== b) bad++;
      html += '<tr><td>' + n + '</td><td>' + a.toLocaleString() + '</td><td>' + b.toLocaleString() + '</td><td style="color:' + (a === b ? css('--ok') : css('--bad')) + '">' + (a - b) + '</td></tr>';
    }
    document.getElementById('sq-table').innerHTML = html;
    S.redraw();
    if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([document.getElementById('sq-formula')]);
  }
  document.querySelectorAll('#sq-k .btn').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('#sq-k .btn').forEach(x => x.classList.remove('on'));
    b.classList.add('on'); K = +b.dataset.k; render();
  }));
  document.getElementById('sq-n').addEventListener('input', e => { N = +e.target.value; render(); });
  render();
})();

})();
