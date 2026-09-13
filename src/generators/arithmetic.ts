import type { Config, Operator, Rnd } from '../types';
import type { Range } from './helpers';
import {
  choice,
  dedupeKey,
  fromDigits,
  hasBorrow,
  hasCarry,
  hasMulCarry,
  maxForDigits,
  minForDigits,
  pickWithDigits,
} from './helpers';

export type CarryMode = 'any' | 'with' | 'without';

export const carryOptions = [
  { value: 'any', label: 'dowolnie' },
  { value: 'with', label: 'tylko z przeniesieniem' },
  { value: 'without', label: 'bez przeniesień' },
];

export const borrowOptions = [
  { value: 'any', label: 'dowolnie' },
  { value: 'with', label: 'tylko z pożyczką' },
  { value: 'without', label: 'bez pożyczek' },
];

/**
 * Co jest niewiadomą w działaniu zapisanym w jednej linii: wynik, konkretna
 * liczba (`term0` to pierwsza), losowa z liczb albo losowo wynik lub liczba.
 */
export type UnknownMode = 'result' | 'term' | 'mixed' | `term${number}`;

const ordinals = ['pierwsza', 'druga', 'trzecia', 'czwarta', 'piąta'];

/** Opcje pola „Szukana liczba” dla działania z `count` liczbami. */
export const unknownOptions = (count: number) => [
  { value: 'result', label: 'wynik' },
  ...ordinals.slice(0, count).map((o, i) => ({ value: `term${i}`, label: `${o} liczba` })),
  { value: 'term', label: 'jedna z liczb, losowo' },
  { value: 'mixed', label: 'wynik albo liczba, losowo' },
];

/** Jak uczący opisuje liczby w działaniu: liczbą cyfr albo zakresem od–do każdej z nich. */
export type NumbersMode = 'digits' | 'ranges';

export const numbersOptions = [
  { value: 'digits', label: 'według liczby cyfr' },
  { value: 'ranges', label: 'według zakresu od–do' },
];

export const byRanges = (cfg: Config) => choice<NumbersMode>(cfg, 'numbers', 'digits') === 'ranges';
export const byDigits = (cfg: Config) => !byRanges(cfg);

const TRIES = 400;

/**
 * Przy zakresach od–do przeniesienia i pożyczki sprawdzamy dopiero po
 * wylosowaniu, więc prób jest więcej — rzadki warunek (np. dodawanie bez
 * przeniesień przy szerokich zakresach) też ma szansę trafić.
 */
const RANGED_TRIES = 2000;

/** Losowa permutacja indeksów 0..n-1. */
function shuffledIndexes(rnd: Rnd, n: number): number[] {
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = rnd.int(0, i);
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}

/**
 * Składniki o zadanej liczbie cyfr, których suma nie przekracza `maxResult`.
 * Kolejność losowania jest tasowana, żeby limit nie obcinał zawsze ostatniej liczby.
 */
function additionTerms(rnd: Rnd, digits: number[], maxResult: number): number[] {
  const mins = digits.map(minForDigits);
  const terms = new Array<number>(digits.length).fill(0);
  let budget = maxResult;
  let remainingMin = mins.reduce((a, b) => a + b, 0);
  for (const i of shuffledIndexes(rnd, digits.length)) {
    remainingMin -= mins[i];
    const cap = Math.max(mins[i], budget - remainingMin);
    terms[i] = pickWithDigits(rnd, digits[i], cap);
    budget -= terms[i];
  }
  return terms;
}

/** Składniki dodawane bez przekraczania progu — suma cyfr na każdej pozycji ≤ 9. */
function noCarryTerms(rnd: Rnd, digits: number[]): number[] {
  const width = Math.max(...digits);
  const terms = new Array<number>(digits.length).fill(0);
  for (let pos = 0; pos < width; pos++) {
    const active = digits.map((d, i) => ({ i, d })).filter((t) => t.d > pos);
    // cyfra wiodąca musi być niezerowa, więc rezerwujemy dla niej 1 z puli 9
    const needed = (t: { i: number; d: number }) => (t.d - 1 === pos ? 1 : 0);
    let used = 0;
    for (const [k, t] of active.entries()) {
      const reserve = active.slice(k + 1).reduce((a, o) => a + needed(o), 0);
      const lo = needed(t);
      const hi = Math.max(lo, 9 - used - reserve);
      const digit = rnd.int(lo, hi);
      terms[t.i] += digit * 10 ** pos;
      used += digit;
    }
  }
  return terms;
}

export function makeAddition(
  rnd: Rnd,
  digits: number[],
  maxResult: number,
  carry: CarryMode,
  minResult = 0,
): number[] {
  for (let attempt = 0; attempt < TRIES; attempt++) {
    const terms = carry === 'without' ? noCarryTerms(rnd, digits) : additionTerms(rnd, digits, maxResult);
    const sum = terms.reduce((a, b) => a + b, 0);
    if (sum > maxResult || sum < minResult) continue;
    const carried = hasCarry(terms);
    if (carry === 'with' && !carried) continue;
    if (carry === 'without' && carried) continue;
    return terms;
  }
  return additionTerms(rnd, digits, maxResult);
}

/**
 * Składniki z zakresów od–do, których suma mieści się w [minResult, maxResult].
 * Każdy składnik (w tasowanej kolejności) losowany jest z przedziału, który
 * zostawia pozostałym miejsce w granicach sumy — przy wykonalnych ustawieniach
 * nie trzeba więc zgadywać. `null`, gdy zakresy nie pozwalają trafić w sumę.
 */
function rangedAdditionTerms(rnd: Rnd, ranges: Range[], minResult: number, maxResult: number): number[] | null {
  const terms = new Array<number>(ranges.length).fill(0);
  let restLo = ranges.reduce((a, r) => a + r[0], 0);
  let restHi = ranges.reduce((a, r) => a + r[1], 0);
  let sum = 0;
  for (const i of shuffledIndexes(rnd, ranges.length)) {
    const [lo, hi] = ranges[i];
    restLo -= lo;
    restHi -= hi;
    const from = Math.max(lo, minResult - sum - restHi);
    const to = Math.min(hi, maxResult - sum - restLo);
    if (from > to) return null;
    terms[i] = rnd.int(from, to);
    sum += terms[i];
  }
  return terms;
}

/** Składniki z zakresów od–do, z granicami sumy i trybem przeniesień. */
export function makeRangedAddition(
  rnd: Rnd,
  ranges: Range[],
  minResult: number,
  maxResult: number,
  carry: CarryMode,
): number[] | null {
  for (let attempt = 0; attempt < RANGED_TRIES; attempt++) {
    const terms = rangedAdditionTerms(rnd, ranges, minResult, maxResult);
    if (!terms) return null;
    const carried = hasCarry(terms);
    if ((carry === 'with' && !carried) || (carry === 'without' && carried)) continue;
    return terms;
  }
  return null;
}

/**
 * Odjemna i odjemniki z zakresów od–do; wynik nigdy nie schodzi poniżej zera.
 * Odjemna jest co najmniej tak duża jak suma najmniejszych odjemników, a każdy
 * odjemnik zostawia miejsce na kolejne — więc zgadujemy tylko pożyczki.
 */
export function makeRangedSubtraction(rnd: Rnd, ranges: Range[], borrow: CarryMode): number[] | null {
  const [lo0, hi0] = ranges[0];
  const restLo = ranges.slice(1).reduce((a, r) => a + r[0], 0);
  const from = Math.max(lo0, restLo);
  if (from > hi0) return null;
  for (let attempt = 0; attempt < RANGED_TRIES; attempt++) {
    let rest = rnd.int(from, hi0);
    const terms = [rest];
    let need = restLo;
    let ok = true;
    for (const [lo, hi] of ranges.slice(1)) {
      need -= lo;
      const b = rnd.int(lo, Math.min(hi, rest - need));
      const borrowed = hasBorrow(rest, b);
      if ((borrow === 'with' && !borrowed) || (borrow === 'without' && borrowed)) {
        ok = false;
        break;
      }
      terms.push(b);
      rest -= b;
    }
    if (ok) return terms;
  }
  return null;
}

/**
 * Czynniki z zakresów od–do, których iloczyn nie przekracza `maxResult`.
 * Tak jak przy dodawaniu każdy czynnik zostawia miejsce na najmniejsze
 * pozostałe; zero wśród nich znosi limit, bo iloczyn i tak będzie zerem.
 */
export function makeRangedMultiplication(rnd: Rnd, ranges: Range[], maxResult: number): number[] | null {
  if (ranges.reduce((a, r) => a * r[0], 1) > maxResult) return null;
  const terms = new Array<number>(ranges.length).fill(1);
  const order = shuffledIndexes(rnd, ranges.length);
  let product = 1;
  for (const [k, i] of order.entries()) {
    const [lo, hi] = ranges[i];
    const restLo = order.slice(k + 1).reduce((a, j) => a * ranges[j][0], 1);
    const bound = product * restLo;
    const to = bound === 0 ? hi : Math.min(hi, Math.floor(maxResult / bound));
    if (to < lo) return null;
    terms[i] = rnd.int(lo, to);
    product *= terms[i];
  }
  return terms;
}

/** Mnożna i mnożnik z zakresów od–do, z wymaganym trybem przeniesień. */
export function makeRangedMultiplicationPair(
  rnd: Rnd,
  [loA, hiA]: Range,
  [loB, hiB]: Range,
  carry: CarryMode,
): [number, number] | null {
  for (let attempt = 0; attempt < RANGED_TRIES; attempt++) {
    const a = rnd.int(loA, hiA);
    const b = rnd.int(loB, hiB);
    const carried = hasMulCarry(a, b);
    if ((carry === 'with' && !carried) || (carry === 'without' && carried)) continue;
    return [a, b];
  }
  return null;
}

/**
 * Odjemna i odjemniki o zadanej liczbie cyfr; wynik nigdy nie schodzi poniżej zera.
 * Zwraca `null`, gdy przy danych cyfrach nie da się trafić w warunki.
 */
export function makeSubtraction(
  rnd: Rnd,
  digits: number[],
  maxValue: number,
  borrow: CarryMode,
): number[] | null {
  for (let attempt = 0; attempt < TRIES; attempt++) {
    const terms: number[] = [];
    let rest = pickWithDigits(rnd, digits[0], maxValue);
    terms.push(rest);
    let ok = true;
    for (let i = 1; i < digits.length; i++) {
      const lo = minForDigits(digits[i]);
      const hi = Math.min(maxForDigits(digits[i]), rest);
      if (hi < lo) {
        ok = false;
        break;
      }
      const b = rnd.int(lo, hi);
      const borrowed = hasBorrow(rest, b);
      if ((borrow === 'with' && !borrowed) || (borrow === 'without' && borrowed)) {
        ok = false;
        break;
      }
      terms.push(b);
      rest -= b;
    }
    if (ok) return terms;
  }
  return null;
}

/**
 * Czynniki o zadanej liczbie cyfr, których iloczyn nie przekracza `maxResult`.
 * Tak jak przy dodawaniu kolejność jest tasowana, żeby limit nie obcinał
 * zawsze tego samego czynnika.
 */
function multiplicationFactors(rnd: Rnd, digits: number[], maxResult: number): number[] {
  const mins = digits.map(minForDigits);
  const terms = new Array<number>(digits.length).fill(1);
  let product = 1;
  let remainingMin = mins.reduce((a, b) => a * b, 1);
  for (const i of shuffledIndexes(rnd, digits.length)) {
    remainingMin /= mins[i];
    const cap = Math.max(mins[i], Math.floor(maxResult / (product * remainingMin)));
    terms[i] = pickWithDigits(rnd, digits[i], cap);
    product *= terms[i];
  }
  return terms;
}

/**
 * Czynniki o zadanej liczbie cyfr. `minFactor` odcina banalne przypadki
 * (mnożenie przez 1), `maxResult` ogranicza iloczyn.
 */
export function makeMultiplication(
  rnd: Rnd,
  digits: number[],
  maxResult: number,
  minFactor = 1,
): number[] | null {
  for (let attempt = 0; attempt < TRIES; attempt++) {
    const terms = multiplicationFactors(rnd, digits, maxResult);
    if (terms.reduce((a, b) => a * b, 1) > maxResult) continue;
    if (terms.some((t) => t < minFactor)) continue;
    return terms;
  }
  return null;
}

/**
 * Para liczb do mnożenia pisemnego, w której żadna cyfra nie daje przeniesienia.
 * Cyfry mnożnika dobierane są pierwsze, potem mnożnej — tak, żeby każdy iloczyn
 * cząstkowy zmieścił się w jednej cyfrze.
 */
function noCarryPair(rnd: Rnd, digitsA: number, digitsB: number): [number, number] | null {
  for (let attempt = 0; attempt < TRIES; attempt++) {
    const b = Array.from({ length: digitsB }, (_, i) => rnd.int(i === digitsB - 1 ? 1 : 0, 3));
    const hi = Math.floor(9 / Math.max(...b));
    if (hi < 1) continue;
    const a = Array.from({ length: digitsA }, (_, i) => rnd.int(i === digitsA - 1 ? 1 : 0, hi));
    const [na, nb] = [fromDigits(a), fromDigits(b)];
    if (!hasMulCarry(na, nb)) return [na, nb];
  }
  return null;
}

/** Mnożna i mnożnik o zadanej liczbie cyfr, z wymaganym trybem przeniesień. */
export function makeMultiplicationPair(
  rnd: Rnd,
  digitsA: number,
  digitsB: number,
  carry: CarryMode,
): [number, number] | null {
  if (carry === 'without') return noCarryPair(rnd, digitsA, digitsB);
  for (let attempt = 0; attempt < TRIES; attempt++) {
    const a = pickWithDigits(rnd, digitsA);
    const b = pickWithDigits(rnd, digitsB);
    if (carry === 'with' && !hasMulCarry(a, b)) continue;
    return [a, b];
  }
  return null;
}

/**
 * Który element działania jest zakryty: -1 to wynik, inaczej indeks liczby.
 * Przy mnożeniu nie zakrywamy czynnika, gdy którykolwiek z pozostałych jest
 * zerem — takie zadanie nie ma jednego rozwiązania, więc szukany jest wynik.
 * Wynik zostaje też wtedy, gdy wybrana liczba wypadła poza działanie (np. po
 * zmniejszeniu liczby składników z trzech do dwóch).
 */
export function pickBlank(rnd: Rnd, mode: UnknownMode, terms: number[], op: Operator): number {
  const wanted = mode === 'mixed' ? (rnd.int(0, 1) === 0 ? 'result' : 'term') : mode;
  if (wanted === 'result') return -1;
  const allowed = terms
    .map((_, i) => i)
    .filter((i) => op !== '×' || terms.every((t, j) => j === i || t !== 0));
  if (wanted !== 'term') {
    const fixed = Number(wanted.slice('term'.length));
    return allowed.includes(fixed) ? fixed : -1;
  }
  return allowed.length ? rnd.pick(allowed) : -1;
}

/**
 * Ile razy z rzędu wolno wylosować zadanie, które już jest na arkuszu, zanim
 * uznamy pulę za wyczerpaną. Na tyle dużo, żeby przy puli wielkości arkusza
 * trafić też ostatnie brakujące zadanie.
 */
const MAX_REPEATS = 500;

/**
 * Powtarza `make`, aż uzbiera `count` różnych zadań. Duplikat nigdy nie trafia
 * na arkusz — gdy konfiguracja nie daje tylu różnych zadań, wraca ich mniej,
 * a formularz mówi o tym uczącemu.
 *
 * `seen` zbiera klucze zadań już wydrukowanych w tym bloku: jeden zestaw na
 * blok sprawia, że zadania nie powtarzają przykładów z ramki ani siebie nawzajem.
 */
export function collect<T>(
  count: number,
  make: () => T | null,
  key: (item: T) => string,
  seen: Set<string> = new Set(),
): T[] {
  const out: T[] = [];
  let sinceNew = 0;
  while (out.length < count && sinceNew < MAX_REPEATS) {
    const item = make();
    if (!item) break;
    const k = key(item);
    if (seen.has(k)) {
      sinceNew++;
      continue;
    }
    seen.add(k);
    out.push(item);
    sinceNew = 0;
  }
  return out;
}

export const termsKey = dedupeKey;

/** Dzielenie `a : b = q` z opcjonalną resztą `r` (0, gdy dzielimy bez reszty). */
export interface Division {
  a: number;
  b: number;
  q: number;
  r: number;
}

/**
 * Dzielna i dzielnik dobrane tak, żeby iloraz był całkowity — a przy dzieleniu
 * z resztą, żeby reszta była niezerowa. Dzielna mieści się w
 * [minDividend, maxDividend]. `null`, gdy przy podanym zakresie nie da się
 * trafić w warunki.
 */
export function makeDivision(
  rnd: Rnd,
  divisorFrom: number,
  divisorTo: number,
  minDividend: number,
  maxDividend: number,
  minQuotient: number,
  maxQuotient: number,
  withRemainder: boolean,
): Division | null {
  // reszta mniejsza od dzielnika istnieje dopiero dla dzielnika co najmniej 2
  const lo = withRemainder ? Math.max(2, divisorFrom) : divisorFrom;
  if (lo > divisorTo) return null;
  for (let attempt = 0; attempt < TRIES; attempt++) {
    const b = rnd.int(lo, divisorTo);
    const r = withRemainder ? rnd.int(1, b - 1) : 0;
    const minQ = Math.max(minQuotient, Math.ceil((minDividend - r) / b));
    const maxQ = Math.min(maxQuotient, Math.floor((maxDividend - r) / b));
    if (maxQ < minQ) continue;
    const q = rnd.int(minQ, maxQ);
    return { a: q * b + r, b, q, r };
  }
  return null;
}
