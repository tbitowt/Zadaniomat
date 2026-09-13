// Sprawdza, czy wygenerowane zadania mieszczą się w zadanych ograniczeniach.
import { chromium } from 'playwright';
import { findEquations, openCard, readCrosswords, setNumber, setRange, setSelect, toggle, typeNumber } from './ui.mjs';

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

// --- zakres od–do dla każdej liczby w działaniu ---

const within = (x, [lo, hi]) => x >= lo && x <= hi;
const byRanges = () => setSelect(p, 'Jak dobierać liczby', 'ranges');

await run('Odejmowanie w pamięci', async () => {
  await byRanges();
  await setRange(p, '1. liczba', 10, 20);
  await setRange(p, '2. liczba', 1, 10);
}, t => t.length === 2 && within(t[0], [10, 20]) && within(t[1], [1, 10]) && t[0] - t[1] >= 0, 'zakresy/odejmowanie 10-20 minus 1-10');
await run('Odejmowanie w pamięci', async () => {
  await byRanges();
  await setNumber(p, 'Ile liczb w działaniu', 3);
  await setRange(p, '1. liczba', 25, 49);
  await setRange(p, '2. liczba', 1, 4);
  await setRange(p, '3. liczba', 1, 4);
  await setSelect(p, 'Pożyczka (przekraczanie progu)', 'without');
}, t => t.length === 3 && within(t[0], [25, 49]) && within(t[1], [1, 4]) && within(t[2], [1, 4])
  && t[0] - t[1] - t[2] >= 0 && !borrow(t[0], t[1]) && !borrow(t[0] - t[1], t[2]), 'zakresy/odejmowanie trzech liczb bez pożyczek');
await run('Dodawanie w pamięci', async () => {
  await byRanges();
  await setRange(p, '1. liczba', 10, 20);
  await setRange(p, '2. liczba', 1, 10);
  await setNumber(p, 'Maksymalny wynik', 25);
  await setNumber(p, 'Minimalny wynik', 15);
}, t => { const s = t[0] + t[1]; return within(t[0], [10, 20]) && within(t[1], [1, 10]) && s >= 15 && s <= 25; },
'zakresy/dodawanie 10-20 plus 1-10, wynik 15-25');
await run('Dodawanie w pamięci', async () => {
  await byRanges();
  await setRange(p, '1. liczba', 13, 19);
  await setRange(p, '2. liczba', 3, 9);
  await setSelect(p, 'Przekraczanie progu', 'with');
}, t => within(t[0], [13, 19]) && within(t[1], [3, 9]) && carry(t), 'zakresy/dodawanie z przeniesieniem');
await run('Mnożenie w pamięci', async () => {
  await setSelect(p, 'Skąd brać czynniki', 'ranges');
  await setRange(p, '1. liczba', 11, 20);
  await setRange(p, '2. liczba', 0, 5);
}, t => within(t[0], [11, 20]) && within(t[1], [2, 5]) && t[0] * t[1] <= 1000, 'zakresy/mnożenie 11-20 razy 2-5 (bez 0 i 1)');
await run('Dodawanie pisemne', async () => {
  await byRanges();
  await setRange(p, '1. liczba', 100, 500);
  await setRange(p, '2. liczba', 10, 99);
}, t => within(t[0], [100, 500]) && within(t[1], [10, 99]) && carry(t), 'zakresy/dodawanie pisemne 100-500 plus 10-99');
await run('Odejmowanie pisemne', async () => {
  await byRanges();
  await setRange(p, 'odjemna', 100, 200);
  await setRange(p, 'odjemnik', 10, 99);
}, t => within(t[0], [100, 200]) && within(t[1], [10, 99]) && borrow(t[0], t[1]), 'zakresy/odejmowanie pisemne 100-200 minus 10-99');
await run('Mnożenie pisemne', async () => {
  await byRanges();
  await setRange(p, 'mnożna', 100, 300);
  await setRange(p, 'mnożnik', 2, 9);
}, t => within(t[0], [100, 300]) && within(t[1], [2, 9]) && mulCarry(t[0], t[1]), 'zakresy/mnożenie pisemne 100-300 razy 2-9');
await run('Dzielenie w pamięci', async () => {
  await setNumber(p, 'Najmniejsza liczba dzielona', 50);
  await setNumber(p, 'Liczba zadań', 20);
}, t => within(t[0], [50, 100]) && within(t[1], [2, 10]) && t[0] % t[1] === 0, 'zakresy/dzielenie, liczba dzielona 50-100');

// --- wpisywanie liczb klawisz po klawiszu: pole nie może poprawiać wartości w trakcie pisania ---

await openCard(p, 'Dodawanie w pamięci');
const maxInput = await typeNumber(p, 'Maksymalny wynik', '15');
const countInput = await typeNumber(p, 'Liczba zadań', '15');
await p.waitForTimeout(300);
const typed = [await maxInput.inputValue(), await countInput.inputValue()];
const typedRows = await grab();
const typedOk = typed.join(',') === '15,15' && typedRows.length === 15 && typedRows.every((t) => t[0] + t[1] <= 15);
console.log(`wpisywanie/„15” w polach z minimum 2 i 1: pola ${typed.join(', ')}, zadań ${typedRows.length}`);
if (!typedOk) bad++;

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

// szukana liczba: wybrana pozycja jest zakryta w każdym zadaniu, a lista
// pozycji rośnie razem z liczbą składników
await runData('Dodawanie w pamięci', () => setSelect(p, 'Szukana liczba', 'term0'),
  (r) => Number(r.blank) === 0, 'szukana/dodawanie, pierwsza liczba');
await runData('Dodawanie w pamięci', async () => {
  await setNumber(p, 'Ile liczb do dodania', 3);
  await setNumber(p, 'Maksymalny wynik', 1000);
  await setSelect(p, 'Szukana liczba', 'term2');
}, (r) => Number(r.blank) === 2, 'szukana/dodawanie trzech liczb, trzecia liczba');
await runData('Odejmowanie w pamięci', () => setSelect(p, 'Szukana liczba', 'term1'),
  (r) => Number(r.blank) === 1, 'szukana/odejmowanie, druga liczba');
await runData('Mnożenie w pamięci', () => setSelect(p, 'Szukana liczba', 'term1'),
  (r) => Number(r.blank) === 1, 'szukana/tabliczka mnożenia, druga liczba');
await runData('Dzielenie w pamięci', () => setSelect(p, 'Szukana liczba', 'term0'),
  (r) => Number(r.blank) === 0, 'szukana/dzielenie, pierwsza liczba');
{
  await openCard(p, 'Dodawanie w pamięci');
  const labels = () =>
    p.locator('label.field', { has: p.locator('.field-label', { hasText: 'Szukana liczba' }) })
      .locator('option').allTextContents();
  const two = await labels();
  await setNumber(p, 'Ile liczb do dodania', 4);
  await p.waitForTimeout(200);
  const four = await labels();
  const ok = two.includes('druga liczba') && !two.includes('trzecia liczba') && four.includes('czwarta liczba');
  console.log(`szukana/opcje zależą od liczby składników: ${two.length} → ${four.length}`);
  if (!ok) bad++;
}

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

// --- strategie dodawania: czy zapis kroków pasuje do wybranej strategii ---

const firstStep = (r) => r.steps.split('|')[0];
const nums = (text) => (text.match(/\d+/g) ?? []).map(Number);
const unitsOf = (n) => n % 10;

const strategy = (name, tweak, test, label) =>
  runData('Dodawanie ze strategią', async () => {
    await setSelect(p, 'Strategia', name);
    await tweak();
  }, test, label);

await strategy('toTen', () => setNumber(p, 'Największy wynik', 20), (r) => {
  const [a, b] = nums(firstStep(r));
  // dopełniamy pierwszą liczbę do dziesiątki, więc próg musi zostać przekroczony
  return a + b <= 20 && Math.floor(a / 10) < Math.floor((a + b) / 10) && unitsOf(a) !== 0;
}, 'strategie/dopełnienie do dziesiątki, wynik do 20');

await strategy('doubles', async () => {
  await setSelect(p, 'Co ćwiczymy', 'same');
  await setNumber(p, 'Największa podwajana liczba', 10);
}, (r) => {
  const [a, b] = nums(firstStep(r));
  return a === b && a <= 10;
}, 'strategie/podwojenia do 10');

await strategy('doubles', () => setSelect(p, 'Co ćwiczymy', 'near'), (r) => {
  const [a, b] = nums(firstStep(r));
  return Math.abs(a - b) === 1;
}, 'strategie/prawie podwojenia');

await strategy('pairsOfTen', () => setNumber(p, 'Największy wynik', 20), (r) => {
  const t = nums(firstStep(r));
  const pair = t[0] + t[1] === 10 || t[0] + t[2] === 10 || t[1] + t[2] === 10;
  return t.length === 3 && pair && t.reduce((a, x) => a + x, 0) <= 20;
}, 'strategie/para do 10 wśród trzech liczb');

await strategy('splitTens', () => setNumber(p, 'Największy wynik', 200), (r) => {
  const [a, b] = nums(firstStep(r));
  return a >= 11 && b >= 11 && a + b <= 200 && unitsOf(a) + unitsOf(b) <= 9;
}, 'strategie/rozbicie bez przekraczania progu');

await strategy('roundAdjust', () => setNumber(p, 'Największy wynik', 100), (r) => {
  const [a, b] = nums(firstStep(r));
  return [8, 9].includes(unitsOf(b)) && a + b <= 100;
}, 'strategie/druga liczba tuż przed dziesiątką');

await strategy('moveUnits', () => setNumber(p, 'Największy wynik', 100), (r) => {
  const [a, b] = nums(firstStep(r));
  return unitsOf(b) >= 1 && unitsOf(b) <= 4 && unitsOf(a) + unitsOf(b) <= 9 && a + b <= 100;
}, 'strategie/przerzucanie jedności');

// poziom rusztowania decyduje o liczbie kroków w zapisie
await runData('Dodawanie ze strategią', () => setSelect(p, 'Ile podpowiedzi', 'bare'),
  (r) => r.steps.split('|').length === 2, 'strategie/samo działanie — dwa człony');
await runData('Dodawanie ze strategią', () => setSelect(p, 'Ile podpowiedzi', 'short'),
  (r) => r.steps.split('|').length === 3, 'strategie/skrócone — trzy człony');
await runData('Dodawanie ze strategią', async () => {}, (r) => r.steps.split('|').length === 4,
  'strategie/pełne rusztowanie — cztery człony');

// --- kolorowanka ---

await runData('Kolorowanka według wyniku', async () => {
  await setSelect(p, 'Wzór', 'kotek');
  await setNumber(p, 'Największy wynik', 10);
}, (r) => {
  const palette = r.palette.split(',').map(Number);
  const colors = r.colors.split(',').map(Number);
  return (
    palette.every((v) => v >= 1 && v <= 10) &&
    new Set(palette).size === palette.length &&
    colors.length === Number(r.w) * 12 &&
    colors.every((c) => c < palette.length)
  );
}, 'kolorowanka/wyniki różne i w zakresie');

await openCard(p, 'Kolorowanka według wyniku');
await p.waitForTimeout(300);
const plusOnly = await p.$$eval('.sheet:first-of-type .pixel-cell', (els) =>
  els.map((e) => e.textContent.trim()).filter((t) => !/^\d+\+\d+$/.test(t)),
);
console.log(`kolorowanka/same dodawanie: kratek nie na plus ${plusOnly.length}`, plusOnly.slice(0, 3));
if (plusOnly.length) bad++;

await openCard(p, 'Kolorowanka według wyniku');
await toggle(p, 'Dodawanie');
await toggle(p, 'Mnożenie');
await setNumber(p, 'Największy wynik', 20);
await p.waitForTimeout(300);
const mulOnly = await p.$$eval('.sheet:first-of-type .pixel-cell', (els) =>
  els.map((e) => e.textContent.trim()).filter((t) => !/^\d+×\d+$/.test(t)),
);
console.log(`kolorowanka/samo mnożenie: kratek nie na razy ${mulOnly.length}`, mulOnly.slice(0, 3));
if (mulOnly.length) bad++;

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

// --- powtórzenia: żadne zadanie nie może wrócić drugi raz w tym samym bloku ---

/** Tożsamość zadania: atrybuty z danymi, a przy krzyżówce dodatkowo treść kratek. */
const identities = (sheet) =>
  p.$$eval(`${sheet} .block`, (blocks) =>
    blocks.map((block) =>
      [...block.querySelectorAll('.problem')].map((el) =>
        JSON.stringify({
          ...el.dataset,
          cw: [...el.querySelectorAll('.cw-cell')].map((c) => c.textContent).join(','),
        }),
      ),
    ),
  );

/** Zadania, które wracają drugi raz w obrębie swojego bloku. */
const repeatsIn = (blocks) => blocks.flatMap((keys) => keys.filter((k, i) => keys.indexOf(k) !== i));

/** `expected` to liczba zadań, jakiej się spodziewamy — przy ciasnych ustawieniach mniej niż zamówiono. */
const runDupes = async (card, tweak, label, expected = null) => {
  await openCard(p, card);
  await tweak();
  await p.waitForTimeout(400);
  const blocks = await identities('.sheet:first-of-type');
  const keys = blocks.flat();
  const repeats = repeatsIn(blocks);
  const wrongCount = expected !== null && keys.length !== expected;
  if (repeats.length || !keys.length || wrongCount) bad++;
  console.log(
    `${label}: ${keys.length} zadań${expected === null ? '' : ` (spodziewane ${expected})`}, powtórzonych ${repeats.length}`,
    repeats.slice(0, 2),
  );
};

await runDupes('Uzupełnianie do pełnej liczby', async () => {}, 'powtórki/uzupełnianie do 10');
await runDupes('Mnożenie w pamięci', async () => {}, 'powtórki/tabliczka mnożenia');
await runDupes('Zegar — godziny', async () => {}, 'powtórki/zegar co pół godziny');
await runDupes('Oś liczbowa', async () => {}, 'powtórki/oś liczbowa');
await runDupes('Pieniądze — ile to razem?', async () => {}, 'powtórki/pieniądze');
await runDupes('Krzyżówki matematyczne', async () => {}, 'powtórki/krzyżówki');
// ciasne ustawienia: zadań jest mniej, niż zamówiono — i ani jednego powtórzonego.
// Pełne godziny na tarczy 12-godzinnej to dokładnie dwanaście różnych zadań.
await runDupes('Zegar — godziny', async () => {
  await setSelect(p, 'Dokładność', 'hour');
  await setNumber(p, 'Liczba zadań', 30);
}, 'powtórki/pełne godziny, zamówione 30 zadań', 12);
// „do 10” z zakrytą drugą liczbą ma dziewięć różnych zadań
await runDupes('Uzupełnianie do pełnej liczby', () => setNumber(p, 'Liczba zadań', 30),
  'powtórki/uzupełnianie do 10, zamówione 30 zadań', 9);
// drugi blok powiela ustawienia pierwszego — każdy ma pełną pulę zadań, więc
// przy dziewięciu możliwych zadaniach oba bloki dostają po dziewięć, bez powtórek w bloku
await openCard(p, 'Uzupełnianie do pełnej liczby');
await setNumber(p, 'Liczba zadań', 9);
await p.getByText('+ Ten sam rodzaj').click();
await p.waitForTimeout(400);
{
  const blocks = await identities('.sheet:first-of-type');
  const sizes = blocks.map((k) => k.length).join(' + ');
  const repeats = repeatsIn(blocks);
  console.log(`powtórki/dwa bloki o tych samych ustawieniach: zadań w blokach ${sizes} (spodziewane 9 + 9), powtórzonych w bloku ${repeats.length}`);
  if (sizes !== '9 + 9' || repeats.length) bad++;
}

// różne rodzaje zadań nie zabierają sobie zadań: tabliczka 2–3 to „2|2”, „2|3”,
// „3|2”, „3|3” — te same klucze co 2 + 2 czy 3 + 2 w dodawaniu, a przecież to
// nie są powtórki. Dodawanie cyfra + cyfra z wynikiem 4–6 ma dwanaście zadań.
const smallAddition = async (block) => {
  await block.locator('.digits-row input').first().fill('1');
  await block.locator('label.field', { hasText: 'Minimalny wynik' }).locator('input').fill('4');
  await block.locator('label.field', { hasText: 'Maksymalny wynik' }).locator('input').fill('6');
  await block.locator('label.field', { hasText: 'Liczba zadań' }).locator('input').fill('30');
};
await openCard(p, 'Mnożenie w pamięci');
await setNumber(p, 'Czynniki od', 2);
await setNumber(p, 'Czynniki do', 3);
await setNumber(p, 'Liczba zadań', 4);
await p.getByText('+ Inny rodzaj').click();
await p.locator('.card-title', { hasText: 'Dodawanie w pamięci' }).click();
await smallAddition(p.locator('.block-config').nth(1));
await p.waitForTimeout(400);
const perBlock = await p.$$eval('.sheet:first-of-type .block', (els) => els.map((el) => el.querySelectorAll('.problem').length));
console.log(`powtórki/różne rodzaje na jednej karcie: zadań w blokach ${perBlock.join(' + ')} (spodziewane 4 + 12)`);
if (perBlock.join(',') !== '4,12') bad++;

// przykłady w ramce to też zadania — nie mogą wrócić w zadaniach pod nią
await openCard(p, 'Dodawanie ze strategią');
await p.getByText('Zacznij od wyjaśnienia i przykładów').click();
await setNumber(p, 'Ile przykładów', 3);
await p.waitForTimeout(400);
/** Samo działanie z lewej strony zapisu, bez spacji: „8+5”. */
const lhs = (text) => text.split('=')[0].replace(/\s/g, '');
const examples = await p.$$eval('.sheet:first-of-type .intro-example .inline-problem', (els) =>
  els.map((e) => e.textContent),
);
const stepTasks = await p.$$eval('.sheet:first-of-type .problem', (els) => els.map((e) => e.dataset.steps));
const taskLhs = stepTasks.map((s) => lhs(s.split('|')[0]));
const shared = examples.map(lhs).filter((x) => taskLhs.includes(x));
console.log(`powtórki/przykłady w ramce: ${examples.length} przykładów, wspólnych z zadaniami ${shared.length}`, shared);
if (shared.length || examples.length !== 3) bad++;

await b.close();
console.log(bad ? 'NIEPOWODZENIE' : 'OK — wszystkie ograniczenia spełnione');
if (bad) process.exitCode = 1;
