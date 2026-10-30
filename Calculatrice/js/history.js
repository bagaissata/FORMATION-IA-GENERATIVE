/* ═══════════════════════════════════════════════════════════════
   SciCalc — Historique persistant (localStorage)
   ═══════════════════════════════════════════════════════════════ */
window.History = (() => {
'use strict';

const $ = (id) => document.getElementById(id);
const KEY = 'scicalc:history';
const MAX = 60;

let items = [];
let filter = '';

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(raw)) items = raw.slice(0, MAX);
  } catch { items = []; }
  render();
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {}
}

function add(entry) {
  items.unshift({ ...entry, ts: Date.now() });
  if (items.length > MAX) items.length = MAX;
  save();
  render();
}

function clear() {
  items = [];
  save();
  render();
}

function render() {
  const list = $('history-list');
  const empty = document.querySelector('.history-empty-msg');
  if (!list) return;
  const f = filter.toLowerCase();
  const shown = f ? items.filter(i => (i.expr + ' ' + i.result).toLowerCase().includes(f)) : items;
  list.innerHTML = '';
  empty.classList.toggle('hidden', shown.length > 0);

  shown.forEach((it, idx) => {
    const li = document.createElement('li');
    li.className = 'history-item';
    li.style.animationDelay = Math.min(idx * 22, 500) + 'ms';
    li.innerHTML =
      '<div class="history-expr">' + esc(it.expr) + '</div>' +
      '<div class="history-res">= ' + esc(it.result) + '</div>';
    li.title = 'Clic : réutiliser ce calcul';
    li.addEventListener('click', () => {
      if (window.SciCalcInsert) window.SciCalcInsert(it.expr);
      document.querySelector('.tab[data-tab="calc"]').click();
    });
    list.appendChild(li);
  });
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function boot() {
  load();
  const search = $('history-search');
  search.addEventListener('input', () => { filter = search.value; render(); });
  $('btn-clear-history').addEventListener('click', () => {
    if (items.length && confirm('Effacer tout l\'historique ?')) clear();
  });
  // liaison avec app.js
  document.querySelectorAll('.side-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.side-tab').forEach(t => {
        t.classList.toggle('active', t === tab);
        t.setAttribute('aria-selected', t === tab);
      });
      document.querySelectorAll('.side-view').forEach(v => v.classList.remove('active'));
      $('view-' + tab.dataset.side).classList.add('active');
    });
  });
}

boot();
})();
