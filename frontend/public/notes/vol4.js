/* ============================================================
   VOL. IV — HOW LEAN WORKS · interactive figures
   ============================================================ */
(function () {
'use strict';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ===============================================================
   FIG 1 — simply-typed lambda calculus with type inference
   =============================================================== */
(function fig1() {
  const input = document.getElementById('ch-in'); if (!input) return;

  /* --- terms --------------------------------------------------- */
  function parseTerm(src) {
    let i = 0;
    const ws = () => { while (i < src.length && /\s/.test(src[i])) i++; };
    const eat = (s) => { ws(); if (src.startsWith(s, i)) { i += s.length; return true; } return false; };
    const name = () => { ws(); const m = /^[A-Za-z_][A-Za-z0-9_']*/.exec(src.slice(i)); if (!m) return null; i += m[0].length; return m[0]; };

    function atom() {
      ws();
      if (eat('(')) { const e = expr(); ws(); if (!eat(')')) throw { msg: "expected ')'", at: i }; return e; }
      const save = i, n = name();
      if (n === null) return null;
      if (n === 'fun' || n === 'λ') { i = save; return null; }        // let expr() handle binders
      return { t: 'var', n };
    }
    function expr() {
      ws();
      const save = i, n0 = name();
      if (n0 === 'fun' || n0 === 'λ') {
        const vs = [];
        for (;;) { const v = name(); if (v === null) break; vs.push(v); ws(); if (src.startsWith('=>', i) || src.startsWith('.', i) || src.startsWith('↦', i)) break; }
        if (!vs.length) throw { msg: 'expected a binder name after fun', at: i };
        if (!(eat('=>') || eat('↦') || eat('.'))) throw { msg: "expected '=>' after the binder", at: i };
        let body = expr();
        for (let k = vs.length - 1; k >= 0; k--) body = { t: 'lam', x: vs[k], b: body };
        return body;
      }
      i = save;
      let head = atom();
      if (head === null) throw { msg: 'expected a term', at: i };
      for (;;) {
        const mark = i; ws();
        if (i >= src.length || src[i] === ')') break;
        const a = (function () { try { return atom(); } catch (e) { i = mark; return null; } })();
        if (a === null) { i = mark; break; }
        head = { t: 'app', f: head, a };
      }
      return head;
    }
    const e = expr(); ws();
    if (i < src.length) throw { msg: `unexpected '${src[i]}'`, at: i };
    return e;
  }

  /* --- types and unification ----------------------------------- */
  let nextTV = 0;
  const fresh = () => ({ t: 'tv', id: nextTV++, ref: null });
  const arrow = (a, b) => ({ t: 'arr', a, b });
  function prune(t) { while (t.t === 'tv' && t.ref) t = t.ref; return t; }
  function occurs(v, t) {
    t = prune(t);
    if (t === v) return true;
    if (t.t === 'arr') return occurs(v, t.a) || occurs(v, t.b);
    return false;
  }
  function unify(a, b) {
    a = prune(a); b = prune(b);
    if (a === b) return;
    if (a.t === 'tv') { if (occurs(a, b)) throw { occ: true, a, b }; a.ref = b; return; }
    if (b.t === 'tv') return unify(b, a);
    unify(a.a, b.a); unify(a.b, b.b);
  }
  const GREEK = 'αβγδεζηθικλμνξ';
  /* → is right-associative, so only the DOMAIN of an arrow ever needs brackets. */
  function tyStr(t, names, needParen) {
    t = prune(t);
    if (t.t === 'tv') { if (!names.has(t)) names.set(t, GREEK[names.size % GREEK.length] || 't' + names.size); return names.get(t); }
    const s = tyStr(t.a, names, true) + ' → ' + tyStr(t.b, names, false);
    return needParen ? '(' + s + ')' : s;
  }
  function infer(term, env, stats) {
    switch (term.t) {
      case 'var': {
        if (!(term.n in env)) throw { unbound: term.n };
        return env[term.n];
      }
      case 'lam': {
        stats.lam++;
        const tv = fresh();
        return arrow(tv, infer(term.b, Object.assign({}, env, { [term.x]: tv }), stats));
      }
      case 'app': {
        stats.app++;
        const tf = infer(term.f, env, stats), ta = infer(term.a, env, stats), tr = fresh();
        unify(tf, arrow(ta, tr));
        return tr;
      }
    }
  }

  const PRESETS = [
    ['fun x => x', 'α → α', 'The identity. In Vol. III this took a five-line Hilbert derivation; here it is the shortest program there is.'],
    ['fun x => fun y => x', 'α → β → α', 'The <strong>K</strong> combinator — and axiom <strong>A1</strong> of the Hilbert system in Vol. III §1.3. "If α, then β implies α": given a proof of α, throw away the proof of β and hand it back.'],
    ['fun f => fun g => fun x => f x (g x)', '(α → β → γ) → (α → β) → α → γ', 'The <strong>S</strong> combinator — axiom <strong>A2</strong>. Everything provable in implicational intuitionistic logic is built from these two, which is exactly why S and K generate all closed λ-terms.'],
    ['fun f => fun g => fun x => f (g x)', '(α → β) → (γ → α) → γ → β', 'Function composition — which, read as logic, is the hypothetical syllogism: from α→β and γ→α, conclude γ→β. (The letters fall out of the order unification allocated them; the type is the syllogism whatever you call the variables.)'],
    ['fun f => fun x => f (f x)', '(α → α) → α → α', 'The Church numeral 2. Its type is the Peano-style "iterate once, iterate again" — data and proof are literally the same term.'],
    ['fun x => x x', null, 'Self-application. The occurs check refuses it: unifying α with α → β would need an infinite type. Untyped λ-calculus allows this and is therefore useless as a logic — Y = λf.(λx.f (x x))(λx.f (x x)) gives a "proof" of anything. <strong>Termination is not a convenience here; it is consistency.</strong>'],
    ['fun f => (fun x => f (x x)) (fun x => f (x x))', null, 'The <strong>Y combinator</strong>, the fixed-point operator of untyped λ-calculus. Rejected for the same reason as <code>x x</code>. And it had better be: a well-typed Y would give <code>Y : (α → α) → α</code>, hence an inhabitant of <em>every</em> type — including <code>False</code>. Termination is not a stylistic preference; it is the difference between a logic and a paradox.'],
    ['fun p => fun q => p (q p)', '(α → β) → ((α → β) → α) → β', 'Worth trying because it <em>looks</em> like Peirce’s law and is not. Apply q to p to get an α, then p to that to get a β — perfectly constructive. Peirce’s law proper, <code>((α → β) → α) → α</code>, has no inhabitant at all: it is exactly the strength of excluded middle, and no amount of λ-writing will produce one.']
  ];
  document.getElementById('ch-presets').innerHTML = PRESETS.map((p, i) =>
    `<button class="tok dash" data-pre="${i}">${esc(p[0])}</button>`).join('');
  document.querySelectorAll('[data-pre]').forEach(b => b.addEventListener('click', () => {
    input.value = PRESETS[+b.dataset.pre][0]; render();
  }));

  function render() {
    nextTV = 0;
    const out = document.getElementById('ch-type'), st = document.getElementById('ch-status');
    const stats = { lam: 0, app: 0 };
    let term;
    try { term = parseTerm(input.value); }
    catch (e) {
      out.innerHTML = `<span style="color:${css('--bad')}">parse error at ${e.at}: ${esc(e.msg)}</span>`;
      st.textContent = 'syntax error'; st.style.color = css('--bad');
      ['ch-tv', 'ch-lam', 'ch-app'].forEach(i => document.getElementById(i).textContent = '—');
      document.getElementById('ch-note').innerHTML = ''; return;
    }
    let ty;
    try { ty = infer(term, {}, stats); }
    catch (e) {
      const names = new Map();
      out.innerHTML = e.unbound
        ? `<span style="color:${css('--bad')}">unbound variable '${esc(e.unbound)}' — only closed terms correspond to theorems</span>`
        : `<span style="color:${css('--bad')}">occurs check failed: cannot construct the infinite type ${esc(tyStr(e.a, names, false))} = ${esc(tyStr(e.b, names, false))}</span>`;
      st.textContent = e.unbound ? 'not closed' : 'ill-typed'; st.style.color = css('--bad');
      document.getElementById('ch-tv').textContent = '—';
      document.getElementById('ch-lam').textContent = stats.lam;
      document.getElementById('ch-app').textContent = stats.app;
      const pre = PRESETS.find(p => p[0] === input.value.trim());
      document.getElementById('ch-note').innerHTML = pre ? pre[2]
        : 'No type means no theorem. The type system is rejecting this term, and in the propositions-as-types reading that is exactly a proof checker rejecting a bad proof.';
      return;
    }
    const names = new Map();
    const s = tyStr(ty, names, false);
    out.innerHTML = esc(s);
    st.textContent = 'well-typed ✓'; st.style.color = css('--ok');
    document.getElementById('ch-tv').textContent = names.size;
    document.getElementById('ch-lam').textContent = stats.lam;
    document.getElementById('ch-app').textContent = stats.app;
    const pre = PRESETS.find(p => p[0] === input.value.trim());
    document.getElementById('ch-note').innerHTML = (pre && pre[2] ? pre[2] + '<br><br>' : '') +
      `Read the type as a proposition: <strong>${esc(s)}</strong>. Your term is a proof of it, and the proof is constructive — it tells you how to build the conclusion from the hypotheses. ` +
      `The ${stats.lam} λ-abstraction${stats.lam === 1 ? '' : 's'} ${stats.lam === 1 ? 'is' : 'are'} implication-introduction${stats.lam === 1 ? '' : 's'}; the ${stats.app} application${stats.app === 1 ? '' : 's'} ${stats.app === 1 ? 'is a' : 'are'} modus ponens.`;
  }
  input.addEventListener('input', render);
  render();
})();

/* ===============================================================
   FIG 2 — the pipeline
   =============================================================== */
(function fig2() {
  const host = document.getElementById('pipe'); if (!host) return;
  const STAGES = [
    { n: 'stage 1', t: 'Source text', trusted: false, d: `
      <h6>What it is</h6><p>The <code>.lean</code> file: notation, <code>theorem</code> declarations, tactic blocks, <code>macro</code> definitions. Lean 4's syntax is itself extensible — user code can add new notation and even new tactics, in Lean.</p>
      <h6>If this is wrong</h6><p>You proved something other than what you meant. <strong>This is the one failure mode the architecture cannot protect you from</strong>, and in practice it is the most common one. A mis-stated definition or a vacuous hypothesis is checked with complete enthusiasm.</p>` },
    { n: 'stage 2', t: 'Parser &amp; macros', trusted: false, d: `
      <h6>What it is</h6><p>Turns text into <code>Syntax</code> trees, then expands macros and notation. <code>a + b</code> becomes <code>HAdd.hAdd a b</code>; <code>⟨x, y⟩</code> becomes an anonymous constructor node awaiting elaboration.</p>
      <h6>If this is wrong</h6><p>Nothing unsound. A bad macro produces a <code>Syntax</code> tree that elaborates to a term that fails to type-check, or that means something you did not intend — and the latter collapses into stage 1's problem, not a soundness problem.</p>` },
    { n: 'stage 3', t: 'Elaborator', trusted: false, d: `
      <h6>What it is</h6><p>The big one — around 100 000 lines. Infers implicit arguments, resolves type classes, inserts coercions, runs unification, executes your tactic blocks, and fills metavariables. Practically everything that makes Lean pleasant lives here.</p>
      <h6>If this is wrong</h6><p><strong>Nothing unsound.</strong> The elaborator's only output is a term. If it is buggy, it emits a term that the kernel rejects — your file stops compiling. It cannot manufacture a false theorem, because it has no authority to declare anything true.</p>
      <p>This is the whole point of the design, and it is why a hundred thousand lines of heuristics can sit in the middle of a system people trust.</p>` },
    { n: 'stage 4', t: 'Expr (the term)', trusted: false, d: `
      <h6>What it is</h6><p>A small, closed data type: variables (de Bruijn), applications, lambdas, Π-types, <code>let</code>, sorts, constants, literals. Eleven constructors. <em>This</em> is the proof — the tactic script is now irrelevant and discarded.</p>
      <h6>Why it matters</h6><p>Because the term is self-contained, it can be serialised, shipped, and re-checked by a completely different program that knows nothing about how it was made.</p>` },
    { n: 'stage 5', t: 'Kernel', trusted: true, d: `
      <h6>What it is</h6><p>A few thousand lines of C++ doing one job: given an <code>Expr</code> and a claimed type, decide whether the term really has that type. Implements the typing rules, the five reduction rules of §3, universe-level constraints, and the inductive-type schema of §4.</p>
      <h6>If this is wrong</h6><p><strong>A genuine crisis</strong> — false theorems become provable. Which is exactly why it is small, changes rarely, and has independent re-implementations (<code>lean4checker</code>, Trepplein) that can re-verify an entire compiled environment from scratch.</p>
      <h6>Caveat worth knowing</h6><p>The kernel is slightly bigger than the idealised story: it special-cases <code>Nat</code> with GMP arithmetic, and handles literals and structure-eta. Each addition is a deliberate, argued-over widening of the trusted base.</p>` },
    { n: 'stage 6', t: 'Environment', trusted: true, d: `
      <h6>What it is</h6><p>The accumulated set of accepted declarations, plus the axioms. <code>#print axioms f</code> walks the dependency graph and reports exactly which axioms a result rests on.</p>
      <h6>If this is wrong</h6><p>Adding an inconsistent axiom makes everything provable. Lean's three (<code>propext</code>, <code>Classical.choice</code>, <code>Quot.sound</code>) are known consistent relative to ZFC + countably many inaccessibles. <code>sorry</code> registers as <code>sorryAx</code> and is visible to the same command — you cannot hide a hole.</p>` }
  ];
  host.innerHTML = STAGES.map((s, i) =>
    (i ? '<div class="parrow">→</div>' : '') +
    `<div class="pbox${s.trusted ? ' trusted' : ''}" data-s="${i}"><span class="n">${s.n}</span><span class="t">${s.t}</span></div>`
  ).join('');
  const detail = document.getElementById('pipe-detail');
  function pick(i) {
    host.querySelectorAll('.pbox').forEach(b => b.classList.toggle('on', +b.dataset.s === i));
    detail.innerHTML = `<h6 style="color:${STAGES[i].trusted ? css('--acc-2') : css('--acc')}">${STAGES[i].t}${STAGES[i].trusted ? ' — TRUSTED' : ' — untrusted'}</h6>` + STAGES[i].d;
  }
  host.querySelectorAll('.pbox').forEach(b => b.addEventListener('click', () => pick(+b.dataset.s)));
  pick(4);
})();

/* ===============================================================
   FIG 3 — the reduction machine
   ===============================================================
   A real evaluator: terms are data, and each step fires an actual
   rule.  Implicit motives are suppressed in the display.
   =============================================================== */
(function fig3() {
  const termEl = document.getElementById('rd-term'); if (!termEl) return;

  const V = n => ({ t: 'var', n });
  const L = (x, b) => ({ t: 'lam', x, b });
  const A = (f, ...as) => as.reduce((g, a) => ({ t: 'app', f: g, a }), f);
  const C = n => ({ t: 'const', n });
  const K = (n, ...args) => ({ t: 'ctor', n, args });
  const LET = (x, v, b) => ({ t: 'let', x, v, b });

  /* definitions, unfolded by δ */
  const DEFS = {
    'Nat.add': L('m', L('n', A(C('Nat.rec'), V('m'), L('k', L('ih', K('Nat.succ', V('ih')))), V('n')))),
    'Nat.mul': L('m', L('n', A(C('Nat.rec'), K('Nat.zero'), L('k', L('ih', A(C('Nat.add'), V('ih'), V('m')))), V('n')))),
    'List.append': L('xs', L('ys', A(C('List.rec'), V('ys'), L('a', L('t', L('ih', K('List.cons', V('a'), V('ih'))))), V('xs')))),
    'double': L('n', A(C('Nat.add'), V('n'), V('n')))
  };
  const REC = {
    'Nat.rec': { arity: 3, major: 2, cases: { 'Nat.zero': (ms) => ms[0], 'Nat.succ': (ms, args, self) => A(ms[1], args[0], self(args[0])) } },
    'List.rec': { arity: 3, major: 2, cases: { 'List.nil': (ms) => ms[0], 'List.cons': (ms, args, self) => A(ms[1], args[0], args[1], self(args[1])) } }
  };

  const numeral = n => { let t = K('Nat.zero'); for (let i = 0; i < n; i++) t = K('Nat.succ', t); return t; };
  const list = (...xs) => xs.reduceRight((acc, x) => K('List.cons', numeral(x), acc), K('List.nil'));

  /* --- free variables and capture-avoiding substitution --------- */
  function fv(t, acc) {
    acc = acc || new Set();
    switch (t.t) {
      case 'var': acc.add(t.n); break;
      case 'lam': { const s = fv(t.b); s.delete(t.x); s.forEach(v => acc.add(v)); break; }
      case 'app': fv(t.f, acc); fv(t.a, acc); break;
      case 'ctor': t.args.forEach(a => fv(a, acc)); break;
      case 'let': { fv(t.v, acc); const s = fv(t.b); s.delete(t.x); s.forEach(v => acc.add(v)); break; }
    }
    return acc;
  }
  let gensym = 0;
  function subst(t, x, s) {
    switch (t.t) {
      case 'var': return t.n === x ? s : t;
      case 'app': return { t: 'app', f: subst(t.f, x, s), a: subst(t.a, x, s) };
      case 'ctor': return { t: 'ctor', n: t.n, args: t.args.map(a => subst(a, x, s)) };
      case 'const': return t;
      case 'lam': {
        if (t.x === x) return t;
        if (fv(s).has(t.x)) { const y = t.x + '′' + (gensym++); return { t: 'lam', x: y, b: subst(subst(t.b, t.x, V(y)), x, s) }; }
        return { t: 'lam', x: t.x, b: subst(t.b, x, s) };
      }
      case 'let': {
        const v = subst(t.v, x, s);
        if (t.x === x) return { t: 'let', x: t.x, v, b: t.b };
        return { t: 'let', x: t.x, v, b: subst(t.b, x, s) };
      }
    }
  }
  const spine = t => { const args = []; while (t.t === 'app') { args.unshift(t.a); t = t.f; } return { head: t, args }; };
  const rebuild = (head, args) => A(head, ...args);

  /* --- one reduction step, leftmost-outermost ------------------- */
  function reduce(t) {
    /* β */
    if (t.t === 'app' && t.f.t === 'lam') return { t: subst(t.f.b, t.f.x, t.a), rule: 'β' };
    /* ι */
    if (t.t === 'app') {
      const { head, args } = spine(t);
      if (head.t === 'const' && REC[head.n]) {
        const R = REC[head.n];
        if (args.length >= R.arity) {
          const maj = args[R.major];
          if (maj.t === 'ctor' && R.cases[maj.n]) {
            const minors = args.slice(0, R.major);
            const self = (x) => rebuild(head, minors.concat([x]));
            const core = R.cases[maj.n](minors, maj.args, self);
            return { t: rebuild(core, args.slice(R.arity)), rule: 'ι' };
          }
        }
      }
    }
    /* δ */
    if (t.t === 'const' && DEFS[t.n]) return { t: DEFS[t.n], rule: 'δ' };
    /* ζ */
    if (t.t === 'let') return { t: subst(t.b, t.x, t.v), rule: 'ζ' };
    /* η */
    if (t.t === 'lam' && t.b.t === 'app' && t.b.a.t === 'var' && t.b.a.n === t.x && !fv(t.b.f).has(t.x))
      return { t: t.b.f, rule: 'η' };
    /* otherwise descend, leftmost first */
    const kids = t.t === 'app' ? [['f', t.f], ['a', t.a]]
      : t.t === 'lam' ? [['b', t.b]]
        : t.t === 'ctor' ? t.args.map((a, i) => [i, a]) : [];
    for (const [k, sub] of kids) {
      const r = reduce(sub);
      if (r) {
        if (t.t === 'ctor') { const args = t.args.slice(); args[k] = r.t; return { t: { t: 'ctor', n: t.n, args }, rule: r.rule, path: [k].concat(r.path || []) }; }
        const nt = Object.assign({}, t); nt[k] = r.t;
        return { t: nt, rule: r.rule, path: [k].concat(r.path || []) };
      }
    }
    return null;
  }

  /* --- printing ------------------------------------------------- */
  function asNumeral(t) { let n = 0; while (t.t === 'ctor' && t.n === 'Nat.succ') { n++; t = t.args[0]; } return (t.t === 'ctor' && t.n === 'Nat.zero') ? n : null; }
  function pp(t, numerals, path, here) {
    here = here || [];
    const mark = s => (path && path.join() === here.join()) ? `<span class="hot">${s}</span>` : s;
    const at = (k, sub) => pp(sub, numerals, path, here.concat([k]));
    switch (t.t) {
      case 'var': return mark(esc(t.n));
      case 'const': return mark(esc(t.n));
      case 'lam': return mark('fun ' + esc(t.x) + ' => ' + at('b', t.b));
      case 'let': return mark('let ' + esc(t.x) + ' := ' + at('v', t.v) + '; ' + at('b', t.b));
      case 'app': {
        const fs = at('f', t.f);
        const as = t.a.t === 'app' || t.a.t === 'lam' || t.a.t === 'let' || (t.a.t === 'ctor' && t.a.args.length && !(numerals && asNumeral(t.a) !== null))
          ? '(' + at('a', t.a) + ')' : at('a', t.a);
        return mark(fs + ' ' + as);
      }
      case 'ctor': {
        if (numerals) { const n = asNumeral(t); if (n !== null) return mark(String(n)); }
        if (!t.args.length) return mark(esc(t.n));
        return mark(esc(t.n) + ' ' + t.args.map((a, i) => {
          const s = at(i, a);
          return (a.t === 'app' || a.t === 'lam' || (a.t === 'ctor' && a.args.length && !(numerals && asNumeral(a) !== null))) ? '(' + s + ')' : s;
        }).join(' '));
      }
    }
  }
  const size = t => t.t === 'var' || t.t === 'const' ? 1
    : t.t === 'lam' ? 1 + size(t.b)
      : t.t === 'app' ? 1 + size(t.f) + size(t.a)
        : t.t === 'let' ? 1 + size(t.v) + size(t.b)
          : 1 + t.args.reduce((s, a) => s + size(a), 0);

  const EXAMPLES = [
    { lab: '(fun x => x+1) 2', t: () => A(L('x', A(C('Nat.add'), V('x'), numeral(1))), numeral(2)),
      note: 'Pure β to begin with: the argument is substituted for the bound variable. Then δ unfolds <code>Nat.add</code> and ι grinds through the recursion. Nine or so steps to compute 2 + 1 — and the kernel really does this.' },
    { lab: 'Nat.add 2 2', t: () => A(C('Nat.add'), numeral(2), numeral(2)),
      note: '<strong>This is why <code>example : 2 + 2 = 4 := rfl</code> compiles.</strong> The kernel reduces both sides to the same normal form and accepts <code>rfl</code>. No proof search, no lemma — arithmetic is evaluation.' },
    { lab: 'Nat.add n 0', t: () => A(C('Nat.add'), V('n'), numeral(0)),
      note: 'Reduces all the way to <code>n</code>, because <code>Nat.add</code> recurses on its <em>second</em> argument and that argument is the literal <code>Nat.zero</code> — so ι fires immediately. Hence <code>n + 0 = n</code> is provable by <code>rfl</code>.' },
    { lab: 'Nat.add 0 n', t: () => A(C('Nat.add'), numeral(0), V('n')),
      note: '<strong>Gets stuck.</strong> After δ and two β steps you reach <code>Nat.rec 0 (…) n</code>, and ι cannot fire because <code>n</code> is a variable, not a constructor. So <code>0 + n = n</code> is <em>not</em> true by computation and <code>rfl</code> fails — you need an induction. Compare the previous example: same theorem morally, completely different definitional status.' },
    { lab: 'Nat.mul 2 3', t: () => A(C('Nat.mul'), numeral(2), numeral(3)),
      note: 'Multiplication defined by recursion on top of addition, which is itself recursion. Watch the step count: this is why Lean\'s kernel special-cases <code>Nat</code> with real machine arithmetic — the honest unary version is unusable past small numbers.' },
    { lab: 'List.append [1,2] [3]', t: () => A(C('List.append'), list(1, 2), list(3)),
      note: '<code>List.rec</code> instead of <code>Nat.rec</code>, but the identical schema: one minor premise per constructor, an induction hypothesis for each recursive argument.' },
    { lab: 'let y := 3; y + y', t: () => LET('y', numeral(3), A(C('Nat.add'), V('y'), V('y'))),
      note: 'ζ-reduction: <code>let</code> is substitution. Note it fires first, before anything else — and that duplicating <code>y</code> duplicates the work, which is why real implementations are more careful than this idealised rule.' },
    { lab: 'fun x => f x', t: () => L('x', A(V('f'), V('x'))),
      note: 'η: a function that just passes its argument along <em>is</em> that function. Lean\'s kernel has η definitionally, so <code>f = fun x => f x</code> is true by <code>rfl</code>. Not every type theory makes this choice.' },
    { lab: 'Nat.rec z s 2 (raw)', t: () => A(C('Nat.rec'), V('z'), V('s'), numeral(2)),
      note: 'The recursor with nothing else in the way. Each ι step peels one <code>Nat.succ</code> and hands the minor premise both the predecessor and the recursive result — the induction hypothesis, in proof-reading.' }
  ];

  let ex = 1, cur = EXAMPLES[1].t(), n = 0, log = [], numerals = true, timer = null;

  document.getElementById('rd-pick').innerHTML = EXAMPLES.map((e, i) =>
    `<button class="btn${i === ex ? ' on' : ''}" data-e="${i}">${esc(e.lab)}</button>`).join('');

  function paint() {
    const r = reduce(cur);
    termEl.innerHTML = pp(cur, numerals, r && r.path ? r.path : (r ? [] : null));
    document.getElementById('rd-rule').textContent = r ? 'next: ' + r.rule : 'normal form';
    document.getElementById('rd-n').textContent = n;
    document.getElementById('rd-next').textContent = r ? r.rule : '—';
    const nf = document.getElementById('rd-nf');
    nf.textContent = r ? 'no' : 'yes';
    nf.style.color = r ? css('--warn') : css('--ok');
    document.getElementById('rd-size').textContent = size(cur);
    document.getElementById('rd-log').innerHTML = log.length
      ? log.slice(-40).map(l => `<div><span class="r">${l.rule}</span>${esc(l.s)}</div>`).join('')
      : '<div style="color:var(--ink-4)">no steps yet</div>';
    const el = document.getElementById('rd-log'); el.scrollTop = el.scrollHeight;
    document.getElementById('rd-note').innerHTML = EXAMPLES[ex].note +
      (r ? '' : `<br><br><strong style="color:${css('--acc')}">Normal form reached after ${n} step${n === 1 ? '' : 's'}.</strong>`);
  }
  function step() {
    const r = reduce(cur);
    if (!r) return false;
    cur = r.t; n++;
    const plain = pp(cur, numerals, null).replace(/<[^>]+>/g, '');
    log.push({ rule: r.rule, s: plain.length > 90 ? plain.slice(0, 90) + '…' : plain });
    paint(); return true;
  }
  function reset(i) {
    if (timer) { clearInterval(timer); timer = null; document.getElementById('rd-run').textContent = '▶ Normalise'; }
    ex = i; cur = EXAMPLES[i].t(); n = 0; log = [];
    document.querySelectorAll('#rd-pick .btn').forEach(b => b.classList.toggle('on', +b.dataset.e === i));
    paint();
  }
  document.querySelectorAll('#rd-pick .btn').forEach(b => b.addEventListener('click', () => reset(+b.dataset.e)));
  document.getElementById('rd-step').addEventListener('click', step);
  document.getElementById('rd-reset').addEventListener('click', () => reset(ex));
  document.getElementById('rd-num').addEventListener('click', e => { numerals = !numerals; e.target.classList.toggle('on', numerals); paint(); });
  document.getElementById('rd-num').classList.add('on');
  document.getElementById('rd-run').addEventListener('click', e => {
    if (timer) { clearInterval(timer); timer = null; e.target.textContent = '▶ Normalise'; return; }
    e.target.textContent = '❙❙ Stop';
    let guard = 400;
    timer = setInterval(() => {
      if (!step() || --guard <= 0) { clearInterval(timer); timer = null; e.target.textContent = '▶ Normalise'; }
    }, 110);
  });
  reset(1);
})();

/* ===============================================================
   FIG 4 — the recursor generator
   =============================================================== */
(function fig4() {
  const host = document.getElementById('rc-pick'); if (!host) return;
  const TYPES = {
    Nat: {
      decl: `inductive Nat where\n  | zero : Nat\n  | succ : Nat → Nat`,
      sort: 'Sort u', ind: 'Nat',
      ctors: [{ n: 'zero', args: [] }, { n: 'succ', args: [{ v: 'n', ty: 'Nat', rec: true }] }],
      note: `<h6>What it is</h6><p>Simultaneously the recursion principle and the induction principle. Take <code>motive := fun _ => Nat</code> and you get recursive definitions; take <code>motive := fun n => P n</code> with <code>P : Nat → Prop</code> and the very same term is proof by induction.</p>
      <p>That coincidence is Curry–Howard at its sharpest: <em>defining a function by recursion and proving a theorem by induction are the same operation</em>, and Lean does not need two mechanisms.</p>` },
    List: {
      decl: `inductive List (α : Type u) where\n  | nil  : List α\n  | cons : α → List α → List α`,
      sort: 'Sort v', ind: 'List α',
      ctors: [{ n: 'nil', args: [] }, { n: 'cons', args: [{ v: 'a', ty: 'α' }, { v: 't', ty: 'List α', rec: true }] }],
      note: `<h6>What it is</h6><p>The same schema with a parameter. <code>α</code> is fixed throughout — it is a <em>parameter</em>, not an <em>index</em>, so the motive does not depend on it and no induction hypothesis is generated for the <code>a : α</code> argument (α is not recursive).</p>
      <p><code>List.rec</code> is <code>foldr</code>. Every structurally recursive list function in Mathlib compiles to it.</p>` },
    Or: {
      decl: `inductive Or (a b : Prop) : Prop where\n  | inl : a → Or a b\n  | inr : b → Or a b`,
      sort: 'Prop', ind: 'Or a b',
      ctors: [{ n: 'inl', args: [{ v: 'h', ty: 'a' }] }, { n: 'inr', args: [{ v: 'h', ty: 'b' }] }],
      note: `<h6>What it is</h6><p>Proof by cases, derived rather than postulated. To use a disjunction you must handle both constructors — which is precisely what <code>rcases</code> / <code>cases</code> does.</p>
      <h6>The restriction</h6><p><code>Or</code> lives in <code>Prop</code> and has two constructors, so it only eliminates into <code>Prop</code>: you cannot compute which disjunct held. Contrast <code>Sum</code> in <code>Type</code>, where you can. This is the <code>Prop</code>/<code>Type</code> distinction of §5 biting, and it is why <code>Classical.em</code> gives you no algorithm.</p>` },
    And: {
      decl: `structure And (a b : Prop) : Prop where\n  intro ::\n  left  : a\n  right : b`,
      sort: 'Sort u', ind: 'And a b',
      ctors: [{ n: 'intro', args: [{ v: 'left', ty: 'a' }, { v: 'right', ty: 'b' }] }],
      note: `<h6>What it is</h6><p>A <code>structure</code> is an inductive type with exactly one constructor, and its recursor is the pattern-matching principle. The projections <code>h.left</code> and <code>h.right</code> are defined <em>from</em> the recursor.</p>
      <h6>Singleton elimination</h6><p>Single-constructor <code>Prop</code>s whose fields are all proofs are allowed to eliminate into <code>Type</code> — the carefully-carved exception mentioned in §5. It is what makes <code>And</code> and <code>Eq</code> usable in computations.</p>` },
    False: {
      decl: `inductive False : Prop`,
      sort: 'Sort u', ind: 'False', ctors: [],
      note: `<h6>What it is</h6><p><em>Ex falso quodlibet</em>, and note what it is <strong>not</strong>: an axiom. It is the recursor schema applied to a type with zero constructors. One minor premise per constructor means <em>none at all</em>, so the recursor takes only the motive and the major premise and hands you <code>motive t</code> for any motive whatsoever.</p>
      <p>There are no ι-rules either, because there is no constructor for the recursor to meet. The principle emerges from the general schema; nobody had to decide it should hold.</p>` },
    Eq: {
      decl: `inductive Eq {α : Sort u} (a : α) : α → Prop where\n  | refl : Eq a a`,
      indexed: true,
      recOverride: `@Eq.rec : {α : Sort u} → {a : α} →
  {%MOTIVE%motive : (b : α) → a = b → Sort v%/%} →
  %MINOR%(refl : motive a rfl)%/% →
  {b : α} → %MAJOR%(h : a = b)%/% → motive b h`,
      iotaOverride: `@Eq.rec motive m a rfl  ⟶  m`,
      note: `<h6>What it is</h6><p>An <em>indexed</em> family: the second argument of <code>Eq</code> varies, so the motive must depend both on that index <code>b</code> and on the proof <code>h</code> itself. There is one constructor, <code>refl</code>, which forces <code>b</code> to be <code>a</code>.</p>
      <h6>Why it matters</h6><p>This is the <strong>only</strong> thing Lean knows about equality. Every <code>rw</code>, every <code>subst</code>, every <code>congrArg</code>, every <code>simp</code> rewrite in all of Mathlib elaborates down to <code>Eq.rec</code>. Leibniz's "substitute equals for equals" is not a rule of the logic; it is the eliminator of a one-constructor inductive family.</p>
      <p>It is also the source of dependent-type pain: when the motive is complicated, <code>Eq.rec</code> produces terms that do not reduce, and you meet the infamous "motive is not type correct".</p>` },
    Acc: {
      decl: `inductive Acc {α : Sort u} (r : α → α → Prop) : α → Prop where\n  | intro (x : α) (h : ∀ y, r y x → Acc r y) : Acc r x`,
      indexed: true,
      recOverride: `@Acc.rec : {α : Sort u} → {r : α → α → Prop} →
  {%MOTIVE%motive : (x : α) → Acc r x → Sort v%/%} →
  %MINOR%((x : α) → (h : ∀ y, r y x → Acc r y) →
   (ih : ∀ y (hy : r y x), motive y (h y hy)) →
   motive x (Acc.intro x h))%/% →
  {x : α} → %MAJOR%(t : Acc r x)%/% → motive x t`,
      iotaOverride: `@Acc.rec motive m x (Acc.intro x h)
  ⟶  m x h (fun y hy => @Acc.rec motive m y (h y hy))`,
      note: `<h6>What it is</h6><p>How Lean justifies recursion that is <em>not</em> structural. <code>Acc r x</code> says "x is accessible": every <code>r</code>-predecessor of x is accessible too. The type is well-founded by construction, because you can only build <code>Acc.intro</code> from proofs about smaller elements.</p>
      <h6>The trick</h6><p>When you write a function whose argument does not visibly shrink — Euclid's algorithm, say — Lean recurses on the <em>accessibility proof</em> instead of on the data. The proof is structurally decreasing even when the data is not, so <code>Acc.rec</code> applies and termination is established.</p>
      <p>The cost: the resulting definition does not reduce well definitionally, which is why <code>decide</code> and <code>rfl</code> often fail on well-founded definitions and you need the equation lemmas instead.</p>` }
  };

  const wrap = (cls, s) => `<span class="${cls}">${s}</span>`;
  function generate(T) {
    if (T.recOverride) return T.recOverride
      .replace(/%MOTIVE%/g, '<span class="m-motive">').replace(/%MINOR%/g, '<span class="m-minor">')
      .replace(/%MAJOR%/g, '<span class="m-major">').replace(/%\/%/g, '</span>');
    const I = T.ind;
    const lines = [`${T.ind.split(' ')[0]}.rec :`];
    lines.push('  {' + wrap('m-motive', `motive : ${esc(I)} → Sort v`) + '} →');
    T.ctors.forEach(c => {
      const bind = c.args.map(a => `(${a.v} : ${esc(a.ty)})`).join(' → ');
      const ihs = c.args.filter(a => a.rec).map(a => `motive ${a.v}`).join(' → ');
      const concl = `motive (${I.split(' ')[0]}.${c.n}${c.args.length ? ' ' + c.args.map(a => a.v).join(' ') : ''})`;
      const inner = [bind, ihs, concl].filter(Boolean).join(' → ');
      lines.push('  ' + wrap('m-minor', `(${c.n} : ${c.args.length || ihs ? inner : concl})`) + ' →');
    });
    lines.push('  ' + wrap('m-major', `(t : ${esc(I)})`) + ' → motive t');
    return lines.join('\n');
  }
  function iota(T) {
    if (T.iotaOverride) return esc(T.iotaOverride);
    if (!T.ctors.length) return '(none — there is no constructor for the recursor to meet)';
    const base = T.ind.split(' ')[0];
    const ms = T.ctors.map(c => 'm_' + c.n).join(' ');
    return T.ctors.map(c => {
      const as = c.args.map(a => a.v).join(' ');
      const ihs = c.args.filter(a => a.rec).map(a => `(${base}.rec ${ms} ${a.v})`).join(' ');
      return `${base}.rec ${ms} (${base}.${c.n}${as ? ' ' + as : ''})  ⟶  m_${c.n}${as ? ' ' + as : ''}${ihs ? ' ' + ihs : ''}`;
    }).join('\n');
  }

  host.innerHTML = Object.keys(TYPES).map((k, i) => `<button class="btn${i === 0 ? ' on' : ''}" data-t="${k}">${k}</button>`).join('');
  function pick(k) {
    host.querySelectorAll('.btn').forEach(b => b.classList.toggle('on', b.dataset.t === k));
    const T = TYPES[k];
    document.getElementById('rc-decl').textContent = T.decl;
    document.getElementById('rc-rec').innerHTML = generate(T);
    document.getElementById('rc-iota').textContent = iota(T).replace(/<[^>]+>/g, '');
    document.getElementById('rc-note').innerHTML = T.note +
      (T.indexed ? `<p style="margin-top:12px;color:var(--ink-3)"><em>This one is an indexed family, so the motive depends on the index as well as on the element. The general schema still applies, but the mechanical generator above is written out by hand here rather than derived, to keep the indices honest.</em></p>` : '');
  }
  host.querySelectorAll('.btn').forEach(b => b.addEventListener('click', () => pick(b.dataset.t)));
  pick('Nat');
})();

/* ===============================================================
   FIG 5 — the universe calculator
   =============================================================== */
(function fig5() {
  const a = document.getElementById('uv-a'); if (!a) return;
  const b = document.getElementById('uv-b');
  const nm = u => u === 0 ? 'Prop' : 'Type ' + (u - 1);
  const sort = u => u === 0 ? 'Sort 0' : 'Sort ' + u;
  function render() {
    const u = +a.value, v = +b.value;
    document.getElementById('uv-av').textContent = nm(u);
    document.getElementById('uv-bv').textContent = nm(v);
    const r = (v === 0) ? 0 : Math.max(u, v);
    document.getElementById('uv-out').innerHTML =
      `<span style="color:${css('--ink-3')}">α : ${nm(u)}        β : ${nm(v)}</span>\n\n` +
      `(x : α) → β   :   <span style="color:${css('--acc')};font-weight:600">${nm(r)}</span>\n\n` +
      `<span style="color:${css('--ink-3')}">imax ${u} ${v} = ${r}   (${sort(u)}, ${sort(v)} ↦ ${sort(r)})</span>`;
    let note;
    if (v === 0 && u === 0) note = `<h6>Impredicative, level 0</h6><p><code>∀ p : Prop, p → p</code> is a proposition that quantifies over <em>all</em> propositions, itself included, and remains a proposition. In any predicative system this would have to live one level up.</p>`;
    else if (v === 0) note = `<h6>Impredicativity, the striking case</h6><p>You are quantifying over <strong>${nm(u)}</strong> — a universe far larger than <code>Prop</code> — and the result is still <code>Prop</code>. <code>∀ α : ${nm(u)}, α → α</code> is a proposition.</p>
      <p>Doing the analogous thing one level up (<code>Type : Type</code>) yields <strong>Girard's paradox</strong> and an inconsistency. It is safe here only because <code>Prop</code> has proof irrelevance: any two proofs of a proposition are definitionally equal, so a proof carries no information to diagonalise against.</p>`;
    else note = `<h6>Predicative, above Prop</h6><p>Ordinary behaviour: the function type lands in the larger of the two universes. <code>List : Type u → Type u</code>, <code>(α : Type 0) → α → α : Type 1</code>. The hierarchy is cumulative-by-lifting rather than cumulative-by-subtyping, which is why Lean has explicit universe polymorphism (<code>Sort u</code>) instead of a single <code>Type</code>.</p>
      <p>Try setting the codomain to <code>Prop</code> and watch the result collapse to <code>Prop</code> no matter how large the domain.</p>`;
    document.getElementById('uv-note').innerHTML = note;
  }
  a.addEventListener('input', render); b.addEventListener('input', render); render();
})();

/* ===============================================================
   FIG 6 — the tactic sandbox
   =============================================================== */
(function fig6() {
  const host = document.getElementById('tc-pick'); if (!host) return;
  const st = (hyps, goals) => ({ hyps, goals });
  const PROOFS = [
    {
      name: 'p ∧ q → q ∧ p',
      init: st(['p q : Prop'], ['p ∧ q → q ∧ p']),
      term: 'fun h => ⟨h.right, h.left⟩',
      steps: [
        { ok: 'intro h', after: st(['p q : Prop', 'h : p ∧ q'], ['q ∧ p']),
          note: '<code>intro</code> is →-introduction: it moves the antecedent into the context and leaves the consequent as the goal. The term being built so far is <code>fun h => ?_</code>.',
          wrong: { 'exact h.1': 'There is no <code>h</code> in the context yet — the goal is still an implication. You have to <code>intro</code> first.', 'rfl': 'The goal is not an equality, so there is nothing for <code>rfl</code> to do.', 'induction p': '<code>p</code> is a <code>Prop</code>, not a piece of data. <code>Prop</code>s do not eliminate into <code>Type</code>, and there is nothing to induct on.' } },
        { ok: 'constructor', after: st(['p q : Prop', 'h : p ∧ q'], ['q', 'p']),
          note: '<code>constructor</code> applies the unique constructor <code>And.intro</code>, splitting one goal into one per argument. Two goals now; Lean works on the first.',
          wrong: { 'exact h': '<code>h : p ∧ q</code> but the goal is <code>q ∧ p</code>. The two are propositionally equivalent and <em>not</em> definitionally equal, so <code>exact</code> refuses.', 'rfl': 'Still not an equality goal.' } },
        { ok: 'exact h.right', after: st(['p q : Prop', 'h : p ∧ q'], ['p']),
          note: '<code>h.right</code> is <code>And.right h</code>, itself defined via <code>And.rec</code>. First goal closed.',
          wrong: { 'exact h.left': '<code>h.left : p</code>, but this goal is <code>q</code>. Right lemma, wrong goal — Lean is working on the first goal.', 'constructor': '<code>q</code> is an opaque propositional variable; it has no constructor.' } },
        { ok: 'exact h.left', after: st(['p q : Prop'], []),
          note: 'Both goals closed. <strong>The script is now discarded</strong> and the term below is what the kernel will check.',
          wrong: { 'exact h.right': '<code>h.right : q</code>, but this goal is <code>p</code>.' } }
      ]
    },
    {
      name: '∀ n : Nat, n + 0 = n',
      init: st([], ['∀ n : Nat, n + 0 = n']),
      term: 'fun n => rfl',
      steps: [
        { ok: 'intro n', after: st(['n : Nat'], ['n + 0 = n']),
          note: 'For a ∀, <code>intro</code> is Π-introduction — the same lambda as for →, because ∀ <em>is</em> a dependent function type.',
          wrong: { 'rfl': 'The goal is a ∀, not an equation. Introduce the variable first.', 'simp': 'It would in fact close this, but let us do it by hand to see what happens.' } },
        { ok: 'rfl', after: st([], []),
          note: '<strong>Done in one step.</strong> <code>Nat.add</code> recurses on its second argument, and that argument is the literal <code>Nat.zero</code>, so ι fires and <code>n + 0</code> reduces to <code>n</code>. The two sides are <em>definitionally</em> equal, and the entire proof is the word <code>rfl</code>. Run this one in Fig. 3 to watch it happen.',
          wrong: { 'induction n': 'It works, but it is unnecessary — and the resulting term is far larger than <code>rfl</code>. Reach for computation before induction.', 'apply Nat.add_comm': 'Wrong shape: <code>add_comm</code> proves <code>a + b = b + a</code>, which would leave you with <code>0 + n = n</code> — the harder direction.' } }
      ]
    },
    {
      name: '∀ n : Nat, 0 + n = n',
      init: st([], ['∀ n : Nat, 0 + n = n']),
      term: 'fun n => Nat.rec rfl (fun k ih => congrArg Nat.succ ih) n',
      steps: [
        { ok: 'intro n', after: st(['n : Nat'], ['0 + n = n']),
          note: 'Same start as before. The statement looks like a trivial variant of the previous one. It is not.',
          wrong: { 'rfl': 'The goal is still a ∀.' } },
        { ok: 'induction n with', after: st(['case zero'], ['0 + 0 = 0', '0 + (k+1) = k+1']),
          note: '<strong><code>rfl</code> fails here</strong>, because <code>0 + n</code> is stuck: <code>Nat.add</code> recurses on the second argument, which is the variable <code>n</code>, so ι cannot fire. Induction is genuinely required. <code>induction</code> elaborates to <code>Nat.rec</code> — the recursor from §4, nothing more.',
          wrong: { 'rfl': 'This is the interesting failure. <code>0 + n</code> does not reduce — the recursion is on <code>n</code>, which is a variable, not a constructor. Compare <code>n + 0</code> in the previous proof, which reduced instantly. <em>Same theorem morally; completely different definitional status.</em>', 'simp': '<code>simp</code> closes it, but by applying <code>Nat.zero_add</code> — which is this very theorem. Circular here.' } },
        { ok: 'rfl  -- zero case', after: st(['case succ', 'k : Nat', 'ih : 0 + k = k'], ['0 + (k+1) = k+1']),
          note: 'The base case <code>0 + 0 = 0</code> <em>is</em> definitional — both arguments are now literals, so ι fires. One goal left, and note the induction hypothesis <code>ih</code> that <code>Nat.rec</code> handed us.',
          wrong: { 'exact ih': 'There is no <code>ih</code> in the zero case — that is the whole point of the base case.' } },
        { ok: 'simp [Nat.add_succ, ih]', after: st([], []),
          note: 'The successor case: <code>0 + (k+1)</code> reduces to <code>(0 + k) + 1</code> by ι, then <code>ih</code> rewrites it to <code>k + 1</code>. The final term is <code>Nat.rec rfl (fun k ih => congrArg Nat.succ ih) n</code> — literally the recursor, applied to a base case and a step.',
          wrong: { 'rfl': 'The two sides differ by <code>ih</code>, which is a propositional equality, not a definitional one. <code>rfl</code> cannot use a hypothesis.' } }
      ]
    },
    {
      name: 'p → ¬¬p',
      init: st(['p : Prop'], ['p → ¬¬p']),
      term: 'fun hp hnp => hnp hp',
      steps: [
        { ok: 'intro hp', after: st(['p : Prop', 'hp : p'], ['¬¬p']),
          note: 'Standard →-introduction.',
          wrong: { 'exact absurd': 'Not a term, and there is nothing to apply it to yet.' } },
        { ok: 'intro hnp', after: st(['p : Prop', 'hp : p', 'hnp : ¬p'], ['False']),
          note: '<code>¬a</code> is <em>notation</em> for <code>a → False</code>, so <code>¬¬p</code> is <code>(p → False) → False</code> — an implication, and <code>intro</code> applies. The goal unfolds to <code>False</code>.',
          wrong: { 'exact hp': 'The goal <code>¬¬p</code> is a function type; <code>hp : p</code> is not a function. Unfold the notation and it becomes obvious.', 'constructor': '<code>False</code> has no constructors, and <code>¬¬p</code> is a Π-type, not an inductive one.' } },
        { ok: 'exact hnp hp', after: st(['p : Prop'], []),
          note: 'Modus ponens, i.e. function application: <code>hnp : p → False</code> applied to <code>hp : p</code> gives <code>False</code>. Note the proof is <em>constructive</em> — no classical axiom needed. The converse <code>¬¬p → p</code> is not, and requires <code>Classical.byContradiction</code>.',
          wrong: { 'exact hp hnp': 'Backwards — <code>hp : p</code> is not a function.' } }
      ]
    }
  ];

  let pi = 0, at = 0, script = [];
  host.innerHTML = PROOFS.map((p, i) => `<button class="btn${i === 0 ? ' on' : ''}" data-p="${i}">${esc(p.name)}</button>`).join('');

  function state() { return at === 0 ? PROOFS[pi].init : PROOFS[pi].steps[at - 1].after; }
  function paint(msg) {
    const P = PROOFS[pi], s = state(), done = at >= P.steps.length;
    document.getElementById('tc-goal').innerHTML = done && !s.goals.length
      ? `<span class="done">No goals — the proof is complete.</span>`
      : s.hyps.map(h => `<span class="hyp">${esc(h)}</span>`).join('\n') +
        (s.hyps.length ? '\n' : '') + `<span class="bar">${'⊢'}</span> <span class="tgt">${esc(s.goals[0] || '')}</span>` +
        (s.goals.length > 1 ? `\n<span class="hyp">${s.goals.length - 1} more goal${s.goals.length > 2 ? 's' : ''}: ${esc(s.goals.slice(1).join('   '))}</span>` : '');
    document.getElementById('tc-script').innerHTML =
      `<span style="color:${css('--ink-3')}">theorem ex : ${esc(P.name)} := by</span>\n` +
      (script.length ? script.map(t => '  ' + esc(t)).join('\n') : `  <span style="color:${css('--ink-4')}">…</span>`) +
      (done ? `\n\n<span style="color:${css('--ink-3')}">-- term produced, and the only thing the kernel sees:</span>\n<span style="color:${css('--acc')}">${esc(P.term)}</span>` : '');

    const tacs = document.getElementById('tc-tactics');
    if (done) { tacs.innerHTML = `<span style="font-family:var(--mono);font-size:12px;color:${css('--ok')}">proof complete</span>`; }
    else {
      const step = P.steps[at];
      const opts = [step.ok].concat(Object.keys(step.wrong || {}));
      /* stable shuffle so the answer is not always first */
      opts.sort((a, b) => ((a.length * 37 + a.charCodeAt(0)) % 11) - ((b.length * 37 + b.charCodeAt(0)) % 11));
      tacs.innerHTML = opts.map(o => `<button class="tok" data-tac="${esc(o)}">${esc(o)}</button>`).join('');
      tacs.querySelectorAll('[data-tac]').forEach(b => b.addEventListener('click', () => apply(b.dataset.tac)));
    }
    document.getElementById('tc-note').innerHTML = msg ||
      (done ? `<h6 style="color:${css('--acc')}">Proof complete</h6><p>${P.steps[P.steps.length - 1].note}</p>
        <p style="margin-top:12px"><strong>Look at the term.</strong> That is the entire content of what you proved, and the only thing the kernel will examine. Your tactic script — the <code>intro</code>s, the <code>simp</code>, the search that <code>simp</code> did internally — has been thrown away. Correctness of the tactics was never assumed.</p>`
        : (at > 0 ? `<h6>${esc(script[script.length - 1])}</h6><p>${P.steps[at - 1].note}</p>` : `<h6>Goal</h6><p>Pick a tactic. Wrong choices are explained rather than hidden — the failures are where the type theory shows through.</p>`));
  }
  function apply(t) {
    const step = PROOFS[pi].steps[at];
    if (t === step.ok) { script.push(t); at++; paint(); }
    else paint(`<h6 style="color:${css('--bad')}">${esc(t)} — fails</h6><p>${step.wrong[t]}</p>`);
  }
  function reset(i) { pi = i; at = 0; script = []; host.querySelectorAll('.btn').forEach(b => b.classList.toggle('on', +b.dataset.p === i)); paint(); }
  host.querySelectorAll('.btn').forEach(b => b.addEventListener('click', () => reset(+b.dataset.p)));
  document.getElementById('tc-undo').addEventListener('click', () => { if (at > 0) { at--; script.pop(); paint(); } });
  document.getElementById('tc-reset').addEventListener('click', () => reset(pi));
  document.getElementById('tc-solve').addEventListener('click', () => {
    const P = PROOFS[pi];
    script = P.steps.map(s => s.ok); at = P.steps.length; paint();
  });
  reset(0);
})();

/* ============================================================
   FIG. 7 — the proof term, drawn
   Each tactic grows the tree; then the kernel sweeps it bottom-up
   re-deriving every type, with no reference to the tactic script.
   ============================================================ */
(function () {
  const cv = document.getElementById('ptCanvas');
  if (!cv) return;

  /* Each proof: a tactic script, and the term node each tactic emits.
     `add` names the parent slot the new node drops into, so the tree
     grows in the same order the tactics run. */
  const PROOFS = [
    {
      name: 'A → B → A',
      goal: '∀ {A B : Prop}, A → B → A',
      term: 'fun a => fun b => a',
      note: 'The simplest non-trivial proof there is, and the one worth understanding completely. Two <code>intro</code>s build two nested lambdas; <code>exact</code> plugs a variable into the hole. Under Curry–Howard this term is exactly <b>axiom A1</b> of the Hilbert system in Vol. III §1.3 — the combinator <b>K</b>.',
      steps: [
        { t: 'intro a', emit: 'fun a => ?h', node: { k: 'lam', l: 'λ a', p: null } },
        { t: 'intro b', emit: 'fun b => ?h', node: { k: 'lam', l: 'λ b', p: 0 } },
        { t: 'exact a', emit: 'a', node: { k: 'var', l: 'a', p: 1 } }
      ]
    },
    {
      name: '(A → B) → A → B',
      goal: '∀ {A B : Prop}, (A → B) → A → B',
      term: 'fun f => fun a => f a',
      note: 'Modus ponens, written as a program. The <code>apply</code>/<code>exact</code> step builds an <b>application</b> node with two children: the function and its argument. Applying a proof of <code>A → B</code> to a proof of <code>A</code> <i>is</i> function application — not an analogy for it.',
      steps: [
        { t: 'intro f', emit: 'fun f => ?h', node: { k: 'lam', l: 'λ f', p: null } },
        { t: 'intro a', emit: 'fun a => ?h', node: { k: 'lam', l: 'λ a', p: 0 } },
        { t: 'exact f a', emit: 'f a', node: { k: 'app', l: '@', p: 1 } },
        { t: '  ↳ head', emit: 'f', node: { k: 'var', l: 'f', p: 2 }, auto: true },
        { t: '  ↳ arg', emit: 'a', node: { k: 'var', l: 'a', p: 2 }, auto: true }
      ]
    },
    {
      name: '2 + 2 = 4',
      goal: '2 + 2 = 4',
      term: 'rfl',
      note: 'One node. <code>rfl</code> is the proof that a thing equals itself, and it is accepted here because the kernel can <b>reduce</b> <code>2 + 2</code> and <code>4</code> to the same normal form. Nothing was searched for; the checker simply ran the arithmetic. This is §3 — type checking <i>is</i> computation — in its smallest possible form.',
      steps: [
        { t: 'rfl', emit: 'rfl', node: { k: 'con', l: 'rfl', p: null } }
      ]
    },
    {
      name: '∀ n, 0 + n = n',
      goal: '∀ n : Nat, 0 + n = n',
      term: 'fun n => Nat.rec rfl (fun k ih => congrArg succ ih) n',
      note: 'The one that cannot be <code>rfl</code>. <code>0 + n</code> is stuck on a variable, so nothing reduces and induction is genuinely required. Note what <code>induction n</code> emits: <b><code>Nat.rec</code></b> — literally the recursor derived in §4, with one child per constructor. The <code>simp</code> in the successor case is untrusted search, but it produced <code>congrArg succ ih</code>, and <i>that</i> is what gets checked.',
      steps: [
        { t: 'intro n', emit: 'fun n => ?h', node: { k: 'lam', l: 'λ n', p: null } },
        { t: 'induction n', emit: 'Nat.rec ?z ?s n', node: { k: 'rec', l: 'Nat.rec', p: 0 } },
        { t: '· case zero', emit: 'rfl', node: { k: 'con', l: 'rfl', p: 1 } },
        { t: '· case succ', emit: 'fun k ih => ?h', node: { k: 'lam', l: 'λ k ih', p: 1 } },
        { t: '  simp [ih]', emit: 'congrArg succ ih', node: { k: 'app', l: 'congrArg', p: 3 } },
        { t: '  ↳ arg', emit: 'ih', node: { k: 'var', l: 'ih', p: 4 }, auto: true },
        { t: '· major', emit: 'n', node: { k: 'var', l: 'n', p: 1 }, auto: true }
      ]
    }
  ];

  const COLOR = P => ({ lam: P.acc2, app: P.acc, rec: P.warn, var: P.ink3, con: P.ink3 });

  let pi = 0, at = 0, nodes = [], checkT = -1, grow = 0;

  const $id = i => document.getElementById(i);
  const pick = $id('pt-pick');
  PROOFS.forEach((p, i) => {
    const b = document.createElement('button');
    b.className = 'btn' + (i === 0 ? ' on' : '');
    b.dataset.p = i; b.textContent = p.name;
    pick.appendChild(b);
  });

  /* ---- layout: assign each node an (x, y) by walking the tree ---------- */
  function layout(w, h) {
    if (!nodes.length) return [];
    const kids = nodes.map(() => []);
    nodes.forEach((n, i) => { if (n.p !== null && kids[n.p]) kids[n.p].push(i); });
    const depth = nodes.map(() => 0);
    nodes.forEach((n, i) => { depth[i] = n.p === null ? 0 : depth[n.p] + 1; });
    const maxD = Math.max(...depth);

    let slot = 0;
    const xs = nodes.map(() => -1);
    (function place(i) {                       // in-order walk gives leaves distinct columns
      if (!kids[i].length) { xs[i] = slot++; return; }
      kids[i].forEach(place);
      xs[i] = kids[i].reduce((a, c) => a + xs[c], 0) / kids[i].length;
    })(0);
    const span = Math.max(1, slot - 1);

    const padX = 46, padY = 26;
    return nodes.map((n, i) => ({
      i, n,
      x: padX + (span === 0 ? .5 : xs[i] / span) * (w - 2 * padX),
      y: padY + (maxD === 0 ? 0 : depth[i] / maxD) * (h - 2 * padY - 18)
    }));
  }

  function draw(ctx, P, t) {
    const w = cv._w, h = cv._h;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = P.paper2; ctx.fillRect(0, 0, w, h);

    if (!nodes.length) {
      ctx.fillStyle = P.ink4;
      ctx.font = '13px ' + 'ui-monospace, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('no term yet — apply a tactic', w / 2, h / 2);
      return;
    }

    const pts = layout(w, h);
    const col = COLOR(P);
    const R = Math.min(19, Math.max(13, w / 34));

    // kernel sweep: verified up to this depth-from-leaves
    const maxD = Math.max(...pts.map(p => p.y));
    let verified = -1;
    if (checkT >= 0) verified = (t - checkT) * 2.2;

    // edges
    ctx.lineWidth = 1.6;
    pts.forEach(p => {
      if (p.n.p === null) return;
      const q = pts.find(x => x.i === p.n.p);
      if (!q) return;
      const fresh = p.i === nodes.length - 1 ? grow : 1;
      ctx.strokeStyle = P.rule;
      ctx.globalAlpha = fresh;
      ctx.beginPath();
      ctx.moveTo(q.x, q.y + R * .72); ctx.lineTo(p.x, p.y - R * .72); ctx.stroke();
      ctx.globalAlpha = 1;
    });

    // nodes
    pts.forEach(p => {
      const fresh = p.i === nodes.length - 1 ? grow : 1;
      // depth from the bottom of the drawing, so the sweep runs leaves-up
      const fromLeaf = (maxD - p.y) / Math.max(1, maxD) * 3.2;
      const done = checkT >= 0 && verified > fromLeaf;
      const rr = R * (0.55 + 0.45 * fresh);

      ctx.globalAlpha = fresh;
      ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, Math.PI * 2);
      ctx.fillStyle = done ? P.ok : col[p.n.k];
      ctx.globalAlpha = fresh * (p.n.k === 'var' || p.n.k === 'con' ? .55 : .92);
      ctx.fill();
      ctx.globalAlpha = fresh;
      if (done) {
        ctx.strokeStyle = P.ok; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, rr + 4, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = P.paper2;
      ctx.font = '600 ' + Math.round(rr * .62) + 'px ui-monospace, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.n.l, p.x, p.y);
      ctx.globalAlpha = 1;
    });

    // legend + sweep caption
    ctx.font = '10px ui-monospace, monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    const leg = [['λ  abstraction', col.lam], ['@  application', col.app], ['rec  induction', col.rec], ['var / const', col.var]];
    let lx = 10;
    leg.forEach(([s, c]) => {
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(lx + 4, h - 8, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = P.ink4; ctx.fillText(s, lx + 12, h - 4);
      lx += ctx.measureText(s).width + 30;
    });
    if (checkT >= 0) {
      ctx.fillStyle = P.ok; ctx.textAlign = 'right';
      ctx.fillText(verified > 3.4 ? 'kernel: accepted' : 'kernel: re-deriving types, leaves upward…', w - 10, h - 4);
    }
  }

  const sc = scene(cv, { aspect: 16 / 8.2, draw: (ctx, P, t) => draw(ctx, P, t) });

  /* ---- state --------------------------------------------------------- */
  function termText() {
    const P = PROOFS[pi];
    return at >= P.steps.length ? P.term
      : P.steps.slice(0, at).map(s => s.emit).join('\n  ') + (at ? '\n  …still has holes' : '');
  }

  function paint() {
    const P = PROOFS[pi];
    const done = at >= P.steps.length;
    $id('pt-n').textContent = at + ' / ' + P.steps.length;
    $id('pt-size').textContent = nodes.length;
    $id('pt-last').textContent = at ? P.steps[at - 1].t.trim() : '—';
    $id('pt-emit').textContent = at ? P.steps[at - 1].emit : '—';
    $id('pt-status').textContent = checkT >= 0 ? 'accepted — every node re-typed'
      : done ? 'ready — press “Hand it to the kernel”' : 'incomplete: the term still has holes';
    $id('pt-term').textContent = done ? P.term : (at ? 'partial: ' + P.steps[at - 1].emit : '—');
    $id('pt-note').innerHTML = '<h6>' + P.goal + '</h6><p>' + (done ? P.note
      : 'Keep applying tactics. Each one drops exactly one node into the tree — that is all a tactic ever does.') + '</p>';
    if (sc) sc.kick();
  }

  function step() {
    const P = PROOFS[pi];
    if (at >= P.steps.length) return;
    nodes.push(P.steps[at].node); at++;
    grow = 0;
    const t0 = performance.now();
    (function anim() {                        // grow the new node in
      grow = Math.min(1, (performance.now() - t0) / 260);
      if (sc) sc.kick();
      if (grow < 1) requestAnimationFrame(anim);
    })();
    // auto-steps are structural children of the tactic just applied
    if (P.steps[at] && P.steps[at].auto) setTimeout(step, 300);
    paint();
  }

  function reset(i) {
    pi = i; at = 0; nodes = []; checkT = -1; grow = 1;
    pick.querySelectorAll('.btn').forEach(b => b.classList.toggle('on', +b.dataset.p === i));
    paint();
  }

  $id('pt-step').addEventListener('click', step);
  $id('pt-run').addEventListener('click', () => {
    const P = PROOFS[pi];
    const go = () => { if (at < P.steps.length) { step(); setTimeout(go, 340); } };
    go();
  });
  $id('pt-check').addEventListener('click', () => {
    if (at < PROOFS[pi].steps.length) { $id('pt-status').textContent = 'refused: the term still has holes'; return; }
    checkT = (sc ? sc.t : 0);
    paint();
  });
  $id('pt-reset').addEventListener('click', () => reset(pi));
  pick.querySelectorAll('.btn').forEach(b => b.addEventListener('click', () => reset(+b.dataset.p)));

  reset(0);
})();

})();
