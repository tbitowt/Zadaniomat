// Sprawdza, czy wygenerowane zadania mieszczą się w zadanych ograniczeniach.
import { chromium } from 'playwright';
import { findEquations, openCard, readCrosswords, setNumber, setSelect, toggle } from './ui.mjs';

const carry = (t) => { let c = 0; const w = Math.max(...t.map(x => String(x).length));
  for (let i = 0; i < w; i++) { const s = t.reduce((a, x) => a + Math.floor(x / 10 ** i) % 10, c); c = Math.floor(s / 10); if (c) return true; } return false; };
const borrow = (a, b) => { for (let i = 0; i < String(a).length; i++) { if ((Math.floor(a / 10 ** i) % 10) < (Math.floor(b / 10 ** i) % 10)) return true; } return false; };
const digits = (n) => String(n).split('').reverse().map(Number);
const mulCarry = (a, b) => {
  for (const y of digits(b)) for (const x of digits(a)) if (x * y > 9) return true;
  const parts = digits(b).map((y, j) => a * y * 10 ** j).filter(v => v > 0);
  return parts.length > 1 && carry(parts);
};

const b = await chromium.launch(); const p = await b.newPage();
p.on('pageerror', (e) => { console.log('PAGE ERROR', e); process.exitCode = 1; });
const grab = async () => p.$$eval('.sheet:first-of-type .problem', els => els.map(e => e.dataset.terms.split(',').map(Number)));
let bad = 0;
const run = async (card, tweak, test, label) => {
  await openCard(p, card);
  await tweak(); await p.waitForTimeout(300);
  const rows = await grab();
  const wrong = rows.filter(r => !test(r));
  if (wrong.length || !rows.length) bad++;
  console.log(`${label}: ${rows.length} zadań, niezgodnych ${wrong.length}`, wrong.slice(0, 3));
};

await run('Dodawanie w pamięci', () => setSelect(p, 'Przekraczanie progu', 'without'), t => !carry(t), 'pamięć/bez przeniesień');
await run('Dodawanie w pamięci', () => setSelect(p, 'Przekraczanie progu', 'with'), t => carry(t), 'pamięć/z przeniesieniem');
await run('Dodawanie w pamięci', () => setNumber(p, 'Maksymalny wynik', 50), t => t.reduce((a,x)=>a+x,0) <= 50, 'pamięć/limit 50');
await run('Dodawanie w pamięci', async () => { await setNumber(p, 'Maksymalny wynik', 100); await setNumber(p, 'Minimalny wynik', 80); },
  t => { const s = t.reduce((a,x)=>a+x,0); return s >= 80 && s <= 100; }, 'pamięć/wynik 80-100');
await run('Dodawanie pisemne', () => setSelect(p, 'Przeniesienia', 'without'), t => !carry(t), 'pisemne/bez przeniesień');
await run('Odejmowanie pisemne', () => setSelect(p, 'Pożyczki', 'without'), t => !borrow(t[0], t[1]), 'odejm./bez pożyczek');
await run('Odejmowanie pisemne', () => setSelect(p, 'Pożyczki', 'with'), t => borrow(t[0], t[1]), 'odejm./z pożyczką');
await run('Mnożenie w pamięci', async () => {}, t => t.every(x => x >= 2 && x <= 10), 'mnożenie/tabliczka 2-10');
await run('Mnożenie w pamięci', async () => { await setNumber(p, 'Czynniki od', 6); await setNumber(p, 'Czynniki do', 9); },
  t => t.every(x => x >= 6 && x <= 9), 'mnożenie/czynniki 6-9');
await run('Mnożenie w pamięci', async () => { await setSelect(p, 'Skąd brać czynniki', 'digits'); await setNumber(p, 'Maksymalny wynik', 500); },
  t => t.reduce((a,x)=>a*x,1) <= 500, 'mnożenie/limit 500');
await run('Mnożenie pisemne', () => setSelect(p, 'Przeniesienia', 'without'), t => !mulCarry(t[0], t[1]), 'mnoż. pisemne/bez przeniesień');
await run('Mnożenie pisemne', () => setSelect(p, 'Przeniesienia', 'with'), t => mulCarry(t[0], t[1]), 'mnoż. pisemne/z przeniesieniem');

// --- pozostałe typy zadań: czy trzymają się ustawień z formularza ---

const grabData = () => p.$$eval('.sheet:first-of-type .problem', (els) => els.map((e) => ({ ...e.dataset })));
const list = (s) => (s === '' || s === undefined ? [] : s.split(',').map(Number));

const runData = async (card, tweak, test, label) => {
  await openCard(p, card);
  await tweak();
  await p.waitForTimeout(300);
  const rows = await grabData();
  const wrong = rows.filter((r) => !test(r));
  if (wrong.length || !rows.length) bad++;
  console.log(`${label}: ${rows.length} zadań, niezgodnych ${wrong.length}`, wrong.slice(0, 2));
};

// dzielenie w pamięci
await runData('Dzielenie w pamięci', async () => {}, (r) => {
  const [a, b] = list(r.terms);
  return a % b === 0 && a <= 100 && b >= 2 && b <= 10 && a / b >= 2 && a / b <= 10;
}, 'dzielenie/tabliczka bez reszty');
await runData('Dzielenie w pamięci', async () => {
  await setNumber(p, 'Dzielnik od', 3);
  await setNumber(p, 'Dzielnik do', 4);
  await setNumber(p, 'Największa liczba dzielona', 40);
}, (r) => {
  const [a, b] = list(r.terms);
  return b >= 3 && b <= 4 && a <= 40 && a % b === 0;
}, 'dzielenie/dzielnik 3-4, do 40');
await runData('Dzielenie w pamięci', () => toggle(p, 'Dzielenie z resztą'), (r) => {
  const [a, b] = list(r.terms);
  const rest = Number(r.rem);
  return rest >= 1 && rest < b && a <= 100 && (a - rest) % b === 0;
}, 'dzielenie/z resztą');

// uzupełnianie do pełnej liczby
await runData('Uzupełnianie do pełnej liczby', async () => {}, (r) => {
  const t = list(r.terms);
  return r.op === '+' && t[0] + t[1] === 10 && Number(r.blank) === 1;
}, 'uzupełnianie/do 10');
await runData('Uzupełnianie do pełnej liczby', async () => {
  await setSelect(p, 'Do ilu uzupełniamy', 'nextTen');
  await setNumber(p, 'Największa liczba', 100);
}, (r) => {
  const t = list(r.terms);
  const full = t[0] + t[1];
  return full % 10 === 0 && full <= 100 && t[1] >= 1 && t[1] <= 9;
}, 'uzupełnianie/do pełnej dziesiątki');
await runData('Uzupełnianie do pełnej liczby', () => setSelect(p, 'Postać działania', 'sub'), (r) => {
  const t = list(r.terms);
  return r.op === '-' && t[0] === 10;
}, 'uzupełnianie/odejmowanie od 10');

// porównywanie
const sideValue = (text) => {
  const m = /^(\d+)([+\-×])(\d+)$/.exec(text);
  if (!m) return Number(text);
  const [, a, op, b] = m;
  return op === '+' ? +a + +b : op === '-' ? +a - +b : +a * +b;
};
await runData('Porównywanie liczb', () => setNumber(p, 'Największa liczba', 12),
  (r) => sideValue(r.left) <= 12 && sideValue(r.right) <= 12, 'porównywanie/liczby do 12');
await runData('Porównywanie liczb', () => setNumber(p, 'Ile zadań ze znakiem „=” (%)', 0),
  (r) => r.answer !== '=', 'porównywanie/bez znaku równości');
await runData('Porównywanie liczb', () => setSelect(p, 'Co porównujemy', 'numbers'),
  (r) => !/[+\-×]/.test(r.left) && !/[+\-×]/.test(r.right), 'porównywanie/same liczby');

// ciągi liczbowe
await runData('Ciągi liczbowe', async () => {
  await setNumber(p, 'Krok od', 3);
  await setNumber(p, 'Krok do', 3);
  await setNumber(p, 'Największa liczba', 60);
}, (r) => {
  const v = list(r.values);
  return Number(r.step) === 3 && v.every((x, i) => i === 0 || x - v[i - 1] === 3) && Math.max(...v) <= 60;
}, 'ciągi/krok 3, do 60');
await runData('Ciągi liczbowe', async () => {
  await setSelect(p, 'Kierunek', 'down');
  await setNumber(p, 'Ile liczb w ciągu', 8);
  await setNumber(p, 'Ile liczb zakryć', 3);
}, (r) => {
  const v = list(r.values);
  const h = list(r.hidden);
  return v.length === 8 && Number(r.step) < 0 && Math.min(...v) >= 0 && h.filter(Boolean).length === 3;
}, 'ciągi/malejące, 8 liczb, 3 zakryte');

// poprzednik i następnik
await runData('Poprzednik i następnik', async () => {
  await setNumber(p, 'Liczby od', 20);
  await setNumber(p, 'Liczby do', 40);
  await setNumber(p, 'O ile mniej i więcej', 10);
}, (r) => {
  const v = Number(r.value);
  return Number(r.step) === 10 && v >= 20 && v <= 30 && (r.before === '' || Number(r.before) === v - 10);
}, 'sąsiedzi/krok 10 w zakresie 20-40');
await runData('Poprzednik i następnik', () => setSelect(p, 'Co uzupełnia uczeń', 'after'),
  (r) => r.before === '' && r.after !== '', 'sąsiedzi/tylko następnik');

// parzyste i nieparzyste
await runData('Liczby parzyste i nieparzyste', async () => {
  await setSelect(p, 'Czego szukamy', 'odd');
  await setNumber(p, 'Liczby od', 10);
  await setNumber(p, 'Liczby do', 30);
  await setNumber(p, 'Ile liczb w zadaniu', 8);
}, (r) => {
  const v = list(r.values);
  return r.label === 'nieparzyste' && v.length === 8 && new Set(v).size === 8 && v.every((x) => x >= 10 && x <= 30);
}, 'parzyste/nieparzyste 10-30, 8 różnych liczb');

// oś liczbowa
await runData('Oś liczbowa', async () => {
  await setNumber(p, 'Co ile', 5);
  await setNumber(p, 'Ile podziałek', 8);
  await setNumber(p, 'Największa liczba na osi', 100);
}, (r) => {
  const v = list(r.values);
  return v.length === 8 && v.every((x, i) => i === 0 || x - v[i - 1] === 5) && Math.max(...v) <= 100 && v[0] % 5 === 0;
}, 'oś/8 podziałek co 5, do 100');
await runData('Oś liczbowa', () => toggle(p, 'Oś zawsze zaczyna się od zera'),
  (r) => list(r.values)[0] === 0, 'oś/zawsze od zera');

// zegar
await runData('Zegar — godziny', async () => {}, (r) => {
  const h = Number(r.h);
  return [0, 30].includes(Number(r.m)) && h >= 1 && h <= 12 && r.mode === 'read';
}, 'zegar/co pół godziny, 12-godzinny');
await runData('Zegar — godziny', async () => {
  await setSelect(p, 'Dokładność', 'quarter');
  await setSelect(p, 'Zapis godziny', '24');
  await setSelect(p, 'Co robi uczeń', 'draw');
}, (r) => {
  const h = Number(r.h);
  return [0, 15, 30, 45].includes(Number(r.m)) && h >= 0 && h <= 23 && r.mode === 'draw';
}, 'zegar/kwadranse, 24-godzinny, rysowanie');

// pieniądze
const ZL = [100, 200, 500];
const GR = [1, 2, 5, 10, 20, 50];
const BANK = [1000, 2000, 5000, 10000];
await runData('Pieniądze — ile to razem?', async () => {}, (r) => {
  const items = list(r.items);
  return items.length === 4 && items.every((v) => ZL.includes(v)) && Number(r.total) <= 2000;
}, 'pieniądze/tylko złote, 4 monety, do 20 zł');
await runData('Pieniądze — ile to razem?', async () => {
  await setSelect(p, 'Czym płacimy', 'gr');
  await setNumber(p, 'Największa kwota (w gr)', 80);
}, (r) => {
  const items = list(r.items);
  return items.every((v) => GR.includes(v)) && Number(r.total) <= 80;
}, 'pieniądze/tylko grosze, do 80 gr');
await runData('Pieniądze — ile to razem?', async () => {
  await toggle(p, 'Dopuść banknoty');
  await setNumber(p, 'Największa kwota (w zł)', 150);
  await setNumber(p, 'Ile monet i banknotów', 5);
}, (r) => {
  const items = list(r.items);
  return items.length === 5 && items.every((v) => [...ZL, ...BANK].includes(v)) && Number(r.total) <= 15000;
}, 'pieniądze/z banknotami, 5 sztuk, do 150 zł');

// --- krzyżówki ---
const flatCells = (g) => g.rows.flat().filter(Boolean);

const runCrossword = async (tweak, test, label) => {
  await openCard(p, 'Krzyżówki matematyczne');
  await tweak(); await p.waitForTimeout(400);
  const grids = await readCrosswords(p, '.sheet:first-of-type .problem-crossword');
  const wrong = grids.filter(g => !test(g));
  if (wrong.length || !grids.length) bad++;
  console.log(`${label}: ${grids.length} krzyżówek, niezgodnych ${wrong.length}`);
};

const opsUsed = (g) => new Set(flatCells(g).filter(c => c.t === 'o').map(c => c.v));
const numbers = (g) => flatCells(g).filter(c => c.t === 'n').map(c => Number(c.v));

await runCrossword(async () => setNumber(p, 'Największa liczba', 60),
  g => numbers(g).every(v => v >= 1 && v <= 60), 'krzyżówka/liczby do 60');
await runCrossword(async () => {},
  g => [...opsUsed(g)].every(o => o === '×' || o === ':'), 'krzyżówka/tylko mnożenie i dzielenie');
await runCrossword(async () => { await toggle(p, 'Mnożenie'); await toggle(p, 'Dzielenie'); await toggle(p, 'Dodawanie'); },
  g => [...opsUsed(g)].every(o => o === '+'), 'krzyżówka/samo dodawanie');
await runCrossword(async () => setNumber(p, 'Ile działań w krzyżówce', 6),
  g => g.eqs === 6, 'krzyżówka/6 działań');
// zakrywamy tylko to, co zaznaczone
await runCrossword(async () => {},
  g => flatCells(g).every(c => !c.hidden || c.t === 'n'), 'krzyżówka/znaki działań odkryte');
await runCrossword(async () => { await toggle(p, 'Zakrywaj liczby przed znakiem ='); await toggle(p, 'Zakrywaj wyniki działań'); await toggle(p, 'Zakrywaj znaki działań'); },
  g => flatCells(g).some(c => c.hidden) && flatCells(g).every(c => !c.hidden || c.t === 'o'), 'krzyżówka/zakryte tylko znaki');
// żadne działanie nie może być wypisane w całości — zawsze zostaje niewiadoma
const everyEqHasBlank = (g) => {
  const hidden = new Set();
  g.rows.forEach((row, r) => row.forEach((c, cc) => { if (c && c.hidden) hidden.add(`${r},${cc}`); }));
  const eqs = findEquations(g.rows);
  return eqs.length === g.eqs && eqs.every(e => e.keys.some(k => hidden.has(k)));
};
await runCrossword(async () => setNumber(p, 'Ile kratek zakryć (%)', 0), everyEqHasBlank, 'krzyżówka/0% — każde działanie z niewiadomą');
await runCrossword(async () => {}, everyEqHasBlank, 'krzyżówka/domyślnie — każde działanie z niewiadomą');
await runCrossword(async () => { await toggle(p, 'Mnożenie'); await toggle(p, 'Dzielenie'); await toggle(p, 'Odejmowanie'); await setNumber(p, 'Ile kratek zakryć (%)', 100); },
  everyEqHasBlank, 'krzyżówka/odejmowanie 100% — każde działanie z niewiadomą');

await b.close();
console.log(bad ? 'NIEPOWODZENIE' : 'OK — wszystkie ograniczenia spełnione');
if (bad) process.exitCode = 1;
