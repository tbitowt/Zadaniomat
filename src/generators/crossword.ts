import type { Config, CrosswordCell, CrosswordProblem, GeneratorDef, Operator, Rnd } from '../types';
import { collect } from './arithmetic';
import { bool, num } from './helpers';

/** Ile kratek może zająć krzyżówka w każdą stronę — dalej nie mieści się na stronie. */
const MAX_SPAN = 15;
const PLACEMENT_TRIES = 80;
const RESTARTS = 24;

const OPERATIONS: { key: string; op: Operator; label: string }[] = [
  { key: 'opAdd', op: '+', label: 'Dodawanie' },
  { key: 'opSub', op: '-', label: 'Odejmowanie' },
  { key: 'opMul', op: '×', label: 'Mnożenie' },
  { key: 'opDiv', op: ':', label: 'Dzielenie' },
];

const enabledOps = (cfg: Config): Operator[] =>
  OPERATIONS.filter((o) => bool(cfg, o.key, false)).map((o) => o.op);

/** Wartość działania; `null`, gdy dzielenie nie wychodzi bez reszty. */
function apply(op: Operator, a: number, b: number): number | null {
  if (op === '+') return a + b;
  if (op === '-') return a - b;
  if (op === '×') return a * b;
  return b !== 0 && a % b === 0 ? a / b : null;
}

function shuffled<T>(rnd: Rnd, items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rnd.int(0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Dzielniki `n` z przedziału [2, n/2], którymi da się rozbić `n` na dwa czynniki ≤ max. */
function splitFactors(n: number, max: number): number[] {
  const out: number[] = [];
  for (let d = 2; d * d <= n; d++) {
    if (n % d !== 0) continue;
    const other = n / d;
    if (other < 2) continue;
    if (d <= max && other <= max) {
      out.push(d);
      if (other !== d) out.push(other);
    }
  }
  return out;
}

/**
 * Trójka `a ⚬ b = c` dla zadanego działania. `fixed` to indeks liczby, która
 * jest już na planszy (0 = a, 1 = b, 2 = c), albo `null` przy pierwszym działaniu.
 * Wszystkie liczby mieszczą się w [1, max]; mnożenie i dzielenie omijają czynnik 1.
 */
function makeTriple(
  rnd: Rnd,
  op: Operator,
  fixed: number | null,
  value: number,
  max: number,
): [number, number, number] | null {
  const pick = (lo: number, hi: number) => (hi < lo ? null : rnd.int(lo, hi));

  if (op === '+') {
    if (fixed === 2) {
      const a = pick(1, value - 1);
      return a === null ? null : [a, value - a, value];
    }
    const known = fixed === null ? pick(1, max - 1) : value;
    if (known === null) return null;
    const other = pick(1, max - known);
    if (other === null) return null;
    return fixed === 1 ? [other, known, known + other] : [known, other, known + other];
  }

  if (op === '-') {
    if (fixed === 1) {
      const a = pick(value + 1, max);
      return a === null ? null : [a, value, a - value];
    }
    if (fixed === 2) {
      const b = pick(1, max - value);
      return b === null ? null : [value + b, b, value];
    }
    const a = fixed === 0 ? value : pick(2, max);
    if (a === null) return null;
    const b = pick(1, a - 1);
    return b === null ? null : [a, b, a - b];
  }

  if (op === '×') {
    if (fixed === 2) {
      const factors = splitFactors(value, max);
      if (!factors.length) return null;
      const a = rnd.pick(factors);
      return [a, value / a, value];
    }
    const known = fixed === null ? pick(2, Math.floor(max / 2)) : value;
    if (known === null || known < 2) return null;
    const other = pick(2, Math.floor(max / known));
    if (other === null) return null;
    return fixed === 1 ? [other, known, known * other] : [known, other, known * other];
  }

  // dzielenie: a : b = c, więc a = b · c
  if (fixed === 0) {
    const factors = splitFactors(value, max);
    if (!factors.length) return null;
    const b = rnd.pick(factors);
    return [value, b, value / b];
  }
  const known = fixed === null ? pick(2, Math.floor(max / 2)) : value;
  if (known === null || known < 2) return null;
  const other = pick(2, Math.floor(max / known));
  if (other === null) return null;
  return [known * other, fixed === 2 ? other : known, fixed === 2 ? known : other];
}

type Board = Map<string, CrosswordCell>;
/** Działanie na planszy: klucze kratek z liczbami i znakiem. */
interface Equation {
  a: string;
  op: string;
  b: string;
  c: string;
}

const key = (r: number, c: number) => `${r},${c}`;
const STEP = { h: [0, 1], v: [1, 0] } as const;

const numberAt = (board: Board, k: string) => {
  const cell = board.get(k);
  return cell && cell.kind === 'num' ? cell.value : 0;
};

interface Layout {
  board: Board;
  equations: Equation[];
  min: [number, number];
  max: [number, number];
}

/** Wpisuje działanie na planszę, zaczynając od `(r, c)` i idąc w kierunku `dir`. */
function place(layout: Layout, r: number, c: number, dir: 'h' | 'v', triple: [number, number, number], op: Operator) {
  const [dr, dc] = STEP[dir];
  const at = (i: number) => key(r + dr * i, c + dc * i);
  layout.board.set(at(0), { kind: 'num', value: triple[0], hidden: false });
  layout.board.set(at(1), { kind: 'op', op, hidden: false });
  layout.board.set(at(2), { kind: 'num', value: triple[1], hidden: false });
  layout.board.set(at(3), { kind: 'eq' });
  layout.board.set(at(4), { kind: 'num', value: triple[2], hidden: false });
  layout.equations.push({ a: at(0), op: at(1), b: at(2), c: at(4) });
  layout.min = [Math.min(layout.min[0], r), Math.min(layout.min[1], c)];
  layout.max = [Math.max(layout.max[0], r + dr * 4), Math.max(layout.max[1], c + dc * 4)];
}

/**
 * Dokłada jedno działanie, przecinając istniejącą liczbę. Poza kratką przecięcia
 * wszystkie pola muszą być puste, a kratki tuż przed i tuż za działaniem wolne —
 * inaczej dwa działania zlałyby się w jeden nieczytelny ciąg.
 */
function addEquation(rnd: Rnd, layout: Layout, ops: Operator[], max: number): boolean {
  const numbers = [...layout.board].filter(([, cell]) => cell.kind === 'num').map(([k]) => k);
  for (let attempt = 0; attempt < PLACEMENT_TRIES; attempt++) {
    const cross = rnd.pick(numbers);
    const [cr, cc] = cross.split(',').map(Number);
    const dir = rnd.pick(['h', 'v'] as const);
    const slot = rnd.pick([0, 2, 4]);
    const [dr, dc] = STEP[dir];
    const [sr, sc] = [cr - dr * slot, cc - dc * slot];

    const free = (i: number) => !layout.board.has(key(sr + dr * i, sc + dc * i));
    if (![0, 1, 2, 3, 4].every((i) => i === slot || free(i))) continue;
    if (!free(-1) || !free(5)) continue;

    const [er, ec] = [sr + dr * 4, sc + dc * 4];
    const span = (lo: number, hi: number) => hi - lo + 1;
    if (span(Math.min(layout.min[0], sr), Math.max(layout.max[0], er)) > MAX_SPAN) continue;
    if (span(Math.min(layout.min[1], sc), Math.max(layout.max[1], ec)) > MAX_SPAN) continue;

    const value = numberAt(layout.board, cross);
    for (const op of shuffled(rnd, ops)) {
      const triple = makeTriple(rnd, op, slot / 2, value, max);
      if (!triple || triple[slot / 2] !== value) continue;
      if (triple.some((v) => v < 1 || v > max)) continue;
      place(layout, sr, sc, dir, triple, op);
      return true;
    }
  }
  return false;
}

/**
 * Czy krzyżówkę da się rozwiązać krok po kroku: w kółko szukamy działania,
 * w którym brakuje dokładnie jednej rzeczy, i uznajemy ją za wyliczoną.
 * Zakryty znak liczy się tylko wtedy, gdy pasuje do niego jedno działanie.
 */
function deducible(layout: Layout, hidden: Set<string>, ops: Operator[]): boolean {
  const unknown = new Set(hidden);
  let changed = true;
  while (changed && unknown.size) {
    changed = false;
    for (const eq of layout.equations) {
      const missing = [eq.a, eq.op, eq.b, eq.c].filter((k) => unknown.has(k));
      if (missing.length !== 1) continue;
      if (missing[0] === eq.op) {
        const [a, b, c] = [numberAt(layout.board, eq.a), numberAt(layout.board, eq.b), numberAt(layout.board, eq.c)];
        if (ops.filter((o) => apply(o, a, b) === c).length !== 1) continue;
      }
      unknown.delete(missing[0]);
      changed = true;
    }
  }
  return unknown.size === 0;
}

/**
 * Wybiera zakryte kratki w dwóch krokach. Najpierw każde działanie dostaje
 * niewiadomą — żadne nie może być wypisane w całości. Potem dokładamy tyle
 * kratek, ile się da bez utraty rozwiązywalności, i zostawiamy z nich zadany
 * ułamek; mniej zakrytych kratek nigdy nie psuje rozwiązywalności.
 * Zwraca `null`, gdy któremuś działaniu nie da się nadać niewiadomej.
 */
function hideCells(
  rnd: Rnd,
  layout: Layout,
  candidates: string[],
  ops: Operator[],
  fraction: number,
): Set<string> | null {
  const pool = new Set(candidates);
  const hidden = new Set<string>();

  for (const eq of shuffled(rnd, layout.equations)) {
    const slots = [eq.a, eq.op, eq.b, eq.c];
    if (slots.some((k) => hidden.has(k))) continue;
    let covered = false;
    for (const k of shuffled(rnd, slots.filter((s) => pool.has(s)))) {
      hidden.add(k);
      if (deducible(layout, hidden, ops)) {
        covered = true;
        break;
      }
      hidden.delete(k);
    }
    if (!covered) return null;
  }
  const required = [...hidden];

  const extra: string[] = [];
  for (const k of shuffled(rnd, candidates)) {
    if (hidden.has(k)) continue;
    hidden.add(k);
    if (deducible(layout, hidden, ops)) extra.push(k);
    else hidden.delete(k);
  }
  return new Set([...required, ...shuffled(rnd, extra).slice(0, Math.round(extra.length * fraction))]);
}

interface Options {
  equations: number;
  ops: Operator[];
  maxValue: number;
  hideTerms: boolean;
  hideResults: boolean;
  hideOps: boolean;
  fraction: number;
}

function build(rnd: Rnd, opt: Options): CrosswordProblem | null {
  for (let restart = 0; restart < RESTARTS; restart++) {
    const layout: Layout = { board: new Map(), equations: [], min: [0, 0], max: [0, 4] };
    const first = shuffled(rnd, opt.ops)
      .map((op) => ({ op, triple: makeTriple(rnd, op, null, 0, opt.maxValue) }))
      .find((x) => x.triple);
    if (!first?.triple) return null;
    place(layout, 0, 0, 'h', first.triple, first.op);

    let stuck = 0;
    while (layout.equations.length < opt.equations && stuck < 12) {
      if (addEquation(rnd, layout, opt.ops, opt.maxValue)) stuck = 0;
      else stuck++;
    }
    if (layout.equations.length < opt.equations && restart < RESTARTS - 1) continue;
    if (layout.equations.length < 3) return null;

    const results = new Set(layout.equations.map((e) => e.c));
    const candidates = [...layout.board]
      .filter(([k, cell]) => {
        if (cell.kind === 'eq') return false;
        if (cell.kind === 'op') return opt.hideOps;
        return results.has(k) ? opt.hideResults : opt.hideTerms;
      })
      .map(([k]) => k);
    if (!candidates.length) return null;
    const hidden = hideCells(rnd, layout, candidates, opt.ops, opt.fraction);
    if (!hidden) continue;

    const [r0, c0] = layout.min;
    const [height, width] = [layout.max[0] - r0 + 1, layout.max[1] - c0 + 1];
    const cells = Array.from({ length: height }, (_, r) =>
      Array.from({ length: width }, (_, c) => {
        const cell = layout.board.get(key(r + r0, c + c0));
        if (!cell) return null;
        return cell.kind === 'eq' ? cell : { ...cell, hidden: hidden.has(key(r + r0, c + c0)) };
      }),
    );
    return { kind: 'crossword', width, height, cells, equationCount: layout.equations.length };
  }
  return null;
}

export const crossword: GeneratorDef = {
  id: 'krzyzowka',
  title: 'Krzyżówki matematyczne',
  description: 'Splecione działania — poziome i pionowe przecinają się na wspólnych liczbach.',
  sample: '3 · □ = 12 na krzyż',
  sheetDefaults: { count: 2, columns: 1 },
  fields: [
    { kind: 'number', key: 'equations', label: 'Ile działań w krzyżówce', min: 3, max: 20 },
    { kind: 'number', key: 'maxValue', label: 'Największa liczba', min: 10, max: 1000, step: 10 },
    ...OPERATIONS.map((o) => ({ kind: 'boolean' as const, key: o.key, label: o.label })),
    { kind: 'boolean', key: 'hideTerms', label: 'Zakrywaj liczby przed znakiem =' },
    { kind: 'boolean', key: 'hideResults', label: 'Zakrywaj wyniki działań' },
    {
      kind: 'boolean',
      key: 'hideOps',
      label: 'Zakrywaj znaki działań',
      help: 'Znak zostaje zakryty tylko wtedy, gdy pasuje do niego jedno działanie.',
    },
    {
      kind: 'number',
      key: 'hidden',
      label: 'Ile kratek zakryć (%)',
      min: 0,
      max: 100,
      step: 5,
      help: 'Każde działanie ma zawsze przynajmniej jedną niewiadomą — to ustawienie steruje resztą kratek. 100% to maksimum, przy którym krzyżówkę wciąż da się rozwiązać krok po kroku.',
    },
  ],
  defaults: {
    equations: 10,
    maxValue: 100,
    opAdd: false,
    opSub: false,
    opMul: true,
    opDiv: true,
    hideTerms: true,
    hideResults: true,
    hideOps: false,
    hidden: 50,
  },
  validate: (cfg) => {
    if (!enabledOps(cfg).length) return 'Zaznacz przynajmniej jedno działanie.';
    if (!bool(cfg, 'hideTerms') && !bool(cfg, 'hideResults') && !bool(cfg, 'hideOps')) {
      return 'Zaznacz, co ma być zakryte — inaczej krzyżówka wyjdzie z wpisanymi wszystkimi liczbami.';
    }
    const ops = enabledOps(cfg);
    const maxValue = num(cfg, 'maxValue', 100);
    if (ops.every((o) => o === '×' || o === ':') && maxValue < 12) {
      return 'Przy samym mnożeniu i dzieleniu największa liczba powinna wynosić co najmniej 12.';
    }
    return null;
  },
  generate: (cfg: Config, count, rnd) => {
    const opt: Options = {
      equations: num(cfg, 'equations', 10),
      ops: enabledOps(cfg),
      maxValue: num(cfg, 'maxValue', 100),
      hideTerms: bool(cfg, 'hideTerms', true),
      hideResults: bool(cfg, 'hideResults', true),
      hideOps: bool(cfg, 'hideOps', false),
      fraction: num(cfg, 'hidden', 70) / 100,
    };
    return collect<CrosswordProblem>(
      count,
      () => build(rnd, opt),
      (p) => p.cells.flat().map((c) => (c ? (c.kind === 'num' ? c.value : c.kind) : '.')).join(','),
    );
  },
};
