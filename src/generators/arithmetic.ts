import type { Operator, Rnd } from '../types';
import {
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

/** Co jest niewiadomą w działaniu zapisanym w jednej linii. */
export type UnknownMode = 'result' | 'term' | 'mixed';

export const unknownOptions = [
  { value: 'result', label: 'wynik' },
  { value: 'term', label: 'jedna z liczb' },
  { value: 'mixed', label: 'losowo' },
];

const TRIES = 400;

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
 * zerem — takie zadanie nie ma jednego rozwiązania.
 */
export function pickBlank(rnd: Rnd, mode: UnknownMode, terms: number[], op: Operator): number {
  const wanted = mode === 'mixed' ? (rnd.int(0, 1) === 0 ? 'result' : 'term') : mode;
  if (wanted === 'result') return -1;
  const allowed = terms
    .map((_, i) => i)
    .filter((i) => op !== '×' || terms.every((t, j) => j === i || t !== 0));
  return allowed.length ? rnd.pick(allowed) : -1;
}

/**
 * Powtarza `make`, aż uzbiera `count` różnych zadań.
 * Po serii powtórzeń przyjmuje duplikat, żeby nie zapętlić się przy wąskiej konfiguracji.
 */
export function collect<T>(count: number, make: () => T | null, key: (item: T) => string): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  let sinceNew = 0;
  while (out.length < count) {
    const item = make();
    if (!item) break;
    const k = key(item);
    if (!seen.has(k) || sinceNew > 40) {
      seen.add(k);
      out.push(item);
      sinceNew = 0;
    } else {
      sinceNew++;
    }
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
 * z resztą, żeby reszta była niezerowa. `null`, gdy przy podanym zakresie nie
 * da się trafić w warunki.
 */
export function makeDivision(
  rnd: Rnd,
  divisorFrom: number,
  divisorTo: number,
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
    const maxQ = Math.min(maxQuotient, Math.floor((maxDividend - r) / b));
    if (maxQ < minQuotient) continue;
    const q = rnd.int(minQuotient, maxQ);
    return { a: q * b + r, b, q, r };
  }
  return null;
}
