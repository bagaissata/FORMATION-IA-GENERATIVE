/* ═══════════════════════════════════════════════════════════════
   SciCalc — Moteur de calcul
   Tokeniseur → parseur (Pratt) → évaluateur
   • Fractions exactes via BigInt (1/3 reste 1/3)
   • Angles DEG / RAD / GRAD
   • Étapes pédagogiques (traçage des réductions)
   • Aucun eval(), erreurs en français
   ═══════════════════════════════════════════════════════════════ */
window.Eng = (() => {
'use strict';

const BIG_MAX_DEN = 10n ** 12n;   // au-delà, on bascule en flottant
const BIG_MAX_INT = 10n ** 15n;   // entiers exacts max

class CalcErr extends Error {
  constructor(msg) { super(msg); this.msg = msg; }
}

/* ── Rationnels (BigInt) ─────────────────────────────────────── */

function bgcd(a, b) {
  a = a < 0n ? -a : a; b = b < 0n ? -b : b;
  while (b) { [a, b] = [b, a % b]; }
  return a || 1n;
}

function rat(n, d) {                       // -> {n,d} normalisé ou null
  if (d === 0n) return null;
  if (d < 0n) { n = -n; d = -d; }
  const g = bgcd(n, d);
  n /= g; d /= g;
  return { n, d };
}

const R = {
  fromInt(v) {
    if (!Number.isInteger(v) || Math.abs(v) >= Number(BIG_MAX_INT)) return null;
    return { n: BigInt(v), d: 1n };
  },
  add(a, b) {
    const r = rat(a.n * b.d + b.n * a.d, a.d * b.d);
    return r && r.d <= BIG_MAX_DEN ? r : null;
  },
  sub(a, b) {
    const r = rat(a.n * b.d - b.n * a.d, a.d * b.d);
    return r && r.d <= BIG_MAX_DEN ? r : null;
  },
  mul(a, b) {
    const r = rat(a.n * b.n, a.d * b.d);
    return r && r.d <= BIG_MAX_DEN ? r : null;
  },
  div(a, b) {
    if (b.n === 0n) return null;          // division par zéro (gérée par l'appelant)
    const r = rat(a.n * b.d, a.d * b.n);
    return r && r.d <= BIG_MAX_DEN ? r : null;
  },
  pow(a, e) {                              // e entier BigInt
    if (a.d !== 1n && Number(e) > 64) return null;
    if (Number(e) > 4096) return null;
    let n = 1n, d = 1n;
    const k = e < 0n ? -e : e;
    for (let i = 0n; i < k; i++) {
      n *= a.n; d *= a.d;
      if (d > BIG_MAX_DEN * 1000000n) return null;
    }
    return e < 0n ? (n === 0n ? null : rat(d, n)) : rat(n, d);
  },
  num(a) { return Number(a.n) / Number(a.d); },
};

/* ── Valeur : {r: rationnel|null, n: flottant|null} ─────────── */

function N(r)       { return { r, n: null }; }
function NF(x)      { return { r: null, n: x }; }
function val(v)     { return v.r ? R.num(v.r) : v.n; }

/* ── Formatage français ─────────────────────────────────────── */

const NBSP = '\u202F';

function sepGroups(intPart) {             // 1234567 -> 1 234 567
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

function fmtDec(v) {                      // flottant -> chaîne FR
  if (!isFinite(v)) return v > 0 ? '∞' : '−∞';
  if (v === 0) return '0';
  const neg = v < 0; v = Math.abs(v);
  if (Number.isInteger(v) && v < 1e15) {
    return (neg ? '−' : '') + sepGroups(String(v));
  }
  if (v >= 1e12 || v < 1e-9) {            // notation scientifique
    const exp = Math.floor(Math.log10(v));
    const mant = fmtDec(Math.abs(parseFloat((v / 10 ** exp).toPrecision(12))));
    return (neg ? '−' : '') + mant + '×10' + supNum(exp);
  }
  let s = parseFloat(v.toPrecision(12)).toString();
  let [i, f] = s.split('.');
  i = sepGroups(i);
  return (neg ? '−' : '') + i + (f ? ',' + f : '');
}

const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
function supNum(k) { return String(k).split('').map(c => SUP[c] || c).join(''); }

function fmtVal(v) {                      // NumObj -> chaîne
  if (v.r) {
    if (v.r.d === 1n) return fmtDecimalFromBig(v.r.n);
    const p = fmtDecimalFromBig(v.r.n), q = fmtDecimalFromBig(v.r.d);
    return p + '/' + q;
  }
  return fmtDec(v.n);
}

function fmtDecimalFromBig(b) {           // BigInt -> chaîne groupée
  const neg = b < 0n; if (neg) b = -b;
  let s = b.toString();
  if (s.length > 15) s = s.slice(0, 15);
  return (neg ? '−' : '') + sepGroups(s);
}

/* ── Tokeniseur ─────────────────────────────────────────────── */

const FNS = {
  sin: 1, cos: 1, tan: 1, asin: 1, acos: 1, atan: 1,
  sinh: 1, cosh: 1, tanh: 1, asinh: 1, acosh: 1, atanh: 1,
  ln: 1, log: 1, log2: 1, exp: 1,
  sqrt: 1, cbrt: 1, abs: 1, floor: 1, ceil: 1, round: 1,
};

const FN_LABEL = {
  sin: 'sin', cos: 'cos', tan: 'tan', asin: 'arcsin', acos: 'arccos', atan: 'arctan',
  sinh: 'sinh', cosh: 'cosh', tanh: 'tanh',
  ln: 'ln', log: 'log', log2: 'log₂', exp: 'exp',
  sqrt: '√', cbrt: '∛', abs: 'abs', floor: 'floor', ceil: 'ceil', round: 'round',
};

function tokenize(src) {
  const text = src.replace(/,/g, '.');
  const T = [];
  let i = 0;
  const push = (t) => T.push(t);
  const last = () => T[T.length - 1];

  while (i < text.length) {
    const c = text[i];
    const start = i;

    if (c === ' ' || c === '\u202F' || c === '\u00A0') { i++; continue; }

    // nombre : 12 · 3,5 · .5 · 2e-7
    if (/[0-9.]/.test(c)) {
      const m = /^[0-9]*\.?[0-9]+(?:[eE][+-]?[0-9]+)?/.exec(text.slice(i));
      if (!m) throw new CalcErr('Nombre invalide.');
      const raw = m[0];
      i += raw.length;
      let v = parseFloat(raw);
      if (!isFinite(v)) throw new CalcErr('Nombre invalide.');
      const isInt = /^[0-9]+$/.test(raw);
      push({ t: 'num', v: isInt ? N(R.fromInt(Number(raw)) || NF(v)) : NF(v), s: start, e: i });
      continue;
    }

    // opérateurs
    if ('−-'.includes(c)) { push({ t: 'op', op: '-', s: start, e: ++i }); continue; }
    if ('+' === c) { push({ t: 'op', op: '+', s: start, e: ++i }); continue; }
    if ('×*·'.includes(c)) { push({ t: 'op', op: '×', s: start, e: ++i }); continue; }
    if ('÷/'.includes(c)) { push({ t: 'op', op: '÷', s: start, e: ++i }); continue; }
    if ('^' === c) { push({ t: 'op', op: '^', s: start, e: ++i }); continue; }

    // postfixes
    if (c === '!' || c === '%' || c === '²' || c === '³') {
      push({ t: 'post', op: c, s: start, e: ++i }); continue;
    }

    if (c === '√' || c === '∛') {
      push({ t: 'fn', f: c === '√' ? 'sqrt' : 'cbrt', s: start, e: ++i }); continue;
    }

    if (c === '(') { push({ t: 'open', s: start, e: ++i }); continue; }
    if (c === ')') { push({ t: 'close', s: start, e: ++i }); continue; }

    if (c === 'π') { push({ t: 'const', v: NF(Math.PI), s: start, e: ++i }); continue; }

    if (/[a-zA-Z]/.test(c)) {
      const m = /^[a-zA-Z]+/.exec(text.slice(i));
      const word = m[0].toLowerCase();
      // notation scientifique collée : 2e3, 5e-7
      if (word === 'e' && /^[e][+-]?[0-9]/.test(text.slice(i)) && last() && last().t === 'num') {
        const ex = /^[e]([+-]?[0-9]+)/.exec(text.slice(i));
        const expVal = Number(ex[1]);
        const prevNum = last();
        const mant = val(prevNum.v);
        i += ex[0].length;
        const res = mant * 10 ** expVal;
        const isInt = Number.isInteger(res) && Math.abs(res) < 1e15;
        prevNum.v = isInt ? N(R.fromInt(res) || NF(res)) : NF(res);
        prevNum.e = i;
        continue;
      }
      i += word.length;
      if (word === 'e') { push({ t: 'const', v: NF(Math.E), s: start, e: i }); continue; }
      if (word === 'ans') { throw new CalcErr('Ans doit être injecté par l\'interface.'); }
      if (FNS[word]) { push({ t: 'fn', f: word, s: start, e: i }); continue; }
      throw new CalcErr(`« ${word} » n'est pas reconnu.`);
    }

    if (c === '=' || c === '?') { i++; continue; }     // tolérés en fin d'expression
    throw new CalcErr(`Caractère inattendu « ${c} ».`);
  }

  // multiplication implicite : 2π · 3(4) · )( · )2 · πsin
  const out = [];
  for (const t of T) {
    const p = out[out.length - 1];
    if (p && ['num', 'close', 'const', 'post'].includes(p.t) &&
        (t.t === 'num' || t.t === 'const' || t.t === 'fn' || t.t === 'open')) {
      out.push({ t: 'op', op: '×', s: p.e, e: t.s, impl: true });
    }
    out.push(t);
  }
  return out;
}

/* ── Parseur (Pratt) ─────────────────────────────────────────── */

const P_ADD = 1, P_MUL = 2, P_POW = 3;

function parse(tokens) {
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parseExpr(min) {
    let a = parseUnary();
    for (;;) {
      const t = peek();
      if (!t) break;
      let prec = 0, right = false;
      if (t.t === 'op') {
        if (t.op === '+' || t.op === '-') { prec = P_ADD; }
        else if (t.op === '×' || t.op === '÷') { prec = P_MUL; }
        else if (t.op === '^') { prec = P_POW; right = true; }
        else break;
      } else break;
      if (prec < min) break;
      next();
      const b = parseExpr(right ? prec : prec + 1);
      a = { type: 'bin', op: t.op, a, b, s: a.s, e: b.e, impl: !!t.impl, tOp: t };
    }
    return a;
  }

  function parseUnary() {
    const t = peek();
    if (t && t.t === 'op' && t.op === '-') {
      next();
      const a = parseExpr(P_POW);
      return { type: 'neg', a, s: t.s, e: a.e, tOp: t };
    }
    if (t && t.t === 'op' && t.op === '+') { next(); return parseUnary(); }
    return parsePostfix();
  }

  function parsePostfix() {
    let a = parsePrimary();
    for (;;) {
      const t = peek();
      if (t && t.t === 'post') {
        next();
        a = { type: 'post', op: t.op, a, s: a.s, e: t.e, tOp: t };
      } else break;
    }
    return a;
  }

  function parsePrimary() {
    const t = next();
    if (!t) throw new CalcErr('Expression incomplète.');

    if (t.t === 'num' || t.t === 'const') {
      return { type: 'lit', v: t.v, s: t.s, e: t.e };
    }
    if (t.t === 'open') {
      const a = parseExpr(0);
      const c = peek();
      if (!c || c.t !== 'close') throw new CalcErr('Parenthèse manquante.');
      next();
      return { type: 'paren', a, s: t.s, e: c.e, tkOp: t, tkCl: c };
    }
    if (t.t === 'fn') {
      const o = peek();
      if (o && o.t === 'open') {
        next();
        const a = parseExpr(0);
        const c = peek();
        if (!c || c.t !== 'close') throw new CalcErr('Parenthèse manquante après ' + FN_LABEL[t.f] + '().');
        next();
        return { type: 'call', f: t.f, a, s: t.s, e: c.e };
      }
      const a = parsePostfix();   // sin 30 — argument implicite
      return { type: 'call', f: t.f, a, s: t.s, e: a.e };
    }
    if (t.t === 'close') throw new CalcErr('Parenthèse en trop.');
    if (t.t === 'op') throw new CalcErr(`Opérateur ${t.op} inattendu.`);
    if (t.t === 'post') throw new CalcErr(`« ${t.op} » doit suivre une valeur.`);
    throw new CalcErr('Saisie invalide.');
  }

  const ast = parseExpr(0);
  if (pos < tokens.length) throw new CalcErr('Saisie inexploitable.');
  return ast;
}

/* ── Fonctions & angles ─────────────────────────────────────── */

function makeCtx(angle) {
  const toRad = (x) => angle === 'RAD' ? x : angle === 'GRAD' ? x * Math.PI / 200 : x * Math.PI / 180;
  const fromRad = (x) => angle === 'RAD' ? x : angle === 'GRAD' ? x * 200 / Math.PI : x * 180 / Math.PI;
  const G = [676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.9843695780195716e-6, 1.5056327351493116e-7];
  const gamma = (z) => {
    if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
    z -= 1;
    let x = 0.99999999999980993;
    for (let i = 0; i < 8; i++) x += G[i] / (z + i + 1);
    const t = z + 7.5;
    return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
  };
  const fact = (n) => {
    if (Number.isInteger(n) && n >= 0) {
      if (n > 170) return Infinity;
      let r = 1; for (let i = 2; i <= n; i++) r *= i; return r;
    }
    return gamma(n + 1);
  };
  const need = (ok) => { if (!ok) throw new CalcErr('Domaine invalide pour cette fonction.'); };

  return { angle, toRad, fromRad,
    fns: {
      sin: (x) => Math.sin(toRad(x)), cos: (x) => Math.cos(toRad(x)), tan: (x) => {
        const r = toRad(x);
        if (Math.abs(Math.cos(r)) < 1e-14) throw new CalcErr('tan indéfini (π/2).');
        return Math.tan(r);
      },
      asin: (x) => { need(x >= -1 && x <= 1); return fromRad(Math.asin(x)); },
      acos: (x) => { need(x >= -1 && x <= 1); return fromRad(Math.acos(x)); },
      atan: (x) => fromRad(Math.atan(x)),
      sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
      asinh: Math.asinh, acosh: (x) => { need(x >= 1); return Math.acosh(x); },
      atanh: (x) => { need(x > -1 && x < 1); return Math.atanh(x); },
      ln: (x) => { need(x > 0); return Math.log(x); },
      log: (x) => { need(x > 0); return Math.log10(x); },
      log2: (x) => { need(x > 0); return Math.log2(x); },
      exp: Math.exp,
      sqrt: (x) => { need(x >= 0); return Math.sqrt(x); },
      cbrt: Math.cbrt, abs: Math.abs, floor: Math.floor, ceil: Math.ceil, round: Math.round,
      fact,
    },
  };
}

/* ── Évaluation d'un nœud ───────────────────────────────────── */

function chk(x) {
  if (!isFinite(x)) {
    if (isNaN(x)) throw new CalcErr('Résultat indéfini.');
    throw new CalcErr('Résultat hors limites (∞).');
  }
  return x;
}

function arith(op, a, b) {
  if (a.r && b.r) {
    let r = null;
    if (op === '+') r = R.add(a.r, b.r);
    else if (op === '-') r = R.sub(a.r, b.r);
    else if (op === '×') r = R.mul(a.r, b.r);
    else if (op === '÷') {
      if (b.r.n === 0n) throw new CalcErr('Division par zéro.');
      r = R.div(a.r, b.r);
    } else if (op === '^') {
      const e = b.r;
      if (e.d === 1n && e.n >= -(2n ** 20n) && e.n <= 2n ** 20n) {
        r = R.pow(a.r, e.n);
        if (r && r.d > BIG_MAX_DEN) r = null;
      }
    }
    if (r) return N(r);
  }
  const x = val(a), y = val(b);
  let z;
  switch (op) {
    case '+': z = x + y; break;
    case '-': z = x - y; break;
    case '×': z = x * y; break;
    case '÷':
      if (y === 0) throw new CalcErr('Division par zéro.');
      z = x / y; break;
    case '^':
      z = Math.pow(x, y);
      if (isNaN(z) && x < 0) throw new CalcErr('Puissance indéfinie (base négative).');
      break;
  }
  if (!isFinite(z) && op !== '^') throw new CalcErr(op === '÷' ? 'Division par zéro.' : 'Résultat hors limites.');
  return NF(chk(z));
}

function applyNode(node, ctx) {
  switch (node.type) {
    case 'lit': return node.v;
    case 'paren': return evalNode(node.a, ctx);
    case 'neg': {
      const a = evalNode(node.a, ctx);
      if (a.r) { const r = rat(-a.r.n, a.r.d); if (r) return N(r); }
      return NF(-val(a));
    }
    case 'post': {
      const a = evalNode(node.a, ctx);
      const x = val(a);
      switch (node.op) {
        case '!': return NF(chk(ctx.fns.fact(x)));
        case '%': {
          if (a.r) { const r = rat(a.r.n, a.r.d * 100n); if (r && r.d <= BIG_MAX_DEN) return N(r); }
          return NF(x / 100);
        }
        case '²': {
          if (a.r) { const r = R.mul(a.r, a.r); if (r) return N(r); }
          return NF(chk(x * x));
        }
        case '³': {
          if (a.r) { const r = R.mul(R.mul(a.r, a.r), a.r); if (r) return N(r); }
          return NF(chk(x * x * x));
        }
      }
      break;
    }
    case 'call': {
      const a = evalNode(node.a, ctx);
      const f = ctx.fns[node.f];
      if (!f) throw new CalcErr('Fonction inconnue.');
      return NF(chk(f(val(a))));
    }
    case 'bin': {
      const a = evalNode(node.a, ctx);
      const b = evalNode(node.b, ctx);
      return arith(node.op, a, b);
    }
  }
  throw new CalcErr('Erreur interne d\'évaluation.');
}

function evalNode(node, ctx) {
  if (node.type === 'lit') return node.v;
  return applyNode(node, ctx);
}

/* ── Étapes : recherche du nœud réductible le plus interne/gauche ── */

const REDUCIBLE = (node) => node.type === 'lit';

function lit(v, node) { node.kind = 'lit'; node.v = v; return node; }

function findReducible(node) {
  if (node.type === 'lit') return null;
  const kids = [];
  if (node.a) kids.push(node.a);
  if (node.b) kids.push(node.b);
  for (const k of kids) {
    if (!REDUCIBLE(k)) {
      const sub = findReducible(k);
      if (sub) return sub;
    }
  }
  for (const k of kids) {
    if (!REDUCIBLE(k)) return null;   // un enfant non réduit bloque
  }
  return { node, s: node.s, e: node.e,
    rule: ruleOf(node) };
}

function ruleOf(node) {
  switch (node.type) {
    case 'paren': return 'Parenthèses';
    case 'neg': return 'Signes';
    case 'call': return FN_LABEL[node.f] || node.f;
    case 'post': return node.op === '!' ? 'Factorielles' : node.op === '%' ? 'Pourcentages' : 'Puissances';
    case 'bin':
      if (node.op === '+') return 'Additions';
      if (node.op === '-') return 'Soustractions';
      if (node.op === '×') return 'Multiplications';
      if (node.op === '÷') return 'Divisions';
      return 'Puissances';
  }
  return '';
}

/* ── API principale ─────────────────────────────────────────── */

function compute(text, angle = 'DEG', trace = true) {
  try {
    const ctx = makeCtx(angle);
    const tokens = tokenize(text);
    if (!tokens.length) throw new CalcErr('Saisissez un calcul.');
    const ast = parse(tokens);

    if (!trace) {
      const result = evalNode(ast, ctx);
      return { ok: true, result, steps: [] };
    }

    // Si le tout est déjà un littéral (ex. « 2+ » non, « 42 » oui)
    const steps = [];
    let cur = text;
    for (let guard = 0; guard < 500; guard++) {
      const target = findReducible(ast);
      if (!target) break;
      const v = applyNode(target.node, ctx);
      lit(v, target.node);
      const before = cur;
      cur = cur.slice(0, target.s) + renderStepVal(v) + cur.slice(target.e);
      steps.push({ rule: target.rule, before, after: cur });
    }
    if (ast.type !== 'lit') throw new CalcErr('Calcul incomplet.');
    return { ok: true, result: ast.v, steps };
  } catch (e) {
    if (e instanceof CalcErr) return { ok: false, err: e.msg };
    console.error('[SciCalc]', e);
    return { ok: false, err: 'Erreur interne.' };
  }
}

function renderStepVal(v) {
  if (v.r && v.r.d !== 1n) {
    // fraction affichée (parenthésée si négative pour garder la lisibilité)
    const s = fmtDecimalFromBig(v.r.n) + '/' + fmtDecimalFromBig(v.r.d);
    return v.r.n < 0n ? '(' + s + ')' : s;
  }
  if (v.r) return fmtDecimalFromBig(v.r.n);
  return fmtDec(v.n).replace(NBSP, '');      // sans séparateurs dans les étapes
}

const preview = (text, angle) => compute(text, angle, false);

/* Auto-tests accessibles via index.html?test=1 */
function selfTest() {
  const eq = (a, b) => Math.abs(val(a) - b) < 1e-9;
  const t = [];
  const run = () => {
    const c = (txt) => compute(txt, 'DEG', false);
    const cases = [
      ['2+3×4', 14], ['(2+3)×4', 20], ['2^3^2', 512], ['-2^2', -4],
      ['2+3×(4-1)²', 29], ['1/3+1/6', 0.5], ['0.1+0.2', 0.3],
      ['√(9+16)', 5], ['sin(30)', 0.5], ['sin(30)+cos(60)', 1],
      ['∛(-27)', -3], ['5!', 120], ['50%', 0.5], ['2^-2', 0.25],
      ['2π', 6.28318530718], ['3×(4+5)', 27],
      ['1/(2+3)', 0.2], ['abs(-7)', 7], ['100×(1+5%)', 105],
      ['(2+3)(4+5)', 45], ['ln(e)', 1], ['log(1000)', 3],
    ];
    for (const [txt, want] of cases) {
      const r = c(txt);
      t.push([txt, r.ok && eq(r.result, want), r.ok ? val(r.result) : r.err]);
    }
    const errs = [['2/0', true], ['(2+3', true], ['ln(0)', true], ['2+', true]];
    for (const [txt] of errs) t.push([txt + ' (erreur attendue)', !c(txt).ok, null]);
    return t;
  };
  return run();
}

return { compute, preview, fmtDec, fmtVal, val, selfTest, CalcErr, R, NF, N };
})();
