/* ============================================================
   THE MARGINALIA SERIES — glossary dictionary  (part 1 of 4)
   Shared mathematical vocabulary + Volume I.

   Each entry:
     term   display name
     match  strings the auto-tagger looks for in the prose
     kind   small label shown at the top of the card
     short  one plain sentence — assume no background at all
     body   the full explanation: what it is, a concrete example,
            and the misunderstanding people actually have
     fig    key into GFIG (animated mini-figure), optional
     see    related entries
   ============================================================ */

window.GLOSS = {

/* ---------- universal mathematical vocabulary --------------------------- */

'set': {
  term: 'set', match: ['set of', 'a set'], kind: 'foundations',
  short: 'A collection of things, with no order and no repeats — the only thing that matters is what belongs to it.',
  body: '<p>Writing \\(S = \\{2, 3, 5\\}\\) says: the objects 2, 3 and 5 belong to \\(S\\), and nothing else does. \\(\\{2,3,5\\}\\) and \\(\\{5,2,3\\}\\) are the <b>same set</b> — order carries no information.</p>' +
        '<p class="eg"><b>Notation you will meet constantly.</b> \\(x \\in S\\) means "\\(x\\) belongs to \\(S\\)". \\(\\{n : \\text{condition}\\}\\) means "all \\(n\\) satisfying the condition" — so \\(\\{n \\le x : n \\text{ prime}\\}\\) is the set of primes up to \\(x\\). \\(|S|\\) or \\(\\#S\\) is how many elements \\(S\\) has.</p>',
  see: ['function', 'cardinality']
},

'cardinality': {
  term: 'cardinality', match: ['cardinality', 'counting function'], kind: 'foundations',
  short: 'The size of a set — how many things are in it.',
  body: '<p>Written \\(|S|\\) or \\(\\#S\\). For finite sets this is just a count. In analytic number theory almost every question is secretly a cardinality question: "how many primes below \\(x\\)" is \\(|\\{p \\le x : p \\text{ prime}\\}|\\), which gets the name \\(\\pi(x)\\).</p>' +
        '<p class="eg"><b>Why it matters here.</b> Sieve theory (Vol. II) is entirely the art of estimating cardinalities you cannot list. You will never write down the set; you will bound its size.</p>',
  see: ['set', 'asymptotic']
},

'function': {
  term: 'function', match: ['function'], kind: 'foundations',
  short: 'A rule that takes an input and returns exactly one output.',
  body: '<p>The notation \\(f : A \\to B\\) says: \\(f\\) accepts inputs from the set \\(A\\) (the <b>domain</b>) and produces outputs in \\(B\\) (the <b>codomain</b>). The defining requirement is <i>exactly one</i> output per input — no ambiguity, no missing cases.</p>' +
        '<p class="eg"><b>The move that surprises people.</b> A function need not be given by a formula. "The number of divisors of \\(n\\)" is a perfectly good function \\(\\mathbb{N} \\to \\mathbb{N}\\); so is "the \\(n\\)th prime". Modular forms are functions whose <i>only</i> useful description is a symmetry property.</p>',
  see: ['set', 'holomorphic']
},

'group': {
  term: 'group', match: ['group theory', 'a group', 'the group'], kind: 'algebra',
  short: 'A set of moves you can undo and combine — like the rotations of a square, or addition of whole numbers.',
  body: '<p>A group is a set \\(G\\) with a way of combining two elements (written \\(gh\\)) satisfying exactly four rules: combining is associative, there is an identity \\(e\\) that does nothing, every \\(g\\) has an inverse \\(g^{-1}\\) undoing it, and combining two elements of \\(G\\) stays inside \\(G\\).</p>' +
        '<p class="eg"><b>The mental model to carry.</b> A group is not a bag of objects, it is a <i>collection of symmetries</i>. The symmetries of a square form a group of 8 elements (4 rotations, 4 reflections). Composing two symmetries is another symmetry; undoing one is another. That is the whole definition.</p>' +
        '<p>In Volume I the group is \\(\\mathrm{SL}_2(\\mathbb{Z})\\), infinite rather than 8 elements, acting on the upper half-plane. Everything about modular forms follows from how brutally large that group is.</p>',
  fig: 'lattice',
  see: ['group-action', 'sl2z', 'generators', 'orbit']
},

'group-action': {
  term: 'group action', match: ['group action', 'acts on', 'action is', 'the action'], kind: 'algebra',
  short: 'A group acts on a set when each group element rearranges that set, and combining elements matches doing the rearrangements in sequence.',
  body: '<p>Formally: for each \\(g \\in G\\) a map \\(x \\mapsto g\\cdot x\\) of the set to itself, with \\(e\\cdot x = x\\) and \\((gh)\\cdot x = g\\cdot(h\\cdot x)\\). That second condition is the whole content — it says the group\'s multiplication and the rearranging agree.</p>' +
        '<p class="eg"><b>Concretely.</b> The 8 symmetries of a square <i>act on</i> the 4 corners. Rotate-by-90 then rotate-by-90 rearranges the corners the same way rotate-by-180 does. The group has an existence independent of the square; the action is the dictionary between them.</p>' +
        '<p>Vol. I: \\(\\mathrm{SL}_2(\\mathbb{Z})\\) acts on the upper half-plane by Möbius transformations. The whole subject is about functions that barely notice this action.</p>',
  fig: 'mobius',
  see: ['group', 'orbit', 'mobius-transformation', 'fundamental-domain']
},

'orbit': {
  term: 'orbit', match: ['orbit'], kind: 'algebra',
  short: 'All the places one point can be moved to by the group — its complete family of copies.',
  body: '<p>The orbit of \\(x\\) is \\(\\{g\\cdot x : g \\in G\\}\\). Orbits carve the set into disjoint families: every point lies in exactly one orbit, and no orbit overlaps another.</p>' +
        '<p class="eg"><b>Why this is the key idea in Vol. I.</b> A function invariant under the group must take the same value everywhere in an orbit. So such a function is really a function on the set <i>of orbits</i> — which is much smaller. In the upper half-plane, the set of orbits is one tile of the tessellation, and that shrinkage is where finite-dimensionality ultimately comes from.</p>',
  see: ['group-action', 'fundamental-domain', 'quotient']
},

'quotient': {
  term: 'quotient', match: ['quotient'], kind: 'algebra',
  short: 'What you get when you declare certain points to be the same and glue them together.',
  body: '<p>Given an equivalence (here: "same orbit"), the quotient is the set whose elements are the equivalence classes. You have not thrown anything away; you have changed what counts as "different".</p>' +
        '<p class="eg"><b>Picture it.</b> Take a strip of paper and declare the left edge equal to the right edge. The quotient is a cylinder. Take the fundamental domain \\(\\mathcal{F}\\) of Vol. I and glue its left edge to its right edge (by \\(T\\)) and fold its bottom arc onto itself (by \\(S\\)): the quotient is a sphere with one puncture. Modular forms of weight 0 are literally functions on that sphere — which is why there are so few of them.</p>',
  see: ['orbit', 'fundamental-domain', 'riemann-surface']
},

'generators': {
  term: 'generators', match: ['generated by', 'generators', 'generate'], kind: 'algebra',
  short: 'A small set of moves from which every move in the group can be built by repetition and combination.',
  body: '<p>\\(G\\) is generated by \\(S\\) if every element of \\(G\\) is a product of elements of \\(S\\) and their inverses. Finding generators is how an infinite group becomes checkable.</p>' +
        '<p class="eg"><b>The payoff in Vol. I.</b> \\(\\mathrm{SL}_2(\\mathbb{Z})\\) is infinite, but generated by just \\(T: z \\mapsto z+1\\) and \\(S: z \\mapsto -1/z\\). So to verify that a function is modular — an <i>infinite</i> family of equations — you check <b>two</b> equations. Without generators the definition would be unusable.</p>',
  see: ['group', 'sl2z', 'cocycle']
},

'vector-space': {
  term: 'vector space', match: ['vector space', 'linear algebra', 'linear combination'], kind: 'algebra',
  short: 'A collection of objects you can add together and scale by numbers, obeying the usual rules.',
  body: '<p>Arrows in the plane form one. So do polynomials, so do functions \\(\\mathbb{R}\\to\\mathbb{R}\\), and — crucially for Vol. I — so do modular forms of a fixed weight: add two of them and the sum is one, multiply by a constant and it stays one.</p>' +
        '<p class="eg"><b>Dimension</b> is the number of objects in a <b>basis</b>: a minimal list \\(v_1,\\dots,v_d\\) such that every element is uniquely \\(c_1v_1 + \\cdots + c_dv_d\\). Dimension \\(d\\) means "\\(d\\) numbers pin down any element completely". The entire finiteness miracle of Vol. I is the statement that a space of functions has a small finite dimension.</p>',
  see: ['dimension', 'eigenvector', 'quadratic-form']
},

'dimension': {
  term: 'dimension', match: ['finite-dimensional', 'dimension', 'dimensional'], kind: 'algebra',
  short: 'How many independent numbers you need to specify one element of a space.',
  body: '<p>A plane is 2-dimensional: two coordinates determine a point. A space of functions is \\(d\\)-dimensional if fixing \\(d\\) numbers determines the function <i>completely</i>.</p>' +
        '<p class="eg"><b>Why this is a superpower.</b> If \\(\\dim M_k = d\\) and two modular forms of weight \\(k\\) agree in their first \\(d\\) Fourier coefficients, they are the <i>same function</i> — so all their infinitely many remaining coefficients agree too. Comparing finitely many numbers proves infinitely many identities. That is Vol. I in one sentence.</p>',
  see: ['vector-space', 'sturm-bound', 'valence-formula']
},

'eigenvector': {
  term: 'eigenvector', match: ['eigenvector', 'eigenvalue', 'eigenform', 'eigenvectors', 'eigenvalues'], kind: 'algebra',
  short: 'A direction that a transformation only stretches, never turns.',
  body: '<p>If \\(Tv = \\lambda v\\) for a number \\(\\lambda\\), then \\(v\\) is an eigenvector and \\(\\lambda\\) its eigenvalue. Most vectors get rotated by \\(T\\); eigenvectors are the special ones that stay on their own line.</p>' +
        '<p class="eg"><b>In Vol. I.</b> Hecke operators \\(T_p\\) are linear maps on the space of cusp forms. An <b>eigenform</b> is a form that every \\(T_p\\) merely scales. Normalised so \\(a_1 = 1\\), the eigenvalue equals the Fourier coefficient \\(a_p\\) — and the eigenvalue equations turn straight into multiplicativity \\(a_ma_n = a_{mn}\\). Ramanujan\'s conjecture about \\(\\tau\\) is a corollary of a 1-dimensional space having eigenvectors for free.</p>',
  fig: 'eigen',
  see: ['hecke-operator', 'dimension', 'self-adjoint']
},

'asymptotic': {
  term: 'asymptotic', match: ['asymptotic', 'asymptotically', 'asymptotics'], kind: 'analysis',
  short: 'A statement about what happens in the long run, ignoring everything that stops mattering.',
  body: '<p>\\(f(x) \\sim g(x)\\) means the ratio \\(f/g\\) tends to 1 as \\(x\\to\\infty\\). It does <i>not</i> mean the difference is small — \\(x + \\sqrt{x} \\sim x\\) even though they differ by \\(\\sqrt x\\), which is enormous.</p>' +
        '<p class="eg"><b>The trap this subject sets.</b> Asymptotic statements can be true and still invisible at any size you can compute. In Vol. II, a ratio that provably tends to 1.1229 is only at 1.03 by \\(x = 10^6\\). Numerical experiments mislead here more than almost anywhere else in mathematics — you are watching a limit that converges like \\(1/\\log\\log x\\).</p>',
  fig: 'bigO',
  see: ['big-o', 'main-term', 'error-term']
},

'big-o': {
  term: 'big-O notation', match: ['big-O', 'O(', 'error term of size'], kind: 'analysis',
  short: 'A way of saying "no bigger than this, up to a constant we do not care about".',
  body: '<p>\\(g(x) = O(f(x))\\) means: there is a constant \\(C\\) with \\(|g(x)| \\le C f(x)\\) for all large \\(x\\). The symbol \\(\\ll\\) means the same thing. \\(o(f)\\) is stronger: the ratio \\(g/f\\) tends to <i>zero</i>.</p>' +
        '<p class="eg"><b>Read it as a promise about shape, not size.</b> \\(O(x/\\log x)\\) and \\(O(x)\\) are wildly different promises; \\(O(x)\\) and \\(O(1000x)\\) are the same promise. The constant is suppressed because in this subject the constant is almost never the interesting part — and when it <i>is</i> (Brun\'s constant, the twin-prime constant \\(C_2\\)) it gets a name and a section of its own.</p>',
  fig: 'bigO',
  see: ['asymptotic', 'error-term']
},

'main-term': {
  term: 'main term', match: ['main term'], kind: 'analysis',
  short: 'The part of an estimate that carries the answer.',
  body: '<p>Nearly every count in analytic number theory is written as <i>main term + error term</i>. The main term is a clean formula you can evaluate; the error term is everything you could not control.</p>' +
        '<p class="eg"><b>The only question that ever matters.</b> Is the error smaller than the main term? If yes, you have a theorem. If no, you have a true statement carrying no information. Vol. II §1 is exactly the story of an error term (\\(2^{\\pi(z)}\\)) overtaking a main term (\\(x/\\log z\\)), and every technique afterwards is a way of keeping them apart.</p>',
  see: ['error-term', 'big-o', 'level-of-distribution']
},

'error-term': {
  term: 'error term', match: ['error term', 'remainder term'], kind: 'analysis',
  short: 'The unknown leftover in an estimate — the thing you must prove is small.',
  body: '<p>Written \\(r_d\\), \\(E(x)\\), \\(O(\\cdot)\\). It is not a mistake; it is the honest accounting of what your approximation failed to capture.</p>' +
        '<p class="eg"><b>Individually harmless, collectively fatal.</b> In Vol. II each \\(r_d\\) satisfies \\(|r_d| &lt; 1\\) — as small as an error could possibly be. But inclusion–exclusion produces one of them for every squarefree divisor of \\(P(z)\\), which is \\(2^{\\pi(z)}\\) of them. A million errors of size 1 beat a main term of size a thousand. <b>The count of error terms matters more than their size.</b></p>',
  see: ['main-term', 'level-of-distribution', 'inclusion-exclusion']
},

/* ---------- Volume I: complex analysis ---------------------------------- */

'complex-number': {
  term: 'complex number', match: ['complex number', 'complex plane', 'complex-valued'], kind: 'complex analysis',
  short: 'A number with two parts, written \\(x + iy\\), where \\(i^2 = -1\\) — equivalently, a point in the plane.',
  body: '<p>Every complex number \\(z = x + iy\\) has a <b>real part</b> \\(\\operatorname{Re} z = x\\) and an <b>imaginary part</b> \\(\\operatorname{Im} z = y\\). Its <b>modulus</b> \\(|z| = \\sqrt{x^2+y^2}\\) is its distance from 0; its <b>argument</b> \\(\\arg z\\) is the angle it makes with the positive real axis. The <b>conjugate</b> is \\(\\bar z = x - iy\\).</p>' +
        '<p class="eg"><b>The fact that runs all of Vol. I.</b> Multiplying by a complex number both rotates and scales. \\(e^{i\\theta} = \\cos\\theta + i\\sin\\theta\\) is the point on the unit circle at angle \\(\\theta\\), so \\(e^{2\\pi i} = 1\\). That is why \\(q = e^{2\\pi i z}\\) turns the symmetry \\(z \\mapsto z+1\\) into "nothing happened": adding 1 to \\(z\\) adds \\(2\\pi\\) to the angle, and you come back to where you started.</p>',
  see: ['upper-half-plane', 'holomorphic', 'domain-colouring']
},

'upper-half-plane': {
  term: 'upper half-plane', match: ['upper half-plane', 'upper half plane'], kind: 'complex analysis',
  short: 'All complex numbers sitting strictly above the real axis — the stage every modular form lives on.',
  body: '<p>\\(\\mathbb{H} = \\{z \\in \\mathbb{C} : \\operatorname{Im} z &gt; 0\\}\\). Nothing on the real line itself, nothing below it.</p>' +
        '<p class="eg"><b>Why the top half specifically?</b> Because the group \\(\\mathrm{SL}_2(\\mathbb{Z})\\) preserves it. The computation \\(\\operatorname{Im}(\\gamma z) = \\operatorname{Im}(z)/|cz+d|^2\\) shows the imaginary part gets multiplied by a <i>positive</i> number, never flipped — so points above the axis stay above it. The determinant condition \\(ad - bc = 1\\) is exactly what makes this work; it is not decoration.</p>' +
        '<p>\\(\\mathbb{H}\\) also carries a natural geometry, the <b>hyperbolic metric</b> \\(ds = |dz|/y\\), in which the group acts by rigid motions. The tiles of the tessellation look like they shrink near the real axis only because your eyes are Euclidean; hyperbolically they are all the same size.</p>',
  fig: 'mobius',
  see: ['complex-number', 'sl2z', 'mobius-transformation', 'fundamental-domain', 'cusp']
},

'holomorphic': {
  term: 'holomorphic', match: ['holomorphic', 'holomorphy', 'analytic function'], kind: 'complex analysis',
  short: 'Differentiable as a function of a complex variable — a condition so strong that one such function is almost never close to another.',
  body: '<p>\\(f\\) is holomorphic at \\(z_0\\) if the limit \\(\\lim_{h\\to 0}\\frac{f(z_0+h)-f(z_0)}{h}\\) exists, where \\(h\\) is complex and may approach 0 from <i>any</i> direction. Real differentiability only demands two directions agree; complex differentiability demands infinitely many do.</p>' +
        '<p class="eg"><b>What that extra demand buys.</b> A holomorphic function is automatically infinitely differentiable, automatically equal to its own Taylor series, and <b>rigid</b>: if two holomorphic functions on a connected region agree on any little arc — or even on a sequence of points with a limit — they are identical everywhere. Real functions have nothing remotely like this.</p>' +
        '<p>Geometrically, holomorphic maps are <b>conformal</b>: they can bend and stretch, but every angle between two curves is preserved. That is what the animation shows.</p>',
  fig: 'holo',
  see: ['complex-number', 'meromorphic', 'pole', 'argument-principle', 'analytic-continuation']
},

'meromorphic': {
  term: 'meromorphic', match: ['meromorphic'], kind: 'complex analysis',
  short: 'Holomorphic except at isolated points where it blows up in a controlled way.',
  body: '<p>A meromorphic function is holomorphic apart from <b>poles</b> — points where \\(|f| \\to \\infty\\) but where \\(f\\) still behaves like \\(c/(z-z_0)^m\\) for some finite \\(m\\). Rational functions \\(p(z)/q(z)\\) are the model case: holomorphic except where the denominator vanishes.</p>' +
        '<p class="eg"><b>Vol. I\'s example.</b> \\(j(z) = E_4^3/\\Delta\\) is meromorphic on \\(\\mathbb{H}\\cup\\{\\text{cusp}\\}\\): holomorphic everywhere on \\(\\mathbb{H}\\) (because \\(\\Delta\\) never vanishes there) with a single pole at the cusp. That one pole is exactly what lets \\(j\\) take every complex value once per tile.</p>',
  fig: 'pole',
  see: ['holomorphic', 'pole', 'zero-of-order']
},

'pole': {
  term: 'pole', match: ['a pole', 'poles', 'pole at'], kind: 'complex analysis',
  short: 'A point where a function blows up like \\(1/(z-z_0)^m\\) — infinite, but in an orderly way.',
  body: '<p>The <b>order</b> \\(m\\) says how violently. A simple pole (\\(m=1\\)) is \\(1/z\\); a double pole is \\(1/z^2\\). Poles are the tame kind of infinity: nearby, the function looks exactly like a power of \\(1/(z-z_0)\\) times something holomorphic.</p>' +
        '<p class="eg"><b>How to see one.</b> In a domain-coloured picture, a pole is a pinwheel where all hues meet — the same look as a zero, but the colours wheel the <i>opposite way</i> and the surroundings are bright rather than dark. The mini-figure shows both side by side.</p>',
  fig: 'pole',
  see: ['zero-of-order', 'meromorphic', 'domain-colouring', 'cusp']
},

'zero-of-order': {
  term: 'order of vanishing', match: ['order of vanishing', 'simple zero', 'zero of order', 'ord'], kind: 'complex analysis',
  short: 'How many times a function\'s zero "counts" — whether it touches zero, flattens against it, or flattens harder.',
  body: '<p>\\(f\\) vanishes to order \\(m\\) at \\(z_0\\) if \\(f(z) = (z-z_0)^m g(z)\\) with \\(g(z_0) \\neq 0\\). Order 1 is a <b>simple zero</b>. Writing \\(\\operatorname{ord}_{z_0}(f) = m\\).</p>' +
        '<p class="eg"><b>Why counting with multiplicity is the right convention.</b> It makes zeros behave like a conserved quantity. In Vol. I the valence formula says a weight-\\(k\\) form has exactly \\(k/12\\) worth of zeros, counted this way, and not one more. Order is the <i>currency</i>; the weight is the <i>budget</i>.</p>' +
        '<p>In domain colouring, a zero of order \\(m\\) has the rainbow wrapping \\(m\\) times as you circle it. Count the wraps, read off the order.</p>',
  fig: 'argprinciple',
  see: ['pole', 'valence-formula', 'argument-principle', 'domain-colouring']
},

'argument-principle': {
  term: 'argument principle', match: ['argument principle', 'winding number'], kind: 'complex analysis',
  short: 'Walk once around a loop; count how many times the output circles the origin; that is how many zeros were inside.',
  body: '<p>Precisely: \\(\\frac{1}{2\\pi i}\\oint_C \\frac{f\'(z)}{f(z)}\\,dz = Z - P\\), the number of zeros minus poles inside \\(C\\), each counted with its order.</p>' +
        '<p class="eg"><b>Why the contour integral is really just counting.</b> \\(f\'/f\\) is the derivative of \\(\\log f = \\log|f| + i\\arg f\\). Going once round a closed loop, \\(\\log|f|\\) returns to where it started and cancels; only the <i>angle</i> can have accumulated, and it must have accumulated a whole number of full turns. That whole number is the answer.</p>' +
        '<p>The valence formula in Vol. I §5 is this principle applied to the boundary of the fundamental domain. The left and right edges cancel because \\(f\\) takes equal values on them; the bottom arc almost cancels against itself, and the residue left over is proportional to the weight \\(k\\). Everything symmetric cancels; only \\(k\\) survives.</p>',
  fig: 'argprinciple',
  see: ['zero-of-order', 'valence-formula', 'holomorphic']
},

'analytic-continuation': {
  term: 'analytic continuation', match: ['analytic continuation', 'analytically continued'], kind: 'complex analysis',
  short: 'Extending a formula beyond where it converges — and there is only ever one way to do it.',
  body: '<p>\\(\\sum_{n\\ge1} n^{-s}\\) only converges for \\(\\operatorname{Re} s &gt; 1\\), yet \\(\\zeta(s)\\) is defined on the whole plane except \\(s=1\\). The extension is not a choice: by rigidity of holomorphic functions, if an extension exists it is <b>unique</b>.</p>' +
        '<p class="eg"><b>Reading \\(\\zeta(-1) = -1/12\\) correctly.</b> It does not say \\(1+2+3+\\cdots = -1/12\\); the series diverges and means nothing there. It says: the unique holomorphic function agreeing with that series where it does converge takes the value \\(-1/12\\) at \\(s=-1\\). The function is the object; the series was only ever one of its disguises.</p>',
  see: ['holomorphic', 'l-function', 'functional-equation', 'zeta-function']
},

'domain-colouring': {
  term: 'domain colouring', match: ['domain colouring', 'domain-coloured', 'domain coloring', 'phase portrait'], kind: 'visualisation',
  short: 'Painting a complex function by colour: hue is the angle of the output, brightness is its size.',
  body: '<p>A complex function needs four dimensions to graph honestly, so instead we colour each input point according to its output. <b>Hue</b> cycles red → yellow → green → cyan → blue → magenta → red as \\(\\arg f\\) goes round. <b>Brightness</b> encodes \\(|f|\\), with dark contour bands where \\(|f|\\) crosses powers of two.</p>' +
        '<p class="eg"><b>What to look for, in order.</b> (1) A pinwheel where all hues meet is a <b>zero</b> — the rainbow wraps once per order. (2) The same pinwheel spinning the other way, in a bright region, is a <b>pole</b>. (3) Repeating patterns are <b>symmetries</b> made visible: in Fig. 5 of Vol. I, the exact horizontal repeat is \\(T\\)-invariance and the fold across \\(|z|=1\\) is \\(S\\). (4) Δ showing no pinwheel anywhere is Jacobi\'s theorem, seen rather than proved.</p>',
  fig: 'pole',
  see: ['pole', 'zero-of-order', 'complex-number']
},

/* ---------- Volume I: the modular machinery ----------------------------- */

'sl2z': {
  term: 'SL₂(ℤ)', match: ['the modular group', 'modular group', 'special linear group', 'SL2(Z)'], kind: 'algebra',
  short: 'All 2×2 grids of whole numbers whose determinant is 1 — the symmetry group behind every modular form.',
  body: '<p>\\(\\mathrm{SL}_2(\\mathbb{Z}) = \\left\\{\\begin{pmatrix}a&amp;b\\\\c&amp;d\\end{pmatrix} : a,b,c,d \\in \\mathbb{Z},\\ ad-bc=1\\right\\}\\). It is infinite, and it is generated by only two elements: \\(T = \\begin{pmatrix}1&amp;1\\\\0&amp;1\\end{pmatrix}\\) and \\(S = \\begin{pmatrix}0&amp;-1\\\\1&amp;0\\end{pmatrix}\\).</p>' +
        '<p class="eg"><b>Where the determinant condition earns its keep.</b> \\(ad-bc=1\\) is exactly what makes \\(\\operatorname{Im}(\\gamma z) = \\operatorname{Im}(z)/|cz+d|^2\\) come out positive, so the upper half-plane is preserved. It is also what makes the matrix invertible <i>over the integers</i> — the inverse \\(\\begin{pmatrix}d&amp;-b\\\\-c&amp;a\\end{pmatrix}\\) has integer entries only because the determinant is \\(\\pm1\\).</p>' +
        '<p>Modulo \\(\\pm I\\) the group is the free product \\(\\mathbb{Z}/2 * \\mathbb{Z}/3\\) generated by \\(S\\) and \\(ST\\), which is why the tessellation looks like a tree of triangles: no unexpected relations, so different words give genuinely different tiles.</p>',
  fig: 'lattice',
  see: ['group', 'generators', 'mobius-transformation', 'congruence-subgroup', 'fundamental-domain']
},

'mobius-transformation': {
  term: 'Möbius transformation', match: ['Möbius transformation', 'Möbius transformations', 'fractional linear'], kind: 'complex analysis',
  short: 'A map \\(z \\mapsto \\frac{az+b}{cz+d}\\) — the most general motion that sends circles and lines to circles and lines.',
  body: '<p>These are exactly the invertible holomorphic maps of the Riemann sphere to itself. Composing two of them corresponds to <i>multiplying the matrices</i> \\(\\begin{pmatrix}a&amp;b\\\\c&amp;d\\end{pmatrix}\\), which is the whole reason matrices appear in a subject about functions.</p>' +
        '<p class="eg"><b>The two you must know.</b> \\(T: z \\mapsto z+1\\) slides sideways. \\(S: z \\mapsto -1/z\\) turns the picture inside out, swapping the region near 0 with the region near \\(\\infty\\). Every element of \\(\\mathrm{SL}_2(\\mathbb{Z})\\) is a word in these two, so every modular symmetry is a finite sequence of "slide" and "invert".</p>' +
        '<p>Note \\(\\gamma\\) and \\(-\\gamma\\) give the same map, which is why the group that really acts is \\(\\mathrm{PSL}_2(\\mathbb{Z}) = \\mathrm{SL}_2(\\mathbb{Z})/\\{\\pm I\\}\\) — and why odd weights die for the full modular group.</p>',
  fig: 'mobius',
  see: ['sl2z', 'upper-half-plane', 'group-action', 'automorphy-factor']
},

'fundamental-domain': {
  term: 'fundamental domain', match: ['fundamental domain', 'tessellation', 'tiling', 'tile'], kind: 'geometry',
  short: 'One representative tile containing (almost) exactly one point from every orbit.',
  body: '<p>For \\(\\mathrm{SL}_2(\\mathbb{Z})\\) acting on \\(\\mathbb{H}\\) the standard choice is \\(\\mathcal{F} = \\{z : |\\operatorname{Re} z| \\le \\tfrac12,\\ |z| \\ge 1\\}\\). Every point of \\(\\mathbb{H}\\) can be moved into \\(\\mathcal{F}\\), and the representative is unique except on the boundary.</p>' +
        '<p class="eg"><b>The proof is an algorithm you can run.</b> (1) Slide by \\(T^{\\pm1}\\) until \\(|\\operatorname{Re} z| \\le \\tfrac12\\). (2) If \\(|z| &lt; 1\\), apply \\(S\\); since \\(\\operatorname{Im}(-1/z) = \\operatorname{Im}(z)/|z|^2\\), the point jumps strictly <i>upward</i>. (3) Repeat. The imaginary part strictly increases and the achievable values are discrete, so it terminates. Fig. 1 of Vol. I lets you drag a point and watch this happen.</p>' +
        '<p>\\(\\mathcal{F}\\) has two <b>elliptic points</b> — \\(i\\), fixed by \\(S\\) (order 2), and \\(\\rho = e^{2\\pi i/3}\\) (order 3) — plus the cusp at \\(i\\infty\\). Those three special points are where the \\(\\tfrac12\\), \\(\\tfrac13\\) and \\(1\\) in the valence formula come from.</p>',
  see: ['orbit', 'quotient', 'sl2z', 'cusp', 'elliptic-point', 'valence-formula']
},

'elliptic-point': {
  term: 'elliptic point', match: ['elliptic point', 'elliptic points'], kind: 'geometry',
  short: 'A point that some non-trivial group element leaves exactly where it is.',
  body: '<p>In \\(\\mathcal{F}\\) there are two, up to equivalence: \\(i\\) is fixed by \\(S\\) (which has order 2 in \\(\\mathrm{PSL}_2(\\mathbb{Z})\\)), and \\(\\rho = e^{2\\pi i/3}\\) is fixed by \\(ST\\) (order 3).</p>' +
        '<p class="eg"><b>Why they get fractional weights.</b> Near an elliptic point of order \\(n\\), the quotient map wraps \\(n\\) times, so a zero there "costs" only \\(1/n\\) of the budget. That is the entire explanation for the \\(\\tfrac12\\operatorname{ord}_i\\) and \\(\\tfrac13\\operatorname{ord}_\\rho\\) terms in the valence formula — and hence for why \\(E_4\\) must vanish at \\(\\rho\\) and \\(E_6\\) at \\(i\\).</p>',
  see: ['fundamental-domain', 'valence-formula', 'cusp']
},

'cusp': {
  term: 'cusp', match: ['the cusp', 'cusps', 'cusp form', 'cusp forms'], kind: 'geometry',
  short: 'The point "at infinity" you add to close up the surface — reached by going straight up forever.',
  body: '<p>Going up in \\(\\mathbb{H}\\) (\\(y \\to \\infty\\)) sends \\(q = e^{2\\pi i z}\\) to 0. So the cusp is <b>literally the point \\(q = 0\\)</b>, and "holomorphic at the cusp" literally means "the \\(q\\)-expansion has no negative powers". This is why the abstraction costs nothing: the cusp is a concrete point in the \\(q\\)-disc.</p>' +
        '<p class="eg"><b>Cusp form.</b> A modular form whose constant term \\(a_0\\) also vanishes — it actually goes to zero at the cusp, rather than merely staying finite. Cusp forms are where the arithmetic lives: their coefficients are small (Deligne: \\(|\\tau(n)| \\le d(n)n^{11/2}\\)) whereas Eisenstein coefficients grow like \\(n^{k-1}\\). That square-root gap is exactly why cusp forms control error terms while Eisenstein series supply main terms.</p>',
  fig: 'qmap',
  see: ['q-expansion', 'fundamental-domain', 'eisenstein-series', 'delta-function']
},

'automorphy-factor': {
  term: 'automorphy factor', match: ['automorphy factor', 'weight-k slash', 'slash operator'], kind: 'modular forms',
  short: 'The fudge factor \\((cz+d)^k\\) that a modular form is allowed to pick up when you move it.',
  body: '<p>Write \\(j(\\gamma,z) = cz+d\\). Modularity says \\(f(\\gamma z) = j(\\gamma,z)^k f(z)\\) rather than \\(f(\\gamma z) = f(z)\\). The exponent \\(k\\) is the <b>weight</b>.</p>' +
        '<p class="eg"><b>Why not just demand plain invariance?</b> Because plain invariance (weight 0) is too strong: the quotient surface is compact, a holomorphic function on a compact Riemann surface is constant, so the only weight-0 holomorphic modular forms are constants. <b>The weight is not a technicality — it is the entire reason non-trivial examples exist.</b></p>' +
        '<p>The <b>slash operator</b> \\((f|_k\\gamma)(z) = (cz+d)^{-k}f(\\gamma z)\\) repackages this: a modular form is precisely a fixed point, \\(f|_k\\gamma = f\\) for every \\(\\gamma\\).</p>',
  see: ['cocycle', 'modular-form', 'weight', 'line-bundle']
},

'cocycle': {
  term: 'cocycle condition', match: ['cocycle', 'cocycle relation', 'cocycle condition'], kind: 'modular forms',
  short: 'The bookkeeping identity that makes the automorphy factors of two moves compose correctly.',
  body: '<p>\\(j(\\gamma_1\\gamma_2, z) = j(\\gamma_1, \\gamma_2 z)\\,j(\\gamma_2, z)\\). Check it once by hand; you will never need to again.</p>' +
        '<p class="eg"><b>What it buys you, concretely.</b> It makes \\(f \\mapsto f|_k\\gamma\\) a genuine group action, so modularity for the <i>generators</i> \\(S\\) and \\(T\\) implies modularity for <i>every</i> \\(\\gamma\\). The definition therefore collapses from infinitely many equations to two: \\(f(z+1) = f(z)\\) and \\(f(-1/z) = z^kf(z)\\). Without the cocycle relation the definition would be uncheckable.</p>',
  see: ['automorphy-factor', 'generators', 'line-bundle']
},

'weight': {
  term: 'weight', match: ['weight k', 'the weight', 'weight of a modular form'], kind: 'modular forms',
  short: 'The exponent \\(k\\) in \\((cz+d)^k\\) — the single integer that controls everything about a modular form.',
  body: '<p>Applying modularity to \\(\\gamma = -I\\) (which acts trivially but has \\(cz+d = -1\\)) gives \\(f = (-1)^kf\\). So for the full modular group <b>odd weights force \\(f \\equiv 0\\)</b>, and only even weights carry content. For congruence subgroups not containing \\(-I\\), odd weights come back to life — that is where most modern arithmetic happens.</p>' +
        '<p class="eg"><b>The weight is a budget.</b> The valence formula says a weight-\\(k\\) form has exactly \\(k/12\\) worth of zeros to spend. Weight 2 gives budget \\(1/6\\), which cannot be assembled from denominations \\(1, \\tfrac12, \\tfrac13\\) — so \\(M_2 = 0\\). Weight 12 gives budget exactly 1, which for the first time affords a zero at the cusp: enter \\(\\Delta\\).</p>',
  see: ['automorphy-factor', 'valence-formula', 'modular-form', 'dimension']
},

'modular-form': {
  term: 'modular form', match: ['modular form', 'modular forms'], kind: 'modular forms',
  short: 'A holomorphic function on the upper half-plane that transforms by \\((cz+d)^k\\) under the whole modular group, and stays finite at the cusp.',
  body: '<p>Three clauses, each doing a job. <b>(1) Holomorphic on \\(\\mathbb{H}\\)</b> — so all the rigidity of complex analysis applies. <b>(2) \\(f\\!\\left(\\frac{az+b}{cz+d}\\right) = (cz+d)^kf(z)\\)</b> — an infinite family of symmetries, checkable on two generators. <b>(3) Holomorphic at the cusp</b> — the \\(q\\)-expansion \\(\\sum a_nq^n\\) has no negative-index terms.</p>' +
        '<p class="eg"><b>Why this should have no solutions, and why it does.</b> Imposing one symmetry on a function space is mild; imposing infinitely many should kill everything. Instead the surviving space \\(M_k\\) is non-zero and <i>finite-dimensional</i> — small enough to write down completely. Rigidity in, finiteness out, and arithmetic identities fall out as consequences.</p>',
  see: ['weight', 'cusp', 'q-expansion', 'eisenstein-series', 'valence-formula']
},

'q-expansion': {
  term: 'q-expansion', match: ['q-expansion', 'q-expansions', 'Fourier expansion', 'Fourier coefficients', 'q-series', 'coefficients', 'coefficient'], kind: 'modular forms',
  short: 'The power series \\(\\sum a_nq^n\\) in \\(q = e^{2\\pi iz}\\) — where a modular form stops being analysis and becomes arithmetic.',
  body: '<p>Write \\(z = x+iy\\); then \\(q = e^{2\\pi ix}e^{-2\\pi y}\\), so \\(|q| = e^{-2\\pi y}\\) and \\(\\arg q = 2\\pi x\\). Two consequences: moving \\(z\\) right by 1 leaves \\(q\\) unchanged (so \\(q\\) has the \\(T\\)-symmetry baked in), and going up sends \\(q\\to 0\\) (so the cusp is the point \\(q=0\\)).</p>' +
        '<p class="eg"><b>Why the expansion exists at all.</b> \\(f(z+1) = f(z)\\) means \\(f\\) descends to a holomorphic function of \\(q\\) on the punctured disc \\(0 &lt; |q| &lt; 1\\), which therefore has a Laurent series. Clause 3 of the definition says the puncture is removable, so only \\(n \\ge 0\\) survives.</p>' +
        '<p>The map \\(z \\mapsto q\\) rolls the infinite vertical strip into a punctured disc, like rolling paper into a tube and flattening it. Then \\(a_n\\) — the coefficients — turn out to be divisor sums, counts of lattice points, or Ramanujan\'s \\(\\tau\\): <b>pure number theory, extracted from a statement about symmetry.</b></p>',
  fig: 'qmap',
  see: ['cusp', 'complex-number', 'eisenstein-series', 'divisor-function', 'sturm-bound']
},

'lattice': {
  term: 'lattice', match: ['lattice', 'lattice sum', 'lattice points'], kind: 'geometry',
  short: 'An evenly spaced infinite grid of points, generated by adding and subtracting two fixed vectors.',
  body: '<p>\\(\\Lambda_z = \\mathbb{Z}z + \\mathbb{Z} = \\{mz + n : m,n \\in \\mathbb{Z}\\}\\). Different pairs of generating vectors can produce the <i>same</i> lattice — that is exactly what the animation shows, and it is the source of all the symmetry.</p>' +
        '<p class="eg"><b>The one-line proof of modularity for Eisenstein series.</b> \\(G_k(z) = \\sum_{(m,n)\\neq(0,0)}(mz+n)^{-k}\\) is a sum over \\(\\Lambda_z\\). Replacing \\(z\\) by \\(\\gamma z\\) gives \\(\\Lambda_{\\gamma z} = (cz+d)^{-1}\\Lambda_z\\) — the <i>same lattice, rescaled</i>. Pulling the scalar out through \\(k\\) factors produces exactly \\((cz+d)^k\\). Modularity is not proved so much as noticed.</p>',
  fig: 'lattice',
  see: ['eisenstein-series', 'sl2z', 'elliptic-curve']
},

'eisenstein-series': {
  term: 'Eisenstein series', match: ['Eisenstein series', 'Eisenstein'], kind: 'modular forms',
  short: 'The first examples of modular forms, built by the oldest trick there is: average over the group.',
  body: '<p>\\(G_k(z) = \\sum_{(m,n)\\neq(0,0)}(mz+n)^{-k}\\) for even \\(k \\ge 4\\). Normalised so the constant term is 1, \\(E_k = G_k/(2\\zeta(k))\\), and then \\(E_k(z) = 1 - \\frac{2k}{B_k}\\sum_{n\\ge1}\\sigma_{k-1}(n)q^n\\).</p>' +
        '<p class="eg"><b>The averaging trick, in miniature.</b> Want a function on \\(\\mathbb{R}\\) invariant under \\(x \\mapsto x+1\\)? Start with \\(e^{-x^2}\\), which is not, and sum all its translates: \\(F(x) = \\sum_n e^{-(x+n)^2}\\). Now \\(F(x+1) = F(x)\\), because shifting merely re-indexes the sum. You manufactured invariance out of patience. Eisenstein series are the same move with a bigger group and a weight attached.</p>' +
        '<p><b>Why \\(k \\ge 4\\).</b> The sum only converges absolutely for \\(k &gt; 2\\). At \\(k=2\\) it fails, and the resulting \\(E_2\\) misses modularity by a correction term — a famous, useful failure (Vol. I §7.4).</p>',
  fig: 'lattice',
  see: ['lattice', 'divisor-function', 'bernoulli-number', 'delta-function', 'q-expansion']
},

'divisor-function': {
  term: 'divisor function', match: ['divisor sum', 'divisor sums', 'sigma_{k-1}', 'σ'], kind: 'number theory',
  short: 'Add up the divisors of \\(n\\), each raised to a fixed power.',
  body: '<p>\\(\\sigma_s(n) = \\sum_{d \\mid n} d^{\\,s}\\). So \\(\\sigma_0(n)\\) counts divisors, \\(\\sigma_1(n)\\) sums them: \\(\\sigma_1(6) = 1+2+3+6 = 12\\).</p>' +
        '<p class="eg"><b>Why it appears in a subject about complex symmetry.</b> The \\(q\\)-expansion of \\(E_k\\) has coefficients \\(\\sigma_{k-1}(n)\\), with no divisors mentioned anywhere in the construction. This is the first sign that modular forms are arithmetic objects in analytic costume — and it is what makes free identities possible: \\(E_4^2 = E_8\\) is a statement about symmetry, but comparing coefficients turns it into \\(\\sigma_7(n) = \\sigma_3(n) + 120\\sum_{m=1}^{n-1}\\sigma_3(m)\\sigma_3(n-m)\\), a genuinely non-obvious fact about divisors that nobody found by manipulating divisors.</p>',
  fig: 'multiplicative',
  see: ['multiplicative', 'eisenstein-series', 'q-expansion']
},

'multiplicative': {
  term: 'multiplicative function', match: ['multiplicative function', 'multiplicative', 'multiplicativity'], kind: 'number theory',
  short: 'A function where \\(f(mn) = f(m)f(n)\\) whenever \\(m\\) and \\(n\\) share no prime factor.',
  body: '<p>Such a function is determined entirely by its values on prime powers, which is an enormous compression: knowing \\(f(p^a)\\) for all primes gives you \\(f\\) everywhere.</p>' +
        '<p class="eg"><b>Concretely.</b> \\(\\sigma_1(4) = 7\\) and \\(\\sigma_1(9) = 13\\), and \\(\\sigma_1(36) = 91 = 7 \\times 13\\). This works because 4 and 9 share no prime — it would <i>fail</i> for \\(\\sigma_1(2)\\sigma_1(4)\\) vs \\(\\sigma_1(8)\\).</p>' +
        '<p><b>The structural reason it matters.</b> Multiplicativity is exactly the condition for a Dirichlet series \\(\\sum a_n n^{-s}\\) to factor as an Euler product over primes. In Vol. I it is what Hecke operators force on eigenform coefficients; in Vol. II it is the "sieve axiom" \\(|\\mathcal{A}_d| = Xg(d) + r_d\\) with \\(g\\) multiplicative.</p>',
  fig: 'multiplicative',
  see: ['divisor-function', 'euler-product', 'hecke-operator', 'mobius-function']
},

'bernoulli-number': {
  term: 'Bernoulli numbers', match: ['Bernoulli number', 'Bernoulli numbers', 'B_k', 'Bernoulli', '691'], kind: 'number theory',
  short: 'A sequence of rational numbers that shows up wherever sums of powers, \\(\\zeta\\), and modular forms meet.',
  body: '<p>Defined by \\(\\frac{t}{e^t-1} = \\sum_{n\\ge0}B_n\\frac{t^n}{n!}\\). The first few: \\(B_0=1, B_1=-\\tfrac12, B_2=\\tfrac16, B_4=-\\tfrac1{30}, B_{12} = -\\tfrac{691}{2730}\\).</p>' +
        '<p class="eg"><b>Where the mysterious 691 comes from.</b> \\(E_{12} = 1 + \\frac{65520}{691}\\sum\\sigma_{11}(n)q^n\\) — that 691 is the numerator of \\(B_{12}\\). Since \\(\\dim M_{12} = 2\\) and \\(E_4^3\\) also lives there, comparing the three forms and clearing denominators traps a factor of 691, producing Ramanujan\'s congruence \\(\\tau(n) \\equiv \\sigma_{11}(n) \\bmod 691\\). <b>The prime is visible in the dimension bookkeeping</b> — and this kind of congruence between Eisenstein series and cusp forms is the seed of Iwasawa theory.</p>',
  see: ['eisenstein-series', 'zeta-function', 'ramanujan-tau']
},

'delta-function': {
  term: 'the discriminant Δ', match: ['\\Delta', 'discriminant', 'eta product'], kind: 'modular forms',
  short: 'The first cusp form: weight 12, no zeros anywhere in the upper half-plane, and the protagonist of the subject.',
  body: '<p>\\(\\Delta(z) = \\frac{E_4^3 - E_6^2}{1728} = q\\prod_{n\\ge1}(1-q^n)^{24} = \\sum_{n\\ge1}\\tau(n)q^n\\). The middle expression (the <b>eta product</b>, since \\(\\Delta = \\eta^{24}\\)) is far from obvious from the left one.</p>' +
        '<p class="eg"><b>Jacobi\'s theorem, and why it is immediate.</b> \\(\\Delta\\) has no zeros on \\(\\mathbb{H}\\): in the product, \\(|q^n| &lt; 1\\) so no factor can vanish. Its whole zero budget of \\(12/12 = 1\\) is spent on a simple zero at the cusp. Consequence: dividing by \\(\\Delta\\) is an isomorphism \\(M_k \\xrightarrow{\\sim} S_{k+12}\\), which is how the dimension formula bootstraps itself.</p>' +
        '<p>Because \\(\\dim S_{12} = 1\\), \\(\\Delta\\) is automatically a Hecke eigenform — a linear map on a 1-dimensional space is multiplication by a scalar, so <i>every</i> non-zero element is an eigenvector. Ramanujan\'s multiplicativity conjecture therefore falls out of a dimension count.</p>',
  see: ['cusp', 'ramanujan-tau', 'j-invariant', 'hecke-operator', 'valence-formula']
},

'ramanujan-tau': {
  term: 'Ramanujan\'s τ', match: ['\\tau(n)', 'tau function', 'Ramanujan\'s tau'], kind: 'number theory',
  short: 'The coefficients of Δ: 1, −24, 252, −1472, 4830, … — mysteriously multiplicative and mysteriously small.',
  body: '<p>Defined by \\(\\Delta = \\sum\\tau(n)q^n\\). Ramanujan observed empirically in 1916 that \\(\\tau(mn) = \\tau(m)\\tau(n)\\) for coprime \\(m,n\\), and that \\(|\\tau(p)| \\le 2p^{11/2}\\).</p>' +
        '<p class="eg"><b>Both observations became theorems, by wildly different routes.</b> Multiplicativity is cheap: \\(\\dim S_{12} = 1\\), so \\(\\Delta\\) is a Hecke eigenform automatically. The bound \\(|\\tau(p)| \\le 2p^{11/2}\\) is <i>not</i> cheap — Deligne proved it in 1974 as a corollary of the Weil conjectures, and it won him a Fields Medal. Writing \\(\\tau(p) = 2p^{11/2}\\cos\\theta_p\\), the angles \\(\\theta_p\\) equidistribute with density \\(\\tfrac{2}{\\pi}\\sin^2\\theta\\) (Sato–Tate, proved for Δ in 2011).</p>',
  see: ['delta-function', 'hecke-operator', 'deligne-bound', 'multiplicative']
},

'deligne-bound': {
  term: 'Deligne bound', match: ['Deligne bound', 'Deligne\'s theorem', 'Ramanujan conjecture', 'Sato–Tate'], kind: 'number theory',
  short: 'Cusp form coefficients are square-root small — as small as random cancellation would make them.',
  body: '<p>For a weight-\\(k\\) eigenform, \\(|a_p| \\le 2p^{(k-1)/2}\\). Compare the trivial bound \\(p^{k-1}\\): Deligne\'s theorem is a <b>square-root saving</b>, the analogue of "a random walk of \\(N\\) steps ends \\(\\sqrt N\\) from home".</p>' +
        '<p class="eg"><b>Why analytic number theorists care so much.</b> Eisenstein coefficients grow like \\(n^{k-1}\\) and supply <b>main terms</b>; cusp form coefficients are \\(O(n^{(k-1)/2+\\varepsilon})\\) and supply <b>error terms</b>. The gap between those two exponents is precisely what makes "main term + small error" decompositions work in practice. Deligne obtained it from the Weil conjectures — a statement about counting points on varieties over finite fields, which is not where anyone would have looked.</p>',
  see: ['ramanujan-tau', 'cusp', 'error-term']
},

'j-invariant': {
  term: 'the j-invariant', match: ['j(z)', 'j-invariant', 'uniformiser'], kind: 'modular forms',
  short: 'The weight-zero function \\(E_4^3/\\Delta\\) — a genuine invariant of the modular group, hitting every complex value exactly once per tile.',
  body: '<p>\\(j(z) = \\frac{E_4^3}{\\Delta} = \\frac1q + 744 + 196884q + 21493760q^2 + \\cdots\\). Weight \\(12 - 12 = 0\\), so it is honestly \\(\\mathrm{SL}_2(\\mathbb{Z})\\)-invariant; meromorphic, with a single pole at the cusp.</p>' +
        '<p class="eg"><b>Why it is the "uniformiser".</b> \\(j\\) is a bijection from the fundamental domain onto \\(\\mathbb{C}\\). So the quotient surface <i>is</i> the complex plane (plus the cusp, giving the sphere \\(\\mathbb{P}^1\\)), and \\(j\\) is the coordinate on it. Every \\(\\mathrm{SL}_2(\\mathbb{Z})\\)-invariant meromorphic function is a rational function of \\(j\\).</p>' +
        '<p><b>Monstrous moonshine.</b> \\(196884 = 196883 + 1\\), where 196883 is the dimension of the smallest faithful representation of the Monster group. That looked like numerology in 1978 and won Borcherds a Fields Medal in 1998.</p>',
  see: ['delta-function', 'meromorphic', 'riemann-surface', 'quotient']
},

'valence-formula': {
  term: 'valence formula', match: ['valence formula', 'zero budget', 'budget'], kind: 'modular forms',
  short: 'A weight-\\(k\\) form has exactly \\(k/12\\) worth of zeros — no more, no less.',
  body: '<p>\\(\\operatorname{ord}_\\infty(f) + \\tfrac12\\operatorname{ord}_i(f) + \\tfrac13\\operatorname{ord}_\\rho(f) + \\sum_{P}\\operatorname{ord}_P(f) = \\frac{k}{12}\\), the last sum over the remaining orbits in \\(\\mathcal{F}\\).</p>' +
        '<p class="eg"><b>Read it as a budget with three denominations.</b> Every term on the left is \\(\\ge 0\\). A zero in the interior costs 1, at \\(i\\) costs \\(\\tfrac12\\), at \\(\\rho\\) costs \\(\\tfrac13\\). Then: \\(k&lt;0\\) or odd gives no budget, so \\(M_k = 0\\). \\(k=2\\) gives \\(\\tfrac16\\), unpayable in those denominations, so \\(M_2 = 0\\). \\(k=4\\) gives \\(\\tfrac13\\) — one simple zero at \\(\\rho\\), and \\(E_4\\) realises it. \\(k=6\\) gives \\(\\tfrac12\\), forcing \\(E_6(i)=0\\). \\(k=12\\) gives 1, the first time a zero at the cusp is affordable: enter \\(\\Delta\\).</p>' +
        '<p><b>Where it comes from.</b> The argument principle applied to \\(\\partial\\mathcal{F}\\). The left and right edges are identified by \\(T\\) and cancel exactly; the bottom arc folds onto itself under \\(S\\) and almost cancels, leaving a residue proportional to \\(k\\). All the symmetry cancels; only the weight survives. Since the orders are non-negative and a fixed total splits in finitely many ways, the dimension is finite.</p>',
  fig: 'argprinciple',
  see: ['argument-principle', 'zero-of-order', 'weight', 'dimension', 'elliptic-point']
},

'sturm-bound': {
  term: 'Sturm bound', match: ['Sturm bound'], kind: 'modular forms',
  short: 'The finite number of coefficients you have to check before two modular forms are provably identical.',
  body: '<p>For level 1 weight \\(k\\): if \\(f \\in M_k\\) vanishes to order greater than \\(k/12\\) at the cusp, then \\(f = 0\\). So agreement up to \\(q^{\\lfloor k/12\\rfloor}\\) already forces equality.</p>' +
        '<p class="eg"><b>What this does to your working life.</b> \\(E_4^2\\) and \\(E_8\\) are both weight 8; \\(\\dim M_8 = 1\\); both have constant term 1. Therefore \\(E_4^2 = E_8\\) — proved by checking <b>one</b> coefficient. The infinitely many resulting divisor identities come free. Any identity between modular objects of the same weight and level becomes a finite computation.</p>',
  see: ['dimension', 'valence-formula', 'q-expansion']
},

'hecke-operator': {
  term: 'Hecke operator', match: ['Hecke operator', 'Hecke operators', 'T_p'], kind: 'modular forms',
  short: 'A family of commuting linear maps whose eigenvectors are exactly the forms with multiplicative coefficients.',
  body: '<p>On \\(q\\)-expansions, \\((T_pf)(z) = \\sum_{n\\ge0}\\bigl(a_{np} + p^{k-1}a_{n/p}\\bigr)q^n\\), with \\(a_{n/p} = 0\\) when \\(p \\nmid n\\). Geometrically \\(T_p\\) sums \\(f\\) over the \\(p+1\\) sublattices of index \\(p\\).</p>' +
        '<p class="eg"><b>Why the eigenvectors are the interesting forms.</b> \\(M_k\\) is finite-dimensional, so linear operators have eigenvectors — that is free. The \\(T_p\\) commute and are self-adjoint for the Petersson inner product, so they are <i>simultaneously</i> diagonalisable with real eigenvalues. Normalise an eigenform so \\(a_1 = 1\\); then \\(T_pf = a_pf\\) — the eigenvalue <i>is</i> the coefficient — and the eigenvalue relations become \\(a_ma_n = a_{mn}\\) for coprime \\(m,n\\), plus \\(a_{p^{r+1}} = a_pa_{p^r} - p^{k-1}a_{p^{r-1}}\\).</p>',
  fig: 'eigen',
  see: ['eigenvector', 'multiplicative', 'petersson', 'l-function', 'ramanujan-tau']
},

'petersson': {
  term: 'Petersson inner product', match: ['Petersson inner product', 'Petersson'], kind: 'modular forms',
  short: 'A way of measuring the "angle" between two cusp forms, invariant under the modular group.',
  body: '<p>\\(\\langle f,g\\rangle = \\int_{\\mathcal{F}} f(z)\\overline{g(z)}\\,y^k\\,\\frac{dx\\,dy}{y^2}\\). The measure \\(dx\\,dy/y^2\\) is the hyperbolic area element, which is \\(\\mathrm{SL}_2(\\mathbb{Z})\\)-invariant; the factor \\(y^k\\) exactly cancels the two automorphy factors.</p>' +
        '<p class="eg"><b>Why it is needed.</b> It makes \\(S_k\\) a Hilbert space on which the Hecke operators are Hermitian — and Hermitian commuting operators are simultaneously diagonalisable with real eigenvalues. Without it there is no reason a basis of eigenforms should exist.</p>',
  see: ['hecke-operator', 'self-adjoint', 'cusp']
},

'self-adjoint': {
  term: 'self-adjoint', match: ['self-adjoint', 'Hermitian', 'simultaneously diagonalisable'], kind: 'algebra',
  short: 'An operator that is its own mirror image — which guarantees real eigenvalues and a full basis of eigenvectors.',
  body: '<p>\\(T\\) is self-adjoint if \\(\\langle Tf, g\\rangle = \\langle f, Tg\\rangle\\) for all \\(f,g\\). The spectral theorem then says: eigenvalues are real, eigenvectors for different eigenvalues are orthogonal, and there is an orthonormal basis of eigenvectors.</p>' +
        '<p class="eg"><b>And if several operators commute?</b> They can be diagonalised <i>simultaneously</i> — one basis works for all of them at once. That is precisely why a cusp form can be an eigenform for <i>every</i> \\(T_p\\) at the same time, which is what makes the coefficients multiplicative across all primes rather than one at a time.</p>',
  fig: 'eigen',
  see: ['eigenvector', 'petersson', 'hecke-operator']
},

'l-function': {
  term: 'L-function', match: ['L-function', 'L(f,s)', 'Dirichlet series'], kind: 'number theory',
  short: 'A series \\(\\sum a_n n^{-s}\\) packaging a sequence into a function of a complex variable, so analysis can get at it.',
  body: '<p>For a modular form, \\(L(f,s) = \\sum_{n\\ge1}a_n n^{-s}\\). If the \\(a_n\\) are multiplicative it factors as an <b>Euler product</b> \\(\\prod_p(1 - a_pp^{-s} + p^{k-1-2s})^{-1}\\).</p>' +
        '<p class="eg"><b>The punchline of the classical theory.</b> Modularity of \\(f\\) becomes a <b>functional equation</b> for \\(L(f,s)\\) under \\(s \\mapsto k-s\\). The mechanism is the Mellin transform \\(\\Lambda(f,s) = (2\\pi)^{-s}\\Gamma(s)L(f,s) = \\int_0^\\infty f(iy)y^s\\frac{dy}{y}\\); substituting \\(y \\to 1/y\\) and using \\(f(i/y) = i^ky^kf(iy)\\) does the rest. So <i>an \\(\\mathrm{SL}_2(\\mathbb{Z})\\)-symmetry of a function on \\(\\mathbb{H}\\) is the same thing as an \\(s\\mapsto k-s\\) symmetry of a Dirichlet series.</i> Analytic continuation and functional equations, miraculous from the series side, are trivial consequences of a geometric symmetry.</p>',
  see: ['euler-product', 'functional-equation', 'zeta-function', 'analytic-continuation', 'hecke-operator']
},

'euler-product': {
  term: 'Euler product', match: ['Euler product'], kind: 'number theory',
  short: 'Rewriting a sum over all integers as a product over primes — the analytic form of unique factorisation.',
  body: '<p>\\(\\sum_{n\\ge1}n^{-s} = \\prod_p (1-p^{-s})^{-1}\\). Expand each factor as a geometric series \\(1 + p^{-s} + p^{-2s} + \\cdots\\) and multiply out: every \\(n^{-s}\\) appears exactly once, because every \\(n\\) factors into primes in exactly one way.</p>' +
        '<p class="eg"><b>Euler\'s proof that there are infinitely many primes.</b> The left side diverges at \\(s=1\\) (harmonic series). If there were finitely many primes the right side would be a finite product of finite numbers. Contradiction — and in fact the argument gives more: \\(\\sum_p 1/p\\) diverges, so the primes are not merely infinite but reasonably dense. Vol. II opens by contrasting this with Brun\'s theorem that the <i>twin</i> primes have a convergent reciprocal sum.</p>',
  fig: 'convergence',
  see: ['multiplicative', 'l-function', 'zeta-function', 'brun-constant']
},

'zeta-function': {
  term: 'Riemann zeta function', match: ['\zeta(s)', 'zeta function', 'Riemann zeta', 'zeta'], kind: 'number theory',
  short: 'The function \\(\\zeta(s) = \\sum n^{-s}\\), whose zeros encode how evenly the primes are distributed.',
  body: '<p>Convergent for \\(\\operatorname{Re} s &gt; 1\\), continued to the whole plane except a simple pole at \\(s=1\\). Euler product \\(\\prod_p(1-p^{-s})^{-1}\\) links it to the primes; the functional equation relates \\(s\\) to \\(1-s\\).</p>' +
        '<p class="eg"><b>What the zeros do.</b> The prime number theorem \\(\\pi(x) \\sim x/\\log x\\) is equivalent to \\(\\zeta\\) having no zeros on the line \\(\\operatorname{Re} s = 1\\). The <b>Riemann hypothesis</b> — all non-trivial zeros on \\(\\operatorname{Re} s = \\tfrac12\\) — is equivalent to the sharpest possible error term, \\(\\pi(x) = \\operatorname{Li}(x) + O(\\sqrt x \\log x)\\). Zeros off the critical line would mean the primes clump more than expected.</p>',
  see: ['euler-product', 'l-function', 'prime-number-theorem', 'riemann-hypothesis', 'analytic-continuation']
},

'functional-equation': {
  term: 'functional equation', match: ['functional equation'], kind: 'analysis',
  short: 'A symmetry relating a function\'s value at one point to its value at a reflected point.',
  body: '<p>For \\(\\zeta\\), the completed function \\(\\xi(s) = \\pi^{-s/2}\\Gamma(s/2)\\zeta(s)\\) satisfies \\(\\xi(s) = \\xi(1-s)\\). For a weight-\\(k\\) modular form, \\(\\Lambda(f,s) = \\pm\\Lambda(f,k-s)\\).</p>' +
        '<p class="eg"><b>Why these are not coincidences.</b> Each functional equation is the shadow of a geometric symmetry. For modular \\(L\\)-functions it is literally \\(S: z \\mapsto -1/z\\) transported through the Mellin transform: the substitution \\(y \\to 1/y\\) inside the integral <i>is</i> the modular transformation. A symmetry of the function on \\(\\mathbb{H}\\) and a symmetry of the Dirichlet series are two descriptions of one fact.</p>',
  see: ['l-function', 'zeta-function', 'analytic-continuation']
},

'riemann-surface': {
  term: 'Riemann surface', match: ['Riemann surface', 'modular curve', 'genus'], kind: 'geometry',
  short: 'A surface on which it makes sense to do complex analysis — locally a copy of the complex plane.',
  body: '<p>The sphere, the torus, and any smooth complex curve are examples. <b>Genus</b> counts the holes: sphere 0, torus 1, and so on.</p>' +
        '<p class="eg"><b>Why Vol. I cares.</b> Glue up the fundamental domain and you get a sphere with one puncture; add the cusp back and you get \\(\\mathbb{P}^1\\), genus 0. Modular forms of weight \\(k\\) are sections of a line bundle on that surface, and the finiteness of \\(\\dim M_k\\) is ultimately the Riemann–Roch theorem on a genus-zero curve. The valence formula is the elementary, hands-on version of that statement.</p>' +
        '<p>A holomorphic function on a <i>compact</i> Riemann surface is constant — which is exactly why weight 0 is boring and the automorphy factor is indispensable.</p>',
  see: ['quotient', 'line-bundle', 'j-invariant', 'valence-formula']
},

'line-bundle': {
  term: 'line bundle', match: ['line bundle', 'section of', 'sections of'], kind: 'geometry',
  short: 'A family of one-dimensional spaces, one attached to each point of a surface, glued together consistently.',
  body: '<p>A <b>section</b> picks one element out of each of those lines, varying holomorphically. If the gluing is trivial, sections are just functions; if not, a section transforms by the gluing factors when you change chart.</p>' +
        '<p class="eg"><b>The sentence that makes modular forms click.</b> A modular form of weight \\(k\\) is exactly a holomorphic section of \\(\\omega^{\\otimes k}\\) on the modular curve. The mysterious \\((cz+d)^k\\) is nothing but the <i>transition function</i> of that bundle — the factor you pick up when you change chart. You do not need this language to compute, but it explains why the automorphy factor has the particular form it does, and why the cocycle relation must hold.</p>',
  see: ['riemann-surface', 'automorphy-factor', 'cocycle', 'modular-form']
},

'congruence-subgroup': {
  term: 'congruence subgroup', match: ['congruence subgroup', 'congruence subgroups', '\\Gamma_0(N)', 'level N', 'newform'], kind: 'modular forms',
  short: 'A smaller version of the modular group, defined by a divisibility condition on the matrix entries.',
  body: '<p>\\(\\Gamma_0(N) = \\left\\{\\begin{pmatrix}a&amp;b\\\\c&amp;d\\end{pmatrix} \\in \\mathrm{SL}_2(\\mathbb{Z}) : N \\mid c\\right\\}\\). Fewer symmetries imposed means more forms survive, so the theory gets richer as \\(N\\) grows.</p>' +
        '<p class="eg"><b>Why anyone bothers.</b> Three reasons. (1) Odd weights come back: \\(\\Gamma_0(N)\\) for some \\(N\\) does not contain \\(-I\\), so the killing argument fails. (2) Half-integral weight becomes possible — \\(\\theta(z) = \\sum q^{n^2}\\) is weight \\(1/2\\) on \\(\\Gamma_0(4)\\), which is how sums-of-squares theorems are proved. (3) The modularity theorem lives here: every elliptic curve over \\(\\mathbb{Q}\\) of conductor \\(N\\) matches a weight-2 <b>newform</b> of level \\(N\\).</p>',
  see: ['sl2z', 'modularity-theorem', 'theta-function', 'elliptic-curve']
},

'theta-function': {
  term: 'theta function', match: ['theta function', '\\theta(z)', 'sums of squares'], kind: 'modular forms',
  short: 'The series \\(\\sum_{n\\in\\mathbb{Z}}q^{n^2}\\) — a modular form of weight ½ that counts representations as sums of squares.',
  body: '<p>Raise it to the \\(k\\)th power and \\(\\theta^k = \\sum r_k(n)q^n\\), where \\(r_k(n)\\) counts the ways of writing \\(n\\) as an ordered sum of \\(k\\) squares (signs and order counted). That is pure combinatorics — multiplying out the series is just tallying.</p>' +
        '<p class="eg"><b>The theorem that falls out.</b> \\(\\theta\\) is modular of weight \\(1/2\\) on \\(\\Gamma_0(4)\\), so \\(\\theta^4\\) lives in a 2-dimensional weight-2 space spanned by Eisenstein series. Matching two coefficients gives Jacobi\'s formula \\(r_4(n) = 8\\sum_{d\\mid n,\\,4\\nmid d}d\\) for <i>all</i> \\(n\\) — and since that is always positive, Lagrange\'s four-square theorem drops out as a corollary of a formula. For \\(k \\ge 10\\) a cusp form enters the space and the divisor formula acquires an error term: <b>"main term plus error term" arising structurally rather than by estimation.</b></p>',
  see: ['congruence-subgroup', 'eisenstein-series', 'cusp', 'q-expansion']
},

'elliptic-curve': {
  term: 'elliptic curve', match: ['elliptic curve', 'elliptic curves'], kind: 'number theory',
  short: 'A cubic equation \\(y^2 = x^3+ax+b\\) whose solutions form a group — and, over ℚ, a deeply arithmetic object.',
  body: '<p>Over \\(\\mathbb{C}\\) an elliptic curve is \\(\\mathbb{C}/\\Lambda\\) for a lattice \\(\\Lambda\\) — a torus — which is exactly why lattices and modular forms are entangled with them. Over a finite field \\(\\mathbb{F}_p\\) you can count points, giving \\(a_p(E) = p+1-\\#E(\\mathbb{F}_p)\\).</p>' +
        '<p class="eg"><b>The modularity theorem.</b> Wiles, Taylor–Wiles and Breuil–Conrad–Diamond–Taylor proved: for every elliptic curve \\(E/\\mathbb{Q}\\) there is a weight-2 newform \\(f\\) of level \\(N = \\operatorname{cond}(E)\\) with \\(a_p(f) = a_p(E)\\) for all \\(p \\nmid N\\). Frey\'s observation was that a solution to \\(a^p+b^p=c^p\\) would give a curve \\(y^2 = x(x-a^p)(x+b^p)\\) whose form must live in a space of dimension <b>0</b>. Ribet proved the level-lowering step; modularity supplies the form. <i>A non-existent object in an empty space — the dimension formula is what kills Fermat.</i></p>',
  fig: 'lattice',
  see: ['lattice', 'congruence-subgroup', 'modularity-theorem', 'dimension']
},

'modularity-theorem': {
  term: 'modularity theorem', match: ['modularity theorem', 'Taniyama', 'Fermat\'s Last Theorem'], kind: 'number theory',
  short: 'Every elliptic curve over ℚ comes from a modular form — the bridge that proved Fermat\'s Last Theorem.',
  body: '<p>Two worlds that have no business meeting: cubic equations with rational coefficients, and holomorphic functions with infinite symmetry. The theorem says their arithmetic invariants coincide exactly, prime by prime.</p>' +
        '<p class="eg"><b>How that kills Fermat.</b> Suppose \\(a^p+b^p=c^p\\). Frey builds an elliptic curve from it. Ribet\'s level-lowering theorem shows the associated modular form would have to live at level 2, weight 2 — a space of dimension zero. Modularity says the form exists. A form that exists in an empty space is a contradiction, so the solution does not exist. <b>The dimension count from Vol. I §5 is the load-bearing step.</b></p>',
  see: ['elliptic-curve', 'congruence-subgroup', 'dimension']
},

'quasi-modular': {
  term: 'quasi-modular', match: ['quasi-modular', 'E_2', 'Serre derivative'], kind: 'modular forms',
  short: 'Almost modular — transforming with an extra correction term that refuses to vanish.',
  body: '<p>\\(E_2 = 1 - 24\\sum\\sigma_1(n)q^n\\) satisfies \\(E_2(-1/z) = z^2E_2(z) + \\frac{12z}{2\\pi i}\\). The extra term is the defect, and it is there because the weight-2 lattice sum does not converge absolutely.</p>' +
        '<p class="eg"><b>Two ways to live with the defect.</b> (1) \\(E_2^* = E_2 - \\frac{3}{\\pi y}\\) <i>is</i> modular, at the price of being non-holomorphic. (2) The <b>Serre derivative</b> \\(\\vartheta f = q\\frac{df}{dq} - \\frac{k}{12}E_2f\\) maps \\(M_k \\to M_{k+2}\\) — the defect of \\(E_2\\) exactly cancels the defect of differentiating. That gives modular forms a differential structure, and Ramanujan\'s system \\(q\\frac{dE_2}{dq} = \\frac{E_2^2-E_4}{12}\\), etc., makes \\(\\mathbb{C}[E_2,E_4,E_6]\\) a differential ring. It is why modular forms turn up in differential equations, mirror symmetry and string amplitudes.</p>',
  see: ['eisenstein-series', 'weight', 'modular-form']
},

/* ---------- PART 2 appended below ---------- */

/* ---------- prerequisites Vol. I quietly assumes ------------------------ */

'matrix': {
  term: 'matrix', match: ['matrix', 'matrices', 'integer matrices'], kind: 'algebra',
  short: 'A rectangular grid of numbers that encodes a transformation — and multiplying two of them means doing one transformation after the other.',
  body: '<p>A \\(2\\times2\\) matrix \\(\\begin{pmatrix}a&amp;b\\\\c&amp;d\\end{pmatrix}\\) is a recipe: it sends the vector \\((x,y)\\) to \\((ax+by,\\ cx+dy)\\). That is all a matrix <i>is</i> — a compact way of writing down a linear transformation.</p>' +
        '<p class="eg"><b>Why the grid notation earns its keep.</b> If you apply \\(B\\) and then \\(A\\), the combined effect is exactly the product \\(AB\\). Matrix multiplication is not an arbitrary rule someone invented; it is "do this, then do that", written down. That single fact is why matrices appear in a subject about functions: composing two Möbius transformations corresponds to multiplying their matrices.</p>' +
        '<p>Careful: \\(AB\\) and \\(BA\\) usually differ. Order matters, because doing things in the other order genuinely gives something else.</p>',
  see: ['determinant', 'sl2z', 'mobius-transformation', 'group']
},

'determinant': {
  term: 'determinant', match: ['determinant'], kind: 'algebra',
  short: 'One number telling you the area-scaling factor of a transformation — and whether it can be undone at all.',
  body: '<p>For \\(\\begin{pmatrix}a&amp;b\\\\c&amp;d\\end{pmatrix}\\) the determinant is \\(ad-bc\\). Push the unit square through the matrix and you get a parallelogram of area \\(|ad-bc|\\). Negative means the transformation also flipped orientation.</p>' +
        '<p class="eg"><b>Why \\(\\det = 1\\) is the condition defining \\(\\mathrm{SL}_2(\\mathbb{Z})\\).</b> Three separate jobs at once. (1) Determinant zero squashes the square flat and the map cannot be undone — so \\(\\det \\neq 0\\) <i>is</i> invertibility. (2) The inverse is \\(\\frac{1}{ad-bc}\\begin{pmatrix}d&amp;-b\\\\-c&amp;a\\end{pmatrix}\\), which has integer entries only when \\(ad-bc = \\pm1\\). (3) In the computation \\(\\operatorname{Im}(\\gamma z) = (ad-bc)\\operatorname{Im}(z)/|cz+d|^2\\), taking \\(ad-bc=1\\) is exactly what keeps the imaginary part positive, so the upper half-plane is preserved. The condition is load-bearing in three places, not decoration.</p>',
  see: ['matrix', 'sl2z', 'upper-half-plane']
},

'subgroup': {
  term: 'subgroup', match: ['subgroup', 'subgroups', 'smaller group'], kind: 'algebra',
  short: 'A smaller group living inside a bigger one — a subset still closed under combining and undoing.',
  body: '<p>\\(H \\subseteq G\\) is a subgroup if it contains the identity and is closed under the operation and under inverses. The rotations of a square form a subgroup of all 8 symmetries; the reflections alone do <i>not</i>, since composing two reflections gives a rotation, which is outside.</p>' +
        '<p class="eg"><b>In Vol. I.</b> \\(\\Gamma_0(N)\\) is a subgroup of \\(\\mathrm{SL}_2(\\mathbb{Z})\\): fewer symmetries demanded, so more functions survive the demand. Shrinking the group is the standard move whenever a space of modular forms turns out to be uselessly small — and it is where the arithmetic of elliptic curves lives.</p>',
  see: ['group', 'congruence-subgroup', 'sl2z']
},

'discrete-group': {
  term: 'discrete group', match: ['discrete group', 'properly discontinuous', 'discrete'], kind: 'geometry',
  short: 'A group whose elements are spread out rather than packed together — so its orbits are isolated points, not smears.',
  body: '<p>Rotations of a circle by <i>every</i> angle form a continuous group: the orbit of a point is the whole circle, and the only invariant functions are constants on circles. Rotations by multiples of \\(90^\\circ\\) form a <b>discrete</b> group: the orbit is 4 isolated points, and invariant functions are plentiful.</p>' +
        '<p class="eg"><b>The hinge of the whole subject.</b> \\(\\mathrm{SL}_2(\\mathbb{Z})\\) sits discretely inside the continuous group \\(\\mathrm{SL}_2(\\mathbb{R})\\), and acts <b>properly discontinuously</b> on \\(\\mathbb{H}\\): every point has a neighbourhood that only finitely many group elements disturb. That is why orbits are isolated, why a fundamental domain exists at all, and why the tessellation has crisp tiles rather than dissolving into mush. A continuous group would leave only constants.</p>',
  see: ['group-action', 'orbit', 'fundamental-domain', 'sl2z']
},

'series-convergence': {
  term: 'convergence', match: ['converges', 'convergent', 'convergence', 'diverges', 'divergent', 'absolutely'], kind: 'analysis',
  short: 'An infinite sum converges if its running total settles on a finite number, and diverges if it grows past every bound.',
  body: '<p>\\(1 + \\tfrac12 + \\tfrac14 + \\cdots\\) approaches 2: convergent. \\(1 + \\tfrac12 + \\tfrac13 + \\cdots\\) crawls past every bound: divergent — even though the terms shrink to zero. <b>Terms tending to zero is not enough.</b></p>' +
        '<p class="eg"><b>Absolute convergence</b> means \\(\\sum|a_n|\\) converges. It is the safe kind: you may reorder freely without changing the answer. The Eisenstein sum \\(\\sum(mz+n)^{-k}\\) converges absolutely exactly when \\(k &gt; 2\\) — which is why the theory starts at weight 4, and why \\(E_2\\) misbehaves. Its sum is only conditionally convergent, and applying \\(\\gamma\\) <i>is</i> a rearrangement, so the answer shifts by a correction term.</p>' +
        '<p>Vol. II turns on the same distinction: \\(\\sum_p 1/p\\) diverges (Euler), while the twin-prime version converges (Brun).</p>',
  fig: 'convergence',
  see: ['eisenstein-series', 'quasi-modular', 'brun-constant', 'asymptotic']
},

'laurent-series': {
  term: 'Laurent expansion', match: ['Laurent expansion', 'Laurent series', 'power series', 'Taylor series'], kind: 'complex analysis',
  short: 'A power series that is also allowed negative powers — the right language near a point where a function might blow up.',
  body: '<p>A Taylor series \\(\\sum_{n\\ge0}c_n(z-z_0)^n\\) describes a function that is well behaved at \\(z_0\\). A Laurent series \\(\\sum_{n\\in\\mathbb{Z}}c_n(z-z_0)^n\\) permits \\(n &lt; 0\\), so it can describe a pole as well.</p>' +
        '<p class="eg"><b>Exactly how Vol. I uses it.</b> Periodicity \\(f(z+1)=f(z)\\) makes \\(f\\) a holomorphic function of \\(q\\) on the punctured disc \\(0 &lt; |q| &lt; 1\\), and such a function always has a Laurent expansion \\(\\sum_{n\\in\\mathbb{Z}}a_nq^n\\). The third clause of the definition of a modular form — "holomorphic at the cusp" — says precisely that every negative-index coefficient vanishes, i.e. the puncture is removable. An abstract-sounding growth condition is really just "no negative powers of \\(q\\)".</p>',
  see: ['q-expansion', 'pole', 'holomorphic', 'cusp']
},

'compact': {
  term: 'compact', match: ['compact'], kind: 'topology',
  short: 'Closed and bounded — no edges leaking away, no room to escape towards infinity.',
  body: '<p>The closed interval \\([0,1]\\) is compact; the open interval \\((0,1)\\) and the whole line are not. The property that matters: a continuous function on a compact set attains a maximum somewhere.</p>' +
        '<p class="eg"><b>The consequence that shapes Vol. I.</b> A holomorphic function on a <i>compact</i> Riemann surface must be constant: \\(|f|\\) attains a maximum, and the maximum principle then forces \\(f\\) to be constant everywhere. The modular quotient, with the cusp added back, is compact. So weight-0 holomorphic modular forms are only the constants, and the entire subject exists because the automorphy factor \\((cz+d)^k\\) is a way out of that trap.</p>',
  see: ['riemann-surface', 'automorphy-factor', 'quotient', 'holomorphic']
},

'isomorphism': {
  term: 'isomorphism', match: ['isomorphism', 'isomorphic'], kind: 'algebra',
  short: 'A perfect dictionary between two structures — a relabelling under which absolutely everything matches.',
  body: '<p>Written \\(\\cong\\) or \\(\\xrightarrow{\\ \\sim\\ }\\). Two isomorphic objects are the same for every purpose the structure can detect, however differently they were built.</p>' +
        '<p class="eg"><b>A load-bearing example.</b> Multiplication by \\(\\Delta\\) is an isomorphism \\(M_k \\xrightarrow{\\sim} S_{k+12}\\). Every weight-\\(k\\) form maps to a weight-\\((k{+}12)\\) cusp form, and every such cusp form arises exactly once — divide by \\(\\Delta\\), which is legal precisely because \\(\\Delta\\) never vanishes on \\(\\mathbb{H}\\). So the dimensions match, and the dimension formula bootstraps itself upward in steps of 12. The whole staircase in Fig. 6 comes from this one isomorphism.</p>',
  see: ['delta-function', 'dimension', 'vector-space']
},

'polynomial-ring': {
  term: 'polynomial ring', match: ['polynomial ring', 'Hilbert series', 'generating function'], kind: 'algebra',
  short: 'All polynomials in some fixed symbols — and calling a structure "one of these" means those symbols generate everything with no hidden relations.',
  body: '<p>\\(\\mathbb{C}[x,y]\\) is every polynomial in \\(x\\) and \\(y\\). <b>Free</b> generators means no relation like \\(x^2 = y^3\\) is imposed: two polynomials are equal only if they are literally the same polynomial.</p>' +
        '<p class="eg"><b>The structure theorem of Vol. I, decoded.</b> \\(\\bigoplus_k M_k = \\mathbb{C}[E_4,E_6]\\) says <b>every</b> level-1 modular form is a polynomial in \\(E_4\\) and \\(E_6\\), in exactly one way. An infinite theory, and its complete contents are two functions. The proof is a counting identity: monomials \\(E_4^aE_6^b\\) of weight \\(4a+6b=k\\) give \\(\\sum_k\\dim M_k\\,x^k = \\frac{1}{(1-x^4)(1-x^6)}\\), which is precisely the Hilbert series of a polynomial ring on generators of degree 4 and 6. Matching that against the dimension formula <i>is</i> the argument.</p>',
  see: ['dimension', 'eisenstein-series', 'valence-formula']
},

'hyperbolic-metric': {
  term: 'hyperbolic metric', match: ['hyperbolic metric', 'hyperbolic', 'conformal'], kind: 'geometry',
  short: 'A way of measuring distance in the upper half-plane under which the modular group moves things around rigidly.',
  body: '<p>\\(ds = |dz|/y\\): a step of a given Euclidean size counts as <i>longer</i> the nearer you are to the real axis. The area element is \\(dx\\,dy/y^2\\).</p>' +
        '<p class="eg"><b>What this fixes about the picture.</b> In Fig. 1 the tiles appear to shrink to nothing near the real axis. Hyperbolically they are all <b>exactly the same size</b> — the shrinking is an artefact of Euclidean eyes, the way Mercator makes Greenland look enormous. Möbius transformations are hyperbolic isometries: they slide tiles around rigidly, no distortion. That is the honest picture of what the group is doing.</p>' +
        '<p><b>Conformal</b> means angle-preserving. Holomorphic maps are conformal, which is why the corner angles of the tessellation really are the \\(\\pi/2\\) and \\(\\pi/3\\) they look like — and why those become the \\(\\tfrac12\\) and \\(\\tfrac13\\) in the valence formula.</p>',
  fig: 'holo',
  see: ['upper-half-plane', 'mobius-transformation', 'fundamental-domain', 'holomorphic', 'petersson']
},

'free-product': {
  term: 'free product', match: ['free product'], kind: 'algebra',
  short: 'Two groups glued together with no relations beyond the ones each already had.',
  body: '<p>\\(\\mathbb{Z}/2 * \\mathbb{Z}/3\\) is all alternating words in a generator \\(a\\) of order 2 and \\(b\\) of order 3 — \\(ab,\\ ab^2a,\\ ababab^2,\\dots\\) — with no simplification available beyond \\(a^2=e\\) and \\(b^3=e\\).</p>' +
        '<p class="eg"><b>Why the tessellation looks like a tree.</b> \\(\\mathrm{PSL}_2(\\mathbb{Z}) \\cong \\mathbb{Z}/2 * \\mathbb{Z}/3\\), generated by \\(S\\) and \\(ST\\). "No unexpected relations" means distinct reduced words give genuinely distinct group elements, hence genuinely distinct tiles. The branching you see in Fig. 1 is a picture of that freeness.</p>',
  see: ['sl2z', 'generators', 'fundamental-domain']
},

'prime-number-theorem': {
  term: 'prime number theorem', match: ['prime number theorem'], kind: 'number theory',
  short: 'The primes up to \\(x\\) number about \\(x/\\log x\\) — so a number near \\(x\\) is prime with probability roughly \\(1/\\log x\\).',
  body: '<p>\\(\\pi(x) \\sim x/\\log x\\), proved independently by Hadamard and de la Vallée Poussin in 1896. The sharper form uses the logarithmic integral: \\(\\pi(x) \\approx \\operatorname{Li}(x) = \\int_2^x dt/\\log t\\), which is a much better approximation.</p>' +
        '<p class="eg"><b>The heuristic you should carry.</b> Treat "being prime near \\(x\\)" as an event of probability \\(1/\\log x\\). That single heuristic predicts the twin prime count \\(\\pi_2(x) \\approx 2C_2\\int_2^x dt/(\\log t)^2\\), predicts Goldbach, and predicts the density of primes in arithmetic progressions. It is wrong in detail — primes are not random, and the correction factor \\(C_2\\) exists exactly because divisibility by small primes is correlated between \\(n\\) and \\(n+2\\) — but it is right in shape, which is remarkable.</p>',
  see: ['zeta-function', 'riemann-hypothesis', 'asymptotic', 'liouville-function']
},

'riemann-hypothesis': {
  term: 'Riemann hypothesis', match: ['Riemann hypothesis', 'RH'], kind: 'number theory',
  short: 'The conjecture that every non-trivial zero of \\(\\zeta\\) has real part exactly \\(\\tfrac12\\) — equivalently, that the primes are as evenly spread as they possibly could be.',
  body: '<p>Equivalent forms worth knowing, because they show what is really at stake: \\(\\pi(x) = \\operatorname{Li}(x) + O(\\sqrt x\\log x)\\); and \\(L(x) = \\sum_{n \\le x}\\lambda(n) \\ll x^{1/2+\\varepsilon}\\) for the Liouville function.</p>' +
        '<p class="eg"><b>Read it as a statement about cancellation.</b> A sum of \\(x\\) terms each \\(\\pm1\\) with no structure lands about \\(\\sqrt x\\) from zero — a random walk. RH says the primes are exactly that well behaved: no conspiracy, no clumping, square-root cancellation everywhere. A zero off the critical line would be a conspiracy among the primes, visible as an unexpected clump.</p>',
  fig: 'bigO',
  see: ['zeta-function', 'prime-number-theorem', 'liouville-function', 'deligne-bound']
},

/* ---------- Volume II: sieve theory ------------------------------------- */

'sieve-of-eratosthenes': {
  term: 'sieve of Eratosthenes', match: ['sieve of Eratosthenes', 'Eratosthenes'], kind: 'number theory',
  short: 'Write out the numbers, cross out every multiple of 2, then of 3, then of 5… and whatever is left standing is prime.',
  body: '<p>To find the primes up to 100: list 2 to 100; cross out multiples of 2 (keeping 2 itself), then of 3, then of 5, then of 7. Stop — \\(11^2 &gt; 100\\), so anything still standing has no factor below its own square root and is prime. Two thousand two hundred years old, and still the fastest way to list small primes.</p>' +
        '<p class="eg"><b>Sieve <i>theory</i> asks a harder question.</b> Do not list the survivors — <b>count</b> them, accurately enough to be useful. Crossing out multiples of 2 removes about half; of the rest, multiples of 3 remove about a third; and the estimate \\(x\\prod_{p&lt;z}(1-1/p)\\) writes itself. The trouble is every "about" is an error, and there are exponentially many of them. Making the total error smaller than the thing being estimated is the entire subject.</p>',
  fig: 'sieve',
  see: ['sifting-function', 'inclusion-exclusion', 'mertens', 'sieve-axiom']
},

'sifting-function': {
  term: 'sifting function', match: ['sifting function', 'S(\\mathcal{A}', 'survivors', 'sifted set'], kind: 'number theory',
  short: 'The count of members of your set that survive removing every multiple of every small prime.',
  body: '<p>\\(S(\\mathcal{A},\\mathcal{P},z) = \\#\\{a \\in \\mathcal{A} : \\gcd(a, P(z)) = 1\\}\\), where \\(P(z)\\) is the product of the sifting primes below \\(z\\). This single number is what every theorem in Vol. II is about.</p>' +
        '<p class="eg"><b>What the survivors actually are.</b> If you sift \\(\\{n \\le x\\}\\) by all primes below \\(\\sqrt x\\), the survivors are exactly the primes in \\((\\sqrt x, x]\\) — that is the dream. If you can only sift up to \\(z = \\log x\\), the survivors are merely "numbers with no small factor", which is a much weaker prize. <b>How far you can push \\(z\\) is the whole game</b>, and Vol. II §1 shows Legendre\'s exact method cannot push past about \\(\\log x\\).</p>',
  fig: 'sieve',
  see: ['sieve-of-eratosthenes', 'sieve-axiom', 'level-of-distribution', 'almost-prime']
},

'sieve-axiom': {
  term: 'sieve axiom', match: ['sieve axiom', '|\\mathcal{A}_d|', 'density function g'], kind: 'number theory',
  short: 'The only information a sieve is ever given: for each \\(d\\), how many members of your set are divisible by \\(d\\).',
  body: '<p>\\(|\\mathcal{A}_d| = X g(d) + r_d\\), where \\(X\\) is the size of the set, \\(g\\) is a multiplicative "expected density" and \\(r_d\\) is an error you hope is small.</p>' +
        '<p class="eg"><b>Hold on to the restriction — it becomes an impossibility theorem.</b> A sieve consumes the numbers \\(|\\mathcal{A}_d|\\) and nothing else. So whatever bound it outputs must be valid for <i>every</i> set with those same counts. In §4 Selberg exhibits two sets with identical counts and opposite prime content, and the method is dead on arrival. This is exactly the shape of an adversary argument in complexity theory: to prove a procedure cannot work, feed it two inputs it cannot tell apart.</p>' +
        '<p>For \\(\\mathcal{A} = \\{n \\le x\\}\\): \\(g(d) = 1/d\\) and \\(|r_d| &lt; 1\\). For twin primes \\(\\mathcal{A} = \\{n(n+2) : n\\le x\\}\\): each prime \\(p\\) rules out two residue classes, so \\(g(p) = 2/p\\) — and that 2 is the sieve\'s <b>dimension</b>.</p>',
  see: ['sifting-function', 'multiplicative', 'error-term', 'sifting-dimension', 'parity-problem']
},

'inclusion-exclusion': {
  term: 'inclusion–exclusion', match: ['inclusion–exclusion', 'inclusion-exclusion', 'Legendre\u2019s sieve', 'Legendre sieve'], kind: 'combinatorics',
  short: 'Count everything, subtract the double-counting, add back what you subtracted twice, and keep alternating until it is exact.',
  body: '<p>To count things in neither \\(A\\) nor \\(B\\): total \\(-|A| - |B| + |A\\cap B|\\). With many sets it becomes \\(\\sum_d \\mu(d)|\\mathcal{A}_d|\\) — the Möbius function supplies the alternating signs automatically.</p>' +
        '<p class="eg"><b>Exact, and useless.</b> Legendre\'s sieve is a genuine identity, not an estimate. But it has one error term for <i>every squarefree divisor</i> of \\(P(z)\\), and there are \\(2^{\\pi(z)}\\) of those. Each \\(|r_d| &lt; 1\\), yet \\(2^{\\pi(z)}\\) of them overwhelm a main term of size \\(x/\\log z\\) as soon as \\(z \\gtrsim \\log x\\). Drag \\(x\\) from \\(10^3\\) to \\(10^{30}\\) in Fig. 2 and the usable range for \\(z\\) creeps from about 20 to about 510, while \\(\\sqrt x\\) climbs to \\(10^{15}\\). <b>Exactness is what costs you.</b></p>',
  fig: 'incexcl',
  see: ['mobius-function', 'error-term', 'bonferroni', 'sifting-function']
},

'mobius-function': {
  term: 'Möbius function', match: ['Möbius function', '\\mu(d)', '\\mu(n)'], kind: 'number theory',
  short: 'The sign-keeper of inclusion–exclusion: \\(+1\\), \\(-1\\) or \\(0\\), depending on how \\(n\\) factors.',
  body: '<p>\\(\\mu(1) = 1\\); \\(\\mu(n) = (-1)^k\\) if \\(n\\) is a product of \\(k\\) distinct primes; \\(\\mu(n) = 0\\) if any prime is repeated. So \\(\\mu(6) = 1\\), \\(\\mu(30) = -1\\), \\(\\mu(12) = 0\\).</p>' +
        '<p class="eg"><b>The one identity it exists for.</b> \\(\\sum_{d \\mid n}\\mu(d) = 1\\) if \\(n=1\\), and \\(0\\) otherwise. That is a perfect detector: sum it over the divisors of \\(\\gcd(a, P(z))\\) and you get 1 exactly when \\(a\\) survived sifting. <i>Every</i> sieve is a modification of this detector — Brun truncates it, Selberg squares an approximation to it, and Fig. 5 of Vol. II shows that at full level Selberg\'s optimum <b>is</b> \\(\\mu\\).</p>' +
        '<p>The zeros at non-squarefree \\(n\\) are why "squarefree" appears everywhere in the subject: those terms simply are not there.</p>',
  see: ['inclusion-exclusion', 'squarefree', 'multiplicative', 'liouville-function']
},

'squarefree': {
  term: 'squarefree', match: ['squarefree', 'square-free'], kind: 'number theory',
  short: 'A number with no repeated prime factor — like 30 = 2·3·5, unlike 12 = 2²·3.',
  body: '<p>Equivalently, \\(\\mu(n) \\neq 0\\). About \\(6/\\pi^2 \\approx 61\\%\\) of all integers are squarefree.</p>' +
        '<p class="eg"><b>Why it is everywhere in Vol. II.</b> The Möbius function vanishes on non-squarefree numbers, so every sieve sum is automatically a sum over squarefree \\(d\\). And since \\(P(z)\\) is a product of <i>distinct</i> primes, its divisors are squarefree by construction. When you read "\\(d \\mid P(z)\\)", read "\\(d\\) is a product of some subset of the sifting primes" — and that is why there are \\(2^{\\pi(z)}\\) of them: one per subset.</p>',
  see: ['mobius-function', 'inclusion-exclusion']
},

'mertens': {
  term: 'Mertens\u2019 theorem', match: ['Mertens', 'Mertens\u2019 theorem'], kind: 'number theory',
  short: 'The product \\(\\prod_{p<z}(1-1/p)\\) shrinks like \\(e^{-\\gamma}/\\log z\\) — slowly, which is the source of much grief.',
  body: '<p>Precisely, \\(\\prod_{p&lt;z}(1-1/p) \\sim e^{-\\gamma}/\\log z\\), where \\(\\gamma \\approx 0.5772\\) is the Euler–Mascheroni constant. Equivalently \\(\\sum_{p&lt;z}1/p = \\log\\log z + M + o(1)\\).</p>' +
        '<p class="eg"><b>Read the rate, and despair a little.</b> \\(1/\\log z\\) is a <i>very</i> slow decay. To halve the survivor density you must square \\(z\\). This is why sieve estimates converge so glacially in practice, and why the ratio in Fig. 1 of Vol. II is still only at 1.03 by \\(x = 10^6\\) when its limit is \\(2e^{-\\gamma}\\approx1.1229\\). <b>Numerical experiments mislead in this subject more than almost anywhere else in mathematics.</b></p>',
  fig: 'convergence',
  see: ['sieve-of-eratosthenes', 'asymptotic', 'euler-product', 'series-convergence']
},

'bonferroni': {
  term: 'Bonferroni inequalities', match: ['Bonferroni', 'Bonferroni inequalities', 'truncation'], kind: 'combinatorics',
  short: 'Chop the inclusion–exclusion sum short and you no longer get the truth — but you do get a guaranteed over- or under-estimate, depending on parity.',
  body: '<p>Keeping only terms with \\(\\omega(d) \\le m\\) gives an upper bound when \\(m\\) is even and a lower bound when \\(m\\) is odd. <b>Never wrong, only wasteful.</b></p>' +
        '<p class="eg"><b>Why the sign works out, element by element.</b> Fix one \\(a\\) with exactly \\(\\nu\\) sifting primes dividing it. In the full sum it contributes \\(\\sum_{j=0}^{\\nu}\\binom{\\nu}{j}(-1)^j = (1-1)^\\nu\\) — that is 1 if \\(\\nu=0\\) (it survived) and 0 otherwise. Stop at \\(j \\le m\\) and it contributes the partial alternating sum \\((-1)^m\\binom{\\nu-1}{m}\\), which is \\(\\ge 0\\) for even \\(m\\) and \\(\\le 0\\) for odd \\(m\\). Every element errs in the same direction, so summing preserves the inequality.</p>' +
        '<p><b>The payoff.</b> Truncation leaves \\(\\sum_{j\\le m}\\binom{\\pi(z)}{j} \\le \\pi(z)^m\\) terms — <i>polynomial</i> instead of exponential. Brun\'s choice \\(m \\asymp \\log\\log z\\) makes the truncation loss a factor \\(1+o(1)\\) while keeping the error controllable. That one manoeuvre opened the subject in 1919.</p>',
  fig: 'incexcl',
  see: ['inclusion-exclusion', 'brun-constant', 'error-term', 'selberg-sieve']
},

'brun-constant': {
  term: 'Brun\u2019s constant', match: ['Brun\u2019s constant', 'Brun\u2019s theorem', 'Brun'], kind: 'number theory',
  short: 'The twin primes are thin enough that adding up their reciprocals gives a finite number, about 1.902.',
  body: '<p>\\(B = \\sum_{p,\\,p+2\\ \\mathrm{both\\ prime}}\\left(\\frac1p + \\frac1{p+2}\\right) &lt; \\infty\\) — Brun, 1919, the <b>first theorem ever proved about twin primes</b>.</p>' +
        '<p class="eg"><b>Read it against Euler.</b> \\(\\sum_p 1/p\\) <i>diverges</i>, so the primes are reasonably dense. The twin sum converges, so the twins are vanishingly thin by comparison. But notice carefully what this does <b>not</b> say: a convergent sum is perfectly compatible with a <i>finite</i> set. Brun\'s theorem does not prove there are infinitely many twin primes, and no sieve of its kind ever will (§4).</p>' +
        '<p>At \\(x = 2\\times10^6\\) the partial sum has only reached 1.72. <b>Most of Brun\'s constant lives past where anyone has ever computed.</b></p>',
  fig: 'convergence',
  see: ['bonferroni', 'euler-product', 'parity-problem', 'hardy-littlewood', 'series-convergence']
},

'hardy-littlewood': {
  term: 'Hardy–Littlewood conjecture', match: ['Hardy–Littlewood', 'twin prime constant', 'C_2'], kind: 'number theory',
  short: 'A precise prediction for how many twin primes there are up to \\(x\\) — matching reality to within a percent, and provable by nobody.',
  body: '<p>\\(\\pi_2(x) \\sim 2C_2\\int_2^x \\frac{dt}{(\\log t)^2}\\), where \\(C_2 = \\prod_{p&gt;2}\\left(1 - \\frac{1}{(p-1)^2}\\right) \\approx 0.6602\\).</p>' +
        '<p class="eg"><b>Where the formula comes from, and where the constant comes from.</b> Treat primality near \\(t\\) as probability \\(1/\\log t\\); if \\(n\\) and \\(n+2\\) were independent you would predict \\(\\int dt/(\\log t)^2\\). They are not independent — knowing \\(p \\nmid n\\) changes the odds that \\(p \\nmid n+2\\) — and \\(2C_2\\) is precisely the accumulated correction over all primes. <b>The heuristic gets the shape right and the constant is the price of the correlations.</b> It fits the data to within a percent, and it is a conjecture no sieve will ever prove, for reasons in §4.</p>',
  see: ['brun-constant', 'prime-number-theorem', 'parity-problem', 'admissible-tuple']
},

'selberg-sieve': {
  term: 'Selberg sieve', match: ['Selberg sieve', 'Selberg’s sieve', '\lambda_d', 'Selberg'], kind: 'number theory',
  short: 'Instead of throwing terms away, keep them all with unknown coefficients — then choose the coefficients that minimise the bound.',
  body: '<p>The trick is one line. For any reals \\(\\lambda_d\\) with \\(\\lambda_1 = 1\\), \\(\\mathbf{1}[\\gcd(a,P(z))=1] \\le \\left(\\sum_{d\\mid\\gcd(a,P(z)),\\,d\\le D}\\lambda_d\\right)^2\\), because the left side is 0 or 1, and when it is 1 the only surviving term on the right is \\(d=1\\), giving \\(\\lambda_1^2 = 1\\). Squares are non-negative, so the inequality is free.</p>' +
        '<p class="eg"><b>Then it is undergraduate linear algebra.</b> Summing over \\(a\\) turns the right-hand side into a positive-definite quadratic form in the \\(\\lambda\\), subject to one linear constraint \\(\\lambda_1 = 1\\). Minimising that is a standard exercise; Selberg\'s contribution was the substitution that diagonalises it, giving \\(\\min Q = 1/G(D)\\) in closed form.</p>' +
        '<p><b>The lesson of Fig. 5.</b> Set \\(D = 30\\) and try \\(\\lambda = \\mu\\): you land exactly on the optimum and exactly on the truth. At full level the sieve loses <i>nothing</i> — it simply is inclusion–exclusion. Every loss in a real application comes from the restriction \\(d \\le D\\), which exists only to keep the error terms controllable. <b>You are not limited by the sieve; you are limited by your level of distribution.</b></p>',
  see: ['quadratic-form', 'level-of-distribution', 'mobius-function', 'bonferroni']
},

'quadratic-form': {
  term: 'quadratic form', match: ['quadratic form', 'positive-definite', 'positive definite'], kind: 'algebra',
  short: 'A sum of products of pairs of variables — the multi-variable version of \\(ax^2\\), and something you can always minimise.',
  body: '<p>\\(Q(\\lambda) = \\sum_{i,j}c_{ij}\\lambda_i\\lambda_j\\). It is <b>positive-definite</b> if \\(Q(\\lambda) &gt; 0\\) for every \\(\\lambda \\neq 0\\) — a bowl, not a saddle.</p>' +
        '<p class="eg"><b>Why Selberg\'s move is so clean.</b> A positive-definite quadratic form restricted to a linear constraint has a unique minimum, found by ordinary linear algebra (Lagrange multipliers, or just completing the square in the right coordinates). So "optimise the sieve" is not a search, it is a solve. Contrast Brun, who had to <i>guess</i> a truncation point.</p>',
  see: ['selberg-sieve', 'vector-space']
},

'level-of-distribution': {
  term: 'level of distribution', match: ['level of distribution', 'level D', 'the level'], kind: 'number theory',
  short: 'How far you can control the error terms on average — and therefore how large a sieve you are allowed to run.',
  body: '<p>You need \\(\\sum_{d \\le D}|r_d|\\) to stay below the main term. The largest usable \\(D\\) is your level of distribution, usually written \\(x^\\theta\\).</p>' +
        '<p class="eg"><b>The currency of the entire field.</b> For \\(\\mathcal{A} = \\{n\\le x\\}\\) it is free. For \\(\\mathcal{A} = \\{p-2 : p \\le x\\}\\) it is a deep theorem: <b>Bombieri–Vinogradov</b> (1965) gives \\(\\theta = 1/2 - \\varepsilon\\) unconditionally — "as good as the Riemann hypothesis would give, on average over moduli". Pushing past \\(1/2\\) is the <b>Elliott–Halberstam conjecture</b>, still open, and getting a sliver past \\(1/2\\) for smooth moduli is precisely what Zhang achieved in 2013. Every headline result in the subject is a level-of-distribution result in disguise.</p>',
  see: ['error-term', 'selberg-sieve', 'bounded-gaps', 'main-term']
},

'parity-problem': {
  term: 'parity problem', match: ['parity problem', 'parity obstruction', 'the parity barrier', 'parity'], kind: 'number theory',
  short: 'A sieve cannot tell a prime from a product of two primes — so it can never prove a sifted set is non-empty.',
  body: '<p>Selberg\'s construction: let \\(\\mathcal{A}^+ = \\{n \\le x : \\Omega(n)\\text{ even}\\}\\) and \\(\\mathcal{A}^- = \\{n\\le x : \\Omega(n)\\text{ odd}\\}\\). Because \\(\\sum_{n\\le x,\\ d\\mid n}\\lambda(n) = o(x/d)\\), both sets satisfy \\(|\\mathcal{A}^{\\pm}_d| = \\tfrac12\\cdot\\tfrac{x}{d} + \\text{small}\\) — <b>identical sieve data</b>. But every prime lies in \\(\\mathcal{A}^-\\) (primes have \\(\\Omega = 1\\)) and none in \\(\\mathcal{A}^+\\).</p>' +
        '<p class="eg"><b>Why this is a theorem and not a failure of imagination.</b> Fix <i>any</i> procedure whose only inputs are the numbers \\(|\\mathcal{A}_d|\\) and which always outputs a correct lower bound. Feed it \\(\\mathcal{A}^+\\): correctness forces the output \\(\\le 0\\), since the truth there is 0. Now feed it \\(\\mathcal{A}^-\\) — the inputs are essentially the same numbers, so the output is the same \\(\\le 0\\). <b>The procedure never learns anything.</b> Same shape as an adversary argument in complexity theory, or an information-theoretic lower bound.</p>' +
        '<p><b>What it does not block:</b> upper bounds (fine, just off by a factor of about 2); results about numbers with a bounded number of prime factors (Chen); and anything that injects non-sieve information (§6).</p>',
  fig: 'parity',
  see: ['liouville-function', 'sieve-axiom', 'chen-theorem', 'bilinear-forms', 'bounded-gaps']
},

'liouville-function': {
  term: 'Liouville function', match: ['Liouville function', '\\lambda(n)', '\\Omega(n)', 'Omega function'], kind: 'number theory',
  short: '\\(\\lambda(n) = (-1)^{\\Omega(n)}\\): plus one if \\(n\\) has an even number of prime factors, minus one if odd.',
  body: '<p>\\(\\Omega(n)\\) counts prime factors <b>with multiplicity</b>: \\(\\Omega(12) = \\Omega(2^2\\cdot3) = 3\\). (Its cousin \\(\\omega(n)\\) counts <i>distinct</i> primes, so \\(\\omega(12) = 2\\); the two appear side by side constantly, so watch the case.)</p>' +
        '<p class="eg"><b>Why it is the perfect weapon against sieves.</b> \\(\\lambda\\) is invisible to divisor counting — its partial sums \\(L(x) = \\sum_{n\\le x}\\lambda(n)\\) stay microscopic relative to \\(x\\), inside every residue class. In fact \\(L(x) = o(x)\\) is <i>equivalent</i> to the prime number theorem, and \\(L(x)\\ll x^{1/2+\\varepsilon}\\) is equivalent to the Riemann hypothesis. So the bias a sieve would need to detect is exactly as small as the primes are well behaved. Identical inputs, opposite answers — and that is the entire proof of impossibility.</p>',
  fig: 'parity',
  see: ['parity-problem', 'prime-number-theorem', 'riemann-hypothesis', 'mobius-function']
},

'sifting-dimension': {
  term: 'sifting dimension', match: ['dimension \u03ba', 'sifting density', 'linear sieve', '\\kappa'], kind: 'number theory',
  short: 'How many residue classes each prime removes — one for the integers, two for twin primes, and it controls everything.',
  body: '<p>Defined by \\(\\prod_{w\\le p&lt;z}(1-g(p))^{-1} \\sim (\\log z/\\log w)^{\\kappa}\\). Sifting \\(\\{n\\le x\\}\\) by all primes gives \\(g(p)=1/p\\) and \\(\\kappa=1\\), the <b>linear sieve</b>. Sifting \\(n(n+2)\\) removes two classes mod \\(p\\), so \\(g(p)=2/p\\) and \\(\\kappa=2\\).</p>' +
        '<p class="eg"><b>Dimension is destiny.</b> Every quantitative feature of a sieve — the strength of its upper bound, the threshold where a lower bound switches on, the factor it is off by — is a function of \\(\\kappa\\) alone. Higher dimension means each prime is doing more damage, so less survives and less can be proved. The factor-of-2 slack in linear-sieve upper bounds becomes a factor of 4 in dimension 2.</p>',
  see: ['fundamental-lemma', 'sieve-axiom', 'parity-problem']
},

'fundamental-lemma': {
  term: 'fundamental lemma of sieve theory', match: ['fundamental lemma', 'sieve functions'], kind: 'number theory',
  short: 'Sandwich bounds for the sifted count, with explicit factors that tend to 1 once you sift gently enough.',
  body: '<p>With level \\(D\\) and \\(s = \\log D/\\log z\\), there are functions \\(F_\\kappa \\ge 1 \\ge f_\\kappa\\) with \\(XV(z)f_\\kappa(s) \\lesssim S \\lesssim XV(z)F_\\kappa(s)\\), where \\(V(z) = \\prod_{p&lt;z}(1-g(p))\\). Both tend to 1 rapidly as \\(s\\to\\infty\\).</p>' +
        '<p class="eg"><b>Where the parity problem shows up in the formulas.</b> \\(f_\\kappa(s) \\le 0\\) below a threshold \\(\\beta_\\kappa\\) — and a "lower bound" of \\(\\le 0\\) tells you nothing. For \\(\\kappa=1\\), \\(f(2)=0\\) exactly: <b>below \\(s=2\\) the linear sieve gives no lower bound at all.</b> With Bombieri–Vinogradov level \\(D = x^{1/2}\\), \\(s=2\\) means \\(z = x^{1/4}\\), so survivors may have up to 3 prime factors. That is precisely why classical sieves deliver \\(P_3\\), and why squeezing down to \\(P_2\\) needed Chen\'s extra switching trick.</p>',
  see: ['sifting-dimension', 'parity-problem', 'level-of-distribution', 'almost-prime']
},

'almost-prime': {
  term: 'almost prime', match: ['almost prime', 'almost-prime', 'P_2', 'P_3', 'bounded number of prime factors'], kind: 'number theory',
  short: 'A number with at most \\(r\\) prime factors — written \\(P_r\\), the consolation prize sieves can actually deliver.',
  body: '<p>\\(P_2\\) means "prime, or a product of two primes". Sieves reach \\(P_r\\) for small \\(r\\) but cannot reach \\(P_1\\) = prime.</p>' +
        '<p class="eg"><b>This is the parity problem made concrete.</b> A \\(P_2\\) has \\(\\Omega = 2\\) (even) and a prime has \\(\\Omega = 1\\) (odd) — exactly the distinction \\(\\lambda(n)\\) hides from a sieve. So \\(P_2\\) statements sit comfortably <i>inside</i> the barrier, because they are deliberately parity-ambiguous. Chen\'s theorem (every large even \\(N\\) is \\(p + P_2\\)) is the sharpest thing the classical machinery can reach, and there is a proof that it cannot be sharpened to \\(P_1\\) by these means.</p>',
  see: ['parity-problem', 'chen-theorem', 'fundamental-lemma']
},

'chen-theorem': {
  term: 'Chen\u2019s theorem', match: ['Chen\u2019s theorem', 'Chen', 'switching'], kind: 'number theory',
  short: 'Every large even number is a prime plus a number with at most two prime factors — the closest anyone has come to Goldbach.',
  body: '<p>Chen Jingrun, 1973, using a weighted sieve plus a "switching" trick that reuses the sieve in a second, cleverer way to kill the bad configurations.</p>' +
        '<p class="eg"><b>Notice what it respects.</b> Goldbach asks for \\(N = p + p\'\\), both prime. Chen delivers \\(N = p + P_2\\). That gap is not laziness — it is the parity barrier, obeyed exactly. Chen\'s result is universally regarded as the ceiling of what a parity-respecting method can do on this problem, and nothing in fifty years has improved on it.</p>',
  see: ['almost-prime', 'parity-problem', 'fundamental-lemma']
},

'bilinear-forms': {
  term: 'bilinear (Type II) sums', match: ['bilinear', 'Type II', 'Type I'], kind: 'number theory',
  short: 'Sums over products \\(mn\\) with arbitrary weights on each factor — information about <i>how</i> a number factors, which is exactly what a sieve lacks.',
  body: '<p>\\(\\sum_m\\sum_n \\alpha_m\\beta_n\\mathbf{1}[mn \\in \\mathcal{A}]\\), with \\(\\alpha,\\beta\\) arbitrary. Controlling such sums is genuinely more than knowing the counts \\(|\\mathcal{A}_d|\\).</p>' +
        '<p class="eg"><b>Why this breaks parity rather than dodging it.</b> The parity obstruction assumes the method sees only \\(|\\mathcal{A}_d|\\). A Type II sum is sensitive to the <i>shape</i> of a factorisation — exactly the information \\(\\lambda(n)\\) conceals. Once you have it, the two indistinguishable sets become distinguishable and the barrier simply does not apply. Friedlander–Iwaniec\'s theorem that \\(x^2+y^4\\) is prime infinitely often works this way, as does Vinogradov\'s three-primes theorem and the whole Type I / Type II decomposition behind Vaughan\'s identity.</p>' +
        '<p><b>Modern analytic number theory is largely the study of how to obtain Type II information for sequences you care about.</b></p>',
  see: ['parity-problem', 'level-of-distribution', 'bounded-gaps']
},

'bounded-gaps': {
  term: 'bounded gaps between primes', match: ['bounded gaps', 'Zhang', 'Maynard', 'GPY'], kind: 'number theory',
  short: 'Infinitely often, two primes are within a fixed distance of each other — proved in 2013, without ever beating the parity problem.',
  body: '<p>Goldston–Pintz–Yıldırım, then Zhang (gaps \\(\\le 7\\times10^7\\)), then Maynard and Tao independently, then Polymath8b (gaps \\(\\le 246\\)).</p>' +
        '<p class="eg"><b>How it sidesteps parity rather than defeating it.</b> Take an admissible tuple \\(\\{h_1,\\dots,h_k\\}\\) and Selberg-type weights \\(w_n\\), then show \\(\\sum_n w_n\\left(\\sum_i\\mathbf{1}[n+h_i\\text{ prime}] - 1\\right) &gt; 0\\). A positive sum forces <i>some</i> \\(n\\) with at least two primes among the \\(n+h_i\\) — but tells you nothing about <b>which</b> \\(i\\). The method never has to distinguish a prime from a \\(P_2\\) at a named location, so parity never gets a chance to object.</p>' +
        '<p>That is also why the answer is "gaps \\(\\le 246\\)" and not "twin primes". Even assuming every conjecture in sight, the method reaches gap 6, not 2. <b>The size of the bound is an artefact; the shape of the result is structural.</b> Maynard\'s improvement was multidimensional weights \\(\\lambda_{d_1,\\dots,d_k}\\), which is why his method also gives bounded gaps between \\(m\\) primes for every \\(m\\).</p>',
  see: ['parity-problem', 'admissible-tuple', 'level-of-distribution', 'selberg-sieve']
},

'admissible-tuple': {
  term: 'admissible tuple', match: ['admissible tuple', 'admissible'], kind: 'number theory',
  short: 'A set of offsets that does not cover all residues modulo any prime — so it is not ruled out from containing many primes.',
  body: '<p>\\(\\{h_1,\\dots,h_k\\}\\) is admissible if for every prime \\(p\\) the \\(h_i\\) miss at least one residue class mod \\(p\\). \\(\\{0,2\\}\\) is admissible. \\(\\{0,2,4\\}\\) is <b>not</b>: mod 3 it hits every class, so one of \\(n, n+2, n+4\\) is always divisible by 3, and the only prime triple of that shape is \\(3,5,7\\).</p>' +
        '<p class="eg"><b>The role it plays.</b> Admissibility is the obvious necessary condition for the tuple to be prime infinitely often; the Hardy–Littlewood \\(k\\)-tuple conjecture says it is also sufficient. Bounded-gaps results take an admissible tuple as short as possible and prove two of its entries are simultaneously prime infinitely often. Shrinking the tuple (a combinatorial optimisation problem in its own right) is how 70 000 000 became 246.</p>',
  see: ['bounded-gaps', 'hardy-littlewood']
},

'residue-class': {
  term: 'residue class', match: ['residue class', 'residue classes', 'congruence', 'modulo', 'mod'], kind: 'number theory',
  short: 'All numbers leaving the same remainder when divided by \\(m\\) — clock arithmetic.',
  body: '<p>\\(a \\equiv b \\pmod m\\) means \\(m\\) divides \\(a-b\\). The residue classes mod 3 are \\(\\{\\dots,0,3,6,\\dots\\}\\), \\(\\{\\dots,1,4,7,\\dots\\}\\), \\(\\{\\dots,2,5,8,\\dots\\}\\) — three classes partitioning the integers.</p>' +
        '<p class="eg"><b>Why a sieve is a statement about residue classes.</b> "Cross out multiples of \\(p\\)" means "delete one residue class mod \\(p\\)". For twin primes you delete <i>two</i> classes (those killing \\(n\\) and those killing \\(n+2\\)), which is the whole reason that sieve has dimension 2. And the deep inputs of the field — Bombieri–Vinogradov, Elliott–Halberstam — are statements about how evenly the primes spread across residue classes.</p>',
  see: ['sieve-axiom', 'sifting-dimension', 'level-of-distribution']
},

'gcd': {
  term: 'gcd and coprime', match: ['\\gcd', 'gcd', 'coprime', 'relatively prime'], kind: 'number theory',
  short: 'The largest number dividing both; coprime means that number is 1, i.e. they share no prime factor.',
  body: '<p>\\(\\gcd(12,18) = 6\\). \\(\\gcd(9,10) = 1\\), so 9 and 10 are coprime even though neither is prime.</p>' +
        '<p class="eg"><b>Where it does the work in Vol. II.</b> The sifting function is literally \\(\\#\\{a : \\gcd(a, P(z)) = 1\\}\\) — "shares no factor with any sifting prime". And multiplicativity, \\(f(mn)=f(m)f(n)\\), is only claimed <i>for coprime \\(m,n\\)</i>; drop that hypothesis and it is false.</p>',
  see: ['sifting-function', 'multiplicative', 'squarefree']
},

/* ---------- Volume III: Gödel & formal language -------------------------- */

'formal-language': {
  term: 'formal language', match: ['formal language', 'formalisation', 'formalise', 'formal system'], kind: 'logic',
  short: 'A fixed alphabet plus a grammar, so that "statement" and "proof" become things you can check without understanding them.',
  body: '<p>Ordinary mathematical prose is fine for talking to humans and hopeless as an <i>object of study</i>. You cannot prove a theorem about "all possible proofs" if a proof is a persuasive essay.</p>' +
        '<p class="eg"><b>So you fix four things.</b> (1) A finite alphabet of symbols. (2) A grammar saying which strings count as statements. (3) A finite list of axioms. (4) A finite list of rules, each a purely typographical operation on strings. Then "proof" means "a finite list of strings, each an axiom or obtained from earlier ones by a rule" — checkable by a machine that understands nothing.</p>' +
        '<p>That move is Hilbert\'s, and it is what makes Gödel\'s theorems possible: once proof is concrete, it is something you can do mathematics <b>to</b>. It is also exactly what makes Lean possible (Vol. IV).</p>',
  fig: 'tree',
  see: ['term-formula', 'deductive-system', 'godel-numbering', 'peano-arithmetic']
},

'term-formula': {
  term: 'terms and formulas', match: ['terms and formulas', 'atomic formula', 'well-formed', 'a formula', 'formulas'], kind: 'logic',
  short: 'Terms name objects; formulas make claims about them. Both are defined by building up from the smallest pieces.',
  body: '<p><b>Terms</b>: \\(0\\) is a term, every variable is a term, and if \\(s,t\\) are terms so are \\(S(t)\\), \\((s+t)\\), \\((s\\cdot t)\\). <b>Atomic formulas</b>: \\(s = t\\) and \\(s &lt; t\\). <b>Formulas</b>: atomic ones, closed under \\(\\neg, \\wedge, \\vee, \\to, \\forall v, \\exists v\\).</p>' +
        '<p class="eg"><b>"The smallest set closed under…" is doing real work.</b> It licenses <b>proof by induction on the structure of a formula</b>: to prove something about every formula, prove it for atoms and show each construction step preserves it. That is the workhorse of every proof in logic — and it is exactly why Lean\'s inductive types (Vol. IV §4) look the way they do. Same idea, two centuries apart.</p>' +
        '<p>There is no symbol for "prime", "divides" or "continuous". Everything else must be <i>defined</i> as an abbreviation for a string built from this tiny vocabulary.</p>',
  fig: 'tree',
  see: ['formal-language', 'free-bound', 'quantifier', 'inductive-type']
},

'free-bound': {
  term: 'free and bound variables', match: ['free variable', 'free variables', 'bound', 'sentence'], kind: 'logic',
  short: 'A variable is bound if a quantifier has captured it, free if it is still dangling — and only formulas with nothing dangling have truth values.',
  body: '<p>In \\(\\exists y\\,(x &lt; y)\\), the \\(y\\) is bound and the \\(x\\) is free. A formula with no free variables is a <b>sentence</b>.</p>' +
        '<p class="eg"><b>Why the distinction is not pedantry.</b> "\\(x &lt; y\\)" is neither true nor false — it depends what \\(x\\) and \\(y\\) are. "\\(\\forall x\\,\\exists y\\,(x&lt;y)\\)" is a sentence, and it is true of \\(\\mathbb{N}\\). Only sentences can be theorems. The whole diagonal lemma is an exercise in taking a formula with exactly one free variable and substituting a specific number into it, so keeping track of what is free is the entire bookkeeping of Gödel\'s paper.</p>',
  fig: 'quantifier',
  see: ['term-formula', 'quantifier', 'diagonal-lemma']
},

'quantifier': {
  term: 'quantifier', match: ['quantifier', 'quantifiers', 'universal quantifier', 'existential'], kind: 'logic',
  short: '\\(\\forall\\) says "every", \\(\\exists\\) says "at least one" — and the order you write them in changes everything.',
  body: '<p>\\(\\forall x\\,\\exists y\\,(x &lt; y)\\) says every number has something bigger: true. \\(\\exists y\\,\\forall x\\,(x &lt; y)\\) says one number is bigger than everything: false. <b>Same symbols, swapped order, opposite truth value.</b></p>' +
        '<p class="eg"><b>Bounded quantifiers are the ones that matter for computation.</b> \\(\\forall x &lt; t\\) and \\(\\exists x &lt; t\\) range over a finite range, so they can be <i>checked by a finite search</i>. A formula built only from bounded quantifiers (class \\(\\Delta_0\\)) defines a decidable property. An unbounded \\(\\exists\\) in front of a \\(\\Delta_0\\) body gives \\(\\Sigma_1\\) — semi-decidable, which is exactly the shape of "there exists a proof". Everything downstream turns on that.</p>',
  fig: 'quantifier',
  see: ['free-bound', 'arithmetic-hierarchy', 'decidable', 'provability-predicate']
},

'arithmetic-hierarchy': {
  term: 'arithmetic hierarchy', match: ['arithmetic hierarchy', '\\Sigma_1', '\\Delta_0', 'Sigma_1', 'Delta_0'], kind: 'logic',
  short: 'Classifying statements by how many unbounded quantifier alternations they need — which is the same as classifying by how hard they are to check.',
  body: '<p>\\(\\Delta_0\\): only bounded quantifiers — <b>decidable</b> by finite search. \\(\\Sigma_1\\): one unbounded \\(\\exists\\) over a \\(\\Delta_0\\) body — <b>semi-decidable</b>. \\(\\Pi_1\\): one unbounded \\(\\forall\\). Then \\(\\Sigma_2, \\Pi_2\\) and upward, alternating.</p>' +
        '<p class="eg"><b>The asymmetry that runs through the whole volume.</b> \\(\\Sigma_1\\) statements are semi-decidable: if true, you can confirm it by finding the witness; if false, you search forever. \\(\\mathrm{Prov}_T(f) = \\exists p\\,\\mathrm{Prf}_T(p,f)\\) is \\(\\Sigma_1\\), so provability is semi-decidable — you can confirm a proof exists by finding it, but never confirm none exists by searching. Gödel\'s sentence \\(G = \\neg\\mathrm{Prov}\\) is therefore \\(\\Pi_1\\): a statement that no proof exists, which is precisely the kind you cannot verify by search.</p>' +
        '<p><b>\\(\\Sigma_1\\)-completeness</b>: every true \\(\\Sigma_1\\) sentence is provable even in the weak theory \\(Q\\). That is the engine of step 2 of the incompleteness proof.</p>',
  fig: 'search',
  see: ['quantifier', 'decidable', 'provability-predicate', 'representability']
},

'decidable': {
  term: 'decidable', match: ['decidable', 'decidability', 'computably enumerable', 'recursively enumerable', 'semi-decidable'], kind: 'computability',
  short: 'Decidable: a machine always answers yes or no. Semi-decidable: it answers yes eventually, but may never say no.',
  body: '<p>"Is \\(n\\) prime?" is decidable — trial division halts. "Is this string a valid proof of \\(\\varphi\\)?" is decidable — proof-checking is mechanical. "Does \\(\\varphi\\) have <i>some</i> proof?" is only <b>semi-decidable</b>: enumerate all strings and check each one; if a proof exists you will find it, and if not you run forever with no signal.</p>' +
        '<p class="eg"><b>This is a hypothesis of Gödel\'s theorem, not fine print.</b> The axiom set must be decidable (or at least computably enumerable), or \\(\\mathrm{Prf}_T\\) is not a recursive relation and the entire arithmetization collapses. That is exactly why "the set of all true arithmetic sentences" escapes incompleteness: it is consistent and complete, but not computably axiomatisable, so you cannot write down its \\(\\mathrm{Prov}\\) in the first place.</p>',
  fig: 'search',
  see: ['arithmetic-hierarchy', 'primitive-recursive', 'provability-predicate', 'tarski']
},

'primitive-recursive': {
  term: 'primitive recursive', match: ['primitive recursive', 'recursive function', 'recursive relation'], kind: 'computability',
  short: 'Computable by loops whose length is known in advance — no searching, no risk of running forever.',
  body: '<p>Built from zero, successor and projections by composition and one scheme: define \\(f(n+1)\\) from \\(f(n)\\). Addition, multiplication, exponentiation, factorial, "the \\(n\\)th prime", "is \\(n\\) prime" — all primitive recursive. Every primitive recursive function is total: it always halts.</p>' +
        '<p class="eg"><b>Why Gödel cared so specifically.</b> He had to verify by hand, in 1931, that every string operation he needed was of this form — concatenation, substitution, "is the \\(i\\)th symbol a left bracket", and finally "\\(p\\) codes a proof of \\(f\\)". His paper grinds through forty-six such functions. That grinding is three quarters of the paper and is the real content; the famous part is four pages.</p>' +
        '<p>Not every computable function is primitive recursive — the Ackermann function halts but outgrows the whole class. Adding unbounded search (\\(\\mu\\)-recursion) gives the full <b>recursive</b> functions, equivalently the Turing-computable ones.</p>',
  fig: 'induction',
  see: ['decidable', 'godel-numbering', 'representability', 'recursor']
},

'deductive-system': {
  term: 'deductive system', match: ['deductive system', 'Hilbert system', 'axiom scheme', 'axiom schemes', 'modus ponens', 'natural deduction'], kind: 'logic',
  short: 'A decidable set of axioms plus finitely many rules — a machine for grinding out theorems with no understanding required.',
  body: '<p>The classic Hilbert presentation of propositional logic needs three axiom schemes and one rule:<br>A1. \\(\\varphi \\to (\\psi\\to\\varphi)\\)<br>A2. \\((\\varphi\\to(\\psi\\to\\chi)) \\to ((\\varphi\\to\\psi)\\to(\\varphi\\to\\chi))\\)<br>A3. \\((\\neg\\psi\\to\\neg\\varphi)\\to(\\varphi\\to\\psi)\\)<br><b>MP</b>: from \\(\\varphi\\) and \\(\\varphi\\to\\psi\\), infer \\(\\psi\\).</p>' +
        '<p class="eg"><b>An "axiom scheme" is a template, not an axiom.</b> A1 stands for infinitely many actual axioms, one per choice of \\(\\varphi\\) and \\(\\psi\\). That is fine — the <i>set</i> of instances is still decidable, which is all the theory needs.</p>' +
        '<p><b>Why deriving \\(p \\to p\\) takes five awkward lines.</b> Hilbert systems deliberately trade human ergonomics for a minimal, easily-arithmetized definition of proof. That is a feature: the fewer the rules, the easier to prove things <i>about</i> proofs. Natural deduction — and Lean — make the opposite trade, which is why the same theorem is the one-line program <code>fun x =&gt; x</code> in Vol. IV.</p>',
  see: ['formal-language', 'decidable', 'peano-arithmetic', 'curry-howard']
},

'peano-arithmetic': {
  term: 'Peano arithmetic', match: ['Peano arithmetic', 'PA', 'Robinson arithmetic', 'Q'], kind: 'logic',
  short: 'The standard first-order axioms for the natural numbers: zero, successor, plus, times, and induction.',
  body: '<p><b>PA</b> = basic axioms about \\(0, S, +, \\cdot\\) plus the <b>induction scheme</b>: for each formula \\(\\varphi\\), the axiom "if \\(\\varphi(0)\\) and \\(\\forall n(\\varphi(n)\\to\\varphi(Sn))\\) then \\(\\forall n\\,\\varphi(n)\\)". <b>Robinson arithmetic Q</b> is PA with induction removed — very weak, but enough for the <i>first</i> incompleteness theorem.</p>' +
        '<p class="eg"><b>The catch hiding in "for each formula".</b> Induction is a scheme over <i>definable</i> properties only, not over arbitrary subsets. The second-order version, quantifying over all subsets, does pin down \\(\\mathbb{N}\\) uniquely — but it is not first-order and has no complete proof system. The first-order version cannot: "is a standard natural number" is not definable, which is exactly why nonstandard models exist and why PA cannot notice them.</p>' +
        '<p>Q suffices for the first theorem; the <i>second</i> needs genuine induction, because the derivability condition D3 requires \\(T\\) to prove \\(\\Sigma_1\\)-completeness about itself.</p>',
  fig: 'induction',
  see: ['nonstandard-model', 'derivability-conditions', 'representability', 'induction-principle']
},

'induction-principle': {
  term: 'induction', match: ['induction', 'inductive'], kind: 'logic',
  short: 'Prove it for 0, prove that each case carries to the next, and you have proved it for every number.',
  body: '<p>The domino picture is exact: knock the first one over, guarantee each knocks the next, and every domino falls — even though you only did two pieces of work.</p>' +
        '<p class="eg"><b>Three faces of one idea in these volumes.</b> (1) <b>Ordinary induction</b> on \\(\\mathbb{N}\\), the axiom scheme of PA. (2) <b>Structural induction</b> on formulas — the "smallest set closed under" clause licenses it, and it is how every theorem in logic gets proved. (3) <b>Transfinite induction</b> up to \\(\\varepsilon_0\\) — the strengthened version Gentzen needed to prove Con(PA), which PA itself cannot carry out. Vol. IV shows all three are literally the same object: the <i>recursor</i> of an inductive type.</p>',
  fig: 'induction',
  see: ['peano-arithmetic', 'transfinite-induction', 'recursor', 'term-formula']
},

'model': {
  term: 'model', match: ['model', 'models', 'structure', 'satisfaction', 'semantics'], kind: 'logic',
  short: 'An actual mathematical object the symbols are about — a set with a chosen zero, a chosen addition, and so on.',
  body: '<p>An \\(L\\)-structure \\(\\mathcal{M}\\) is a set \\(M\\) together with an element for \\(0\\), functions for \\(S,+,\\cdot\\), and relations for \\(=,&lt;\\). Tarski\'s recursive definition of satisfaction then assigns truth values by induction on formula structure. Meaning arrives <i>last</i>, after all the syntax is fixed.</p>' +
        '<p class="eg"><b>Two relations you must never conflate.</b> \\(T \\vdash \\varphi\\) is <b>syntactic</b>: there exists a finite string that is a proof. Semi-decidable. \\(T \\models \\varphi\\) is <b>semantic</b>: \\(\\varphi\\) holds in <i>every</i> model of \\(T\\) — a quantification over a proper class of structures. Gödel\'s completeness theorem says these coincide for first-order logic, and that coincidence is a genuine miracle.</p>',
  see: ['completeness-theorem', 'nonstandard-model', 'tarski', 'compactness']
},

'completeness-theorem': {
  term: 'completeness theorem', match: ['completeness theorem', 'completeness'], kind: 'logic',
  short: 'Gödel 1929: in first-order logic, anything true in every model is provable. Not to be confused with incompleteness.',
  body: '<p>\\(T \\vdash \\varphi \\iff T \\models \\varphi\\). Provability and semantic consequence are the same relation.</p>' +
        '<p class="eg"><b>The two theorems are not in tension, and confusing them makes the subject incomprehensible.</b> Completeness is about <b>logic</b>: true in all models \\(\\Rightarrow\\) provable. Incompleteness is about <b>a theory</b>: PA fails to prove a sentence true in its <i>intended</i> model \\(\\mathbb{N}\\) but false in some other model of PA. So \\(G\\) is not true in all models of PA, and completeness is confirmed rather than violated.</p>' +
        '<p><b>The useful consequence.</b> "PA does not prove \\(\\varphi\\)" is <i>equivalent</i> to "there is a model of PA where \\(\\varphi\\) fails". Every independence result is therefore a model construction in disguise — which is why §6 spends its time building one.</p>',
  see: ['model', 'incompleteness', 'nonstandard-model', 'compactness']
},

'compactness': {
  term: 'compactness theorem', match: ['compactness theorem', 'compactness'], kind: 'logic',
  short: 'If every finite chunk of an infinite set of axioms has a model, the whole set has one.',
  body: '<p>An immediate corollary of completeness: proofs are finite, so if the whole set were contradictory some finite subset already would be.</p>' +
        '<p class="eg"><b>It creates nonstandard numbers before Gödel says a word.</b> Add a new constant \\(c\\) to PA along with the axioms \\(c &gt; 0\\), \\(c &gt; 1\\), \\(c &gt; 2\\), … Every <i>finite</i> subset is satisfiable in ordinary \\(\\mathbb{N}\\) — just take \\(c\\) large enough. So by compactness the whole infinite set has a model, and in it \\(c\\) exceeds every numeral. <b>First-order axioms simply cannot pin down \\(\\mathbb{N}\\)</b>, and that is arguably the deeper fact behind incompleteness.</p>',
  see: ['completeness-theorem', 'nonstandard-model', 'model']
},

'godel-numbering': {
  term: 'Gödel numbering', match: ['Gödel numbering', 'Gödel number', 'arithmetization', 'arithmetized', 'coding'], kind: 'logic',
  short: 'Assign each symbol a number, then code a whole string as one integer — so statements about strings become statements about arithmetic.',
  body: '<p>Gödel\'s device: \\(\\ulcorner s\\urcorner = 2^{c(s_1)}3^{c(s_2)}5^{c(s_3)}\\cdots p_n^{c(s_n)}\\). Unique factorisation makes this injective and invertible, and every string operation — concatenation, substitution, "is the \\(i\\)th symbol a bracket" — becomes a primitive recursive function of codes.</p>' +
        '<p class="eg"><b>Nothing depends on the choice of coding.</b> Any injective, computably invertible map from strings to numbers does the job; base-32 packing is thousands of digits shorter. Gödel used primes because in 1931 "primitive recursive" had to be verified by hand, and exponent extraction via unique factorisation is easy to write down that way.</p>' +
        '<p><b>The astronomical size is irrelevant.</b> Nobody ever computes these numbers. They only need to <i>exist</i> and be definable — the whole argument is about what the theory can express, not what anyone can evaluate.</p>',
  fig: 'coding',
  see: ['primitive-recursive', 'representability', 'provability-predicate', 'diagonal-lemma']
},

'representability': {
  term: 'representability', match: ['representability', 'representable', 'definable'], kind: 'logic',
  short: 'The bridge: every computable function can be <i>described</i> by a formula that the theory itself can reason with.',
  body: '<p>Every recursive function \\(f\\) is representable in \\(Q\\): there is a formula \\(\\Phi_f(x,y)\\) with \\(Q \\vdash \\forall y\\,(\\Phi_f(\\bar n, y) \\leftrightarrow y = \\overline{f(n)})\\). Similarly for relations, plus \\(\\Sigma_1\\)-completeness: every true \\(\\Sigma_1\\) sentence is provable.</p>' +
        '<p class="eg"><b>Why coding alone would be useless without it.</b> Turning proofs into numbers is worthless unless the theory can <i>talk</i> about the coded relations. Representability says it can. Apply it to \\(\\mathrm{Prf}_T(p,f)\\) — "\\(p\\) codes a \\(T\\)-proof of the formula coded by \\(f\\)" — which is primitive recursive because proof-checking is mechanical. You now have a \\(\\Delta_0\\) formula defining it, and the theory can express "I can prove this".</p>',
  see: ['godel-numbering', 'primitive-recursive', 'provability-predicate', 'arithmetic-hierarchy']
},

'provability-predicate': {
  term: 'provability predicate', match: ['provability predicate', 'provability', 'Prov', 'Prf', 'Box'], kind: 'logic',
  short: 'A formula \\(\\mathrm{Prov}_T(x)\\) inside the theory saying "the sentence with code \\(x\\) has a proof".',
  body: '<p>\\(\\mathrm{Prov}_T(f) := \\exists p\\,\\mathrm{Prf}_T(p,f)\\), which is \\(\\Sigma_1\\). Often written \\(\\Box\\varphi\\) for \\(\\mathrm{Prov}_T(\\ulcorner\\varphi\\urcorner)\\).</p>' +
        '<p class="eg"><b>The asymmetry that makes the whole subject work.</b> \\(\\mathrm{Prov}\\) has an unbounded existential, so provability is semi-decidable, not decidable. Meanwhile <b>truth</b> is not definable in the language at all (Tarski). Provability is definable, truth is not — and replacing "false" with "unprovable" is exactly what converts the liar paradox into a theorem instead of a contradiction.</p>',
  fig: 'search',
  see: ['representability', 'arithmetic-hierarchy', 'tarski', 'diagonal-lemma', 'derivability-conditions']
},

'diagonal-lemma': {
  term: 'diagonal lemma', match: ['diagonal lemma', 'fixed-point lemma', 'self-reference', 'diagonal', 'quine'], kind: 'logic',
  short: 'For any property ψ you can build a sentence that asserts ψ holds of its own code — with no circular definition anywhere.',
  body: '<p>For every formula \\(\\psi(x)\\) there is a sentence \\(\\theta\\) with \\(T \\vdash \\theta \\leftrightarrow \\psi(\\ulcorner\\theta\\urcorner)\\).</p>' +
        '<p class="eg"><b>The construction, and why it is not circular.</b> Substitution is computable, hence representable by a formula \\(\\mathrm{Sub}(x,y,z)\\). Set \\(\\beta(x) :\\equiv \\forall z(\\mathrm{Sub}(x,x,z)\\to\\psi(z))\\) — note the <i>doubled</i> \\(x\\), the only clever step. Let \\(b = \\ulcorner\\beta\\urcorner\\) and \\(\\theta :\\equiv \\beta(\\bar b)\\). Now \\(\\theta\\) is an ordinary sentence built by a finite mechanical procedure, with nothing self-referential in its definition. It just <i>turns out</i>, afterwards, that \\(\\ulcorner\\theta\\urcorner = \\mathrm{sub}(b,b)\\), so \\(\\theta\\) says \\(\\psi(\\ulcorner\\theta\\urcorner)\\).</p>' +
        '<p><b>You have met this before, in programming.</b> A quine cannot contain its own text — that would be infinite — but it can contain a <i>recipe</i> which, applied to itself, reproduces the text. The diagonal lemma is that exact move, with "string" replaced by "Gödel number" and "run" replaced by "substitute".</p>' +
        '<p><b>It is a theorem about substitution</b>, not about truth or paradox — \\(\\psi\\) is arbitrary. That generality is why one lemma yields Gödel, Tarski, Löb, Rice\'s theorem and Kleene\'s recursion theorem. <b>Learn them as one lemma wearing different hats.</b></p>',
  fig: 'diagonal',
  see: ['godel-numbering', 'provability-predicate', 'incompleteness', 'lob', 'tarski']
},

'incompleteness': {
  term: 'incompleteness theorem', match: ['incompleteness theorem', 'incompleteness', 'Gödel–Rosser', 'Rosser'], kind: 'logic',
  short: 'Any consistent, mechanically-checkable theory strong enough for arithmetic has a sentence it can neither prove nor refute.',
  body: '<p>The argument, once §2 and §3 are in place, is four lines. (1) Get \\(G\\) with \\(T \\vdash G \\leftrightarrow \\neg\\mathrm{Prov}_T(\\ulcorner G\\urcorner)\\). (2) If \\(T\\vdash G\\), its proof has a code \\(p\\), so \\(\\mathrm{Prf}_T(p,\\ulcorner G\\urcorner)\\) is a true \\(\\Delta_0\\) fact, so by \\(\\Sigma_1\\)-completeness \\(T\\vdash\\mathrm{Prov}_T(\\ulcorner G\\urcorner)\\), i.e. \\(T\\vdash\\neg G\\) — inconsistent. (3) So \\(T\\nvdash G\\); hence \\(\\mathrm{Prov}_T(\\ulcorner G\\urcorner)\\) is false, hence \\(G\\) is <i>true</i> in \\(\\mathbb{N}\\). (4) \\(T\\nvdash\\neg G\\) needs Rosser\'s refinement to work from mere consistency.</p>' +
        '<p class="eg"><b>Where "true but unprovable" actually comes from.</b> Step 3. The truth of \\(G\\) is established by <i>us</i>, reasoning in the metatheory about \\(\\mathbb{N}\\), using the assumption that \\(T\\) is consistent — an assumption \\(T\\) cannot use about itself. It is an ordinary argument, not mysticism, and not evidence that minds exceed machines.</p>' +
        '<p><b>And note: incompleteness follows from <i>consistency</i>.</b> An inconsistent theory proves everything and is perfectly complete. "If you are consistent, you are incomplete" — being incomplete is the good case.</p>',
  fig: 'diagonal',
  see: ['diagonal-lemma', 'consistency', 'second-incompleteness', 'nonstandard-model', 'completeness-theorem']
},

'consistency': {
  term: 'consistency', match: ['consistency', 'consistent', 'Con(T)', '\\omega-consistency', 'omega-consistent'], kind: 'logic',
  short: 'A theory is consistent if it never proves both a statement and its negation.',
  body: '<p>Formalised inside the theory as \\(\\mathrm{Con}(T) :\\equiv \\neg\\mathrm{Prov}_T(\\ulcorner 0=1\\urcorner)\\).</p>' +
        '<p class="eg"><b>Why inconsistency is catastrophic rather than merely embarrassing.</b> From a contradiction, classical logic proves <i>everything</i> (<i>ex falso quodlibet</i>). So an inconsistent theory has no content at all: every sentence and its negation are both theorems.</p>' +
        '<p><b>ω-consistency</b> is stronger: \\(T\\) never proves \\(\\exists x\\,\\varphi(x)\\) while also proving \\(\\neg\\varphi(\\bar n)\\) for every numeral \\(n\\). Gödel needed it; Rosser removed it in 1936 by replacing \\(\\mathrm{Prov}\\) with "there is a proof of \\(\\varphi\\) with no <i>shorter</i> proof of \\(\\neg\\varphi\\)". A small trick with a large payoff: plain consistency now suffices.</p>',
  see: ['incompleteness', 'second-incompleteness', 'nonstandard-model']
},

'second-incompleteness': {
  term: 'second incompleteness theorem', match: ['second incompleteness', 'second theorem', 'Hilbert’s programme', 'Hilbert programme'], kind: 'logic',
  short: 'No consistent theory strong enough for arithmetic can prove its own consistency.',
  body: '<p>Formalise step 2 of the first theorem <i>inside</i> \\(T\\): this gives \\(T\\vdash\\mathrm{Con}(T)\\to G\\). Since \\(T\\nvdash G\\), we get \\(T\\nvdash\\mathrm{Con}(T)\\).</p>' +
        '<p class="eg"><b>Why Hilbert\'s programme died, and what replaced it.</b> Hilbert wanted to justify infinitary mathematics by a <i>finitary</i> consistency proof. The second theorem says the finitary part cannot even certify itself, let alone the rest. The programme in its original form is dead.</p>' +
        '<p><b>But consistency proofs still exist</b> — they just have to use genuinely stronger principles. Gentzen (1936) proved Con(PA) using transfinite induction up to \\(\\varepsilon_0\\), a principle not provable in PA yet intuitively far more evident than PA\'s full strength. That trade turned out to be enormously productive: it is the origin of ordinal analysis, and of the Goodstein story in §7.</p>',
  fig: 'wellorder',
  see: ['consistency', 'derivability-conditions', 'lob', 'gentzen', 'incompleteness']
},

'derivability-conditions': {
  term: 'derivability conditions', match: ['derivability conditions', 'Hilbert–Bernays', 'D1', 'D2', 'D3'], kind: 'logic',
  short: 'The three properties the provability predicate must have for the second theorem to go through.',
  body: '<p><b>D1</b>: \\(T\\vdash\\varphi \\Rightarrow T\\vdash\\Box\\varphi\\). <b>D2</b>: \\(T\\vdash\\Box(\\varphi\\to\\psi)\\to(\\Box\\varphi\\to\\Box\\psi)\\). <b>D3</b>: \\(T\\vdash\\Box\\varphi\\to\\Box\\Box\\varphi\\).</p>' +
        '<p class="eg"><b>D3 is the demanding one.</b> It requires \\(T\\) to prove \\(\\Sigma_1\\)-completeness <i>about itself</i> — that whenever a \\(\\Sigma_1\\) statement holds, \\(T\\) proves it. Establishing that needs genuine induction, which is exactly why Robinson arithmetic \\(Q\\) suffices for the <i>first</i> incompleteness theorem but not the second. The extra strength is not a technicality; it is the precise price of self-reflection.</p>',
  see: ['second-incompleteness', 'provability-predicate', 'lob', 'peano-arithmetic']
},

'lob': {
  term: 'Löb’s theorem', match: ['Löb’s theorem', 'Löb', 'provability logic', 'GL', 'Henkin sentence'], kind: 'logic',
  short: 'If a theory proves "if this is provable then it is true", about a specific sentence, then it already proves the sentence.',
  body: '<p>If \\(T \\vdash \\Box\\varphi\\to\\varphi\\) then \\(T\\vdash\\varphi\\). Startling on first reading: you cannot safely assert "provability implies truth" about any particular sentence unless it is already provable.</p>' +
        '<p class="eg"><b>It generalises the second theorem.</b> Take \\(\\varphi \\equiv 0=1\\): then \\(\\Box(0{=}1)\\to 0{=}1\\) is exactly \\(\\mathrm{Con}(T)\\) in contrapositive, so Löb gives \\(T\\nvdash\\mathrm{Con}(T)\\) immediately. The proof is the diagonal lemma again, applied to \\(\\psi(x):\\equiv \\mathrm{Prov}_T(x)\\to\\varphi\\).</p>' +
        '<p><b>The Henkin sentence.</b> Feed the diagonal lemma \\(\\psi(x) :\\equiv \\mathrm{Prov}_T(x)\\) instead of its negation and you get a sentence saying "I <i>am</i> provable". By Löb, it is provable. Same machine, opposite outcome — which is a good test of whether you have understood the mechanism rather than memorised the story.</p>' +
        '<p>Löb\'s theorem is what makes <b>provability logic</b> work: the modal logic <b>GL</b> is, by Solovay\'s theorem, <i>exactly</i> the set of schemes about provability that PA proves. A decidable modal logic completely characterises PA\'s view of itself.</p>',
  see: ['diagonal-lemma', 'second-incompleteness', 'derivability-conditions', 'provability-predicate']
},

'tarski': {
  term: 'Tarski’s undefinability theorem', match: ['Tarski’s undefinability', 'Tarski', 'undefinability of truth'], kind: 'logic',
  short: 'Arithmetic truth cannot be defined by any formula of arithmetic — which is why the liar paradox becomes a theorem instead of a contradiction.',
  body: '<p>There is no formula \\(\\mathrm{True}(x)\\) with \\(\\mathbb{N}\\models \\mathrm{True}(\\ulcorner\\varphi\\urcorner)\\leftrightarrow\\varphi\\) for all \\(\\varphi\\). Proof: if there were, apply the diagonal lemma to \\(\\neg\\mathrm{True}(x)\\) and get a sentence saying "I am false". Contradiction.</p>' +
        '<p class="eg"><b>The single asymmetry the whole volume rests on.</b> <i>Provability</i> is definable (it is \\(\\Sigma_1\\)); <i>truth</i> is not. The liar sentence "this is false" is genuinely paradoxical. Gödel\'s sentence "this is unprovable" is not — and the difference is entirely this. Replacing "false" with "unprovable" converts a paradox into a theorem, because the replacement is expressible and the original is not.</p>',
  fig: 'diagonal',
  see: ['diagonal-lemma', 'provability-predicate', 'decidable', 'model']
},

'nonstandard-model': {
  term: 'nonstandard model', match: ['nonstandard model', 'nonstandard', 'order type'], kind: 'logic',
  short: 'A model of the arithmetic axioms containing "numbers" you cannot reach by counting up from zero.',
  body: '<p>Every countable nonstandard model of PA has the same shape: \\(\\mathbb{N}\\) first, then a dense order of copies of \\(\\mathbb{Z}\\) with no first and no last copy — order type \\(\\mathbb{N} + \\mathbb{Z}\\cdot\\mathbb{Q}\\).</p>' +
        '<p class="eg"><b>What a model of PA + ¬Con(PA) looks like.</b> It contains an element \\(c\\) that it believes codes a proof of \\(0=1\\). Since PA really is consistent, \\(c\\) cannot be a standard number — it lives out in a \\(\\mathbb{Z}\\)-block. The model can verify, step by internal step, that \\(c\\) is a proof of \\(0=1\\); but the verification has <i>nonstandardly many</i> steps, so no contradiction ever reaches us.</p>' +
        '<p><b>And the model cannot notice.</b> "Is standard" is not expressible in the language, precisely because induction only applies to <i>definable</i> sets and the standard part is not definable. <b>"True but unprovable" always means: true in \\(\\mathbb{N}\\), false in some other model.</b> Incompleteness is not a hole in mathematics; it is the shadow cast by first-order axioms being unable to single out \\(\\mathbb{N}\\).</p>',
  see: ['compactness', 'completeness-theorem', 'peano-arithmetic', 'incompleteness']
},

'ordinal': {
  term: 'ordinal', match: ['ordinal', 'ordinals', '\\varepsilon_0', 'epsilon_0', 'Cantor normal form'], kind: 'set theory',
  short: 'Counting numbers extended past infinity: after all of 0, 1, 2, … comes ω, then ω+1, and it keeps going.',
  body: '<p>\\(\\omega\\) is the first infinite ordinal. Then \\(\\omega+1, \\omega+2, \\dots, \\omega\\cdot2, \\dots, \\omega^2, \\dots, \\omega^\\omega, \\dots\\), and \\(\\varepsilon_0 = \\omega^{\\omega^{\\omega^{\\cdots}}}\\) is the first ordinal you cannot reach from below by these operations.</p>' +
        '<p class="eg"><b>Ordinals are about order, not size.</b> \\(\\omega\\) and \\(\\omega+1\\) have the same number of elements, but different order types: \\(\\omega+1\\) has a last element and \\(\\omega\\) does not. <b>Cantor normal form</b> writes any ordinal below \\(\\varepsilon_0\\) uniquely as \\(\\omega^{a_1}c_1 + \\cdots + \\omega^{a_n}c_n\\) with descending exponents, which is what makes ordinal comparison something a program can actually do — as Fig. 6 of Vol. III does, step by step.</p>',
  fig: 'wellorder',
  see: ['well-ordering', 'transfinite-induction', 'goodstein', 'gentzen']
},

'well-ordering': {
  term: 'well-ordering', match: ['well-ordered', 'well-ordering', 'no infinite descent'], kind: 'set theory',
  short: 'An order in which every non-empty subset has a least element — equivalently, you cannot descend forever.',
  body: '<p>\\(\\mathbb{N}\\) is well-ordered. \\(\\mathbb{Z}\\) is not (descend forever). \\(\\mathbb{Q}_{\\ge0}\\) is not (halve repeatedly). Every ordinal is.</p>' +
        '<p class="eg"><b>Why this settles Goodstein\'s theorem in one line.</b> The Goodstein values explode past \\(10^{100}\\) and look obviously divergent. But replace every base by \\(\\omega\\) and you get an ordinal below \\(\\varepsilon_0\\); base-bumping leaves that ordinal <b>unchanged</b> (it is invisible to the substitution), while subtracting 1 strictly <i>decreases</i> it. A strictly decreasing sequence of ordinals cannot be infinite. Therefore the process terminates — however astronomically long it takes.</p>' +
        '<p>The values grow; the ordinal shrinks. Watch both columns at once in Fig. 6 and the theorem stops being surprising.</p>',
  fig: 'wellorder',
  see: ['ordinal', 'transfinite-induction', 'goodstein', 'induction-principle']
},

'transfinite-induction': {
  term: 'transfinite induction', match: ['transfinite induction', 'ordinal analysis', 'proof-theoretic ordinal'], kind: 'set theory',
  short: 'Induction that keeps going past ω — and exactly how far a theory can push it measures the theory\'s strength.',
  body: '<p>To prove \\(\\varphi(\\alpha)\\) for all ordinals \\(\\alpha &lt; \\lambda\\): show that whenever \\(\\varphi\\) holds for everything below \\(\\alpha\\), it holds at \\(\\alpha\\). Well-ordering is exactly what makes this valid.</p>' +
        '<p class="eg"><b>The proof-theoretic ordinal of PA is \\(\\varepsilon_0\\).</b> PA proves transfinite induction up to every \\(\\alpha &lt; \\varepsilon_0\\), and not up to \\(\\varepsilon_0\\) itself. Gentzen showed that adding induction to \\(\\varepsilon_0\\) proves Con(PA) — so \\(\\varepsilon_0\\) measures <i>precisely</i> what PA is missing. Goodstein\'s theorem needs exactly that much, which is why PA cannot prove it. <b>When you watch the ordinal ladder in Fig. 6, you are watching the proof-theoretic ordinal of arithmetic do its job.</b></p>',
  fig: 'wellorder',
  see: ['ordinal', 'well-ordering', 'gentzen', 'goodstein', 'second-incompleteness']
},

'gentzen': {
  term: 'Gentzen’s consistency proof', match: ['Gentzen', 'Gentzen’s'], kind: 'logic',
  short: 'A genuine proof that PA is consistent, using a principle PA cannot prove but which is far more obvious than PA itself.',
  body: '<p>Gentzen, 1936: Con(PA) follows from transfinite induction up to \\(\\varepsilon_0\\) together with otherwise finitary reasoning.</p>' +
        '<p class="eg"><b>Why this is not cheating, and why it matters.</b> The second incompleteness theorem forbids PA proving its own consistency, so any consistency proof must use something outside PA. Gentzen\'s something is "\\(\\varepsilon_0\\) is well-ordered" — a statement about a concrete, explicitly describable ordering, far more evident on inspection than the full strength of arithmetic. So the trade is real: you get consistency, at the cost of one transparent extra principle. That exchange launched <b>ordinal analysis</b>, the programme of measuring every theory by the ordinal it needs.</p>',
  fig: 'wellorder',
  see: ['second-incompleteness', 'transfinite-induction', 'ordinal', 'goodstein']
},

'goodstein': {
  term: 'Goodstein’s theorem', match: ['Goodstein', 'hereditary base', 'Kirby–Paris', 'Paris–Harrington', 'hydra'], kind: 'logic',
  short: 'A wildly explosive sequence of integers that always reaches zero — true, elementary to state, and unprovable in PA.',
  body: '<p>Write \\(n\\) in <b>hereditary base 2</b> (exponents themselves written in hereditary base 2, recursively): \\(266 = 2^{2^{2+1}} + 2^{2+1} + 2\\). Then <b>bump</b> every 2 to a 3, and <b>subtract 1</b>. Repeat, bumping to 4, 5, 6, … Goodstein (1944): every such sequence reaches 0.</p>' +
        '<p class="eg"><b>Why it looks false and is not.</b> Starting from 4 the values rocket past \\(10^{100}\\) within a dozen steps; the sequence terminates only after \\(3\\cdot2^{402653211}-1\\) steps. But replace each base by \\(\\omega\\): base-bumping does not change the ordinal, subtracting 1 strictly decreases it, and \\(\\varepsilon_0\\) is well-ordered. Three lines.</p>' +
        '<p><b>Why it matters historically.</b> Until 1977 it was defensible to call Gödel sentences contrived logicians\' tricks. Then Paris–Harrington gave a natural finite Ramsey statement independent of PA, and Kirby–Paris gave Goodstein and the hydra game — statements a combinatorialist might have asked about for their own sake. The independence is exactly Gentzen\'s: the proof needs induction to \\(\\varepsilon_0\\), which is precisely PA\'s missing reach.</p>',
  fig: 'wellorder',
  see: ['well-ordering', 'ordinal', 'transfinite-induction', 'gentzen', 'incompleteness']
},

/* ---------- Volume IV: Lean & type theory -------------------------------- */

'type': {
  term: 'type', match: ['a type', 'types', 'type of'], kind: 'type theory',
  short: 'A label saying what kind of thing a value is — and in Lean, a label rich enough to be a mathematical statement.',
  body: '<p>In any programming language, <code>3 : Nat</code> says 3 is a natural number and <code>f : Nat → Bool</code> says \\(f\\) turns naturals into booleans. Types stop you adding a number to a string.</p>' +
        '<p class="eg"><b>Lean takes one extra step, and everything follows.</b> Types are allowed to <i>depend on values</i>: <code>Vector Nat n</code> is the type of lists of exactly \\(n\\) naturals, a different type for each \\(n\\). Once types can express "exactly \\(n\\)", they can express any mathematical claim — and then a term of that type is a <b>proof</b> of the claim. That is the whole design.</p>',
  fig: 'curryhoward',
  see: ['curry-howard', 'dependent-type', 'prop-vs-type', 'term']
},

'term': {
  term: 'term', match: ['a term', 'terms', 'proof term'], kind: 'type theory',
  short: 'An expression — a piece of data, a function, or a proof. In Lean these are all the same kind of thing.',
  body: '<p><code>3</code>, <code>fun x =&gt; x + 1</code>, and a completed proof of a theorem are all terms. Each has a type, and the kernel\'s one job is checking that the type it claims is the type it has.</p>' +
        '<p class="eg"><b>The sentence that reorganises everything.</b> A proof <i>is</i> a term. Your tactic script is not the proof — it is a program that <i>writes</i> the proof term, and once written the script is thrown away. That is why a bug in <code>simp</code> cannot produce a false theorem: it can only produce a term that fails to type-check.</p>',
  fig: 'beta',
  see: ['type', 'curry-howard', 'kernel', 'tactic']
},

'curry-howard': {
  term: 'Curry–Howard correspondence', match: ['Curry–Howard', 'Curry-Howard', 'propositions as types', 'proofs are programs'], kind: 'type theory',
  short: 'Propositions are types and proofs are programs — not an analogy, the same mathematical objects.',
  body: '<p>Take "if A then B". A proof of it is a method converting any proof of A into a proof of B — which is to say, a <b>function</b> from proofs-of-A to proofs-of-B. So if <code>A</code> denotes the type of proofs of A, then "A implies B" is the function type <code>A → B</code>, and a proof of it is literally a function. Modus ponens becomes function application.</p>' +
        '<p class="eg"><b>The dictionary, line by line.</b> proposition ↔ type; proof ↔ term; \\(A\\to B\\) ↔ function type; →-introduction ↔ lambda abstraction; modus ponens ↔ application; \\(A\\wedge B\\) ↔ product; \\(A\\vee B\\) ↔ sum; \\(\\forall x{:}\\alpha,\\ P\\,x\\) ↔ dependent function (Π); \\(\\exists\\) ↔ dependent pair (Σ); False ↔ the empty type; <b>proof checking ↔ type checking</b>.</p>' +
        '<p><b>The bridge back to Vol. III.</b> Type <code>fun x =&gt; fun y =&gt; x</code> and you get <code>α → β → α</code> — that is <b>axiom A1</b> of the Hilbert system. Type <code>fun f =&gt; fun g =&gt; fun x =&gt; f x (g x)</code> and you get axiom <b>A2</b>. These are the combinators <b>K</b> and <b>S</b>. The five-line Hilbert derivation of \\(p\\to p\\) is, on this side of the mirror, the one-line program <code>fun x =&gt; x</code>. <i>Lean is what you get when you decide to work on the program side.</i></p>',
  fig: 'curryhoward',
  see: ['type', 'lambda-abstraction', 'dependent-type', 'deductive-system', 'prop-vs-type']
},

'lambda-abstraction': {
  term: 'lambda abstraction', match: ['lambda abstraction', 'λ-abstraction', 'lambda calculus', 'fun x =>', 'application'], kind: 'type theory',
  short: 'Writing a function without naming it — <code>fun x =&gt; e</code> means "given x, produce e".',
  body: '<p><code>fun x =&gt; x + 1</code> is the add-one function. <b>Application</b> is juxtaposition: <code>f a</code> means "run f on a".</p>' +
        '<p class="eg"><b>Under Curry–Howard, each is a logical rule.</b> Every λ you write is an implication-<i>introduction</i> ("assume A, derive B, conclude A → B"); every application is a modus ponens. Writing a program and constructing a proof are the same activity.</p>' +
        '<p><b>Why <code>fun x =&gt; x x</code> must be rejected.</b> Self-application fails the occurs check — "cannot construct the infinite type \\(\\alpha = \\alpha\\to\\beta\\)". The <i>untyped</i> lambda calculus does allow it, and is correspondingly useless as a logic: every proposition gets a "proof", namely a non-terminating one. The type system\'s refusal here is the same guard that stops Russell\'s paradox.</p>',
  fig: 'beta',
  see: ['curry-howard', 'beta-reduction', 'occurs-check', 'strict-positivity']
},

'dependent-type': {
  term: 'dependent type', match: ['dependently-typed', 'dependent type', 'dependent types', 'Pi type', 'Sigma type'], kind: 'type theory',
  short: 'A type that depends on a value — which is what lets a type express a theorem rather than just a data shape.',
  body: '<p><code>Vector Nat 3</code> and <code>Vector Nat 4</code> are different types. The <b>Π-type</b> <code>(x : α) → P x</code> is a function whose <i>result type varies with the input</i>; the <b>Σ-type</b> is a pair whose second component\'s type depends on the first.</p>' +
        '<p class="eg"><b>Read the dictionary the other way.</b> \\(\\forall x : \\alpha,\\ P(x)\\) <i>is</i> the Π-type: a proof is a function that, given any \\(x\\), produces a proof of \\(P(x)\\). \\(\\exists x : \\alpha,\\ P(x)\\) <i>is</i> the Σ-type: a proof is a pair \\(\\langle a, h\\rangle\\) — a witness and a proof about it. Quantifiers are not extra logical machinery; they are function and pair types that happen to be dependent.</p>',
  see: ['type', 'curry-howard', 'prop-vs-type', 'universe']
},

'kernel': {
  term: 'kernel', match: ['the kernel', 'kernel’s', 'de Bruijn criterion', 'trusted computing base'], kind: 'proof assistants',
  short: 'The small, boring program that re-checks every proof from scratch — the only part of Lean you actually have to trust.',
  body: '<p>The kernel does exactly one thing: decide whether a given term has a given type. Everything else in Lean exists to <i>produce terms for it to check</i>.</p>' +
        '<p class="eg"><b>The de Bruijn criterion, and why it is the whole design.</b> Lean\'s elaborator is roughly 100 000 lines of subtle, heuristic, occasionally buggy code. Its kernel is a few thousand lines. Tactics, <code>simp</code>, <code>omega</code>, <code>decide</code>, type-class resolution, the macro system — <b>all untrusted</b>. Each merely proposes a term; the kernel then re-derives the typing from the axioms with no memory of how the term was produced. A bug in the elaborator produces a term that <i>fails to check</i>. A bug in the kernel is a crisis.</p>' +
        '<p>That asymmetry is why Mathlib can hold a hundred thousand theorems proved by machinery nobody has fully audited and still be believable. Independent re-checkers (<code>lean4checker</code>, Trepplein) can re-verify an entire compiled environment.</p>',
  see: ['term', 'tactic', 'definitional-equality', 'lean-axioms']
},

'lean-axioms': {
  term: 'Lean’s three axioms', match: ['propext', 'Classical.choice', 'Quot.sound', 'three axioms'], kind: 'proof assistants',
  short: 'Beyond the type theory itself, Mathlib rests on exactly three axioms — and Lean will tell you which ones any theorem used.',
  body: '<p><code>propext</code>: propositions that are equivalent are equal. <code>Classical.choice</code>: from a proof that a type is non-empty, extract an element. <code>Quot.sound</code>: quotient types work as expected.</p>' +
        '<p class="eg"><b>Machine-checkable logical commitments — genuinely new in mathematics.</b> <code>#print axioms myTheorem</code> lists exactly what a result depends on. Printing <code>[]</code> means fully constructive; listing <code>Classical.choice</code> means classical (it yields excluded middle via Diaconescu\'s theorem). No more arguing about whether a proof "really" uses choice.</p>' +
        '<p><b>What is actually being trusted:</b> the kernel\'s correctness; the consistency of the axioms (Carneiro: relative to ZFC plus countably many inaccessibles); and — the unglamorous one, and by far the most common failure in practice — <b>that the statement says what you think it says</b>.</p>',
  see: ['kernel', 'prop-vs-type', 'excluded-middle', 'quotient-type']
},

'definitional-equality': {
  term: 'definitional equality', match: ['definitional equality', 'definitionally equal', 'defeq', 'rfl'], kind: 'type theory',
  short: 'Two terms are definitionally equal if they compute to the same thing — a question the kernel settles by <i>running</i> them.',
  body: '<p><code>rfl : a = a</code> is accepted for a goal <code>a = b</code> precisely when the kernel can reduce <code>a</code> and <code>b</code> to the same normal form. So <code>example : 2 + 2 = 4 := rfl</code> works, and it works by <b>computing</b>, not by searching for a proof.</p>' +
        '<p class="eg"><b>The asymmetry every beginner hits.</b> <code>n + 0 = n</code> is provable by <code>rfl</code>; <code>0 + n = n</code> is not. Reason: <code>Nat.add</code> recurses on its <i>second</i> argument. In <code>n + 0</code> the second argument is the literal constructor <code>Nat.zero</code>, so ι-reduction fires immediately. In <code>0 + n</code> the second argument is a free variable, nothing can fire, and the term is stuck. Both statements are true; only one is true <b>by computation</b>. This is a fact about how <code>Nat.add</code> was defined, not about arithmetic.</p>' +
        '<p><b>Proof by evaluation.</b> <code>decide</code> works this way: take a decidable proposition, compute the boolean, and if it is <code>true</code> the entire proof is a <code>rfl</code>. You can prove "there are 25 primes below 100" by running a program, and the kernel verifies it by running the program itself.</p>',
  fig: 'beta',
  see: ['beta-reduction', 'kernel', 'normal-form', 'recursor', 'decide']
},

'beta-reduction': {
  term: 'reduction rules', match: ['β-reduction', 'beta-reduction', 'ι-reduction', 'iota', 'δ-unfold', 'reduction rules', 'eta'], kind: 'type theory',
  short: 'The five rewriting steps the kernel uses to compute: β, δ, ι, ζ and η.',
  body: '<p><b>β</b> — apply a lambda: <code>(fun x =&gt; e) a ⟶ e[x := a]</code>.<br>' +
        '<b>δ</b> — unfold a definition: <code>Nat.add ⟶ fun m n =&gt; …</code>.<br>' +
        '<b>ι</b> — a recursor meets a constructor: <code>Nat.rec z s (Nat.succ n) ⟶ s n (Nat.rec z s n)</code>.<br>' +
        '<b>ζ</b> — expand a let: <code>let x := a; e ⟶ e[x := a]</code>.<br>' +
        '<b>η</b> — functions with identical behaviour are equal: <code>fun x =&gt; f x ⟶ f</code>.</p>' +
        '<p class="eg"><b>ι is where arithmetic actually happens.</b> <code>Nat.add</code> is not primitive — it is <i>defined</i> by <code>Nat.rec</code>, so computing <code>2 + 2</code> is literally structural recursion unfolding, one ι-step at a time. (Lean\'s kernel additionally special-cases <code>Nat</code> with GMP arithmetic for speed, which is one of the few places the kernel is larger than it looks — but the definitional content is exactly the reduction sequence.)</p>',
  fig: 'beta',
  see: ['definitional-equality', 'recursor', 'normal-form', 'lambda-abstraction']
},

'normal-form': {
  term: 'normal form', match: ['normal form', 'normalise', 'normalisation', 'termination'], kind: 'type theory',
  short: 'A term with no reduction left to perform — the end of the computation.',
  body: '<p>Type checking works by reducing both sides to normal form and comparing. This only makes sense if reduction always <i>terminates</i>, which is why Lean is so strict about recursion.</p>' +
        '<p class="eg"><b>Why termination is a logical requirement, not a performance concern.</b> A non-terminating term of type <code>False</code> would prove everything — <code>def loop : False := loop</code> would end mathematics. So Lean accepts only three routes: <b>structural recursion</b> (compiled to <code>rec</code>), <b>well-founded recursion</b> (compiled to <code>Acc.rec</code> with a decreasing measure), and functions marked <code>partial</code>, which are excluded from the logic entirely and usable only for programming.</p>',
  fig: 'beta',
  see: ['beta-reduction', 'definitional-equality', 'strict-positivity', 'recursor']
},

'inductive-type': {
  term: 'inductive type', match: ['inductive type', 'inductive types', 'constructors', 'constructor'], kind: 'type theory',
  short: 'A type defined by listing the ways to build its elements — and nothing else is an element.',
  body: '<p><code>inductive Nat | zero | succ (n : Nat)</code> says: <code>zero</code> is a natural, <code>succ n</code> is a natural, and there are <i>no other</i> naturals. That closure clause is what makes induction valid.</p>' +
        '<p class="eg"><b>Almost everything in Lean is one of these.</b> <code>Nat</code>, <code>List</code>, <code>Bool</code>, <code>And</code>, <code>Or</code>, <code>Eq</code>, <code>False</code>, <code>Acc</code>. You declare the constructors; Lean <i>derives</i> the elimination principle automatically by a fixed schema. Understanding that schema is understanding the foundations.</p>' +
        '<p><b>It is the same idea as Vol. III §1.2</b>, where formulas were "the smallest set closed under" the formation rules. Two centuries apart, one concept.</p>',
  see: ['recursor', 'strict-positivity', 'term-formula', 'induction-principle']
},

'recursor': {
  term: 'recursor', match: ['recursor', 'recursors', 'motive', 'minor premise', 'major premise', 'eliminator'], kind: 'type theory',
  short: 'The automatically generated rule for using an inductive type — simultaneously its induction principle and its recursion operator.',
  body: '<p>For <code>inductive I</code> with constructors \\(c_1,\\dots,c_n\\), Lean generates <code>I.rec</code> taking: a <b>motive</b> (what you want to produce for each element), one <b>minor premise</b> per constructor (how to build the result in that case, <i>given the results for recursive arguments</i> — the induction hypotheses), and a <b>major premise</b> (the element you are eliminating). Plus one ι-reduction rule per constructor.</p>' +
        '<p class="eg"><b>Four consequences worth sitting with.</b> (1) <code>Nat.rec</code> is <i>both</i> the induction principle and the definition of recursion — the same term. That is Curry–Howard again. (2) <code>False</code> has no constructors, so <code>False.rec</code> has no minor premises and hands you anything at all: <b><i>ex falso quodlibet</i> is not an axiom, it is the empty case of a schema.</b> (3) <code>Eq.rec</code> is the only thing Lean knows about equality — every <code>rw</code>, <code>subst</code> and <code>congr</code> in Mathlib elaborates down to it. (4) <code>Acc.rec</code> is how non-structural recursion is justified: you recurse on a proof of accessibility instead of on the data.</p>',
  fig: 'induction',
  see: ['inductive-type', 'induction-principle', 'beta-reduction', 'curry-howard', 'primitive-recursive']
},

'strict-positivity': {
  term: 'strict positivity', match: ['strict positivity', 'strict-positivity', 'strictly positive', 'occurs to the left'], kind: 'type theory',
  short: 'A rule forbidding an inductive type from appearing to the left of an arrow in its own constructors — because that would let you build a non-terminating proof of False.',
  body: '<p>Lean rejects <code>inductive Bad | mk : (Bad → Bad) → Bad</code>.</p>' +
        '<p class="eg"><b>Exactly what goes wrong if you allow it.</b> Such a type would let you embed the <i>untyped</i> lambda calculus — you could recover <code>fun x =&gt; x x</code>, build a non-terminating term, and hand it type <code>False</code>. Every proposition would then have a "proof". The occurs-check failure you see typing <code>fun x =&gt; x x</code> into Fig. 1 and this rejection are <b>the same guard at two different levels</b>.</p>',
  see: ['inductive-type', 'occurs-check', 'normal-form', 'lambda-abstraction']
},

'occurs-check': {
  term: 'occurs check', match: ['occurs check', 'infinite type', 'unification', 'type inference'], kind: 'type theory',
  short: 'The step in type inference that refuses to solve \\(\\alpha = \\alpha \\to \\beta\\) — because no finite type satisfies it.',
  body: '<p><b>Unification</b> is the process of finding a substitution making two types identical: matching \\(\\alpha\\to\\beta\\) against <code>Nat</code>\\(\\to\\gamma\\) gives \\(\\alpha := \\) <code>Nat</code>, \\(\\gamma := \\beta\\). The <b>occurs check</b> rejects any solution where a variable would have to contain itself.</p>' +
        '<p class="eg"><b>Try it.</b> <code>fun x =&gt; x x</code> demands that <code>x</code> have type \\(\\alpha\\) (as the argument) and \\(\\alpha\\to\\beta\\) (as the function) simultaneously. Solving requires \\(\\alpha = \\alpha\\to\\beta\\), an infinite type. The refusal is the type system blocking self-application — the same move that stops Russell\'s paradox, and the same principle as strict positivity one level up.</p>',
  fig: 'unify',
  see: ['lambda-abstraction', 'strict-positivity', 'curry-howard']
},

'prop-vs-type': {
  term: 'Prop vs Type', match: ['Prop', 'proof irrelevance', 'impredicativity', 'impredicative', 'erasure'], kind: 'type theory',
  short: 'Prop holds propositions, Type holds data — and the split buys erasure, proof irrelevance and safe classical logic.',
  body: '<p>\\(\\mathtt{Prop} = \\mathtt{Sort}\\,0\\) and \\(\\mathtt{Type}\\,u = \\mathtt{Sort}\\,(u+1)\\). Function types follow \\(\\mathtt{Sort}(\\mathrm{imax}\\ u\\ v)\\), where \\(\\mathrm{imax}\\ u\\ 0 = 0\\).</p>' +
        '<p class="eg"><b>That special case is impredicativity of Prop:</b> a proposition may quantify over <i>all</i> propositions — even itself — and remain a proposition. \\(\\forall p : \\mathtt{Prop},\\ p \\to p\\) is itself a <code>Prop</code>. Doing the same one level up (<code>Type : Type</code>) is fatal: Girard\'s paradox, a typed Russell.</p>' +
        '<p><b>Why it is safe down in Prop.</b> <code>Prop</code> also has <b>proof irrelevance</b> — any two proofs of the same proposition are definitionally equal. That flattens <code>Prop</code>: an element of \\(p : \\mathtt{Prop}\\) carries exactly one bit, whether it exists. Girard\'s diagonalisation needs to distinguish elements of a type and has nothing to bite on.</p>' +
        '<p><b>What the split buys, and its price.</b> Buys: <b>erasure</b> (proofs carry no computational content, so the compiler deletes them — verified programs run at the speed of unverified ones); usable dependent types involving proofs; and safe classical axioms (excluded middle in <code>Prop</code> destroys no computation because there was none). Price: <b>restricted elimination</b> — you cannot generally extract a witness from \\(\\exists x, P\\,x\\) to compute with. That is why Mathlib distinguishes \\(\\exists\\) from \\(\\Sigma\\), and why <code>Classical.choice</code> must be an axiom rather than a theorem.</p>',
  see: ['universe', 'type', 'lean-axioms', 'excluded-middle', 'dependent-type']
},

'universe': {
  term: 'universe', match: ['universe', 'universes', 'Sort', 'Type u', 'Girard'], kind: 'type theory',
  short: 'A hierarchy of levels, because there cannot be a type of all types.',
  body: '<p>\\(\\mathtt{Sort}\\,u : \\mathtt{Sort}\\,(u+1)\\). <code>Type 0 : Type 1 : Type 2 : …</code> forever.</p>' +
        '<p class="eg"><b>Why the tower is forced.</b> <code>Type : Type</code> makes the system inconsistent — Girard\'s paradox, the typed cousin of "the set of all sets that do not contain themselves". The hierarchy is the standard fix: every type lives one level below the thing that contains it, so no level ever contains itself. <b>Universe polymorphism</b> then lets you state a theorem once for all levels rather than copying it per level.</p>',
  see: ['prop-vs-type', 'type', 'dependent-type']
},

'tactic': {
  term: 'tactic', match: ['tactic', 'tactics', 'goal state', 'metavariable', 'simp', 'elaborator'], kind: 'proof assistants',
  short: 'A program that manipulates the goal — and whose only product is a term the kernel will re-check from scratch.',
  body: '<p>Tactic mode gives you a <b>goal state</b>: a metavariable with a local context of hypotheses. Tactics refine it. When the script finishes, the metavariable has been assigned a term, and <i>that</i> is what the kernel sees.</p>' +
        '<p class="eg"><b>What each common tactic really builds.</b> <code>intro h</code> → <code>fun h =&gt; ?goal</code> (→/∀-introduction). <code>exact e</code> → <code>e</code>. <code>apply f</code> → <code>f ?a ?b …</code>, spawning goals for the arguments. <code>rfl</code> → <code>rfl</code>, succeeding iff the sides are <i>definitionally</i> equal. <code>rw [h]</code> → ultimately <code>Eq.rec</code>. <code>induction n</code> → literally <code>Nat.rec</code>. <code>simp</code> → a chain of rewrites, found by untrusted search. <code>decide</code> → <code>of_decide_eq_true rfl</code>, proof by evaluation. <code>omega</code> → a checkable certificate for linear arithmetic.</p>' +
        '<p><b>The point to take away is the last line of every proof: the term.</b> Your script is a program that writes that term, and once it has, the script is discarded. Nothing about <code>simp</code>\'s correctness is ever trusted.</p>',
  see: ['kernel', 'term', 'definitional-equality', 'recursor', 'decide']
},

'decide': {
  term: 'proof by evaluation', match: ['native_decide', 'proof by evaluation'], kind: 'proof assistants',
  short: 'Prove a statement by computing the answer — the checker verifies it by running the same program.',
  body: '<p>A proposition is <code>Decidable</code> if there is an algorithm returning a boolean plus a proof that the boolean is correct. The <code>decide</code> tactic runs it; if the result is <code>true</code>, the whole proof is a <code>rfl</code>.</p>' +
        '<p class="eg"><b>This is only possible because type checking <i>is</i> computation.</b> "There are 25 primes below 100" becomes a program; the kernel confirms it by evaluating. In a traditional proof system this would be a separate trusted oracle; here it falls out of definitional equality.</p>' +
        '<p><b>The escape hatch to avoid.</b> <code>native_decide</code> trusts the compiler and its runtime instead of the kernel, considerably widening the trusted base — which is exactly why Mathlib does not permit it. <code>sorry</code> leaves a hole and Lean warns loudly.</p>',
  see: ['definitional-equality', 'tactic', 'kernel', 'decidable']
},

'excluded-middle': {
  term: 'excluded middle', match: ['excluded middle', 'Diaconescu', 'constructive', 'classical'], kind: 'logic',
  short: '"Every proposition is true or false" — harmless in classical mathematics, but it destroys computational content.',
  body: '<p>\\(P \\vee \\neg P\\). <b>Constructive</b> mathematics does not assume it, because a proof of \\(P\\vee\\neg P\\) ought to tell you <i>which</i>, and in general nothing can.</p>' +
        '<p class="eg"><b>How Lean gets it.</b> Not as an axiom directly — <code>Classical.choice</code> implies it, by Diaconescu\'s theorem. And it is safe here precisely because of the <code>Prop</code>/<code>Type</code> split: excluded middle in <code>Prop</code> destroys no computation, because proofs in <code>Prop</code> had no computational content to destroy (they are erased at compile time). The same axiom in <code>Type</code> would be a disaster.</p>' +
        '<p><b>And Lean keeps score.</b> <code>#print axioms</code> tells you whether a given theorem went classical — making a distinction that was previously a matter of scholarly argument into a machine-checkable fact.</p>',
  see: ['lean-axioms', 'prop-vs-type', 'quotient-type']
},

'quotient-type': {
  term: 'quotient type', match: ['quotient type', 'quotient types', 'Quot'], kind: 'type theory',
  short: 'A type where you have declared certain elements to be equal — the type-theoretic version of gluing.',
  body: '<p><code>Quot r</code> takes a relation \\(r\\) and forces \\(r\\,a\\,b \\Rightarrow\\) <code>Quot.mk r a = Quot.mk r b</code>. That implication is the axiom <code>Quot.sound</code>.</p>' +
        '<p class="eg"><b>Why you cannot do without it.</b> The rationals are pairs of integers with \\((1,2)\\) and \\((2,4)\\) identified; the integers themselves are pairs of naturals modulo an equivalence. Without quotients you would carry an equivalence relation around by hand forever. It is the same construction as the modular quotient in Vol. I — declare orbit-mates equal, work on the glued object.</p>',
  see: ['lean-axioms', 'quotient', 'type', 'isomorphism']
},

'mathlib': {
  term: 'Mathlib', match: ['Mathlib', 'formalisation project', 'Liquid Tensor'], kind: 'proof assistants',
  short: 'Lean\'s community library of formalised mathematics — and its real achievement is the definitions, not the theorem count.',
  body: '<p>Hundreds of thousands of theorems, from basic algebra to perfectoid spaces, all kernel-checked.</p>' +
        '<p class="eg"><b>The honest failure mode of formalisation.</b> It does not protect you from proving the wrong thing. A theorem whose hypothesis is secretly unsatisfiable is checked with enthusiasm. A definition that does not capture the intended concept yields true theorems about the wrong object. <b>In practice the hard part of formalisation is not the proofs, it is the definitions</b> — and that part is still entirely human.</p>' +
        '<p><b>What it does deliver</b> is different from certainty and arguably more useful: it collapses the cost of <i>checking</i>. A referee\'s month becomes a CPU-minute, the exact axioms are printed on request, and every hypothesis is forced into the open. The Liquid Tensor Experiment, the sphere eversion, and the Fermat\'s Last Theorem project are all bets on that trade.</p>',
  see: ['kernel', 'lean-axioms', 'tactic', 'decide']
}
};
