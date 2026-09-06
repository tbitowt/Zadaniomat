import type { Config } from '../types';

/** Najmniejsza liczba o zadanej liczbie cyfr (1 -> 1, 2 -> 10, 3 -> 100). */
export const minForDigits = (d: number) => (d <= 1 ? 1 : 10 ** (d - 1));

/** Największa liczba o zadanej liczbie cyfr (1 -> 9, 2 -> 99). */
export const maxForDigits = (d: number) => 10 ** d - 1;

export const digitCount = (n: number) => Math.abs(n).toString().length;

/** Cyfry liczby, od najmniej znaczącej. */
export const toDigits = (n: number, len = digitCount(n)): number[] =>
  Array.from({ length: len }, (_, i) => Math.floor(n / 10 ** i) % 10);

/** Liczba złożona z cyfr podanych od najmniej znaczącej. */
export const fromDigits = (d: number[]): number => d.reduce((acc, x, i) => acc + x * 10 ** i, 0);

/** Odczyt pól konfiguracji z domyślną wartością — konfiguracja jest luźno typowana. */
export const num = (cfg: Config, key: string, fallback = 0): number => {
  const v = cfg[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
};

export const bool = (cfg: Config, key: string, fallback = false): boolean => {
  const v = cfg[key];
  return typeof v === 'boolean' ? v : fallback;
};

/** Odczyt pola `select` z zawężeniem do znanych wartości. */
export const choice = <T extends string>(cfg: Config, key: string, fallback: T): T => {
  const v = cfg[key];
  return typeof v === 'string' ? (v as T) : fallback;
};

/**
 * Lista „ilość cyfr w poszczególnych liczbach”, przycięta / uzupełniona
 * do aktualnej liczby składników.
 */
export const digitsList = (cfg: Config, key: string, count: number, fallback = 2): number[] => {
  const raw = Array.isArray(cfg[key]) ? (cfg[key] as unknown[]) : [];
  return Array.from({ length: count }, (_, i) => {
    const v = raw[i];
    return typeof v === 'number' && v >= 1 ? Math.floor(v) : fallback;
  });
};

/** Losuje liczbę o dokładnie `d` cyfrach, dodatkowo ograniczoną przez `cap`. */
export function pickWithDigits(rnd: { int: (a: number, b: number) => number }, d: number, cap = Infinity): number {
  const lo = minForDigits(d);
  const hi = Math.min(maxForDigits(d), cap);
  if (hi < lo) return lo;
  return rnd.int(lo, hi);
}

/** Czy przy dodawaniu w słupku występuje przeniesienie. */
export function hasCarry(terms: number[]): boolean {
  let carry = 0;
  const max = Math.max(...terms.map((t) => t.toString().length));
  for (let pos = 0; pos < max; pos++) {
    const sum = terms.reduce((acc, t) => acc + Math.floor(t / 10 ** pos) % 10, carry);
    carry = Math.floor(sum / 10);
    if (carry > 0) return true;
  }
  return false;
}

/** Czy przy odejmowaniu w słupku występuje pożyczka. */
export function hasBorrow(a: number, b: number): boolean {
  let borrow = 0;
  const len = a.toString().length;
  for (let pos = 0; pos < len; pos++) {
    const da = Math.floor(a / 10 ** pos) % 10;
    const db = Math.floor(b / 10 ** pos) % 10;
    if (da - borrow < db) {
      borrow = 1;
      return true;
    }
    borrow = 0;
  }
  return false;
}

/** Iloczyny częściowe mnożenia pisemnego — `a` razy kolejne cyfry `b`, bez przesunięcia. */
export const partialProducts = (a: number, b: number): number[] => toDigits(b).map((y) => a * y);

/**
 * Czy mnożenie pisemne `a × b` wymaga przeniesienia — czy to w trakcie
 * mnożenia przez pojedynczą cyfrę, czy przy dodawaniu iloczynów częściowych.
 */
export function hasMulCarry(a: number, b: number): boolean {
  const da = toDigits(a);
  const db = toDigits(b);
  for (const y of db) {
    for (const x of da) {
      if (x * y > 9) return true;
    }
  }
  const shifted = partialProducts(a, b)
    .map((p, j) => p * 10 ** j)
    .filter((p) => p > 0);
  return shifted.length > 1 && hasCarry(shifted);
}

/** Odrzuca duplikaty w obrębie arkusza (po zestawie składników). */
export function dedupeKey(terms: number[]): string {
  return terms.join('|');
}

/** Tasowanie listy (Fisher–Yates) — kopia, oryginał zostaje nietknięty. */
export function shuffle<T>(rnd: { int: (a: number, b: number) => number }, items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rnd.int(0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** `k` różnych wartości z listy, w losowej kolejności. */
export const sample = <T>(rnd: { int: (a: number, b: number) => number }, items: T[], k: number): T[] =>
  shuffle(rnd, items).slice(0, Math.max(0, Math.min(k, items.length)));

/** Kolejne liczby od `from` do `to` (włącznie). */
export const range = (from: number, to: number): number[] =>
  to < from ? [] : Array.from({ length: to - from + 1 }, (_, i) => from + i);
