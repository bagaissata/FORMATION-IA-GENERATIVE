/* ═══════════════════════════════════════════════════════════════
   SciCalc — Rendu des étapes pédagogiques
   Transforme la liste d'étapes du moteur en timeline animée.
   ═══════════════════════════════════════════════════════════════ */
window.Steps = (() => {
'use strict';

function render(listEl, steps) {
  listEl.innerHTML = '';
  if (!steps.length) return;
  steps.forEach((st, i) => {
    const li = document.createElement('li');
    li.className = 'step';
    li.style.animationDelay = Math.min(i * 45, 900) + 'ms';
    const rule = document.createElement('span');
    rule.className = 'step-rule';
    rule.textContent = st.rule;
    const expr = document.createElement('div');
    expr.className = 'step-expr';
    expr.innerHTML = esc(st.before) + '<span class="step-arrow">→</span><b>' + esc(st.after) + '</b>';
    li.appendChild(rule);
    li.appendChild(expr);
    listEl.appendChild(li);
  });
  listEl.scrollTo({ top: listEl.scrollHeight, behavior: 'smooth' });
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/×/g, '<span class="op">×</span>');
}

return { render };
})();
