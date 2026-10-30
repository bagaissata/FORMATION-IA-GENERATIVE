/* ═══════════════════════════════════════════════════════════════
   SciCalc — Solveur : 1er degré, 2nd degré, système 2×2, TVA
   Solutions détaillées pas à pas.
   ═══════════════════════════════════════════════════════════════ */
window.Solver = (() => {
'use strict';

const $ = (id) => document.getElementById(id);

const FORMS = {
  lin1: [
    { key: 'a', label: 'a' }, { key: 'b', label: 'b' }, { key: 'c', label: 'c' },
    { key: 'x', label: '= valeur ? non — c est le membre de droite', hidden: false },
  ],
  lin2: [
    { key: 'a', label: 'a' }, { key: 'b', label: 'b' }, { key: 'c', label: 'c' },
  ],
  sys: [
    { key: 'a', label: 'a₁' }, { key: 'b', label: 'b₁' }, { key: 'c', label: 'c₁' },
    { key: 'd', label: 'a₂' }, { key: 'e', label: 'b₂' }, { key: 'f', label: 'c₂' },
  ],
  tva: [
    { key: 'a', label: 'Montant' }, { key: 'b', label: 'Taux %' },
  ],
};

let mode = 'lin1';

function buildInputs() {
  const box = $('solver-inputs');
  box.innerHTML = '';
  const fields = FORMS[mode];
  fields.forEach(f => {
    if (mode === 'lin1' && f.hidden) return;
    const inp = document.createElement('input');
    inp.className = 'f';
    inp.dataset.key = f.key;
    inp.type = 'text';
    inp.inputMode = 'decimal';
    inp.placeholder = f.label.split(' ')[0] || f.label;
    inp.title = f.label;
    const wrap = document.createElement('label');
    wrap.style.cssText = 'flex:0 1 120px;display:flex;flex-direction:column;gap:4px;color:var(--ink-3);font-size:11px;font-weight:700';
    wrap.append(inp);
    const lab = document.createElement('span');
    lab.textContent = f.label.split(' — ')[0];
    lab.style.paddingLeft = '2px';
    wrap.appendChild(inp.__lab || lab);
    wrap.insertBefore(lab, inp);
    box.appendChild(wrap);
  });
  $('solver-steps').innerHTML = '';
}

function readNums() {
  const out = {};
  document.querySelectorAll('#solver-inputs input').forEach(inp => {
    const v = inp.value.trim().replace(',', '.');
    out[inp.dataset.key] = v === '' ? null : parseFloat(v);
  });
  return out;
}

const fmt = (v) => {
  if (!isFinite(v)) return '∞';
  if (Math.abs(v) < 1e-12) v = 0;
  if (Number.isInteger(v) && Math.abs(v) < 1e12) return String(v).replace('.', ',');
  return parseFloat(v.toPrecision(10)).toString().replace('.', ',');
};

const num = (v) => Math.abs(v - Math.round(v)) < 1e-10 ? Math.round(v) : v;

/* ── Résolutions ─────────────────────────────────────────────── */

function solveLin1(p) {
  const { a, b, c } = p;          // a·x + b = c
  const steps = [];
  if (a === null || b === null || c === null) return { err: 'Remplissez les trois coefficients.' };
  steps.push({ t: 'Équation de départ', m: `${num(a)}·x ${b >= 0 ? '+' : '−'} ${num(Math.abs(b))} = ${num(c)}` });
  if (a === 0) {
    if (b === c) steps.push({ t: 'Constat', m: 'L\'équation est vraie pour TOUT x (identité). Il y a une infinité de solutions.' });
    else steps.push({ t: 'Constat', m: 'a = 0 et b ≠ c : l\'équation est FAUSE. Aucune solution.' });
    return { steps, answer: a === 0 ? (b === c ? 'Infinité de solutions' : 'Aucune solution') : null };
  }
  steps.push({ t: 'Soustraction de b', m: `${num(a)}·x = ${num(c - b)}` });
  steps.push({ t: 'Division par a', m: `x = ${fmt((c - b) / a)}` });
  return { steps, answer: `x = ${fmt((c - b) / a)}` };
}

function solveLin2(p) {
  const { a, b, c } = p;           // a·x² + b·x + c = 0
  if (a === null || b === null || c === null) return { err: 'Remplissez les trois coefficients.' };
  const steps = [];
  steps.push({ t: 'Équation', m: `${num(a)}·x² ${b >= 0 ? '+' : '−'} ${num(Math.abs(b))}·x ${c >= 0 ? '+' : '−'} ${num(Math.abs(c))} = 0` });
  if (a === 0) return { steps, answer: 'a = 0 : ce n\'est pas une équation du 2nd degré (voir onglet 1er degré).', X: 'lin1' };
  const D = b * b - 4 * a * c;
  steps.push({ t: 'Discriminant', m: `Δ = b² − 4ac = ${fmt(b * b)} − ${fmt(4 * a * c)} = ${fmt(D)}` });
  if (D > 1e-12) {
    const x1 = (-b - Math.sqrt(D)) / (2 * a);
    const x2 = (-b + Math.sqrt(D)) / (2 * a);
    steps.push({ t: 'Δ > 0 : deux racines réelles', m: `x₁ = (−b − √Δ) / 2a = (−(${fmt(b)}) − ${fmt(Math.sqrt(D))}) / ${fmt(2 * a)} = ${fmt(x1)}` });
    steps.push({ t: '', m: `x₂ = (−b + √Δ) / 2a = (−(${fmt(b)}) + ${fmt(Math.sqrt(D))}) / ${fmt(2 * a)} = ${fmt(x2)}` });
    const vs = [x1, x2].map(num);
    steps.push({ t: 'Factorisation', m: `${num(a)}·(x − ${fmt(vs[0])})·(x − ${fmt(vs[1])})` });
    return { steps, answer: `x₁ = ${fmt(vs[0])}   ·   x₂ = ${fmt(vs[1])}` };
  }
  if (Math.abs(D) <= 1e-12) {
    const x0 = -b / (2 * a);
    steps.push({ t: 'Δ = 0 : une racine double', m: `x₀ = −b / 2a = ${fmt(x0)}` });
    return { steps, answer: `x₀ = ${fmt(num(x0))} (racine double)` };
  }
  const re = -b / (2 * a);
  const im = Math.sqrt(-D) / (2 * a);
  steps.push({ t: 'Δ < 0 : pas de racine réelle', m: `Racines complexes : z = ${fmt(re)} ${im >= 0 ? '+' : '−'} ${fmt(Math.abs(im))}·i` });
  return { steps, answer: `z₁ = ${fmt(re)} − ${fmt(Math.abs(im))}·i · z₂ = ${fmt(re)} + ${fmt(Math.abs(im))}·i` };
}

function solveSys(p) {
  const { a, b, c, d, e, f } = p;   // a·x + b·y = c ; d·x + e·y = f
  if ([a, b, c, d, e, f].some(v => v === null)) return { err: 'Remplissez les six coefficients.' };
  const det = a * e - b * d;
  const steps = [
    { t: 'Système', m: `{ ${num(a)}·x + ${num(b)}·y = ${num(c)}   ·   ${num(d)}·x + ${num(e)}·y = ${num(f)} }` },
    { t: 'Déterminant (Cramer)', m: `Δ = a₁·b₂ − a₂·b₁ = ${num(a)}×${num(e)} − ${num(d)}×${num(b)} = ${fmt(det)}` },
  ];
  if (Math.abs(det) < 1e-12) {
    steps.push({ t: 'Δ = 0', m: 'Les droites sont parallèles ou confondues.' });
    return { steps, answer: 'Δ = 0 : pas de solution unique.' };
  }
  const x = (c * e - f * b) / det;
  const y = (a * f - d * c) / det;
  steps.push({ t: 'x (Cramer)', m: `x = (c₁·b₂ − c₂·b₁) / Δ = ${fmt(x)}` });
  steps.push({ t: 'y (Cramer)', m: `y = (a₁·c₂ − a₂·c₁) / Δ = ${fmt(y)}` });
  return { steps, answer: `x = ${fmt(num(x))} · y = ${fmt(num(y))}` };
}

function solveTva(p) {
  const { a, b } = p;              // montant + taux
  if (a === null || b === null) return { err: 'Renseignez le montant et le taux.' };
  const rate = b / 100;
  const ht = a / (1 + rate);       // si le montant est TTC
  const steps = [
    { t: 'Hypothèse', m: `Le montant ${fmt(a)} est TTC avec un taux de ${fmt(b)} %` },
    { t: 'Part TVA', m: `Montant HT = ${fmt(a)} ÷ (1 + ${fmt(b)}÷100) = ${fmt(ht)}` },
    { t: 'TVA extraite', m: `TVA = ${fmt(a)} − ${fmt(ht)} = ${fmt(a - ht)}` },
    { t: 'Variante TTC', m: `Si le montant était HT : TTC = ${fmt(a)} × (1 + ${fmt(b)}÷100) = ${fmt(a * (1 + rate))}` },
  ];
  return { steps, answer: `HT = ${fmt(ht)} · TVA = ${fmt(a - ht)} · TTC = ${fmt(a * (1 + rate))}` };
}

function solve() {
  const p = readNums();
  for (const k in p) {
    if (p[k] !== null && isNaN(p[k])) return render({ err: 'Coefficient « ' + k + ' » invalide.' });
  }
  const fn = { lin1: solveLin1, lin2: solveLin2, sys: solveSys, tva: solveTva }[mode];
  render(fn(p));
}

function render(res) {
  const box = $('solver-steps');
  if (res.err) {
    box.innerHTML = '<p class="side-empty">' + esc(res.err) + '</p>';
    return;
  }
  let html = '<ol class="steps-list">';
  res.steps.forEach((s, i) => {
    if (!s.m) return;
    html += '<li class="step" style="animation-delay:' + Math.min(i * 40, 700) + 'ms">' +
      (s.t ? '<span class="step-rule">' + esc(s.t) + '</span>' : '') +
      '<div class="step-expr">' + esc(s.m) + '</div></li>';
  });
  html += '</ol>';
  if (res.answer) html += '<div class="solver-answer">' + esc(res.answer) + '</div>';
  box.innerHTML = html;

  if (res.X === 'lin1') {          // bascule automatique si a=0 en 2nd degré
    mode = 'lin1';
    document.querySelectorAll('#solver-modes .chip').forEach(c =>
      c.classList.toggle('active', c.dataset.mode === 'lin1'));
    buildInputs();
  }
}

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function boot() {
  buildInputs();
  document.querySelectorAll('#solver-modes .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      mode = chip.dataset.mode;
      document.querySelectorAll('#solver-modes .chip').forEach(c => c.classList.toggle('active', c === chip));
      buildInputs();
    });
  });
  $('btn-solve').addEventListener('click', solve);
}

boot();

return { solve };
})();
