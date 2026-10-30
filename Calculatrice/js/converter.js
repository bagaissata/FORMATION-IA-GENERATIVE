/* ═══════════════════════════════════════════════════════════════
   SciCalc — Convertisseur d'unités (100 % hors ligne)
   ═══════════════════════════════════════════════════════════════ */
window.Converter = (() => {
'use strict';

const $ = (id) => document.getElementById(id);

/* facteur vers l'unité de base */
const CATS = {
  'Longueur': {
    base: 'm',
    units: {
      'nanomètre (nm)': 1e-9, 'micromètre (µm)': 1e-6, 'millimètre (mm)': 1e-3,
      'centimètre (cm)': 1e-2, 'mètre (m)': 1, 'kilomètre (km)': 1e3,
      'pouce (in)': 0.0254, 'pied (ft)': 0.3048, 'yard (yd)': 0.9144,
      'mile (mi)': 1609.344, 'mile nautique': 1852,
    },
  },
  'Masse': {
    base: 'kg',
    units: {
      'milligramme (mg)': 1e-6, 'gramme (g)': 1e-3, 'kilogramme (kg)': 1,
      'tonne (t)': 1e3, 'once (oz)': 0.0283495, 'livre (lb)': 0.453592, 'stone': 6.35029,
    },
  },
  'Surface': {
    base: 'm²',
    units: {
      'cm²': 1e-4, 'm²': 1, 'are (a)': 100, 'hectare (ha)': 1e4, 'km²': 1e6,
      'pied² (ft²)': 0.092903, 'acre': 4046.86,
    },
  },
  'Volume': {
    base: 'L',
    units: {
      'millilitre (mL)': 1e-3, 'centilitre (cL)': 1e-2, 'décilitre (dL)': 0.1,
      'litre (L)': 1, 'm³': 1000, 'pint (UK)': 0.568261, 'gallon (US)': 3.78541,
    },
  },
  'Température': { special: true, units: {
    'Celsius (°C)': 'C', 'Fahrenheit (°F)': 'F', 'Kelvin (K)': 'K',
  } },
  'Vitesse': {
    base: 'm/s',
    units: {
      'm/s': 1, 'km/h': 1 / 3.6, 'mph': 0.44704, 'nœud (kt)': 0.514444, 'pied/s': 0.3048,
    },
  },
  'Temps': {
    base: 's',
    units: {
      'milliseconde (ms)': 1e-3, 'seconde (s)': 1, 'minute (min)': 60,
      'heure (h)': 3600, 'jour (j)': 86400, 'semaine': 604800, 'année (365 j)': 31536000,
    },
  },
  'Angle': {
    base: 'rad',
    units: {
      'degré (°)': Math.PI / 180, 'radian (rad)': 1, 'grade (gon)': Math.PI / 200,
      'tour (tr)': 2 * Math.PI,
    },
  },
  'Données': {
    base: 'octet',
    units: {
      'bit': 0.125, 'octet (o)': 1, 'kilooctet (ko)': 1e3, 'mégaoctet (Mo)': 1e6,
      'gigaoctet (Go)': 1e9, 'téraoctet (To)': 1e12, 'kibioctet (kio)': 1024,
      'mébioctet (Mio)': 1024 ** 2, 'gibioctet (Gio)': 1024 ** 3,
    },
  },
  'Pression': {
    base: 'Pa',
    units: {
      'pascal (Pa)': 1, 'hectopascal (hPa)': 100, 'kilopascal (kPa)': 1e3,
      'bar': 1e5, 'millibar (mbar)': 100, 'atmosphère (atm)': 101325,
      'mm de mercure (mmHg)': 133.322,
    },
  },
  'Énergie': {
    base: 'J',
    units: {
      'joule (J)': 1, 'kilojoule (kJ)': 1e3, 'calorie (cal)': 4.184,
      'kilocalorie (kcal)': 4184, 'wattheure (Wh)': 3600,
      'kilowattheure (kWh)': 3.6e6, 'électronvolt (eV)': 1.602177e-19,
    },
  },
};

let cat = 'Longueur', lastFrom = null, lastTo = null;

function fillCats() {
  const box = $('conv-cats');
  box.innerHTML = '';
  for (const name of Object.keys(CATS)) {
    const b = document.createElement('button');
    b.className = 'chip' + (name === cat ? ' active' : '');
    b.textContent = name;
    b.addEventListener('click', () => {
      cat = name;
      lastFrom = lastTo = null;
      box.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === b));
      fillUnits();
      convert();
    });
    box.appendChild(b);
  }
}

function fillUnits() {
  const from = $('conv-from'), to = $('conv-to');
  const names = Object.keys(CATS[cat].units);
  from.innerHTML = to.innerHTML = '';
  for (const n of names) {
    from.add(new Option(n, n));
    to.add(new Option(n, n));
  }
  // choix par défaut différents
  if (!lastFrom || !CATS[cat].units[lastFrom]) lastFrom = names[Math.min(1, names.length - 1)];
  if (!lastTo || !CATS[cat].units[lastTo] || lastTo === lastFrom) {
    lastTo = names[names.length - 1 === names.indexOf(lastFrom) ? 0 : names.length - 1];
    if (lastTo === lastFrom) lastTo = names.length > 1 ? names[1] : names[0];
  }
  from.value = lastFrom;
  to.value = lastTo;
}

const NBSP = '\u202F';
function fmt(v) {
  if (!isFinite(v)) return '—';
  if (v === 0) return '0';
  if (Math.abs(v) >= 1e12 || Math.abs(v) < 1e-9) {
    const exp = Math.floor(Math.log10(Math.abs(v)));
    return parseFloat((v / 10 ** exp).toPrecision(10)) + '×10' + String(exp).replace(/[0-9]/g, d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d]).replace('-', '⁻');
  }
  let s = parseFloat(v.toPrecision(10)).toString();
  let [i, f] = s.split('.');
  i = i.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return i + (f ? ',' + f : '');
}

/* Température : via Celsius */
function tempToC(v, u) { return u === 'C' ? v : u === 'F' ? (v - 32) * 5 / 9 : v - 273.15; }
function tempFromC(c, u) { return u === 'C' ? c : u === 'F' ? c * 9 / 5 + 32 : c + 273.15; }

function convert() {
  lastFrom = $('conv-from').value;
  lastTo = $('conv-to').value;
  const raw = $('conv-input').value.trim().replace(',', '.').replace(/\s/g, '');
  const out = $('conv-result'), form = $('conv-formula');
  const src = CATS[cat].units[lastFrom].split('(')[0].trim();
  const dst = CATS[cat].units[lastTo].split('(')[0].trim();

  if (raw === '' || isNaN(parseFloat(raw))) {
    out.innerHTML = '—';
    form.textContent = '';
    return;
  }
  const v = parseFloat(raw);
  let res, formula;
  if (CATS[cat].special) {
    const c = tempToC(v, CATS[cat].units[lastFrom]);
    res = tempFromC(c, CATS[cat].units[lastTo]);
    formula = cat === 'Température' ? 'Conversion' + ' ' + lastFrom + ' → ' + lastTo : '';
  } else {
    const f1 = CATS[cat].units[lastFrom], f2 = CATS[cat].units[lastTo];
    res = v * f1 / f2;
    formula = 'Rappel : ' + lastFrom + ' = ' + fmt(f1) + ' ' + (CATS[cat].base) +
      ' · ' + lastTo + ' = ' + fmt(f2) + ' ' + CATS[cat].base + ' · base : ' + CATS[cat].base;
  }
  out.innerHTML = fmt(res) + '<span class="unit">' + dst + '</span>';
  form.textContent = formula;
}

function swap() {
  const f = $('conv-from'), t = $('conv-to');
  [lastFrom, lastTo] = [t.value, f.value];
  if (CATS[cat].special && CATS[cat].units[lastFrom] === CATS[cat].units[lastTo]) return;
  f.value = lastFrom; t.value = lastTo;
  convert();
}

function boot() {
  fillCats();
  fillUnits();
  $('conv-input').addEventListener('input', convert);
  $('conv-from').addEventListener('change', convert);
  $('conv-to').addEventListener('change', convert);
  $('conv-swap').addEventListener('click', swap);
  convert();
}

boot();

return { convert };
})();
