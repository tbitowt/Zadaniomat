import type { CompareProblem, CompareSide, Config, GeneratorDef, Operator, Rnd } from '../types';
import { collect } from './arithmetic';
import { bool, choice, num } from './helpers';

type Sides = 'numbers' | 'mixed' | 'expressions';

const sidesOptions = [
  { value: 'numbers', label: 'same liczby (7 ⬜ 12)' },
  { value: 'mixed', label: 'liczba i działanie (7 + 5 ⬜ 10)' },
  { value: 'expressions', label: 'dwa działania (7 + 5 ⬜ 4 × 3)' },
];

const opFields: { key: string; label: string; op: Operator }[] = [
  { key: 'opAdd', label: 'Dodawanie', op: '+' },
  { key: 'opSub', label: 'Odejmowanie', op: '-' },
  { key: 'opMul', label: 'Mnożenie', op: '×' },
];

const withNumbersOnly = (cfg: Config) => choice<Sides>(cfg, 'sides', 'mixed') === 'numbers';

const enabledOps = (cfg: Config): Operator[] =>
  opFields.filter((f) => bool(cfg, f.key, false)).map((f) => f.op);

const plain = (value: number): CompareSide => ({ terms: [value], op: '+', value });

/** Losowa strona porównania: pojedyncza liczba albo działanie o wartości ≤ `max`. */
function makeSide(rnd: Rnd, ops: Operator[], max: number, asNumber: boolean): CompareSide {
  if (asNumber || !ops.length) return plain(rnd.int(0, max));
  const op = rnd.pick(ops);
  // składniki bierzemy od 1 w górę — działania z zerem niczego nie ćwiczą
  if (op === '-') {
    const a = rnd.int(2, Math.max(2, max));
    const b = rnd.int(1, a - 1);
    return { terms: [a, b], op, value: a - b };
  }
  if (op === '×') {
    const a = rnd.int(2, Math.max(2, Math.min(10, max)));
    const b = rnd.int(1, Math.max(1, Math.floor(max / a)));
    return { terms: [a, b], op, value: a * b };
  }
  const a = rnd.int(1, Math.max(1, max - 1));
  const b = rnd.int(1, Math.max(1, max - a));
  return { terms: [a, b], op: '+', value: a + b };
}

/** Strona o z góry zadanej wartości — stąd biorą się porównania ze znakiem „=”. */
function sideWithValue(rnd: Rnd, ops: Operator[], max: number, v: number, asNumber: boolean): CompareSide {
  if (asNumber || !ops.length) return plain(v);
  const op = rnd.pick(ops);
  if (op === '-') {
    const b = rnd.int(Math.min(1, max - v), max - v);
    return { terms: [v + b, b], op, value: v };
  }
  if (op === '×') {
    const divisors: number[] = [];
    for (let d = 1; d <= v; d++) if (v % d === 0) divisors.push(d);
    if (divisors.length) {
      const d = rnd.pick(divisors);
      return { terms: [d, v / d], op, value: v };
    }
  }
  const a = v > 1 ? rnd.int(1, v - 1) : rnd.int(0, v);
  return { terms: [a, v - a], op: '+', value: v };
}

const sideKey = (s: CompareSide) => s.terms.join(s.op);

export const comparison: GeneratorDef = {
  id: 'porownywanie',
  title: 'Porównywanie liczb',
  description: 'Uczeń wstawia znak <, > albo = między dwie strony.',
  sample: '24 + 3 ⬜ 30',
  sheetDefaults: { count: 24, columns: 3 },
  fields: [
    { kind: 'select', key: 'sides', label: 'Co porównujemy', options: sidesOptions },
    ...opFields.map((f) => ({
      kind: 'boolean' as const,
      key: f.key,
      label: f.label,
      showIf: (cfg: Config) => !withNumbersOnly(cfg),
    })),
    { kind: 'number', key: 'maxValue', label: 'Największa liczba', min: 5, max: 1000000, step: 10 },
    {
      kind: 'number',
      key: 'equalShare',
      label: 'Ile zadań ze znakiem „=” (%)',
      min: 0,
      max: 50,
      step: 5,
      help: 'Poza tym udziałem generator unika przypadkowej równości stron.',
    },
  ],
  defaults: { sides: 'mixed', opAdd: true, opSub: true, opMul: false, maxValue: 20, equalShare: 20 },
  validate: (cfg) => {
    if (!withNumbersOnly(cfg) && !enabledOps(cfg).length) {
      return 'Zaznacz przynajmniej jedno działanie albo porównuj same liczby.';
    }
    return null;
  },
  generate: (cfg: Config, count, rnd) => {
    const sides = choice<Sides>(cfg, 'sides', 'mixed');
    const ops = enabledOps(cfg);
    const max = num(cfg, 'maxValue', 20);
    const equalShare = num(cfg, 'equalShare', 20);
    // w trybie mieszanym jedna strona jest gołą liczbą — raz lewa, raz prawa
    const shape = (): [boolean, boolean] => {
      if (sides === 'numbers') return [true, true];
      if (sides === 'expressions') return [false, false];
      return rnd.int(0, 1) === 0 ? [false, true] : [true, false];
    };
    return collect<CompareProblem>(
      count,
      () => {
        const [leftPlain, rightPlain] = shape();
        const left = makeSide(rnd, ops, max, leftPlain);
        let right: CompareSide;
        if (rnd.int(1, 100) <= equalShare) {
          right = sideWithValue(rnd, ops, max, left.value, rightPlain);
        } else {
          // poza zadanym udziałem równość jest niechciana — losujemy prawą stronę do skutku
          right = makeSide(rnd, ops, max, rightPlain);
          for (let attempt = 0; attempt < 20 && right.value === left.value; attempt++) {
            right = makeSide(rnd, ops, max, rightPlain);
          }
        }
        const answer = left.value < right.value ? '<' : left.value > right.value ? '>' : '=';
        return { kind: 'compare', left, right, answer };
      },
      (p) => `${sideKey(p.left)}#${sideKey(p.right)}`,
    );
  },
};
