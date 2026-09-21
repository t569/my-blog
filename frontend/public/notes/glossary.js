/* ============================================================
   THE MARGINALIA SERIES — glossary runtime
   Click any dotted term to open a plain-English card with a
   small animated figure. Terms are tagged automatically from
   the dictionary in glossary-terms.js, so the prose stays clean.

   Load order:  glossary-terms.js  →  notes.js  →  glossary.js
   ============================================================ */
(function () {
  'use strict';

  /* ---------- mini-figures ------------------------------------------------
     Each is draw(ctx, P, t, w, h) where t is seconds since the card opened.
     Keep them small, legible at 340×150, and theme-aware via P.
     ---------------------------------------------------------------------- */

  const TAU = Math.PI * 2;
  const ease = x => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  const loop = (t, period) => (t % period) / period;           // 0→1 ramp
  const pingpong = (t, period) => { const u = loop(t, period); return u < .5 ? u * 2 : 2 - u * 2; };

  function clear(ctx, P, w, h) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = P.paper3; ctx.fillRect(0, 0, w, h);
  }
  function cap(ctx, P, txt, w, h) {
    ctx.save();
    ctx.fillStyle = P.ink3; ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(txt, w / 2, h - 5);
    ctx.restore();
  }
  function mono(ctx, P, txt, x, y, color, size, align) {
    ctx.save();
    ctx.fillStyle = color || P.ink2;
    ctx.font = (size || 12) + 'px ui-monospace, monospace';
    ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(txt, x, y); ctx.restore();
  }
  function arrow(ctx, x1, y1, x2, y2, color, wdt) {
    const a = Math.atan2(y2 - y1, x2 - x1), s = 5;
    ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = wdt || 1.5;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - s * Math.cos(a - .4), y2 - s * Math.sin(a - .4));
    ctx.lineTo(x2 - s * Math.cos(a + .4), y2 - s * Math.sin(a + .4));
    ctx.closePath(); ctx.fill(); ctx.restore();
  }

  const GFIG = {

    /* A conformal map bends a grid but keeps every crossing at 90°. */
    holo(ctx, P, t, w, h) {
      clear(ctx, P, w, h);
      const k = .38 * pingpong(t, 6);                 // strength of the bend
      const cx = w / 2, cy = h / 2 - 6, R = Math.min(w, h) * .40;
      const map = (u, v) => {                          // z ↦ z + k z²  (conformal)
        const x = u, y = v;
        return [x + k * (x * x - y * y), y + k * (2 * x * y)];
      };
      ctx.lineWidth = 1;
      for (let i = -4; i <= 4; i++) {
        for (const horiz of [true, false]) {
          ctx.strokeStyle = horiz ? P.acc : P.acc2;
          ctx.globalAlpha = .75;
          ctx.beginPath();
          for (let j = -40; j <= 40; j++) {
            const a = i / 4, b = j / 40;
            const [u, v] = horiz ? [b, a] : [a, b];
            const [X, Y] = map(u, v);
            const px = cx + X * R, py = cy - Y * R;
            j === -40 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      cap(ctx, P, 'every crossing stays at 90° — that is holomorphy', w, h);
    },

    /* Möbius map shuffling the upper half-plane; the boundary stays the boundary. */
    mobius(ctx, P, t, w, h) {
      clear(ctx, P, w, h);
      const cx = w / 2, base = h - 28, S = Math.min(w / 4.2, (h - 46) / 2.1);
      ctx.strokeStyle = P.ink3; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(8, base); ctx.lineTo(w - 8, base); ctx.stroke();
      const u = pingpong(t, 5), ang = u * Math.PI;      // interpolate towards z ↦ −1/z
      const pts = [];
      for (let i = 0; i < 26; i++) {
        const th = Math.PI * (.08 + .84 * i / 25), r = 1;
        pts.push([r * Math.cos(th), r * Math.sin(th)]);
      }
      pts.forEach((p, i) => {
        const [x, y] = p;
        // rotate in the disc model = Möbius motion of H
        const c = Math.cos(ang / 2), s = Math.sin(ang / 2);
        const na = c * x - s * y, nb = s * x + c * y;
        const d = na * na + nb * nb;
        const X = (1 - u) * x + u * (-na / d), Y = (1 - u) * y + u * (nb / d);
        ctx.beginPath();
        ctx.arc(cx + X * S, base - Y * S, 2.6, 0, TAU);
        ctx.fillStyle = i % 5 === 0 ? P.acc2 : P.acc; ctx.fill();
      });
      mono(ctx, P, 'z ↦ (az+b)/(cz+d)', 10, 16, P.acc, 11);
      cap(ctx, P, 'the real line maps to itself; the top half stays on top', w, h);
    },

    /* Same lattice, two different bases. */
    lattice(ctx, P, t, w, h) {
      clear(ctx, P, w, h);
      const cx = w / 2, cy = h / 2 - 6, S = 22;
      ctx.fillStyle = P.ink4;
      for (let m = -6; m <= 6; m++) for (let n = -4; n <= 4; n++) {
        ctx.beginPath(); ctx.arc(cx + m * S + n * S * .38, cy - n * S * .9, 1.9, 0, TAU); ctx.fill();
      }
      const u = pingpong(t, 5);
      const b1 = [1, 0], b2a = [.38, .9], b2b = [1.38, .9];   // (0,1) vs (1,1) — same lattice
      const b2 = [b2a[0] + u * (b2b[0] - b2a[0]), b2a[1] + u * (b2b[1] - b2a[1])];
      arrow(ctx, cx, cy, cx + b1[0] * S, cy - b1[1] * S, P.acc, 2);
      arrow(ctx, cx, cy, cx + b2[0] * S, cy - b2[1] * S, P.acc2, 2);
      ctx.save();
      ctx.fillStyle = P.acc; ctx.globalAlpha = .13;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + b1[0] * S, cy - b1[1] * S);
      ctx.lineTo(cx + (b1[0] + b2[0]) * S, cy - (b1[1] + b2[1]) * S);
      ctx.lineTo(cx + b2[0] * S, cy - b2[1] * S);
      ctx.closePath(); ctx.fill(); ctx.restore();
      cap(ctx, P, 'different basis, identical set of points', w, h);
    },

    /* The strip rolls up into a punctured disc: q = e^{2πiz}. */
    qmap(ctx, P, t, w, h) {
      clear(ctx, P, w, h);
      const u = ease(pingpong(t, 6));
      const lx = w * .26, rx = w * .74, cy = h / 2 - 4, R = Math.min(h * .30, w * .16);
      ctx.lineWidth = 1.6;
      for (let i = 0; i <= 12; i++) {
        const s = i / 12;
        const fx = lx - 42 + s * 84, fy0 = cy - 46, fy1 = cy + 46;   // flat strip
        const th = s * TAU, rr = R;
        for (let k = 0; k <= 1; k++) {
          const yy = k ? fy1 : fy0, rad = k ? rr * .35 : rr;
          const X = fx + u * (rx + rad * Math.cos(th - Math.PI / 2) - fx);
          const Y = yy + u * (cy + rad * Math.sin(th - Math.PI / 2) - yy);
          if (k === 0) { ctx.beginPath(); ctx.moveTo(X, Y); ctx.strokeStyle = i % 3 ? P.acc : P.acc2; }
          else { ctx.lineTo(X, Y); ctx.stroke(); }
        }
      }
      ctx.fillStyle = P.bad;
      ctx.beginPath(); ctx.arc(lx - 42 + u * (rx - lx + 42), cy, 2.5, 0, TAU); ctx.fill();
      mono(ctx, P, u < .5 ? 'z-strip' : 'q-disc', 10, 16, P.acc, 11);
      cap(ctx, P, 'q = e^(2πiz) wraps the strip; the cusp is the centre dot', w, h);
    },

    /* Pinwheel: a zero and a pole seen in domain colouring. */
    pole(ctx, P, t, w, h) {
      clear(ctx, P, w, h);
      const R = Math.min(h * .36, w * .21), spin = t * .55;
      [[w * .30, -1, 'zero'], [w * .70, 1, 'pole']].forEach(([cx, sgn, lab]) => {
        const cy = h / 2 - 8;
        for (let a = 0; a < 48; a++) {
          const th0 = a / 48 * TAU, th1 = (a + 1.1) / 48 * TAU;
          ctx.beginPath(); ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, R, th0, th1); ctx.closePath();
          const hue = ((sgn * (th0 + spin)) / TAU * 360 + 720) % 360;
          ctx.fillStyle = 'hsl(' + hue.toFixed(0) + ' 72% 55%)';
          ctx.fill();
        }
        ctx.fillStyle = P.paper3;
        ctx.beginPath(); ctx.arc(cx, cy, sgn < 0 ? 3 : 0, 0, TAU); ctx.fill();
        mono(ctx, P, lab, cx, cy + R + 13, P.ink2, 11, 'center');
      });
      cap(ctx, P, 'colours wheel one way at a zero, the other at a pole', w, h);
    },

    /* Winding number: a loop around a zero makes f(z) circle the origin once. */
    argprinciple(ctx, P, t, w, h) {
      clear(ctx, P, w, h);
      const th = loop(t, 5) * TAU;
      const L = { x: w * .27, y: h / 2 - 6, r: Math.min(h * .28, w * .16) };
      const R2 = { x: w * .73, y: h / 2 - 6, r: Math.min(h * .28, w * .16) };
      [L, R2].forEach(c => {
        ctx.strokeStyle = P.rule; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(c.x - c.r * 1.3, c.y); ctx.lineTo(c.x + c.r * 1.3, c.y);
        ctx.moveTo(c.x, c.y - c.r * 1.3); ctx.lineTo(c.x, c.y + c.r * 1.3); ctx.stroke();
      });
      ctx.strokeStyle = P.acc; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(L.x, L.y, L.r, 0, TAU); ctx.stroke();
      ctx.beginPath();                                  // image curve: winds twice (double zero look)
      for (let i = 0; i <= 90; i++) {
        const a = i / 90 * TAU, rr = R2.r * (.55 + .35 * Math.cos(2 * a));
        const px = R2.x + rr * Math.cos(2 * a), py = R2.y - rr * Math.sin(2 * a);
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.strokeStyle = P.acc2; ctx.stroke();
      ctx.fillStyle = P.bad;
      ctx.beginPath(); ctx.arc(L.x, L.y, 3, 0, TAU); ctx.fill();
      const rr = R2.r * (.55 + .35 * Math.cos(2 * th));
      ctx.fillStyle = P.acc2;
      ctx.beginPath(); ctx.arc(R2.x + rr * Math.cos(2 * th), R2.y - rr * Math.sin(2 * th), 3.4, 0, TAU); ctx.fill();
      ctx.fillStyle = P.acc;
      ctx.beginPath(); ctx.arc(L.x + L.r * Math.cos(th), L.y - L.r * Math.sin(th), 3.4, 0, TAU); ctx.fill();
      mono(ctx, P, 'z goes round once', L.x, h - 22, P.ink3, 10, 'center');
      mono(ctx, P, 'f(z) goes round twice', R2.x, h - 22, P.ink3, 10, 'center');
      cap(ctx, P, 'count the laps and you have counted the zeros', w, h);
    },

    /* Eigenvector: most vectors get rotated, one stays on its own line. */
    eigen(ctx, P, t, w, h) {
      clear(ctx, P, w, h);
      const cx = w / 2, cy = h / 2 - 6, S = Math.min(w, h) * .30;
      const u = pingpong(t, 4);
      const A = [[1 + .8 * u, .6 * u], [.2 * u, 1 + .3 * u]];
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * TAU, vx = Math.cos(a), vy = Math.sin(a);
        const nx = A[0][0] * vx + A[0][1] * vy, ny = A[1][0] * vx + A[1][1] * vy;
        ctx.strokeStyle = P.ink4; ctx.globalAlpha = .5; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + nx * S * .7, cy - ny * S * .7); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // the (approximate) dominant eigenvector of A at u=1
      const ev = [.93, .37];
      const nx = A[0][0] * ev[0] + A[0][1] * ev[1], ny = A[1][0] * ev[0] + A[1][1] * ev[1];
      ctx.strokeStyle = P.rule; ctx.setLineDash([3, 4]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx - ev[0] * S * 1.4, cy + ev[1] * S * 1.4);
      ctx.lineTo(cx + ev[0] * S * 1.4, cy - ev[1] * S * 1.4); ctx.stroke(); ctx.setLineDash([]);
      arrow(ctx, cx, cy, cx + nx * S * .78, cy - ny * S * .78, P.acc2, 2.2);
      cap(ctx, P, 'the dashed line is the eigenvector — it only stretches', w, h);
    },

    /* Eratosthenes crossing out multiples. */
    sieve(ctx, P, t, w, h) {
      clear(ctx, P, w, h);
      const cols = 15, rows = 6, N = cols * rows;
      const cw = (w - 20) / cols, ch = Math.min((h - 30) / rows, 15);
      const primes = [2, 3, 5, 7];
      const stage = Math.floor(loop(t, 9) * 5);
      const killed = new Uint8Array(N + 2);
      for (let s = 0; s < stage && s < primes.length; s++) {
        const p = primes[s];
        for (let m = 2 * p; m <= N; m += p) killed[m] = 1;
      }
      for (let i = 0; i < N; i++) {
        const n = i + 1, r = Math.floor(i / cols), c = i % cols;
        const x = 10 + c * cw, y = 12 + r * ch;
        ctx.fillStyle = n === 1 ? P.ink4 : killed[n] ? P.ink4 : P.acc;
        ctx.globalAlpha = killed[n] ? .3 : 1;
        ctx.font = '9.5px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(n), x + cw / 2, y + ch / 2);
        if (killed[n]) {
          ctx.strokeStyle = P.bad; ctx.globalAlpha = .55; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x + 2, y + ch - 3); ctx.lineTo(x + cw - 2, y + 3); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      cap(ctx, P, stage === 0 ? 'start: every number' : 'crossed out multiples of ' + primes.slice(0, stage).join(', '), w, h);
    },

    /* Inclusion–exclusion overshooting and undershooting the truth. */
    incexcl(ctx, P, t, w, h) {
      clear(ctx, P, w, h);
      const truth = h / 2 - 4, x0 = 18, x1 = w - 14;
      ctx.strokeStyle = P.ink3; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x0, truth); ctx.lineTo(x1, truth); ctx.stroke(); ctx.setLineDash([]);
      mono(ctx, P, 'truth', x1 - 2, truth - 10, P.ink3, 10, 'right');
      const n = 8, shown = Math.min(n, 1 + Math.floor(loop(t, 7) * (n + 1)));
      for (let i = 0; i < shown; i++) {
        const amp = 46 * Math.pow(.62, i) * (i % 2 ? -1 : 1);
        const bx = x0 + (i + .5) * (x1 - x0) / n;
        ctx.fillStyle = i % 2 ? P.acc2 : P.acc; ctx.globalAlpha = .8;
        const bw = (x1 - x0) / n * .56;
        ctx.fillRect(bx - bw / 2, truth, bw, amp);
        ctx.globalAlpha = 1;
      }
      mono(ctx, P, 'over', x0, truth - 44, P.acc, 10);
      mono(ctx, P, 'under', x0, truth + 44, P.acc2, 10);
      cap(ctx, P, 'each extra term flips the sign and shrinks the miss', w, h);
    },

    /* Big-O: g eventually sits under C·f. */
    bigO(ctx, P, t, w, h) {
      clear(ctx, P, w, h);
      const x0 = 16, x1 = w - 14, y0 = h - 26, y1 = 14;
      const X = u => x0 + u * (x1 - x0), Y = v => y0 - v * (y0 - y1);
      ctx.strokeStyle = P.rule; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.stroke();
      const C = 1.1 + .8 * pingpong(t, 5);
      const f = u => Math.pow(u, .58), g = u => .42 * Math.pow(u, .58) * (1 + .55 * Math.sin(u * 13));
      for (const [fn, col, wd] of [[u => C * f(u), P.acc, 2], [g, P.acc2, 2]]) {
        ctx.beginPath(); ctx.strokeStyle = col; ctx.lineWidth = wd;
        for (let i = 0; i <= 120; i++) { const u = i / 120; i ? ctx.lineTo(X(u), Y(fn(u) * .85)) : ctx.moveTo(X(u), Y(fn(u) * .85)); }
        ctx.stroke();
      }
      mono(ctx, P, 'C·f(n)', x1 - 4, Y(C * f(1) * .85) - 9, P.acc, 10.5, 'right');
      mono(ctx, P, 'g(n)', x1 - 4, Y(g(1) * .85) + 11, P.acc2, 10.5, 'right');
      cap(ctx, P, 'g = O(f): some fixed multiple of f stays on top', w, h);
    },

    /* Two sets with identical sieve data, opposite prime content. */
    parity(ctx, P, t, w, h) {
      clear(ctx, P, w, h);
      const cols = 18, rows = 4, cw = (w - 24) / cols, ch = Math.min((h - 40) / rows, 16);
      const flash = Math.sin(t * 2.2) * .5 + .5;
      for (let i = 0; i < cols * rows; i++) {
        const n = i + 2, r = Math.floor(i / cols), c = i % cols;
        let m = n, om = 0; for (let p = 2; p * p <= m; p++) while (m % p === 0) { m /= p; om++; } if (m > 1) om++;
        const even = om % 2 === 0;
        const x = 12 + c * cw, y = 14 + r * ch;
        ctx.fillStyle = even ? P.acc : P.acc2;
        ctx.globalAlpha = .18 + .5 * (even ? flash : 1 - flash);
        ctx.fillRect(x + 1, y + 1, cw - 2, ch - 2);
        ctx.globalAlpha = 1;
        ctx.fillStyle = P.ink2; ctx.font = '9px ui-monospace, monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(n), x + cw / 2, y + ch / 2);
      }
      mono(ctx, P, 'Ω even', 12, h - 20, P.acc, 10);
      mono(ctx, P, 'Ω odd (all primes live here)', 74, h - 20, P.acc2, 10);
      cap(ctx, P, 'both halves look identical to every divisor count', w, h);
    },

    /* Dominoes: induction. */
    induction(ctx, P, t, w, h) {
      clear(ctx, P, w, h);
      const n = 9, base = h - 26, gap = (w - 36) / n;
      const front = loop(t, 5) * (n + 1.4);
      for (let i = 0; i < n; i++) {
        const fall = Math.max(0, Math.min(1, front - i));
        const ang = ease(fall) * (Math.PI / 2 - .12);
        const x = 20 + i * gap, hh = Math.min(34, gap * 1.7);
        ctx.save(); ctx.translate(x, base); ctx.rotate(ang);
        ctx.fillStyle = fall > .98 ? P.acc2 : P.acc;
        ctx.globalAlpha = .85;
        ctx.fillRect(-3.5, -hh, 7, hh);
        ctx.restore();
      }
      ctx.strokeStyle = P.rule; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(10, base + .5); ctx.lineTo(w - 10, base + .5); ctx.stroke();
      mono(ctx, P, 'base case', 20, 18, P.acc, 10.5);
      mono(ctx, P, 'n ⇒ n+1', w - 14, 18, P.acc2, 10.5, 'right');
      cap(ctx, P, 'knock the first one over, and every one falls', w, h);
    },

    /* A strictly descending chain has to stop. */
    wellorder(ctx, P, t, w, h) {
      clear(ctx, P, w, h);
      const steps = [10, 7.4, 5.3, 3.8, 2.6, 1.7, 1.0, .5, .18, 0];
      const x0 = 20, x1 = w - 16, base = h - 28, top = 16;
      ctx.strokeStyle = P.rule; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0, base + .5); ctx.lineTo(x1, base + .5); ctx.stroke();
      const k = Math.min(steps.length - 1, loop(t, 6) * steps.length);
      for (let i = 0; i < steps.length; i++) {
        const px = x0 + i * (x1 - x0) / (steps.length - 1);
        const py = base - steps[i] / 10 * (base - top);
        ctx.fillStyle = i <= k ? P.acc : P.ink4;
        ctx.globalAlpha = i <= k ? 1 : .3;
        ctx.beginPath(); ctx.arc(px, py, 3.4, 0, TAU); ctx.fill();
        if (i > 0 && i <= k) {
          const qx = x0 + (i - 1) * (x1 - x0) / (steps.length - 1);
          const qy = base - steps[i - 1] / 10 * (base - top);
          ctx.strokeStyle = P.acc; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(px, py); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      mono(ctx, P, 'ω^ω', x0, top - 4, P.acc2, 10);
      mono(ctx, P, '0', x1 - 4, base - 8, P.ok, 11, 'right');
      cap(ctx, P, 'no infinite descent is possible — so it terminates', w, h);
    },

    /* Cantor's diagonal / the diagonal lemma, as a grid. */
    diagonal(ctx, P, t, w, h) {
      clear(ctx, P, w, h);
      const n = 8, S = Math.min((w - 40) / n, (h - 40) / n);
      const ox = (w - n * S) / 2, oy = 12;
      const lit = Math.floor(loop(t, 6) * (n + 1));
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        const on = ((r * 7 + c * 3 + (r === c ? 1 : 0)) % 3) === 0;
        ctx.fillStyle = r === c ? (r < lit ? P.acc2 : P.acc) : (on ? P.ink4 : P.paper2);
        ctx.globalAlpha = r === c ? (r < lit ? 1 : .45) : (on ? .55 : 1);
        ctx.fillRect(ox + c * S + .5, oy + r * S + .5, S - 1, S - 1);
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = P.acc2; ctx.lineWidth = 1.6;
      ctx.strokeRect(ox + .5, oy + .5, n * S - 1, n * S - 1);
      cap(ctx, P, 'read down the diagonal, then flip it: nothing on the list matches', w, h);
    },

    /* Strings become numbers. */
    coding(ctx, P, t, w, h) {
      clear(ctx, P, w, h);
      const syms = ['∀', 'x', '¬', 'S', 'x', '=', '0'];
      const codes = [1, 17, 5, 3, 17, 7, 2];
      const k = Math.floor(loop(t, 7) * (syms.length + 2));
      const cw = (w - 28) / syms.length;
      syms.forEach((s, i) => {
        const x = 14 + i * cw + cw / 2;
        ctx.fillStyle = i < k ? P.acc : P.ink3;
        ctx.font = '16px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(s, x, 26);
        if (i < k) {
          arrow(ctx, x, 38, x, 52, P.rule, 1);
          mono(ctx, P, String(codes[i]), x, 62, P.acc, 11, 'center');
          mono(ctx, P, 'p' + (i + 1) + '^', x, 80, P.ink4, 9.5, 'center');
        }
      });
      if (k > syms.length) mono(ctx, P, '= one enormous, perfectly ordinary integer', w / 2, h - 22, P.acc2, 11, 'center');
      cap(ctx, P, 'unique factorisation makes this reversible', w, h);
    },

    /* β-reduction, as a text animation. */
    beta(ctx, P, t, w, h) {
      clear(ctx, P, w, h);
      const frames = [
        '(fun x => x + x) 3',
        '(fun x => x + x) 3',
        '3 + 3',
        '3 + 3',
        '6'
      ];
      const rules = ['', 'β: substitute 3 for x', 'β', 'ι: unfold +', 'normal form'];
      const k = Math.floor(loop(t, 7.5) * frames.length);
      mono(ctx, P, frames[k], w / 2, h / 2 - 12, P.ink, 17, 'center');
      mono(ctx, P, rules[k] || '', w / 2, h / 2 + 16, P.acc, 11, 'center');
      cap(ctx, P, 'checking a proof and running a program are one operation', w, h);
    },

    /* Curry–Howard: two columns, one arrow. */
    curryhoward(ctx, P, t, w, h) {
      clear(ctx, P, w, h);
      const rows = [['proposition', 'type'], ['proof', 'term'], ['A → B', 'function'], ['modus ponens', 'application']];
      const lit = Math.floor(loop(t, 8) * (rows.length + 1));
      const lx = w * .30, rx = w * .70;
      mono(ctx, P, 'LOGIC', lx, 16, P.acc, 10, 'center');
      mono(ctx, P, 'PROGRAMS', rx, 16, P.acc2, 10, 'center');
      rows.forEach((r, i) => {
        const y = 36 + i * 21;
        const on = i < lit;
        mono(ctx, P, r[0], lx, y, on ? P.ink : P.ink4, 12, 'center');
        mono(ctx, P, r[1], rx, y, on ? P.ink : P.ink4, 12, 'center');
        if (on) { ctx.globalAlpha = .9; arrow(ctx, lx + 42, y, rx - 44, y, P.rule, 1); ctx.globalAlpha = 1; }
      });
      cap(ctx, P, 'not an analogy — literally the same objects', w, h);
    },

    /* A parse tree growing. */
    tree(ctx, P, t, w, h) {
      clear(ctx, P, w, h);
      const nodes = [
        { x: .5, y: .16, l: '∀x', p: -1 },
        { x: .5, y: .42, l: '∃y', p: 0 },
        { x: .5, y: .66, l: '<', p: 1 },
        { x: .33, y: .88, l: 'x', p: 2 },
        { x: .67, y: .88, l: 'y', p: 2 }
      ];
      const lit = Math.floor(loop(t, 6) * (nodes.length + 1));
      nodes.forEach((n, i) => {
        if (i >= lit) return;
        const x = 14 + n.x * (w - 28), y = 12 + n.y * (h - 42);
        if (n.p >= 0) {
          const p = nodes[n.p], px = 14 + p.x * (w - 28), py = 12 + p.y * (h - 42);
          ctx.strokeStyle = P.rule; ctx.lineWidth = 1.3;
          ctx.beginPath(); ctx.moveTo(px, py + 9); ctx.lineTo(x, y - 9); ctx.stroke();
        }
        ctx.fillStyle = i === lit - 1 ? P.acc2 : P.acc;
        ctx.beginPath(); ctx.arc(x, y, 10, 0, TAU); ctx.fill();
        ctx.fillStyle = P.paper2; ctx.font = '11px ui-monospace, monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(n.l, x, y);
      });
      cap(ctx, P, 'a formula is a tree, built from the leaves up', w, h);
    },

    /* Divergent vs convergent partial sums. */
    convergence(ctx, P, t, w, h) {
      clear(ctx, P, w, h);
      const x0 = 18, x1 = w - 14, y0 = h - 26, y1 = 14;
      const n = Math.max(4, Math.floor(loop(t, 7) * 70) + 4);
      ctx.strokeStyle = P.rule; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.stroke();
      const draw = (f, col) => {
        ctx.beginPath(); ctx.strokeStyle = col; ctx.lineWidth = 2;
        let s = 0;
        for (let i = 1; i <= n; i++) {
          s += f(i);
          const px = x0 + (i / 70) * (x1 - x0), py = y0 - Math.min(1, s / 2.4) * (y0 - y1);
          i === 1 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.stroke();
      };
      draw(i => 1 / i * .42, P.acc);          // divergent (slowly)
      draw(i => 1 / (i * i) * 1.3, P.acc2);   // convergent
      ctx.setLineDash([3, 4]); ctx.strokeStyle = P.ok; ctx.lineWidth = 1.2;
      const lim = y0 - Math.min(1, (1.3 * Math.PI * Math.PI / 6) / 2.4) * (y0 - y1);
      ctx.beginPath(); ctx.moveTo(x0, lim); ctx.lineTo(x1, lim); ctx.stroke(); ctx.setLineDash([]);
      mono(ctx, P, 'Σ1/n — no ceiling', x0 + 4, y1 + 4, P.acc, 10);
      mono(ctx, P, 'Σ1/n² — settles', x1 - 4, lim - 9, P.acc2, 10, 'right');
      cap(ctx, P, 'both shrink to zero; only one of them adds up', w, h);
    },

    /* Multiplicative: f(mn) = f(m)f(n) when m, n share no factors. */
    multiplicative(ctx, P, t, w, h) {
      clear(ctx, P, w, h);
      const u = ease(pingpong(t, 5));
      const cy = h / 2 - 6;
      const boxes = [['4 = 2²', w * .22, P.acc], ['9 = 3²', w * .50, P.acc2], ['36', w * .78, P.ok]];
      boxes.forEach(([lab, x, col], i) => {
        const on = i < 2 ? 1 : u;
        ctx.globalAlpha = .16 * on; ctx.fillStyle = col;
        ctx.fillRect(x - 34, cy - 20, 68, 40);
        ctx.globalAlpha = on;
        ctx.strokeStyle = col; ctx.lineWidth = 1.3; ctx.strokeRect(x - 34, cy - 20, 68, 40);
        mono(ctx, P, lab, x, cy - 4, P.ink, 12.5, 'center');
        ctx.globalAlpha = 1;
      });
      mono(ctx, P, '×', (w * .22 + w * .50) / 2, cy, P.ink3, 14, 'center');
      mono(ctx, P, '=', (w * .50 + w * .78) / 2, cy, P.ink3, 14, 'center');
      mono(ctx, P, 'σ=7', w * .22, cy + 12, P.acc, 10.5, 'center');
      mono(ctx, P, 'σ=13', w * .50, cy + 12, P.acc2, 10.5, 'center');
      ctx.globalAlpha = u; mono(ctx, P, 'σ=91 = 7·13', w * .78, cy + 12, P.ok, 10.5, 'center'); ctx.globalAlpha = 1;
      cap(ctx, P, 'works only because 4 and 9 share no prime factor', w, h);
    },

    /* Unification: two trees slotting together. */
    unify(ctx, P, t, w, h) {
      clear(ctx, P, w, h);
      const u = ease(pingpong(t, 5));
      const cy = h / 2 - 8;
      mono(ctx, P, 'α → β', w * .5 - 96 + u * 40, cy - 14, P.acc, 14, 'center');
      mono(ctx, P, 'Nat → γ', w * .5 + 96 - u * 40, cy - 14, P.acc2, 14, 'center');
      ctx.globalAlpha = u;
      mono(ctx, P, 'α := Nat,  γ := β', w * .5, cy + 22, P.ok, 12.5, 'center');
      ctx.globalAlpha = 1;
      ctx.strokeStyle = P.rule; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(w * .5 - 70, cy + 6); ctx.lineTo(w * .5 + 70, cy + 6); ctx.stroke();
      cap(ctx, P, 'find the substitution that makes both sides identical', w, h);
    },

    /* Quantifier scope over a row of objects. */
    quantifier(ctx, P, t, w, h) {
      clear(ctx, P, w, h);
      const n = 9, y = h / 2 - 4, gap = (w - 40) / (n - 1);
      const phase = loop(t, 6);
      const forall = phase < .5;
      const k = Math.floor((forall ? phase * 2 : (phase - .5) * 2) * n);
      for (let i = 0; i < n; i++) {
        const x = 20 + i * gap;
        const hit = forall ? i <= k : i === 4;
        ctx.fillStyle = hit ? (forall ? P.acc : P.acc2) : P.ink4;
        ctx.globalAlpha = hit ? 1 : .3;
        ctx.beginPath(); ctx.arc(x, y, 6.5, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
      }
      mono(ctx, P, forall ? '∀x  —  every single one' : '∃x  —  at least one', w / 2, y - 30, forall ? P.acc : P.acc2, 13, 'center');
      cap(ctx, P, 'the two quantifiers, and nothing else', w, h);
    },

    /* Decidable vs semi-decidable search. */
    search(ctx, P, t, w, h) {
      clear(ctx, P, w, h);
      const y = h / 2 - 2, x0 = 18, x1 = w - 16;
      ctx.strokeStyle = P.rule; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      arrow(ctx, x1 - 20, y, x1, y, P.ink4, 1);
      const u = loop(t, 5);
      const px = x0 + u * (x1 - x0 - 24);
      ctx.fillStyle = P.acc;
      ctx.beginPath(); ctx.arc(px, y, 4.5, 0, TAU); ctx.fill();
      for (let i = 0; i < 26; i++) {
        const x = x0 + i * (x1 - x0) / 26;
        ctx.strokeStyle = x < px ? P.acc : P.ink4; ctx.globalAlpha = x < px ? .8 : .3;
        ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 5); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      mono(ctx, P, 'if a proof exists you will find it…', w / 2, y - 26, P.acc, 11, 'center');
      mono(ctx, P, '…if none exists you search forever', w / 2, y + 26, P.bad, 11, 'center');
      cap(ctx, P, 'semi-decidable: yes is confirmable, no is not', w, h);
    },

    /* Zero-knowledge fallback: a gentle pulsing rule. */
    generic(ctx, P, t, w, h) {
      clear(ctx, P, w, h);
      const cy = h / 2;
      for (let i = 0; i < 3; i++) {
        const r = 18 + i * 20 + 6 * Math.sin(t * 1.4 + i);
        ctx.strokeStyle = i % 2 ? P.acc2 : P.acc; ctx.globalAlpha = .5 - i * .12; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(w / 2, cy, r, 0, TAU); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  };

  /* ---------- the popover ------------------------------------------------- */

  let card, stack = [], raf = 0, t0 = 0, fcv = null, fctx = null, figKey = null, anchorEl = null;

  function build() {
    card = document.createElement('div');
    card.className = 'gpop';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'false');
    card.innerHTML =
      '<div class="gpop-bar">' +
        '<button class="gpop-back" title="Back" aria-label="Back">‹</button>' +
        '<span class="gpop-kind"></span>' +
        '<span class="gpop-sp"></span>' +
        '<button class="gpop-x" title="Close" aria-label="Close">×</button>' +
      '</div>' +
      '<h5 class="gpop-term"></h5>' +
      '<p class="gpop-short"></p>' +
      '<canvas class="gpop-fig" hidden></canvas>' +
      '<div class="gpop-body"></div>' +
      '<div class="gpop-see"></div>';
    document.body.appendChild(card);

    card.querySelector('.gpop-x').addEventListener('click', close);
    card.querySelector('.gpop-back').addEventListener('click', () => {
      stack.pop();                       // current
      const prev = stack.pop();
      if (prev) open(prev.id, prev.el); else close();
    });
    card.addEventListener('click', e => {
      const a = e.target.closest('[data-goto]');
      if (a) { e.preventDefault(); open(a.dataset.goto, anchorEl); }
    });
    fcv = card.querySelector('.gpop-fig');

    addEventListener('keydown', e => { if (e.key === 'Escape' && card.classList.contains('on')) close(); });
    addEventListener('pointerdown', e => {
      if (!card.classList.contains('on')) return;
      if (card.contains(e.target) || e.target.closest('.g')) return;
      close();
    }, true);
    addEventListener('resize', () => { if (card.classList.contains('on')) place(); });
    addEventListener('scroll', () => { if (card.classList.contains('on') && !isSheet()) place(); }, { passive: true });
  }

  const isSheet = () => innerWidth < 660;

  function place() {
    if (isSheet()) { card.style.left = card.style.top = ''; return; }
    const r = anchorEl.getBoundingClientRect();
    const cw = card.offsetWidth, chh = card.offsetHeight;
    let left = r.left + r.width / 2 - cw / 2;
    left = Math.max(12, Math.min(left, innerWidth - cw - 12));
    let top = r.bottom + 12;
    if (top + chh > innerHeight - 12) top = Math.max(12, r.top - chh - 12);
    card.style.left = left + 'px';
    card.style.top = top + 'px';
  }

  function animate(ts) {
    if (!figKey) return;
    if (!t0) t0 = ts;
    const w = fcv._w, h = fcv._h;
    (GFIG[figKey] || GFIG.generic)(fctx, pal(), (ts - t0) / 1000, w, h);
    raf = requestAnimationFrame(animate);
  }

  function open(id, el) {
    const e = window.GLOSS && window.GLOSS[id];
    if (!e) return;
    if (!card) build();
    anchorEl = el || anchorEl;
    stack.push({ id, el: anchorEl });
    if (stack.length > 12) stack.shift();

    card.querySelector('.gpop-back').hidden = stack.length < 2;
    card.querySelector('.gpop-kind').textContent = e.kind || 'definition';
    card.querySelector('.gpop-term').textContent = e.term;
    card.querySelector('.gpop-short').innerHTML = e.short;
    card.querySelector('.gpop-body').innerHTML = e.body || '';

    const see = card.querySelector('.gpop-see');
    const links = (e.see || []).filter(s => window.GLOSS[s]);
    see.innerHTML = links.length
      ? '<span class="gpop-seelab">See also</span>' + links.map(s =>
          '<a href="#" data-goto="' + s + '">' + window.GLOSS[s].term + '</a>').join('')
      : '';

    cancelAnimationFrame(raf); raf = 0; t0 = 0;
    figKey = e.fig && (GFIG[e.fig] ? e.fig : null);
    fcv.hidden = !figKey;

    card.classList.remove('on');
    void card.offsetWidth;                      // restart the entrance transition
    card.classList.add('on');
    place();

    if (figKey) {
      fctx = fit(fcv, 2.3);
      raf = requestAnimationFrame(animate);
      place();                                   // height changed once the canvas sized
    }

    // Card bodies carry real formulas, so typeset them, then re-place:
    // MathJax changes the card's height.
    if (window.MathJax && MathJax.typesetPromise) {
      MathJax.typesetPromise([card]).then(place).catch(() => {});
    }
  }

  function close() {
    if (!card) return;
    card.classList.remove('on');
    cancelAnimationFrame(raf); raf = 0; figKey = null; stack = [];
    if (anchorEl && anchorEl.focus) anchorEl.focus();
  }

  /* ---------- auto-tagging ------------------------------------------------
     Runs after MathJax has typeset, so every remaining text node is prose:
     the math already lives inside <mjx-container> elements we skip.
     ---------------------------------------------------------------------- */

  const SKIP = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'TEXTAREA', 'INPUT', 'SELECT',
    'BUTTON', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'A', 'TABLE', 'CANVAS', 'SVG']);
  const SKIPCLASS = /\b(g|gpop|plate-head|term|goalbox|steplist|tok|gnum|hered|ord|prooftable|chip|no-gloss|readout|ctl|meta-strip|links)\b/;

  function tag() {
    if (!window.GLOSS) return;
    const entries = [];
    for (const id in window.GLOSS) {
      const e = window.GLOSS[id];
      (e.match || [e.term]).forEach(m => entries.push({ id, m }));
    }
    entries.sort((a, b) => b.m.length - a.m.length);
    const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp('(?<![\\w-])(' + entries.map(e => esc(e.m)).join('|') + ')(?![\\w-])', 'gi');
    const byLower = Object.create(null);   // 'constructor' is a real term here — no prototype
    entries.forEach(e => { byLower[e.m.toLowerCase()] = e.id; });

    const root = document.querySelector('main.body');
    if (!root) return;

    document.querySelectorAll('section[id]').forEach(sec => {
      const used = new Set();
      // Pre-tagged terms in this section already count as used.
      sec.querySelectorAll('.g[data-g]').forEach(n => used.add(n.dataset.g));

      const walker = document.createTreeWalker(sec, NodeFilter.SHOW_TEXT, {
        acceptNode(n) {
          if (!n.nodeValue || n.nodeValue.length < 3) return NodeFilter.FILTER_REJECT;
          for (let p = n.parentElement; p && p !== sec.parentElement; p = p.parentElement) {
            if (SKIP.has(p.tagName)) return NodeFilter.FILTER_REJECT;
            if (p.tagName === 'MJX-CONTAINER' || p.tagName.slice(0, 4) === 'MJX-') return NodeFilter.FILTER_REJECT;
            if (p.className && typeof p.className === 'string' && SKIPCLASS.test(p.className)) return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      const texts = [];
      for (let n = walker.nextNode(); n; n = walker.nextNode()) texts.push(n);

      texts.forEach(node => {
        const s = node.nodeValue;
        rx.lastIndex = 0;
        let m, pieces = null, last = 0;
        while ((m = rx.exec(s))) {
          const id = byLower[m[1].toLowerCase()];
          if (!id || used.has(id)) continue;
          used.add(id);
          pieces = pieces || [];
          pieces.push(document.createTextNode(s.slice(last, m.index)));
          const span = document.createElement('span');
          span.className = 'g';
          span.dataset.g = id;
          span.tabIndex = 0;
          span.setAttribute('role', 'button');
          span.setAttribute('aria-label', m[1] + ' — open explanation');
          span.textContent = m[1];
          pieces.push(span);
          last = m.index + m[1].length;
        }
        if (pieces) {
          pieces.push(document.createTextNode(s.slice(last)));
          const frag = document.createDocumentFragment();
          pieces.forEach(p => frag.appendChild(p));
          node.parentNode.replaceChild(frag, node);
        }
      });
    });
  }

  /* Legacy: spans written as <span class="g" data-def="…"> keep working. */
  function adoptLegacy() {
    document.querySelectorAll('.g[data-def]').forEach((n, i) => {
      const id = '_legacy' + i;
      window.GLOSS[id] = { term: n.textContent.trim(), short: n.dataset.def, kind: 'note', fig: null };
      n.dataset.g = id;
      n.tabIndex = 0;
      n.setAttribute('role', 'button');
      n.removeAttribute('data-def');
    });
  }

  function wire() {
    document.addEventListener('click', e => {
      const g = e.target.closest('.g[data-g]');
      if (!g) return;
      e.preventDefault();
      stack = [];
      open(g.dataset.g, g);
    });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const g = e.target.closest && e.target.closest('.g[data-g]');
      if (!g) return;
      e.preventDefault();
      stack = [];
      open(g.dataset.g, g);
    });
  }

  function boot() {
    window.GLOSS = window.GLOSS || {};
    adoptLegacy();
    tag();
    wire();
    // Count what got tagged, for the reader's benefit.
    const n = document.querySelectorAll('.g[data-g]').length;
    const badge = document.getElementById('glossCount');
    if (badge) badge.textContent = n;
  }

  // Tag only after MathJax has typeset: every remaining text node is then prose,
  // because the math has been replaced by <mjx-container> elements we skip.
  function whenTypeset() {
    if (window.MathJax && MathJax.startup && MathJax.startup.promise) {
      MathJax.startup.promise.then(boot).catch(boot);
    } else {
      setTimeout(whenTypeset, 120);          // MathJax loads async; wait for it
    }
  }
  if (document.readyState === 'complete') whenTypeset();
  else addEventListener('load', whenTypeset);

  window.openGloss = open;
})();
