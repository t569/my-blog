/* ============================================================
   VOL. III — GÖDEL & FORMAL LANGUAGE · interactive figures
   ============================================================ */
(function () {
'use strict';

/* ===============================================================
   PART A — the language of arithmetic: tokenizer, parser, semantics
   =============================================================== */

const VARS = 'xyzuvw';
/** Token stream.  '->' is the only multi-character token. */
function lex(src) {
  const out = []; let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '-' && src[i + 1] === '>') { out.push({ t: '->', i }); i += 2; continue; }
    if ('0()+*=<~&|.ASE'.includes(c) || VARS.includes(c)) { out.push({ t: c, i }); i++; continue; }
    throw { msg: `unknown symbol '${c}'`, at: i };
  }
  return out;
}

function parse(src) {
  const ts = lex(src); let p = 0;
  const peek = () => (p < ts.length ? ts[p].t : null);
  const pos = () => (p < ts.length ? ts[p].i : src.length);
  const eat = (t) => { if (peek() !== t) throw { msg: `expected '${t}'${peek() ? `, found '${peek()}'` : ', but the input ended'}`, at: pos() }; return ts[p++].t; };

  function term() {
    const t = peek();
    if (t === '0') { p++; return { k: '0' }; }
    if (t && VARS.includes(t)) { p++; return { k: 'var', n: t }; }
    if (t === 'S') { p++; return { k: 'S', a: term() }; }
    if (t === '(') {
      p++; const l = term();
      const op = peek();
      if (op !== '+' && op !== '*') throw { msg: `expected '+' or '*' inside a term, found '${op || 'end of input'}'`, at: pos() };
      p++; const r = term(); eat(')');
      return { k: op, l, r };
    }
    throw { msg: `expected a term (0, a variable, S…, or '(')${t ? `, found '${t}'` : ', but the input ended'}`, at: pos() };
  }

  function atom() {
    const l = term(); const r0 = peek();
    if (r0 !== '=' && r0 !== '<') throw { msg: `expected '=' or '<' after a term, found '${r0 || 'end of input'}'`, at: pos() };
    p++; const r = term();
    return { k: r0, l, r };
  }

  function formula() {
    const t = peek();
    if (t === '~') { p++; return { k: '~', a: formula() }; }
    if (t === 'A' || t === 'E') {
      p++;
      const v = peek();
      if (!v || !VARS.includes(v)) throw { msg: `quantifier must be followed by a variable (one of ${VARS.split('').join(' ')})`, at: pos() };
      p++;
      let bound = null;
      if (peek() === '<') { p++; bound = term(); }
      eat('.');
      return { k: t, v, bound, a: formula() };
    }
    if (t === '(') {
      /* '(' is ambiguous: it can open a compound formula, a grouped formula,
         or a compound *term* inside an atom.  Try the formula readings, and
         on failure rewind and read an atom, reporting whichever error got
         further into the string. */
      const save = p;
      let inner = null;
      try {
        p++; const l = formula();
        const op = peek();
        if (op === '&' || op === '|' || op === '->') { p++; const r = formula(); eat(')'); return { k: op, l, r }; }
        if (op === ')') { p++; return l; }                       // grouping
        throw { msg: `expected a connective (&, |, ->) or ')', found '${op || 'end of input'}'`, at: pos() };
      } catch (e) { inner = e; p = save; }
      try { return atom(); }
      catch (e2) { throw (inner && (inner.at || 0) > (e2.at || 0)) ? inner : e2; }
    }
    return atom();
  }

  const f = formula();
  if (p < ts.length) throw { msg: `unexpected '${ts[p].t}' — the formula already ended here`, at: ts[p].i };
  return f;
}

/** Pretty-print an AST back to source form. */
function show(n) {
  switch (n.k) {
    case '0': return '0';
    case 'var': return n.n;
    case 'S': return 'S' + show(n.a);
    case '+': case '*': return `(${show(n.l)} ${n.k} ${show(n.r)})`;
    case '=': case '<': return `${show(n.l)} ${n.k} ${show(n.r)}`;
    case '~': return '~' + show(n.a);
    case '&': case '|': case '->': return `(${show(n.l)} ${n.k} ${show(n.r)})`;
    case 'A': case 'E': return `${n.k}${n.v}${n.bound ? '<' + show(n.bound) : ''}. ${show(n.a)}`;
  }
}

/** Free variables, as a Set. */
function free(n, acc) {
  acc = acc || new Set();
  switch (n.k) {
    case 'var': acc.add(n.n); break;
    case 'S': free(n.a, acc); break;
    case '~': free(n.a, acc); break;
    case '+': case '*': case '=': case '<': case '&': case '|': case '->': free(n.l, acc); free(n.r, acc); break;
    case 'A': case 'E': {
      if (n.bound) free(n.bound, acc);
      const inner = free(n.a);
      inner.delete(n.v);
      inner.forEach(v => acc.add(v));
      break;
    }
  }
  return acc;
}

const size = n => n.k === '0' || n.k === 'var' ? 1
  : n.k === 'S' || n.k === '~' ? 1 + size(n.a)
  : n.k === 'A' || n.k === 'E' ? 2 + (n.bound ? size(n.bound) + 1 : 0) + size(n.a)
  : 1 + size(n.l) + size(n.r);

const qdepth = n => {
  switch (n.k) {
    case 'A': case 'E': return 1 + qdepth(n.a);
    case '~': case 'S': return qdepth(n.a);
    case '0': case 'var': return 0;
    default: return Math.max(qdepth(n.l), qdepth(n.r));
  }
};

/** Δ₀ = every quantifier is bounded. */
function isD0(n) {
  switch (n.k) {
    case 'A': case 'E': return !!n.bound && isD0(n.a);
    case '~': case 'S': return isD0(n.a);
    case '0': case 'var': return true;
    default: return isD0(n.l) && isD0(n.r);
  }
}
const SUB = s => String(s).replace(/\d/g, d => '₀₁₂₃₄₅₆₇₈₉'[+d]);

/** Arithmetic-hierarchy class, honest about non-prenex inputs. */
function classify(n) {
  if (isD0(n)) return 'Δ₀ — decidable by finite search';
  let cur = n, kind = null, last = null, lvl = 0;
  while ((cur.k === 'A' || cur.k === 'E') && !cur.bound) {
    const k = cur.k === 'E' ? 'Σ' : 'Π';
    if (kind === null) { kind = k; lvl = 1; } else if (k !== last) { lvl++; }
    last = k;
    cur = cur.a;
  }
  if (kind && isD0(cur)) {
    const tag = kind + SUB(lvl);
    if (tag === 'Σ₁') return 'Σ₁ — semi-decidable (search for a witness)';
    if (tag === 'Π₁') return 'Π₁ — refutable but not confirmable by search';
    return tag;
  }
  return 'not in prenex form — no syntactic class';
}

/* --- three-valued evaluation in ℕ ------------------------------ */
const U = 'unk';
const not3 = a => a === U ? U : !a;
const and3 = (a, b) => (a === false || b === false) ? false : (a === true && b === true) ? true : U;
const or3 = (a, b) => (a === true || b === true) ? true : (a === false && b === false) ? false : U;

function evalIn(n, env, B, budget) {
  const tval = (t) => {
    switch (t.k) {
      case '0': return 0;
      case 'var': return env[t.n] === undefined ? 0 : env[t.n];
      case 'S': return tval(t.a) + 1;
      case '+': return tval(t.l) + tval(t.r);
      case '*': return tval(t.l) * tval(t.r);
    }
  };
  const go = (f) => {
    if (--budget.n < 0) return U;
    switch (f.k) {
      case '=': return tval(f.l) === tval(f.r);
      case '<': return tval(f.l) < tval(f.r);
      case '~': return not3(go(f.a));
      case '&': return and3(go(f.l), go(f.r));
      case '|': return or3(go(f.l), go(f.r));
      case '->': return or3(not3(go(f.l)), go(f.r));
      case 'A': case 'E': {
        const lim = f.bound ? tval(f.bound) : B + 1;
        const wantAll = f.k === 'A';
        let sawUnknown = false;
        const old = env[f.v];
        for (let i = 0; i < lim; i++) {
          env[f.v] = i;
          const r = go(f.a);
          if (wantAll && r === false) { env[f.v] = old; return false; }
          if (!wantAll && r === true) { env[f.v] = old; return true; }
          if (r === U) sawUnknown = true;
          if (budget.n < 0) { env[f.v] = old; return U; }
        }
        env[f.v] = old;
        /* A bounded quantifier that exhausted its range has decided the matter.
           An unbounded one merely ran out of patience — that gap is Σ₁-ness. */
        return (f.bound && !sawUnknown) ? wantAll : U;
      }
    }
  };
  return go(n);
}

/* ===============================================================
   FIG 1 — the formula workbench
   =============================================================== */
(function fig1() {
  const input = document.getElementById('fw-in'); if (!input) return;
  const cv = document.getElementById('fwCanvas');
  const PRESETS = [
    ['A x. ~ (S x = 0)', 'Zero is not a successor — an axiom of Q.'],
    ['A x. A y. ((S x = S y) -> (x = y))', 'The successor function is injective.'],
    ['A x. E y. (x = (y + y))', 'Every number is even. FALSE in ℕ, but watch: the search returns INCONCLUSIVE. To refute a ∀ you need a definite counterexample, and to know x = 1 is a counterexample you must refute an unbounded ∃ — which no search can do. Π₂ is unreachable from both directions.'],
    ['A x. (E y<S x. (x = (y + y)) | E y<S x. (x = S (y + y)))', 'Every number is even or odd. TRUE, and Δ₀ inside — so it is decidable for each x.'],
    ['E y. (x < y)', 'Has a FREE variable x, so it is not a sentence and has no truth value on its own.'],
    ['A x. A y<x. ~ ((y * y) = x)', 'No number below x is a square root of x. Π₁ — and FALSE, with x = 4 the first counterexample. Watch the search find it and report a definitive answer: one counterexample kills a ∀ outright.'],
    ['E x. E y. E z. (((S x * S x) + (S y * S y)) = (S z * S z))', 'A Pythagorean triple exists. Three ∃ in a row form a single block, so this is Σ₁, not Σ₃ — and the search settles it definitively by producing 3² + 4² = 5².']
  ];
  const PAL = ['0', 'S', 'x', 'y', 'z', '(', ')', '+', '*', '=', '<', '~', '&', '|', '->', 'A x. ', 'E x. ', 'A x<y. ', 'E x<y. '];

  document.getElementById('fw-pal').innerHTML = PAL.map(t => `<button class="tok" data-ins="${t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')}">${t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</button>`).join('');
  document.getElementById('fw-presets').innerHTML = PRESETS.map((p, i) =>
    `<button class="tok" data-pre="${i}" style="border-style:dashed">${p[0].replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</button>`).join('');
  document.querySelectorAll('[data-ins]').forEach(b => b.addEventListener('click', () => {
    const s = input.selectionStart || input.value.length;
    input.value = input.value.slice(0, s) + b.dataset.ins + input.value.slice(input.selectionEnd || s);
    input.focus(); render();
  }));
  document.querySelectorAll('[data-pre]').forEach(b => b.addEventListener('click', () => {
    input.value = PRESETS[+b.dataset.pre][0]; render();
  }));

  let ast = null;
  /* --- tree layout: leaves get unit width, parents centre over children --- */
  function layout(n) {
    const lbl = { '0': '0', 'S': 'S', '+': '+', '*': '·', '=': '=', '<': '<', '~': '¬', '&': '∧', '|': '∨', '->': '→' };
    const build = (n, depth) => {
      const kids = n.k === 'var' || n.k === '0' ? []
        : n.k === 'S' || n.k === '~' ? [n.a]
          : n.k === 'A' || n.k === 'E' ? (n.bound ? [n.bound, n.a] : [n.a])
            : [n.l, n.r];
      const text = n.k === 'var' ? n.n
        : n.k === 'A' ? '∀' + n.v + (n.bound ? '<' : '')
          : n.k === 'E' ? '∃' + n.v + (n.bound ? '<' : '')
            : lbl[n.k];
      const isF = '=<~&|->AE'.includes(n.k) && n.k !== '-';
      const node = { text, depth, kids: kids.map(k => build(k, depth + 1)), n, isF: ['=', '<', '~', '&', '|', '->', 'A', 'E'].includes(n.k) };
      node.w = node.kids.length ? node.kids.reduce((s, k) => s + k.w, 0) : 1;
      return node;
    };
    const root = build(n, 0);
    let cursor = 0;
    (function place(nd) {
      if (!nd.kids.length) { nd.x = cursor + 0.5; cursor += 1; return; }
      nd.kids.forEach(place);
      nd.x = (nd.kids[0].x + nd.kids[nd.kids.length - 1].x) / 2;
    })(root);
    return { root, leaves: cursor, depth: Math.max(...flat(root).map(n => n.depth)) + 1 };
  }
  const flat = (n, acc) => { acc = acc || []; acc.push(n); n.kids.forEach(k => flat(k, acc)); return acc; };

  const S = scene(cv, {
    aspect: 2.5, still: true,
    draw(ctx, P) {
      const w = cv._w, h = cv._h;
      ctx.fillStyle = P.paper2; ctx.fillRect(0, 0, w, h);
      if (!ast) { label(ctx, 'no parse tree — fix the syntax error above', 14, 24, P.bad, '12px ui-monospace, monospace'); return; }
      const L = layout(ast), nodes = flat(L.root);
      const padX = 26, padY = 24;
      const sx = (w - 2 * padX) / Math.max(1, L.leaves), sy = (h - 2 * padY) / Math.max(1, L.depth - 1 || 1);
      const X = n => padX + n.x * sx, Y = n => padY + n.depth * sy;
      const fv = free(ast);
      ctx.strokeStyle = P.rule; ctx.lineWidth = 1.2;
      nodes.forEach(n => n.kids.forEach(k => { ctx.beginPath(); ctx.moveTo(X(n), Y(n) + 9); ctx.lineTo(X(k), Y(k) - 9); ctx.stroke(); }));
      nodes.forEach(n => {
        const isFreeVar = n.n.k === 'var' && fv.has(n.n.n);
        const col = isFreeVar ? P.bad : n.isF ? P.acc : P.acc2;
        ctx.beginPath(); ctx.arc(X(n), Y(n), 11, 0, 7);
        ctx.fillStyle = P.paper2; ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = isFreeVar ? 2 : 1.4; ctx.stroke();
        label(ctx, n.text, X(n), Y(n), col, (isFreeVar ? '600 ' : '') + Math.min(12, sx * 0.8 + 6) + 'px ui-monospace, monospace', 'center', 'middle');
      });
      label(ctx, 'cyan = logical   amber = arithmetic   red = free variable', 10, h - 8, P.ink4, '9px ui-monospace, monospace');
    }
  });

  function render() {
    const src = input.value;
    const msg = document.getElementById('fw-msg');
    try {
      ast = parse(src);
      msg.innerHTML = `<span class="good">well-formed ✓</span>  canonical form:  ${show(ast).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}`;
    } catch (e) {
      ast = null;
      const caret = ' '.repeat(Math.max(0, e.at || 0)) + '^';
      msg.textContent = src + '\n' + caret + '\nparse error at position ' + (e.at ?? '?') + ': ' + (e.msg || e);
      ['fw-wf', 'fw-free', 'fw-sent', 'fw-len', 'fw-qd', 'fw-cls'].forEach(i => document.getElementById(i).textContent = '—');
      document.getElementById('fw-wf').textContent = 'no';
      document.getElementById('fw-wf').style.color = css('--bad');
      document.getElementById('fw-gloss').innerHTML = '';
      S.redraw(); return;
    }
    const fv = [...free(ast)].sort();
    document.getElementById('fw-wf').textContent = 'yes';
    document.getElementById('fw-wf').style.color = css('--ok');
    document.getElementById('fw-free').textContent = fv.length ? fv.join(', ') : 'none';
    const sent = fv.length === 0;
    const se = document.getElementById('fw-sent');
    se.textContent = sent ? 'yes — has a truth value' : 'no — open formula';
    se.style.color = sent ? css('--ok') : css('--warn');
    document.getElementById('fw-len').textContent = size(ast);
    document.getElementById('fw-qd').textContent = qdepth(ast);
    document.getElementById('fw-cls').textContent = classify(ast);

    const g = document.getElementById('fw-gloss');
    const pre = PRESETS.find(p => p[0] === src.trim());
    let html = pre ? `<p style="margin:0 0 12px"><strong>${pre[1]}</strong></p>` : '';
    if (!sent) {
      html += `<p style="margin:0">Free variable${fv.length > 1 ? 's' : ''} <code>${fv.join(', ')}</code>, so this is a <em>predicate</em>, not a statement — it becomes true or false only once you supply values. Formal languages are strict about this; the distinction is invisible in ordinary prose and is exactly what the parse tree makes visible.</p>`;
    } else {
      const B = 60, budget = { n: 900000 };
      const v = evalIn(ast, {}, B, budget);
      const d0 = isD0(ast);
      if (v === true) html += `<p style="margin:0">Search verdict: <strong style="color:${css('--ok')}">TRUE</strong>${d0 ? ' — and definitively so, since every quantifier is bounded and the search was exhaustive.' : ', and definitively so: a witness was found, and finding a witness settles an existential for good.'}</p>`;
      else if (v === false) html += `<p style="margin:0">Search verdict: <strong style="color:${css('--bad')}">FALSE</strong>${d0 ? ' — definitively, the search was exhaustive.' : ', and definitively so: a counterexample was found, and one counterexample kills a universal for good.'}</p>`;
      else html += `<p style="margin:0">Search verdict: <strong style="color:${css('--warn')}">INCONCLUSIVE</strong> after checking all values below ${B}. No counterexample turned up, but an unbounded ∀ can never be confirmed by search — you would have to check infinitely many cases. <em>This is exactly what semi-decidability feels like from the inside, and it is why Prov is Σ₁ rather than decidable.</em></p>`;
    }
    g.innerHTML = html;
    S.redraw();
  }
  input.addEventListener('input', render);
  render();
})();

/* ===============================================================
   FIG 2 — a Hilbert-style proof checker
   =============================================================== */
(function fig2() {
  const tbl = document.getElementById('pf-table'); if (!tbl) return;
  const P = 'p', PP = ['->', 'p', 'p'], PPP = ['->', 'p', ['->', 'p', 'p']];
  const MENU = [['p', P], ['(p → p)', PP], ['(p → (p → p))', PPP]];
  const pp = f => typeof f === 'string' ? f : `(${pp(f[1])} → ${pp(f[2])})`;
  const eq = (a, b) => pp(a) === pp(b);
  const GOAL = PP;
  let lines = [];

  const form = document.getElementById('pf-form');
  const sel = (id, lab) => `<label style="font-family:var(--mono);font-size:10.5px;color:var(--ink-3);margin-right:14px">${lab}
     <select id="${id}" style="margin-left:6px">${MENU.map((m, i) => `<option value="${i}">${m[0]}</option>`).join('')}</select></label>`;
  form.innerHTML = sel('pf-phi', 'φ =') + sel('pf-psi', 'ψ =') + sel('pf-chi', 'χ =') +
    `<span style="font-family:var(--mono);font-size:10.5px;color:var(--ink-3);margin-right:14px">MP from
       <select id="pf-a" style="margin:0 4px"></select> and <select id="pf-b" style="margin:0 4px"></select></span>`;

  const pick = id => MENU[+document.getElementById(id).value][1];
  function refresh() {
    ['pf-a', 'pf-b'].forEach(id => {
      const s = document.getElementById(id), v = s.value;
      s.innerHTML = lines.map((_, i) => `<option value="${i}">${i + 1}</option>`).join('');
      if (v && +v < lines.length) s.value = v;
    });
    const done = lines.some(l => eq(l.f, GOAL));
    tbl.innerHTML = lines.map((l, i) =>
      `<tr class="${i === lines.length - 1 ? 'new' : ''}${eq(l.f, GOAL) ? ' goal' : ''}"><td>${i + 1}.</td><td>${pp(l.f)}</td><td>${l.why}</td></tr>`).join('')
      || `<tr><td colspan="3" style="color:var(--ink-4)">no lines yet — start by adding an axiom instance</td></tr>`;
    document.getElementById('pf-msg').innerHTML = done
      ? `<strong style="color:${css('--ok')}">Derived p → p in ${lines.length} lines.</strong> Every step was a pattern-match on strings. A machine can verify this transcript without any idea what “p” refers to — which is precisely why Prf(p, f) is a primitive recursive relation, and therefore why §2 works at all.`
      : `Goal: <code>${pp(GOAL)}</code>. It takes five lines. Hint: the useful A2 instance is φ = p, ψ = (p → p), χ = p.`;
  }
  function add(f, why) { lines.push({ f, why }); refresh(); }

  document.querySelectorAll('[data-pf]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.pf;
    if (k === 'A1') {
      const phi = pick('pf-phi'), psi = pick('pf-psi');
      add(['->', phi, ['->', psi, phi]], 'A1');
    } else if (k === 'A2') {
      const phi = pick('pf-phi'), psi = pick('pf-psi'), chi = pick('pf-chi');
      add(['->', ['->', phi, ['->', psi, chi]], ['->', ['->', phi, psi], ['->', phi, chi]]], 'A2');
    } else if (k === 'MP') {
      const a = +document.getElementById('pf-a').value, b2 = +document.getElementById('pf-b').value;
      if (!lines[a] || !lines[b2]) return;
      const maj = lines[b2].f;
      if (typeof maj === 'string' || !eq(maj[1], lines[a].f)) {
        document.getElementById('pf-msg').innerHTML =
          `<strong style="color:${css('--bad')}">Rejected.</strong> Modus ponens needs line ${b2 + 1} to be an implication whose antecedent is exactly line ${a + 1}. ` +
          `Here line ${b2 + 1} is <code>${pp(maj)}</code> and line ${a + 1} is <code>${pp(lines[a].f)}</code>. <em>The checker is doing nothing but comparing strings — and that is the point.</em>`;
        return;
      }
      add(maj[2], `MP ${a + 1}, ${b2 + 1}`);
    } else if (k === 'clear') { lines = []; refresh(); }
    else if (k === 'auto') {
      lines = [];
      add(['->', ['->', P, ['->', PP, P]], ['->', ['->', P, PP], ['->', P, P]]], 'A2  φ=p ψ=(p→p) χ=p');
      add(['->', P, ['->', PP, P]], 'A1  φ=p ψ=(p→p)');
      add(['->', ['->', P, PP], ['->', P, P]], 'MP 2, 1');
      add(['->', P, PP], 'A1  φ=p ψ=p');
      add(['->', P, P], 'MP 4, 3');
    }
  }));
  refresh();
})();

/* ===============================================================
   FIG 3 — the Gödel numbering machine
   =============================================================== */
(function fig3() {
  const input = document.getElementById('gn-in'); if (!input) return;
  const CODE = { '0': 1, 'S': 2, '(': 3, ')': 4, '+': 5, '*': 6, '=': 7, '<': 8, '~': 9, '&': 10, '|': 11, '->': 12, 'A': 13, 'E': 14, '.': 15, 'x': 16, 'y': 17, 'z': 18, 'u': 19, 'v': 20, 'w': 21 };
  const REV = Object.fromEntries(Object.entries(CODE).map(([k, v]) => [v, k]));
  const PR = primesTo(400);
  let mode = 'prime';

  function render() {
    const src = input.value;
    let ts;
    try { ts = lex(src); } catch (e) { document.getElementById('gn-num').textContent = 'lex error: ' + e.msg; return; }
    const codes = ts.map(t => CODE[t.t]);
    if (codes.some(c => c === undefined) || !codes.length) { document.getElementById('gn-num').textContent = 'empty or unencodable'; return; }

    let N;
    if (mode === 'prime') { N = 1n; codes.forEach((c, i) => { N *= BigInt(PR[i]) ** BigInt(c); }); }
    else { N = 0n; for (let i = codes.length - 1; i >= 0; i--) N = N * 32n + BigInt(codes[i]); }

    const s = N.toString();
    document.getElementById('gn-num').textContent = s.length > 3000 ? s.slice(0, 1500) + ' … [' + (s.length - 3000) + ' digits omitted] … ' + s.slice(-1500) : s;
    document.getElementById('gn-len').textContent = codes.length;
    document.getElementById('gn-dig').textContent = s.length.toLocaleString();
    document.getElementById('gn-atoms').textContent = s.length > 80 ? '10^' + (s.length - 80) + ' × bigger' : 'smaller';

    // decode, to prove the map is invertible
    let out = '';
    if (mode === 'prime') {
      let M = N;
      for (let i = 0; i < codes.length; i++) {
        const p = BigInt(PR[i]); let e = 0;
        while (M % p === 0n) { M /= p; e++; }
        out += REV[e] || '?';
      }
    } else {
      let M = N;
      while (M > 0n) { out += REV[Number(M % 32n)] || '?'; M /= 32n; }
    }
    const ok = out === ts.map(t => t.t).join('');
    const de = document.getElementById('gn-dec');
    de.textContent = out.length > 44 ? out.slice(0, 44) + '…' : out;
    de.style.color = ok ? css('--ok') : css('--bad');

    document.getElementById('gn-table').innerHTML =
      '<tr><th>position i</th>' + ts.map((_, i) => `<th>${i + 1}</th>`).join('') + '</tr>' +
      '<tr><td>symbol</td>' + ts.map(t => `<td>${t.t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')}</td>`).join('') + '</tr>' +
      '<tr><td>code c(sᵢ)</td>' + codes.map(c => `<td style="color:${css('--acc')}">${c}</td>`).join('') + '</tr>' +
      (mode === 'prime' ? '<tr><td>prime pᵢ</td>' + ts.map((_, i) => `<td style="color:${css('--acc-2')}">${PR[i]}</td>`).join('') + '</tr>' : '');
    S.redraw();
  }

  const cv = document.getElementById('gnCanvas');
  const S = scene(cv, {
    aspect: 5.0, still: true,
    draw(ctx, P) {
      const w = cv._w, h = cv._h;
      ctx.fillStyle = P.paper2; ctx.fillRect(0, 0, w, h);
      let ts; try { ts = lex(input.value); } catch (e) { return; }
      const codes = ts.map(t => CODE[t.t]).filter(c => c !== undefined);
      if (!codes.length) return;
      let a = 1n, b = 0n;
      codes.forEach((c, i) => { a *= BigInt(PR[i]) ** BigInt(c); });
      for (let i = codes.length - 1; i >= 0; i--) b = b * 32n + BigInt(codes[i]);
      const da = a.toString().length, db = b.toString().length, mx = Math.max(da, db, 81);
      const rows = [['prime powers', da, P.acc], ['base-32 packing', db, P.acc2], ['atoms in the universe', 81, P.ink4]];
      const padL = 138, bh = (h - 16) / 3;
      rows.forEach(([lab, v, col], i) => {
        const y = 8 + i * bh;
        label(ctx, lab, padL - 8, y + bh / 2, P.ink3, '10px ui-monospace, monospace', 'right', 'middle');
        ctx.fillStyle = col; ctx.globalAlpha = .75;
        ctx.fillRect(padL, y + 3, Math.max(2, (w - padL - 62) * v / mx), bh - 8);
        ctx.globalAlpha = 1;
        label(ctx, v.toLocaleString() + ' digits', padL + Math.max(2, (w - padL - 62) * v / mx) + 6, y + bh / 2, col, '10px ui-monospace, monospace', 'left', 'middle');
      });
    }
  });
  input.addEventListener('input', render);
  document.getElementById('gn-mode-p').addEventListener('click', e => {
    mode = 'prime'; e.target.classList.add('on'); document.getElementById('gn-mode-b').classList.remove('on'); render();
  });
  document.getElementById('gn-mode-b').addEventListener('click', e => {
    mode = 'b32'; e.target.classList.add('on'); document.getElementById('gn-mode-p').classList.remove('on'); render();
  });
  render();
})();

/* ===============================================================
   FIG 4A — the quine
   =============================================================== */
(function fig4() {
  const pre = document.getElementById('q-src'); if (!pre) return;
  const f = function f() { return '(' + f + ')()'; };
  const src = '(' + f + ')()';
  pre.textContent = src;
  document.getElementById('q-run').addEventListener('click', () => {
    const out = f();
    const r = document.getElementById('q-res');
    r.innerHTML = out === src
      ? `<span style="color:${css('--ok')}">output === source ✓ (${src.length} characters, identical)</span>`
      : `<span style="color:${css('--bad')}">mismatch</span>`;
  });
})();

/* ===============================================================
   FIG 5 — anatomy of a nonstandard model
   =============================================================== */
(function fig5() {
  const cv = document.getElementById('nsCanvas'); if (!cv) return;
  let zoom = 0, marked = false;

  const S = scene(cv, {
    aspect: 2.4, still: true,
    draw(ctx, P) {
      const w = cv._w, h = cv._h;
      ctx.fillStyle = P.paper2; ctx.fillRect(0, 0, w, h);
      const yTop = h * 0.30, yBot = h * 0.76;

      /* --- upper band: the whole order type ℕ + ℤ·ℚ --- */
      ctx.strokeStyle = P.rule; ctx.beginPath(); ctx.moveTo(20, yTop); ctx.lineTo(w - 20, yTop); ctx.stroke();
      const stdEnd = w * 0.30;
      for (let i = 0; i < 14; i++) {
        const x = 24 + stdEnd * (1 - Math.exp(-i * 0.34)) * 1.02;
        dot(ctx, x, yTop, i < 6 ? 4 : 2.6, P.acc);
        if (i < 5) label(ctx, String(i), x, yTop - 13, P.ink3, '10px ui-monospace, monospace', 'center');
      }
      label(ctx, 'ℕ — the standard part', 24, yTop + 24, P.acc, '10px ui-monospace, monospace');
      label(ctx, '…', stdEnd + 8, yTop + 4, P.ink3, '14px ui-monospace, monospace');

      /* ℤ-blocks, densely ordered */
      const blocks = [];
      const bx0 = stdEnd + 40, bx1 = w - 28;
      for (let k = 0; k < 9; k++) {
        const t = k / 8;
        const cx = bx0 + (bx1 - bx0) * (0.10 + 0.86 * (t + 0.22 * Math.sin(t * 7.4)));
        blocks.push(cx);
      }
      blocks.sort((a, b) => a - b);
      const target = blocks[3];
      blocks.forEach((cx, k) => {
        const isT = k === 3;
        for (let j = -3; j <= 3; j++) dot(ctx, cx + j * 5.2, yTop, isT ? 3.2 : 2.2, isT ? P.acc2 : P.ink4);
        label(ctx, '⋯', cx - 26, yTop + 4, P.ink4, '11px ui-monospace, monospace', 'center');
        label(ctx, '⋯', cx + 26, yTop + 4, P.ink4, '11px ui-monospace, monospace', 'center');
      });
      label(ctx, 'a dense order of ℤ-blocks — no first block, no last, one between any two', bx0, yTop + 24, P.acc2, '10px ui-monospace, monospace');

      /* --- magnifier lines --- */
      const mw = w * 0.62, mx0 = (w - mw) / 2;
      ctx.strokeStyle = P.rule; ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(target - 20, yTop + 8); ctx.lineTo(mx0, yBot - 30);
      ctx.moveTo(target + 20, yTop + 8); ctx.lineTo(mx0 + mw, yBot - 30);
      ctx.stroke(); ctx.setLineDash([]);

      /* --- lower band: inside one ℤ-block --- */
      ctx.strokeStyle = P.rule; ctx.beginPath(); ctx.moveTo(mx0, yBot); ctx.lineTo(mx0 + mw, yBot); ctx.stroke();
      const n = 9, sp = mw / (n + 1);
      const names = ['c−4', 'c−3', 'c−2', 'c−1', 'c', 'c+1', 'c+2', 'c+3', 'c+4'];
      for (let i = 0; i < n; i++) {
        const x = mx0 + (i + 1) * sp;
        const isC = i === 4;
        dot(ctx, x, yBot, isC && marked ? 6.5 : 4.5, isC && marked ? P.bad : P.acc2, P.paper2, 1.5);
        label(ctx, names[i], x, yBot + 18, isC && marked ? P.bad : P.ink3, '10px ui-monospace, monospace', 'center');
      }
      label(ctx, '⋯', mx0 + 6, yBot + 4, P.ink4, '13px ui-monospace, monospace');
      label(ctx, '⋯', mx0 + mw - 10, yBot + 4, P.ink4, '13px ui-monospace, monospace');
      if (marked) {
        label(ctx, '↑ c — “a proof of 0 = 1”', mx0 + 5 * sp, yBot - 16, P.bad, '600 11px ui-monospace, monospace', 'center');
      }
      label(ctx, 'every element has a predecessor and a successor, but none is reachable from 0 in finitely many steps',
        mx0, yBot + 38, P.ink4, '10px ui-monospace, monospace');
    }
  });

  document.getElementById('ns-z').addEventListener('input', e => {
    zoom = +e.target.value; document.getElementById('ns-zv').textContent = (1 + zoom / 25).toFixed(1); S.redraw();
  });
  document.getElementById('ns-mark').addEventListener('click', e => {
    marked = !marked; e.target.classList.toggle('on', marked); S.redraw();
    document.getElementById('ns-note').innerHTML = marked
      ? `The element <strong>c</strong> is nonstandard, and 𝓜 believes <code>Prf(c, ⌜0=1⌝)</code>. Every <em>internal</em> check 𝓜 can perform confirms it: "the c-th line follows from earlier lines" holds for each line 𝓜 can name. What fails is the step we would take next — running through the proof from the beginning — because from 𝓜's inside, c is not finitely many steps from 0.<br><br>This is what \\(\\mathrm{PA} + \\neg\\mathrm{Con}(\\mathrm{PA})\\) is: not an inconsistency, but a model whose notion of "finite" is wider than ours. And since PA cannot define "standard", it has no way to notice.`
      : '';
    if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([document.getElementById('ns-note')]);
  });
})();

/* ===============================================================
   FIG 6 — Goodstein sequences
   ===============================================================
   A hereditary base-b number is a list of {e, c}: Σ c·b^e with each
   exponent e itself such a list, sorted by exponent descending.
   The empty list is 0.  Base-bumping is a no-op on this structure —
   only the *interpretation* changes — which is exactly why replacing
   b by ω leaves the ordinal fixed.
   =============================================================== */
(function fig6() {
  const cv = document.getElementById('gsCanvas'); if (!cv) return;

  const ZERO = [];
  const isZero = h => h.length === 0;
  const clone = h => h.map(t => ({ e: clone(t.e), c: t.c }));

  function toHered(n, b) {
    if (n === 0) return ZERO;
    const out = [];
    let k = 0; while (Math.pow(b, k + 1) <= n) k++;
    for (; k >= 0 && n > 0; k--) {
      const p = Math.pow(b, k), c = Math.floor(n / p);
      if (c > 0) { out.push({ e: toHered(k, b), c }); n -= c * p; }
    }
    return out;
  }
  /** Value as a Number; Infinity once it overflows (which happens fast). */
  function hVal(h, b) {
    let s = 0;
    for (const t of h) { const e = hVal(t.e, b); const v = t.c * Math.pow(b, e); if (!isFinite(v)) return Infinity; s += v; }
    return s;
  }
  /** log10 of the value, from the leading term; survives well past 10^308. */
  function hLog10(h, b) {
    if (isZero(h)) return -Infinity;
    const t = h[0], e = hVal(t.e, b);
    if (!isFinite(e)) return Infinity;
    return Math.log10(t.c) + e * Math.log10(b);
  }
  /** Subtract one, symbolically, in base b.  Returns null if it would blow up. */
  function dec(h, b, guard) {
    guard = guard || { n: 4000 };
    if (isZero(h)) return null;
    const out = clone(h), last = out[out.length - 1];
    if (isZero(last.e)) { last.c -= 1; if (last.c === 0) out.pop(); return out; }
    last.c -= 1; if (last.c === 0) out.pop();
    let e = clone(last.e);
    while (!isZero(e)) {
      if (--guard.n < 0 || out.length > 220) return null;
      e = dec(e, b, guard);
      if (e === null) return null;
      out.push({ e: clone(e), c: b - 1 });
    }
    return out;
  }
  /** Lexicographic comparison of Cantor normal forms — the real ordinal order. */
  function cmp(a, b) {
    for (let i = 0; ; i++) {
      if (i >= a.length && i >= b.length) return 0;
      if (i >= a.length) return -1;
      if (i >= b.length) return 1;
      const ce = cmp(a[i].e, b[i].e); if (ce) return ce;
      if (a[i].c !== b[i].c) return a[i].c < b[i].c ? -1 : 1;
    }
  }
  const isOne = h => h.length === 1 && h[0].c === 1 && isZero(h[0].e);
  function render(h, base, ordinal) {
    if (isZero(h)) return '0';
    const B = ordinal ? 'ω' : String(base);
    return h.map(t => {
      if (isZero(t.e)) return String(t.c);
      const ex = isOne(t.e) ? '' : (ordinal ? '<sup>' + render(t.e, base, true) + '</sup>' : '<sup>' + render(t.e, base, false) + '</sup>');
      return B + ex + (t.c > 1 ? '·' + t.c : '');
    }).join(' + ');
  }

  let n0 = 4, h = toHered(4, 2), k = 0, hist = [], ords = [], stuck = false, timer = null;

  function reset(n) {
    n0 = n; h = toHered(n, 2); k = 0; stuck = false;
    hist = [{ k: 0, log: Math.log10(n) }]; ords = [{ s: render(h, 2, true), t: clone(h) }];
    if (timer) { clearInterval(timer); timer = null; document.getElementById('gs-run').textContent = '▶ Run 50'; }
    paint();
  }
  function step() {
    if (stuck || isZero(h)) return false;
    const nb = k + 3;                        // bump from base k+2 to k+3
    const d = dec(h, nb);
    if (d === null) { stuck = true; paint(); return false; }
    h = d; k++;
    hist.push({ k, log: hLog10(h, k + 2) });
    ords.push({ s: render(h, k + 2, true), t: clone(h) });
    paint();
    return !isZero(h);
  }

  const S = scene(cv, {
    aspect: 2.8, still: true,
    draw(ctx, P) {
      const w = cv._w, h2 = cv._h, padL = 54, padB = 22, padT = 12, padR = 10;
      ctx.fillStyle = P.paper2; ctx.fillRect(0, 0, w, h2);
      const pts = hist.map(p => ({ k: p.k, y: isFinite(p.log) && p.log > 0 ? Math.log10(1 + p.log) : 0 }));
      const kmax = Math.max(8, hist.length - 1);
      let mx = 0.5; pts.forEach(p => mx = Math.max(mx, p.y));
      const X = kk => padL + kk / kmax * (w - padL - padR);
      const Y = v => h2 - padB - v / (mx * 1.12) * (h2 - padT - padB);
      ctx.strokeStyle = P.ruleSoft; ctx.beginPath();
      for (let v = 0; v <= mx; v += mx / 4) { const py = Math.round(Y(v)) + .5; ctx.moveTo(padL, py); ctx.lineTo(w - padR, py); }
      ctx.stroke();
      ctx.fillStyle = P.ink4; ctx.font = '9px ui-monospace, monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (let v = 0; v <= mx; v += mx / 4) ctx.fillText(v.toFixed(2), padL - 5, Y(v));
      ctx.beginPath();
      pts.forEach((p, i) => { const px = X(p.k), py = Y(p.y); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
      ctx.strokeStyle = P.acc2; ctx.lineWidth = 2.2; ctx.stroke();
      pts.forEach(p => dot(ctx, X(p.k), Y(p.y), 2.6, P.acc2));
      label(ctx, 'log₁₀( log₁₀ of the value )  — a double logarithm, and it still climbs', padL + 6, padT + 9, P.ink4, '9px ui-monospace, monospace');
      label(ctx, 'step k →', w - padR - 4, h2 - 6, P.ink4, '9px ui-monospace, monospace', 'right');
    }
  });

  function paint() {
    const base = k + 2;
    document.getElementById('gs-k').textContent = k;
    document.getElementById('gs-b').textContent = base;
    const lg = hLog10(h, base), val = hVal(h, base);
    document.getElementById('gs-v').textContent = isZero(h) ? '0' : (isFinite(val) && val < 1e15 ? Math.round(val).toLocaleString() : (isFinite(lg) ? '≈ 10^' + lg.toExponential(4) : 'beyond 10^(10^308)'));
    document.getElementById('gs-d').textContent = isZero(h) ? '1' : (isFinite(lg) ? (lg < 1e15 ? Math.ceil(lg).toLocaleString() : '≈ 10^' + Math.log10(lg).toFixed(1)) : 'unrepresentable');
    document.getElementById('gs-her').innerHTML = render(h, base, false);

    const ladder = ords.slice(-7);
    /* Compare the real Cantor normal forms, not their rendered strings. */
    const descended = ords.length < 2 || cmp(ords[ords.length - 1].t, ords[ords.length - 2].t) < 0;
    document.getElementById('gs-ord').innerHTML =
      ladder.map((o, i) => `<div style="opacity:${0.30 + 0.70 * (i + 1) / ladder.length}">${i === ladder.length - 1 ? '▸ ' : '  '}${o.s}</div>`).join('') +
      (isZero(h) ? `<div style="color:${css('--ok')};margin-top:8px">reached 0 — the sequence terminated after ${k} steps</div>`
        : stuck ? `<div style="color:${css('--warn')};margin-top:8px">the hereditary form has outgrown the display; the ordinal is still descending</div>`
          : descended ? `<div style="color:${css('--ok')};margin-top:8px">strictly smaller than the line above ✓ (verified by comparing Cantor normal forms)</div>`
            : `<div style="color:${css('--bad')};margin-top:8px">NOT smaller — that would be a bug</div>`);
    S.redraw();
  }

  document.querySelectorAll('#gs-pick .btn').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('#gs-pick .btn').forEach(x => x.classList.remove('on'));
    b.classList.add('on'); reset(+b.dataset.n);
  }));
  document.getElementById('gs-step').addEventListener('click', step);
  document.getElementById('gs-reset').addEventListener('click', () => reset(n0));
  document.getElementById('gs-run').addEventListener('click', e => {
    if (timer) { clearInterval(timer); timer = null; e.target.textContent = '▶ Run 50'; return; }
    e.target.textContent = '❙❙ Stop';
    let left = 50;
    timer = setInterval(() => {
      if (!step() || --left <= 0) { clearInterval(timer); timer = null; e.target.textContent = '▶ Run 50'; }
    }, 130);
  });

  /* self-check: the ordinal must strictly decrease at every step */
  (function selfCheck() {
    let t = toHered(4, 2), prev = null, ok = true;
    for (let i = 0; i < 30; i++) {
      if (prev && cmp(t, prev) >= 0) { ok = false; break; }
      prev = t;
      const d = dec(t, i + 3); if (d === null || isZero(d)) break;
      t = d;
    }
    if (!ok) console.warn('[vol3] Goodstein ordinal failed to decrease — this is a bug.');
  })();

  reset(4);
})();

})();
