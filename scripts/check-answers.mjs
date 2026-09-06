// Sprawdza, czy wyliczone odpowiedzi zgadzają się z wydrukiem, dla każdego typu zadań.
import { chromium } from 'playwright';
import { applyOp, findEquations, openCard, readCrosswords, setNumber, setSelect, toggle } from './ui.mjs';

const cases = [
  { card: 'Dodawanie w pamięci', tweak: async () => {} },
  { card: 'Dodawanie w pamięci', tweak: (p) => setSelect(p, 'Przekraczanie progu', 'without') },
  { card: 'Dodawanie w pamięci', tweak: async (p) => { await setNumber(p, 'Maksymalny wynik', 1000); await setNumber(p, 'Ile liczb do dodania', 4); } },
  { card: 'Dodawanie w pamięci', tweak: (p) => setSelect(p, 'Szukana liczba', 'term') },
  { card: 'Dodawanie pisemne', tweak: async () => {} },
  { card: 'Dodawanie pisemne', tweak: (p) => setSelect(p, 'Przeniesienia', 'without') },
  { card: 'Odejmowanie w pamięci', tweak: async () => {} },
  { card: 'Odejmowanie w pamięci', tweak: async (p) => { await setNumber(p, 'Największa liczba w działaniu', 1000); await setNumber(p, 'Ile liczb w działaniu', 3); } },
  { card: 'Odejmowanie w pamięci', tweak: (p) => setSelect(p, 'Szukana liczba', 'mixed') },
  { card: 'Odejmowanie pisemne', tweak: async () => {} },
  { card: 'Odejmowanie pisemne', tweak: (p) => setSelect(p, 'Pożyczki', 'without') },
  { card: 'Mnożenie w pamięci', tweak: async () => {} },
  { card: 'Mnożenie w pamięci', tweak: (p) => setSelect(p, 'Szukana liczba', 'term') },
  { card: 'Mnożenie w pamięci', tweak: async (p) => { await setSelect(p, 'Skąd brać czynniki', 'digits'); await setNumber(p, 'Maksymalny wynik', 5000); } },
  { card: 'Mnożenie pisemne', tweak: async () => {} },
  { card: 'Mnożenie pisemne', tweak: (p) => setNumber(p, 'Ilość cyfr mnożnika (dolna liczba)', 1) },
  { card: 'Mnożenie pisemne', tweak: (p) => setNumber(p, 'Ilość cyfr mnożnika (dolna liczba)', 3) },
  { card: 'Mnożenie pisemne', tweak: (p) => setSelect(p, 'Przeniesienia', 'without') },
  { card: 'Dzielenie w pamięci', tweak: async () => {} },
  { card: 'Dzielenie w pamięci', tweak: (p) => setSelect(p, 'Szukana liczba', 'mixed') },
  { card: 'Dzielenie w pamięci', tweak: (p) => toggle(p, 'Dzielenie z resztą') },
  { card: 'Uzupełnianie do pełnej liczby', tweak: async () => {} },
  { card: 'Uzupełnianie do pełnej liczby', tweak: async (p) => { await setSelect(p, 'Do ilu uzupełniamy', 'nextTen'); await setSelect(p, 'Postać działania', 'mixed'); await setSelect(p, 'Która liczba zakryta', 'mixed'); } },
];

const apply = (op, terms) => {
  if (op === '+') return terms.reduce((a, x) => a + x, 0);
  if (op === '×') return terms.reduce((a, x) => a * x, 1);
  if (op === ':') return terms.slice(1).reduce((a, x) => Math.floor(a / x), terms[0]);
  return terms.slice(1).reduce((a, x) => a - x, terms[0]);
};

const b = await chromium.launch();
const p = await b.newPage();
p.on('pageerror', (e) => { console.log('PAGE ERROR', e); process.exitCode = 1; });
let bad = 0;
for (const [n, c] of cases.entries()) {
  await openCard(p, c.card);
  await c.tweak(p);
  await p.getByText('Dołącz arkusz odpowiedzi').click();
  await p.waitForTimeout(300);
  const rows = await p.$$eval('.sheet:last-of-type .problem', (els) =>
    els.map((el) => {
      const inline = el.querySelector('.inline-problem');
      const width = el.querySelectorAll('.result-cell').length;
      const columnAnswer = [...el.querySelectorAll('.result-cell')].map((c) => c.textContent).join('').trim();
      // iloczyny częściowe leżą w tej samej siatce — kolejne wiersze po `width` kratek
      const cells = [...el.querySelectorAll('.partial-cell')].map((c) => c.textContent.trim());
      const partials = [];
      for (let i = 0; width > 0 && i + width <= cells.length; i += width) partials.push(cells.slice(i, i + width).join(''));
      return {
        terms: el.dataset.terms.split(',').map(Number),
        op: el.dataset.op,
        blank: Number(el.dataset.blank),
        answer: Number(inline ? el.querySelector('.answer').textContent : columnAnswer),
        // przy dzieleniu z resztą druga wytłuszczona liczba to reszta
        rem: el.dataset.rem === undefined ? null : Number([...el.querySelectorAll('.answer')].at(-1).textContent),
        printed: inline ? Number(el.querySelector('.result').textContent) : null,
        partials,
      };
    }),
  );
  const errs = rows.filter((r) => {
    const result = apply(r.op, r.terms);
    const expected = r.blank >= 0 ? r.terms[r.blank] : result;
    if (expected !== r.answer || r.answer < 0) return true;
    // przy zakrytym składniku wynik działania jest wydrukowany — musi się zgadzać
    if (r.printed !== null && r.printed !== result) return true;
    // reszta musi być niezerowa, mniejsza od dzielnika i domykać dzielenie
    if (r.rem !== null && (r.rem < 1 || r.rem >= r.terms[1] || r.terms[0] !== r.answer * r.terms[1] + r.rem)) return true;
    // wiersze iloczynów częściowych muszą sumować się do wyniku
    if (r.partials.length) {
      const sum = r.partials.reduce((a, s, j) => a + Number(s) * 10 ** j, 0);
      if (sum !== result) return true;
    }
    return false;
  });
  const count = await p.$$eval('.sheet:first-of-type .problem', (e) => e.length);
  console.log(`${n + 1}. ${c.card}: ${count} zadań, błędne odpowiedzi: ${errs.length}`);
  if (errs.length) { bad++; console.log('   ', JSON.stringify(errs.slice(0, 3))); }
}
// --- krzyżówki: równania odczytane z wydruku muszą być prawdziwe i rozwiązywalne ---

const readGrid = (sel) => readCrosswords(p, sel);

/** Czy zakryte kratki da się wyliczyć krok po kroku (ta sama zasada, co w generatorze). */
function deducible(eqs, hidden, ops) {
  const unknown = new Set(hidden);
  let changed = true;
  while (changed && unknown.size) {
    changed = false;
    for (const e of eqs) {
      const miss = e.keys.filter((k) => unknown.has(k));
      if (miss.length !== 1) continue;
      if (miss[0] === e.keys[1] && ops.filter((o) => applyOp(o, e.a, e.b) === e.c).length !== 1) continue;
      unknown.delete(miss[0]);
      changed = true;
    }
  }
  return unknown.size === 0;
}

const cwCases = [
  { label: 'mnożenie i dzielenie', ops: ['×', ':'], tweak: async () => {} },
  { label: 'wszystkie działania, zakryte znaki', ops: ['+', '-', '×', ':'], tweak: async (p) => {
    await toggle(p, 'Dodawanie'); await toggle(p, 'Odejmowanie'); await toggle(p, 'Zakrywaj znaki działań');
  } },
  { label: 'samo dodawanie, 16 działań', ops: ['+'], tweak: async (p) => {
    await toggle(p, 'Mnożenie'); await toggle(p, 'Dzielenie'); await toggle(p, 'Dodawanie');
    await setNumber(p, 'Ile działań w krzyżówce', 16);
  } },
  { label: 'odejmowanie, tylko wyniki zakryte', ops: ['-'], tweak: async (p) => {
    await toggle(p, 'Mnożenie'); await toggle(p, 'Dzielenie'); await toggle(p, 'Odejmowanie');
    await toggle(p, 'Zakrywaj liczby przed znakiem =');
  } },
  { label: 'mnożenie, 40% zakrytych', ops: ['×'], tweak: async (p) => {
    await toggle(p, 'Dzielenie'); await setNumber(p, 'Ile kratek zakryć (%)', 40);
  } },
];

for (const c of cwCases) {
  await openCard(p, 'Krzyżówki matematyczne');
  await c.tweak(p);
  await p.getByText('Dołącz arkusz odpowiedzi').click();
  await p.waitForTimeout(400);
  const task = await readGrid('.sheet:first-of-type .problem-crossword');
  const done = await readGrid('.sheet:last-of-type .problem-crossword');
  let errs = 0;
  let blanks = 0;
  for (const [i, g] of done.entries()) {
    const eqs = findEquations(g.rows);
    const hiddenKeys = [];
    task[i].rows.forEach((row, r) => row.forEach((x, cc) => { if (x && x.hidden) hiddenKeys.push(`${r},${cc}`); }));
    blanks += hiddenKeys.length;
    const wrong = eqs.filter((e) => applyOp(e.op, e.a, e.b) !== e.c);
    // odczytane równania muszą pokrywać się z liczbą zapisaną przez generator
    if (wrong.length || eqs.length !== g.eqs) errs++;
    // arkusz odpowiedzi wypełnia każdą kratkę
    else if (g.rows.flat().filter(Boolean).some((x) => x.text === '')) errs++;
    // na arkuszu z zadaniami zakryte kratki są puste, a całość da się rozwiązać
    else if (task[i].rows.flat().filter(Boolean).some((x) => (x.text === '') !== x.hidden)) errs++;
    else if (!deducible(eqs, hiddenKeys, c.ops)) errs++;
  }
  console.log(`krzyżówka — ${c.label}: ${done.length} krzyżówek, zakrytych kratek ${blanks}, błędne: ${errs}`);
  if (errs || !done.length || !blanks) { bad++; }
}

// --- pozostałe typy zadań: dane zapisane w atrybutach kontra to, co widać na arkuszu ---

/** Odczyt zadań razem z tym, co faktycznie zostało narysowane. */
const readProblems = (sheet) =>
  p.$$eval(`${sheet} .problem`, (els) =>
    els.map((el) => ({
      data: { ...el.dataset },
      blanks: el.querySelectorAll('.blank, .nl-blank').length,
      answers: [...el.querySelectorAll('.answer, .nl-answer')].map((x) => x.textContent.trim()),
      circled: [...el.querySelectorAll('.mark-num')].map((x) => (x.classList.contains('marked') ? 1 : 0)),
      hands: el.querySelectorAll('.clock-hand').length,
      sign: el.querySelector('.cmp-sign')?.textContent.trim() ?? null,
      cells: [...el.querySelectorAll('.pixel-cell')].map((x) => x.textContent.trim()),
      fills: [...el.querySelectorAll('.pixel-cell')].map((x) => x.style.background || ''),
    })),
  );

const list = (s) => (s === '' ? [] : s.split(',').map(Number));
const hiddenValues = (values, hidden) => values.filter((_, i) => hidden[i]).join(',');
const constantStep = (values, step) => values.every((v, i) => i === 0 || v - values[i - 1] === step);

/** Wartość jednej strony porównania, zapisanej jako „24+3” albo „24”. */
const evalSide = (text) => {
  const m = /^(\d+)([+\-×])(\d+)$/.exec(text);
  if (!m) return Number(text);
  const [, a, op, b] = m;
  return op === '+' ? +a + +b : op === '-' ? +a - +b : +a * +b;
};

/** Każdy sprawdzacz dostaje zadanie z arkusza zadań i to samo z arkusza odpowiedzi. */
const checks = {
  compare: (t, a) => {
    const left = evalSide(t.data.left);
    const right = evalSide(t.data.right);
    const expected = left < right ? '<' : left > right ? '>' : '=';
    if (expected !== t.data.answer) return `zły znak: ${t.data.left} ${t.data.answer} ${t.data.right}`;
    if (t.blanks !== 1) return 'zadanie powinno mieć dokładnie jedną kratkę';
    if (a.sign !== t.data.answer) return `arkusz odpowiedzi pokazuje „${a.sign}”`;
    return null;
  },
  sequence: (t, a) => {
    const values = list(t.data.values);
    const hidden = list(t.data.hidden);
    if (!constantStep(values, Number(t.data.step))) return `ciąg bez stałego kroku: ${t.data.values}`;
    if (values.some((v) => v < 0)) return `ujemny wyraz ciągu: ${t.data.values}`;
    if (hidden[0]) return 'pierwszy wyraz nie może być zakryty';
    if (hidden.filter((h) => !h).length < 2) return 'mniej niż dwa widoczne wyrazy — kroku nie da się odczytać';
    if (t.blanks !== hidden.filter(Boolean).length) return 'liczba kratek nie zgadza się z zakrytymi wyrazami';
    if (a.answers.join(',') !== hiddenValues(values, hidden)) return `złe odpowiedzi: ${a.answers}`;
    return null;
  },
  neighbor: (t, a) => {
    const value = Number(t.data.value);
    const step = Number(t.data.step);
    const expected = [t.data.before, t.data.after].filter((x) => x !== '');
    if (t.data.before !== '' && Number(t.data.before) !== value - step) return 'zły poprzednik';
    if (t.data.after !== '' && Number(t.data.after) !== value + step) return 'zły następnik';
    if (!expected.length) return 'zadanie bez niewiadomej';
    if (t.blanks !== expected.length) return 'zła liczba kratek';
    if (a.answers.join(',') !== expected.join(',')) return `złe odpowiedzi: ${a.answers}`;
    return null;
  },
  mark: (t, a) => {
    const numbers = list(t.data.values);
    const marked = list(t.data.marked);
    const even = t.data.label === 'parzyste';
    if (numbers.some((n, i) => ((n % 2 === 0) === even ? 1 : 0) !== marked[i])) return 'zła parzystość';
    if (!marked.some(Boolean) || marked.every(Boolean)) return 'zadanie bez wyboru — wszystkie albo żadna liczba';
    if (t.circled.some(Boolean)) return 'kółka narysowane już na arkuszu zadań';
    if (a.circled.join(',') !== marked.join(',')) return 'arkusz odpowiedzi otacza inne liczby';
    return null;
  },
  clock: (t, a) => {
    const [h, m] = t.data.label.split(':').map(Number);
    if (h !== Number(t.data.h) || m !== Number(t.data.m)) return `podpis ${t.data.label} nie pasuje do godziny`;
    if (t.data.mode === 'read' && t.hands !== 2) return 'tarcza do odczytania bez wskazówek';
    if (t.data.mode === 'draw' && t.hands !== 0) return 'wskazówki narysowane w zadaniu „narysuj wskazówki”';
    if (t.data.mode === 'read' && t.blanks !== 1) return 'brak miejsca na wpisanie godziny';
    if (a.hands !== 2) return 'arkusz odpowiedzi bez wskazówek';
    if (t.data.mode === 'read' && a.answers[0] !== t.data.label) return `zła godzina w odpowiedziach: ${a.answers[0]}`;
    return null;
  },
  money: (t, a) => {
    const items = list(t.data.items);
    const total = items.reduce((x, y) => x + y, 0);
    if (total !== Number(t.data.total)) return 'suma nominałów nie zgadza się z wynikiem';
    const zl = Math.floor(total / 100);
    const gr = total % 100;
    const label = !zl ? `${gr} gr` : gr ? `${zl} zł ${gr} gr` : `${zl} zł`;
    if (a.answers[0] !== label) return `zły zapis kwoty: „${a.answers[0]}” zamiast „${label}”`;
    return null;
  },
  numberline: (t, a) => {
    const values = list(t.data.values);
    const hidden = list(t.data.hidden);
    if (!constantStep(values, values[1] - values[0])) return `nierówne podziałki: ${t.data.values}`;
    if (values.some((v) => v < 0)) return 'ujemna liczba na osi';
    if (hidden[0]) return 'pierwszy opis nie może być zakryty';
    if (t.blanks !== hidden.filter(Boolean).length) return 'liczba kratek nie zgadza się z zakrytymi opisami';
    if (a.answers.join(',') !== hiddenValues(values, hidden)) return `złe odpowiedzi: ${a.answers}`;
    return null;
  },
};

const otherCases = [
  { card: 'Porównywanie liczb', tweak: async () => {} },
  { card: 'Porównywanie liczb', tweak: async (p) => { await setSelect(p, 'Co porównujemy', 'expressions'); await toggle(p, 'Mnożenie'); } },
  { card: 'Porównywanie liczb', tweak: async (p) => { await setSelect(p, 'Co porównujemy', 'numbers'); await setNumber(p, 'Ile zadań ze znakiem „=” (%)', 50); } },
  { card: 'Ciągi liczbowe', tweak: async () => {} },
  { card: 'Ciągi liczbowe', tweak: async (p) => { await setSelect(p, 'Kierunek', 'down'); await setSelect(p, 'Gdzie zakryte liczby', 'any'); await setNumber(p, 'Ile liczb zakryć', 4); } },
  { card: 'Ciągi liczbowe', tweak: (p) => setSelect(p, 'Kierunek', 'mixed') },
  { card: 'Poprzednik i następnik', tweak: async () => {} },
  { card: 'Poprzednik i następnik', tweak: async (p) => { await setNumber(p, 'O ile mniej i więcej', 10); await setSelect(p, 'Co uzupełnia uczeń', 'mixed'); } },
  { card: 'Liczby parzyste i nieparzyste', tweak: async () => {} },
  { card: 'Liczby parzyste i nieparzyste', tweak: async (p) => { await setSelect(p, 'Czego szukamy', 'mixed'); await setNumber(p, 'Ile liczb w zadaniu', 10); } },
  { card: 'Zegar — godziny', tweak: async () => {} },
  { card: 'Zegar — godziny', tweak: async (p) => { await setSelect(p, 'Co robi uczeń', 'draw'); await setSelect(p, 'Zapis godziny', '24'); await setSelect(p, 'Dokładność', 'five'); } },
  { card: 'Zegar — godziny', tweak: async (p) => { await setSelect(p, 'Co robi uczeń', 'mixed'); await setSelect(p, 'Dokładność', 'minute'); } },
  { card: 'Pieniądze — ile to razem?', tweak: async () => {} },
  { card: 'Pieniądze — ile to razem?', tweak: async (p) => { await setSelect(p, 'Czym płacimy', 'both'); await setNumber(p, 'Ile monet i banknotów', 6); } },
  { card: 'Pieniądze — ile to razem?', tweak: async (p) => { await toggle(p, 'Dopuść banknoty'); await setNumber(p, 'Największa kwota (w zł)', 200); } },
  { card: 'Pieniądze — ile to razem?', tweak: (p) => setSelect(p, 'Czym płacimy', 'gr') },
  { card: 'Oś liczbowa', tweak: async () => {} },
  { card: 'Oś liczbowa', tweak: async (p) => { await setNumber(p, 'Co ile', 5); await setNumber(p, 'Największa liczba na osi', 100); } },
  { card: 'Oś liczbowa', tweak: async (p) => { await toggle(p, 'Oś zawsze zaczyna się od zera'); await setNumber(p, 'Ile liczb zakryć', 5); } },
];

for (const [n, c] of otherCases.entries()) {
  await openCard(p, c.card);
  await c.tweak(p);
  await p.getByText('Dołącz arkusz odpowiedzi').click();
  await p.waitForTimeout(300);
  const task = await readProblems('.sheet:first-of-type');
  const done = await readProblems('.sheet:last-of-type');
  const errs = task
    .map((t, i) => checks[t.data.kind](t, done[i]))
    .filter(Boolean);
  console.log(`${n + 1}. ${c.card}: ${task.length} zadań, błędne: ${errs.length}`);
  if (errs.length || !task.length) {
    bad++;
    console.log('   ', JSON.stringify(errs.slice(0, 3)));
  }
}

// --- zapis krokowy i kolorowanka ---

/** Wartość jednego kroku, np. „(60+50)+(4+2)” albo „56+30-1”. */
const flatten = (text) => (text.match(/[+-]?\d+/g) ?? []).reduce((a, x) => a + Number(x), 0);
const evalStep = (text) => {
  let t = text;
  while (/\(([^()]+)\)/.test(t)) t = t.replace(/\(([^()]+)\)/, (_, inner) => String(flatten(inner)));
  return flatten(t);
};

/** Wartość działania z kratki kolorowanki, np. „7+5”, „9−4”, „3×2”. */
const cellValue = (text) => {
  const m = /^(\d+)([+−×-])(\d+)$/.exec(text);
  if (!m) return NaN;
  const [, a, op, b] = m;
  return op === '+' ? +a + +b : op === '×' ? +a * +b : +a - +b;
};

checks.steps = (t, a) => {
  const parts = t.data.steps.split('|');
  const values = parts.map(evalStep);
  if (new Set(values).size !== 1) return `kroki mają różne wartości: ${t.data.steps}`;
  if (values.some((v) => v < 0)) return `ujemna wartość w krokach: ${t.data.steps}`;
  const answers = t.data.answers === '' ? [] : t.data.answers.split(',');
  if (!answers.length) return 'zadanie bez niewiadomej';
  if (t.blanks !== answers.length) return 'liczba kratek nie zgadza się z zakrytymi liczbami';
  if (a.answers.join(',') !== answers.join(',')) return `złe odpowiedzi: ${a.answers}`;
  return null;
};

checks.pixel = (t, a) => {
  const palette = t.data.palette.split(',').map(Number);
  const colors = t.data.colors.split(',').map(Number);
  if (new Set(palette).size !== palette.length) return 'dwa kolory mają ten sam wynik';
  if (t.cells.length !== colors.length) return 'liczba kratek nie zgadza się z obrazkiem';
  for (const [i, text] of t.cells.entries()) {
    if (cellValue(text) !== palette[colors[i]]) {
      return `kratka ${i}: „${text}” nie daje ${palette[colors[i]]}`;
    }
  }
  if (a.cells.some((text) => text !== '')) return 'arkusz odpowiedzi zostawia działania na obrazku';
  // każdy kolor wypełniony jednakowo i różny od pozostałych
  const fills = new Map();
  for (const [i, color] of colors.entries()) {
    if (!fills.has(color)) fills.set(color, a.fills[i]);
    else if (fills.get(color) !== a.fills[i]) return 'jeden kolor wypełniony na dwa sposoby';
  }
  if (new Set([...fills.values()]).size !== fills.size) return 'dwa kolory wypełnione tak samo';
  return null;
};

const stepCases = [
  { card: 'Dodawanie ze strategią', tweak: async () => {} },
  { card: 'Dodawanie ze strategią', tweak: (p) => setSelect(p, 'Ile podpowiedzi', 'short') },
  { card: 'Dodawanie ze strategią', tweak: (p) => setSelect(p, 'Ile podpowiedzi', 'bare') },
  { card: 'Dodawanie ze strategią', tweak: (p) => setSelect(p, 'Strategia', 'doubles') },
  { card: 'Dodawanie ze strategią', tweak: async (p) => { await setSelect(p, 'Strategia', 'doubles'); await setSelect(p, 'Co ćwiczymy', 'near'); } },
  { card: 'Dodawanie ze strategią', tweak: (p) => setSelect(p, 'Strategia', 'pairsOfTen') },
  { card: 'Dodawanie ze strategią', tweak: (p) => setSelect(p, 'Strategia', 'splitTens') },
  { card: 'Dodawanie ze strategią', tweak: async (p) => { await setSelect(p, 'Strategia', 'splitTens'); await toggle(p, 'Jedności bez przekraczania progu'); } },
  { card: 'Dodawanie ze strategią', tweak: (p) => setSelect(p, 'Strategia', 'roundAdjust') },
  { card: 'Dodawanie ze strategią', tweak: (p) => setSelect(p, 'Strategia', 'moveUnits') },
  { card: 'Kolorowanka według wyniku', tweak: async () => {} },
  { card: 'Kolorowanka według wyniku', tweak: async (p) => { await setSelect(p, 'Wzór', 'dom'); await toggle(p, 'Odejmowanie'); await setNumber(p, 'Największy wynik', 20); } },
  { card: 'Kolorowanka według wyniku', tweak: async (p) => { await setSelect(p, 'Wzór', 'zaglowka'); await toggle(p, 'Mnożenie'); await setNumber(p, 'Największy wynik', 24); } },
];

for (const [n, c] of stepCases.entries()) {
  await openCard(p, c.card);
  await c.tweak(p);
  await p.getByText('Dołącz arkusz odpowiedzi').click();
  await p.waitForTimeout(300);
  const task = await readProblems('.sheet:first-of-type');
  const done = await readProblems('.sheet:last-of-type');
  const errs = task.map((t, i) => checks[t.data.kind](t, done[i])).filter(Boolean);
  console.log(`${n + 1}. ${c.card}: ${task.length} zadań, błędne: ${errs.length}`);
  if (errs.length || !task.length) {
    bad++;
    console.log('   ', JSON.stringify(errs.slice(0, 3)));
  }
}

// --- ramka „wyjaśnienie i przykłady” ---

await openCard(p, 'Dodawanie ze strategią');
await p.getByText('Zacznij od wyjaśnienia i przykładów').click();
await setNumber(p, 'Ile przykładów', 3);
await p.getByText('Dołącz arkusz odpowiedzi').click();
await p.waitForTimeout(400);
const intro = await p.$eval('.sheet:first-of-type .intro', (el) => ({
  rule: el.querySelector('.intro-rule')?.textContent.trim() ?? '',
  examples: el.querySelectorAll('.intro-example').length,
  blanks: el.querySelectorAll('.blank').length,
  answers: [...el.querySelectorAll('.answer')].length,
}));
const introErrs = [];
if (intro.rule.length < 40) introErrs.push('brak reguły w ramce');
if (intro.examples !== 3) introErrs.push(`przykładów ${intro.examples} zamiast 3`);
if (intro.blanks) introErrs.push('przykład z pustą kratką — powinien być rozwiązany');
if (!intro.answers) introErrs.push('przykłady bez wypełnionych liczb');
console.log(`wyjaśnienie i przykłady: błędne: ${introErrs.length}`, introErrs);
if (introErrs.length) bad++;

// --- bloki: kilka konfiguracji tego samego typu na jednym arkuszu ---

await openCard(p, 'Uzupełnianie do pełnej liczby');
await setNumber(p, 'Liczba zadań', 12);
await p.getByText('+ Dodaj blok zadań').click();
const second = p.locator('.block-config').nth(1);
await second.locator('label.field', { hasText: 'Nagłówek nad blokiem' }).locator('input').fill('Do stu');
await second.locator('label.field', { hasText: 'Do ilu uzupełniamy' }).locator('select').selectOption('hundred');
await second.locator('label.field', { hasText: 'Liczba zadań' }).locator('input').fill('8');
await p.getByText('Dołącz arkusz odpowiedzi').click();
await p.waitForTimeout(400);

const readBlocks = (sheet) => p.$$eval(`${sheet} .block`, (els) => els.map((el) => ({
  heading: el.querySelector('.block-heading')?.textContent ?? '',
  numbers: [...el.querySelectorAll('.problem-no')].map((x) => Number(x.textContent.replace('.', ''))),
  targets: [...el.querySelectorAll('.problem')].map((x) => {
    const [a, b] = x.dataset.terms.split(',').map(Number);
    return a + b;
  }),
})));

const taskBlocks = await readBlocks('.sheet:first-of-type');
const answerBlocks = await readBlocks('.sheet:last-of-type');
const blockErrs = [];
if (taskBlocks.length !== 2) blockErrs.push(`bloków ${taskBlocks.length} zamiast 2`);
else {
  const [one, two] = taskBlocks;
  if (one.targets.length !== 12 || two.targets.length !== 8) blockErrs.push('zła liczba zadań w blokach');
  if (!one.targets.every((t) => t === 10)) blockErrs.push('pierwszy blok nie uzupełnia do 10');
  if (!two.targets.every((t) => t === 100)) blockErrs.push('drugi blok nie uzupełnia do 100');
  // numeracja biegnie przez całą stronę, a nie od nowa w każdym bloku
  if (one.numbers[0] !== 1 || two.numbers[0] !== 13 || two.numbers.at(-1) !== 20) blockErrs.push('numeracja nie jest ciągła');
  if (one.heading !== '' || two.heading !== 'Do stu') blockErrs.push('złe nagłówki bloków');
  if (answerBlocks.length !== 2) blockErrs.push('arkusz odpowiedzi bez podziału na bloki');
  else if (answerBlocks.some((b, i) => b.targets.join(',') !== taskBlocks[i].targets.join(','))) {
    blockErrs.push('odpowiedzi nie odpowiadają zadaniom blok w blok');
  }
}
console.log(`bloki — dwa zestawy uzupełniania na jednej stronie: błędne: ${blockErrs.length}`, blockErrs);
if (blockErrs.length) bad++;

await b.close();
console.log(bad ? 'NIEPOWODZENIE' : 'OK — wszystkie odpowiedzi zgodne');
if (bad) process.exitCode = 1;
