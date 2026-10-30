/* ═══════════════════════════════════════════════════════════════
   SciCalc — Interface principale
   État de saisie, clavier virtuel/physique, mémoire, 2nd, écran.
   ═══════════════════════════════════════════════════════════════ */
(() => {
'use strict';

const $ = (id) => document.getElementById(id);
const els = {
  expr: $('display-expr'), result: $('display-result'), extra: $('display-extra'),
  display: document.querySelector('.display'),
  angle: $('badge-angle'), b2nd: $('badge-2nd'), bmem: $('badge-mem'),
  keypad: $('keypad'), steps: $('steps-list'), copy: $('btn-copy'),
};

/* ── État global ─────────────────────────────────────────────── */

const S = {
  tokens: [],            // saisie courante : [{t, s}] t∈ num|op|post|open|close|const|fn
  angle: 'DEG',
  shift: false,
  mem: null,             // nombre en mémoire
  ans: 0,
  justEvaluated: false,  // résultat affiché à l'écran
  sound: false,
};

const LS = {
  get() { try { return JSON.parse(localStorage.getItem('scicalc:state')); } catch { return null; } },
  set(o) { try { localStorage.setItem('scicalc:state', JSON.stringify(o)); } catch {} },
};

/* ── Définition du clavier ───────────────────────────────────── */

/* id, label, action, alt (mode 2nd), classe */
const KEYS = [
  { id: '2nd',    label: '2nd',           type: 'meta', toggle: 'shift' },
  { id: 'angle',  label: 'DEG',           type: 'meta', toggle: 'angle' },
  { id: 'mc',     label: 'MC',            type: 'meta', act: 'mc' },
  { id: 'mr',     label: 'MR',            type: 'meta', act: 'mr' },
  { id: 'mplus',  label: 'M+',            type: 'meta', act: 'mplus', alt: 'M−' },

  { id: 'sin',   label: 'sin',  ins: 'sin(',  type: 'fn', alt: 'sin⁻¹',  altIns: 'asin(' },
  { id: 'cos',   label: 'cos',  ins: 'cos(',  type: 'fn', alt: 'cos⁻¹',  altIns: 'acos(' },
  { id: 'tan',   label: 'tan',  ins: 'tan(',  type: 'fn', alt: 'tan⁻¹',  altIns: 'atan(' },
  { id: 'ln',    label: 'ln',   ins: 'ln(',   type: 'fn', alt: 'eˣ',     altIns: 'exp(' },
  { id: 'log',   label: 'log',  ins: 'log(',  type: 'fn', alt: '10ˣ',    altIns: '10^(' },

  { id: 'sq',    label: 'x²',   ins: '²',     type: 'fn', alt: 'x³',  altIns: '³' },
  { id: 'pow',   label: 'xʸ',   ins: '^',     type: 'fn' },
  { id: 'sqrt',  label: '√',    ins: '√(',    type: 'fn', alt: '∛',   altIns: '∛(' },
  { id: 'pi',    label: 'π',    ins: 'π',     type: 'fn' },
  { id: 'e',     label: 'e',    ins: 'e',     type: 'fn' },

  { id: 'ac',    label: 'C',    act: 'clear', type: 'fn danger' },
  { id: 'del',   label: '⌫',    act: 'del',   type: 'fn danger' },
  { id: 'fact',  label: 'n!',   ins: '!',     type: 'fn' },
  { id: 'pct',   label: '%',    ins: '%',     type: 'fn' },
  { id: 'inv',   label: '1/x',  act: 'inv',   type: 'fn' },

  { id: 'd7', label: '7', ins: '7', type: 'digit' },
  { id: 'd8', label: '8', ins: '8', type: 'digit' },
  { id: 'd9', label: '9', ins: '9', type: 'digit' },
  { id: 'div', label: '÷', ins: '÷', type: 'op' },
  { id: 'mul', label: '×', ins: '×', type: 'op' },

  { id: 'd4', label: '4', ins: '4', type: 'digit' },
  { id: 'd5', label: '5', ins: '5', type: 'digit' },
  { id: 'd6', label: '6', ins: '6', type: 'digit' },
  { id: 'sub', label: '−', ins: '−', type: 'op' },
  { id: 'mminus', label: 'M−', act: 'mminus', type: 'meta' },

  { id: 'd1', label: '1', ins: '1', type: 'digit' },
  { id: 'd2', label: '2', ins: '2', type: 'digit' },
  { id: 'd3', label: '3', ins: '3', type: 'digit' },
  { id: 'add', label: '+', ins: '+', type: 'op' },
  { id: 'ans', label: 'ans', act: 'ans', type: 'meta' },

  { id: 'd0', label: '0', ins: '0', type: 'digit', span: 1 },
  { id: 'dot', label: ',', ins: '.', type: 'digit' },
  { id: 'open', label: '(', ins: '(', type: 'op' },
  { id: 'close', label: ')', ins: ')', type: 'op' },
  { id: 'eq', label: '=', act: 'equals', type: 'eq' },
];

/* ── Construction du clavier ─────────────────────────────────── */

function buildKeypad() {
  els.keypad.innerHTML = '';
  for (const k of KEYS) {
    const b = document.createElement('button');
    b.className = 'key ' + (k.type || '');
    b.dataset.id = k.id;
    if (k.alt) b.dataset.alt = k.alt;
    b.setAttribute('aria-label', k.label);
    updateKeyLabel(b, k);
    b.addEventListener('click', () => press(k, b));
    els.keypad.appendChild(b);
  }
}

let keyMapByld = {};
function updateKeyLabel(btn, k) {
  const use2nd = S.shift && k.alt;
  btn.textContent = use2nd ? k.alt : k.label;
  keyMapByld[k.id] = btn;
}

/* ── Saisie : modèle à jetons ────────────────────────────────── */

function curTokens() { return S.tokens; }
function lastTok() { return S.tokens[S.tokens.length - 1] || null; }
const isOp = (t) => t && t.t === 'op';
const isNumish = (t) => t && (t.t === 'num' || t.t === 'post' || t.t === 'close' || t.t === 'const');

function pushToken(tok) {
  S.tokens.push(tok);
  S.justEvaluated = false;
  render();
}

/* quel DTO insérer selon l'id de touche */
function insertFor(k) {
  const ins = S.shift && k.altIns ? k.altIns : k.ins;
  if (ins == null) return;
  const c = ins[0];

  if (k.type === 'digit') {
    const l = lastTok();
    if (l && l.t === 'num') {
      // conditions d'acceptation : pas deux points, longueur raisonnable
      if (c === '.' && l.s.includes('.')) { beep(); return; }
      if (l.s.replace('-', '').length >= 15) { beep(); return; }
      l.s += c;
    } else if (S.justEvaluated) {
      S.tokens = [{ t: 'num', s: c }];
      S.justEvaluated = false;
    } else {
      // après ')' ou constante : multiplication implicite gérée au rendu
      S.tokens.push({ t: 'num', s: c });
    }
    S.justEvaluated = false;
    render(); return;
  }

  switch (c) {
    case '+': case '×': case '÷': case '^': case ')': case '(': case '%':
      break;
    default: break;
  }

  if ('+×÷^'.includes(c)) {
    const l = lastTok();
    if (!S.tokens.length) { if (c !== '+') { beep(); return; } }
    if (isOp(l) && l.s !== '−' && l.s !== '-') { l.s = c; render(); return; } // remplace op binaire
    if (isOp(l) && (l.s === '−' || l.s === '-') && S.tokens.length === 1) { S.tokens = []; render(); return; }
    if (S.justEvaluated) { S.tokens = [{ t: 'const', s: 'ans', numVal: S.ans }]; S.justEvaluated = false; }
    S.tokens.push({ t: 'op', s: c });
    render(); return;
  }

  if (c === '−') { // unaire ou binaire : moteur décide
    S.tokens.push({ t: 'op', s: '−' });
    S.justEvaluated = false;
    render(); return;
  }

  if (c === '(') {
    // multiplication implicite avant '('
    S.tokens.push({ t: 'open', s: '(' });
    S.justEvaluated = false;
    render(); return;
  }

  if (c === ')') {
    // fermeture intelligente : compte les paranthèses
    let depth = 0;
    for (const t of S.tokens) { if (t.t === 'open') depth++; if (t.t === 'close') depth--; }
    if (depth <= 0 || lastTok()?.t === 'op') { beep(); return; }
    S.tokens.push({ t: 'close', s: ')' });
    S.justEvaluated = false;
    render(); return;
  }

  if ('!²³%'.includes(c)) {
    const l = lastTok();
    if (!isNumish(l) && !(l?.t === 'close')) { beep(); return; }
    if (l?.t === 'post' && l.s === c) { beep(); return; }
    S.tokens.push({ t: 'post', s: c });
    S.justEvaluated = false;
    render(); return;
  }

  if (c === '.') {
    const l = lastTok();
    if (l?.t === 'num') { if (l.s.includes('.')) { beep(); return; } l.s += '.'; }
    else if (S.justEvaluated) { S.tokens = [{ t: 'num', s: '0.' }]; S.justEvaluated = false; }
    else { S.tokens.push({ t: 'num', s: '0.' }); }
    S.justEvaluated = false;
    render(); return;
  }

  if (ins.endsWith('(')) {           // fonctions : sin( …
    S.tokens.push({ t: 'fn', s: ins });
    S.justEvaluated = false;
    render(); return;
  }

  // constantes π e
  if (c === 'π' || c === 'e') {
    if (S.justEvaluated) { S.tokens = []; S.justEvaluated = false; }
    S.tokens.push({ t: 'const', s: c });
    render(); return;
  }
}

/* ── Actions ─────────────────────────────────────────────────── */

function press(k, btn) {
  if (S.sound) ping();
  btn.classList.add('pressed');
  setTimeout(() => btn.classList.remove('pressed'), 90);

  if (k.toggle === 'shift') { S.shift = !S.shift; refreshKeypad(); syncBadges(); return; }
  if (k.toggle === 'angle') { cycleAngle(); return; }

  if (k.act) {
    switch (k.act) {
      case 'clear': S.tokens = []; S.justEvaluated = false; showResult('', null); render(); break;
      case 'del': delChar(); break;
      case 'equals': equals(); break;
      case 'inv': invert(); break;
      case 'ans': insertAns(); break;
      case 'mc': S.mem = null; syncBadges(); toast('Mémoire effacée'); break;
      case 'mr': recallMem(); break;
      case 'mplus': memOp(1); break;
      case 'mminus': memOp(-1); break;
    }
    return;
  }
  if (S.shift) { S.shift = false; refreshKeypad(); syncBadges(); }
  insertFor(k);
}

function delChar() {
  if (S.justEvaluated) {          // après « = », ⌫ efface le résultat
    S.tokens = []; S.justEvaluated = false;
    showResult('', null); render(); return;
  }
  const l = lastTok();
  if (!l) return;
  if (l.t === 'num' && l.s.length > 1) l.s = l.s.slice(0, -1);
  else S.tokens.pop();
  render();
}

function invert() {                // 1/x : enveloppe toute l'expression
  if (!S.tokens.length) { insertTokensFromString('1÷('); return; }
  const inner = S.tokens.slice();
  S.tokens = [{ t: 'fn', s: '1÷(' }, ...inner, { t: 'close', s: ')' }];
  render();
}

function insertAns() {
  if (S.justEvaluated) S.justEvaluated = false;
  S.tokens.push({ t: 'const', s: 'ans', numVal: S.ans });
  render();
}

function recallMem() {
  if (S.mem == null) { toast('Mémoire vide'); beep(); return; }
  if (S.justEvaluated) { S.tokens = []; S.justEvaluated = false; }
  S.tokens.push({ t: 'const', s: 'M', numVal: S.mem });
  render();
}

function memOp(sign) {
  const r = Eng.compute(exprText(), S.angle, false);
  if (!r.ok) { toast('Impossible : ' + r.err); beep(); return; }
  const v = Eng.val(r.result);
  S.mem = (S.mem == null ? 0 : S.mem) + sign * v;
  syncBadges();
  toast((sign > 0 ? 'M+ : ' : 'M− : ') + Eng.fmtDec(S.mem));
}

function cycleAngle() {
  S.angle = S.angle === 'DEG' ? 'RAD' : S.angle === 'RAD' ? 'GRAD' : 'DEG';
  syncBadges(); saveState(); live();
}

/* ── Rendu ───────────────────────────────────────────────────── */

function exprText() {
  // joint les jetons ; les mémoires/ans injectent leur valeur numérique
  let out = '';
  let prev = null;
  for (const t of S.tokens) {
    const needMul = prev && (prev.t === 'num' || prev.t === 'close' || prev.t === 'const') &&
      (t.t === 'num' || t.t === 'const' || t.t === 'fn' || t.t === 'open');
    if (needMul) out += '×';
    if (t.numVal != null && (t.s === 'ans' || t.s === 'M')) {
      out += '(' + numToText(t.numVal) + ')';
    } else {
      out += t.s === '−' ? '-' : t.s;  // le moteur accepte − unicode mais on normalise
      if (t.t === 'fn' && !t.s.endsWith('(')) out += '(';
    }
    prev = t;
  }
  return out;
}

function numToText(v) {
  if (Number.isInteger(v) && Math.abs(v) < 1e15) return String(v);
  return String(v).replace('e', 'e');
}

function render() {
  els.expr.textContent = S.tokens.map(t => t.s === '−' || t.s === '-' ? '−' : t.s).join('');
  els.expr.scrollLeft = els.expr.scrollWidth;
  saveState();
  if (!S.justEvaluated) live();
}

function live() {
  const txt = exprText();
  if (!txt) { showResult('', null); return; }
  const r = Eng.preview(txt, S.angle);
  const lastChar = txt[txt.length - 1];
  if (!r.ok) {
    // saisie en cours : on reste silencieux sauf erreurs « définitives »
    showResult('…', 'preview');
    return;
  }
  const v = r.result;
  if (v.r && v.r.d === 1n && Math.abs(Eng.val(v)) < 1e15 && lastChar !== '=') {
    showPreview(Eng.fmtDec(Eng.val(v)));
  } else {
    showPreview(Eng.fmtVal(v));
  }
  if (v.r && v.r.d !== 1n) els.extra.textContent = '≈ ' + Eng.fmtDec(Eng.val(v));
  else if (typeof Eng.val(v) === 'number' && Math.abs(Eng.val(v)) >= 1e12) els.extra.textContent = '≈ notation scientifique affichée';
  else els.extra.textContent = '';
}

function showPreview(text) { showResult(text, 'preview'); }

function showResult(html, cls) {
  els.result.className = 'display-result' + (cls ? ' ' + cls : '');
  els.result.textContent = html;
}

function equals() {
  const txt = exprText();
  if (!txt) return;
  const r = Eng.compute(txt, S.angle, true);
  if (!r.ok) {
    showResult(r.err, 'error');
    els.display.classList.remove('shake');
    void els.display.offsetWidth;
    els.display.classList.add('shake');
    return;
  }
  const v = r.result;
  const main = Eng.fmtVal(v);
  showResult(main, null);
  els.extra.textContent = '';
  if (v.r && v.r.d !== 1n) {
    els.extra.textContent = '≈ ' + Eng.fmtDec(Eng.val(v));
  } else if (!v.r) {
    const x = Eng.val(v);
    if (Number.isFinite(x) && !Number.isInteger(x) && Math.abs(x) < 1e12) {
      const rr = approxFraction(x);
      if (rr) els.extra.textContent = '≈ ' + rr[0] + '/' + rr[1];
    }
  }
  els.display.classList.remove('flash');
  void els.display.offsetWidth;
  els.display.classList.add('flash');

  S.ans = Eng.val(v);
  S.justEvaluated = true;
  History.add({ expr: txt, result: main, angle: S.angle });
  window.Steps.render(els.steps, r.steps);
  document.querySelector('.side-tab[data-side="steps"]').click();
  refreshAnsBadge();
}

/* approximation en fraction simple (recherche Stern-Brocot bornée) */
function approxFraction(x, maxDen = 10000) {
  let n0 = 0, d0 = 1, n1 = 1, d1 = 0;
  let y = x;
  for (let i = 0; i < 40; i++) {
    const a = Math.floor(y);
    const n2 = a * n1 + n0, d2 = a * d1 + d0;
    if (d2 > maxDen) break;
    if (Math.abs(n2 / d2 - x) < 1e-11) return [n2, d2];
    [n0, d0, n1, d1] = [n1, d1, n2, d2];
    y = 1 / (y - a);
    if (!isFinite(y)) break;
  }
  return null;
}

/* ── Saisie clavier physique ─────────────────────────────────── */

const KEYMAP = {
  '0': 'd0', '1': 'd1', '2': 'd2', '3': 'd3', '4': 'd4', '5': 'd5',
  '6': 'd6', '7': 'd7', '8': 'd8', '9': 'd9',
  '.': 'dot', ',': 'dot',
  '+': 'add', '-': 'sub', '*': 'mul', 'x': 'mul', '/': 'div',
  '^': 'pow', '%': 'pct', '!': 'fact',
  '(': 'open', ')': 'close',
  'p': 'pi',
  'i': 'inv',
  'a': 'ans',
};

window.addEventListener('keydown', (e) => {
  if (document.activeElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
  const tab = e.key;
  let id = null;

  if (tab === 'Enter' || tab === '=') id = 'eq';
  else if (tab === 'Backspace') id = 'del';
  else if (tab === 'Delete' || tab === 'Escape') id = 'ac';
  else if (KEYMAP[tab.toLowerCase()]) id = KEYMAP[tab.toLowerCase()];
  if (!id) return;

  e.preventDefault();
  const btn = keyMapByld[id];
  if (btn) { btn.click(); btn.classList.add('pressed'); setTimeout(() => btn.classList.remove('pressed'), 110); }
});

/* ── Copie ───────────────────────────────────────────────────── */

els.copy.addEventListener('click', async () => {
  const t = els.result.textContent.trim();
  if (!t) return;
  try { await navigator.clipboard.writeText(t); toast('Résultat copié'); }
  catch { toast('Copie impossible'); }
});

/* ── Badges & son ────────────────────────────────────────────── */

function syncBadges() {
  els.angle.textContent = S.angle;
  els.b2nd.classList.toggle('hidden', !S.shift);
  els.bmem.classList.toggle('hidden', S.mem == null);
}

function refreshAnsBadge() { /* pas de badge ans :Bloc visible à l'écran */ }

let audioCtx = null;
function ping() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = 660; g.gain.value = .04;
    o.connect(g).connect(audioCtx.destination);
    o.start(); g.exponentialRampToValueAtTime(1e-4, audioCtx.currentTime + 0.09);
    o.stop(audioCtx.currentTime + 0.1);
  } catch {}
}
function beep() { if (S.sound) { ping(180); } pingErr(); }
function pingErr() {}

/* ── Toast ───────────────────────────────────────────────────── */

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 260); }, 1900);
}
window.toast = toast;

/* ── Persistance ─────────────────────────────────────────────── */

function saveState() {
  LS.set({
    angle: S.angle, mem: S.mem, ans: S.ans,
    tokens: S.tokens,
  });
}

function restoreState() {
  const o = LS.get();
  if (!o) return false;
  if (['DEG', 'RAD', 'GRAD'].includes(o.angle)) S.angle = o.angle;
  S.mem = typeof o.mem === 'number' ? o.mem : null;
  S.ans = typeof o.ans === 'number' ? o.ans : 0;
  if (Array.isArray(o.tokens) && o.tokens.length && o.tokens.every(t => typeof t.s === 'string')) {
    S.tokens = o.tokens;
    S.justEvaluated = true;   // on affiche le résultat précédent sans recalculer
    return true;
  }
  return false;
}

/* ── Historique : interfaceournée ───────────────────────────── */

function restoreExpr(tokens) {
  S.tokens = tokens.map(t => ({ ...t }));
  S.justEvaluated = false;
  document.querySelector('.tab[data-tab="calc"]').click();
  render();
  els.expr.scrollLeft = els.expr.scrollWidth;
}

window.SciCalcInsert = (text) => {           // utilisé par l'onglet Photo
  S.tokens = [];
  insertTokensFromString(text);
  document.querySelector('.tab[data-tab="calc"]').click();
};

function insertTokensFromString(text) {
  for (const ch of text) {
    if (ch === ' ') continue;
    if (/[0-9.]/.test(ch)) { S.tokens.push({ t: 'num', s: ch }); continue; }
    if ('-−'.includes(ch)) { S.tokens.push({ t: 'op', s: '−' }); continue; }
    if ('+×÷^()!²³%'.includes(ch)) {
      if ('+×÷^'.includes(ch)) S.tokens.push({ t: 'op', s: ch });
      else if ('()'.includes(ch)) S.tokens.push({ t: ch === '(' ? 'open' : 'close', s: ch });
      else S.tokens.push({ t: 'post', s: ch });
      continue;
    }
    if (ch === 'π') { S.tokens.push({ t: 'const', s: 'π' }); continue; }
    if (/[a-z]/i.test(ch)) {                 // noms de fonctions : agrège
      const l = S.tokens[S.tokens.length - 1];
      if (l && l.t === 'num') S.tokens.push({ t: 'fn', s: ch }); // cas limite
      else if (S.tokens.length && /[a-z]/i.test((S.tokens[S.tokens.length - 1].s || '').slice(-1))) {
        S.tokens[S.tokens.length - 1].s += ch;
      } else S.tokens.push({ t: 'fn', s: ch });
    }
  }
  render();
}

/* ── Boote ───────────────────────────────────────────────────── */

function refreshKeypad() {
  for (const k of KEYS) {
    const btn = keyMapByld[k.id];
    if (btn && k.alt) updateKeyLabel(btn, k);
  }
  els.keypad.classList.toggle('shifted', S.shift);
}

function boot() {
  buildKeypad();
  restoreState();
  syncBadges();
  render();
  if (new URLSearchParams(location.search).get('test') === '1') runTests();
}

function runTests() {
  const res = Eng.selfTest();
  let pass = 0;
  for (const [expr, ok, got] of res) {
    if (ok) pass++; else console.warn('Échec :', expr, '→', got);
  }
  console.groupCollapsed(`SciCalc auto-tests : ${pass}/${res.length} OK`);
  for (const [expr, ok, got] of res) console.log((ok ? '✔' : '✘') + ' ' + expr + ' → ' + got);
  console.groupEnd();
  showResult(`${pass}/${res.length} tests OK (console)`, 'preview');
}

boot();

/* Liaison historique ↔ saisie ( History défini dans history.js ) */
window.SciCalcRestoreExpr = restoreExpr;
})();
