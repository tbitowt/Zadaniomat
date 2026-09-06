import type { Config, GeneratorDef, InlineProblem, Rnd } from '../types';
import { collect } from './arithmetic';
import { choice, num } from './helpers';

type Target = 'ten' | 'twenty' | 'hundred' | 'nextTen' | 'custom';
type Form = 'add' | 'sub' | 'mixed';
type BlankPos = 'second' | 'first' | 'mixed';

const targetOptions = [
  { value: 'ten', label: 'do 10' },
  { value: 'twenty', label: 'do 20' },
  { value: 'hundred', label: 'do 100' },
  { value: 'nextTen', label: 'do najbliższej pełnej dziesiątki' },
  { value: 'custom', label: 'do własnej liczby' },
];

const formOptions = [
  { value: 'add', label: 'dodawanie (7 + ___ = 10)' },
  { value: 'sub', label: 'odejmowanie (10 − ___ = 7)' },
  { value: 'mixed', label: 'losowo' },
];

const blankOptions = [
  { value: 'second', label: 'druga liczba' },
  { value: 'first', label: 'pierwsza liczba' },
  { value: 'mixed', label: 'losowo' },
];

const target = (cfg: Config) => choice<Target>(cfg, 'target', 'ten');

/** Liczba, którą uczeń widzi, oraz pełna liczba, do której uzupełnia. */
function pickPair(rnd: Rnd, cfg: Config): [number, number] | null {
  if (target(cfg) === 'nextTen') {
    const max = num(cfg, 'maxValue', 100);
    for (let attempt = 0; attempt < 50; attempt++) {
      const n = rnd.int(1, max);
      if (n % 10 !== 0) return [n, Math.ceil(n / 10) * 10];
    }
    return null;
  }
  const mode = target(cfg);
  const full =
    mode === 'ten' ? 10 : mode === 'twenty' ? 20 : mode === 'hundred' ? 100 : num(cfg, 'customTarget', 10);
  if (full < 2) return null;
  return [rnd.int(1, full - 1), full];
}

export const completion: GeneratorDef = {
  id: 'uzupelnianie',
  title: 'Uzupełnianie do pełnej liczby',
  description: 'Ile brakuje do 10, 20, 100 albo do najbliższej dziesiątki.',
  sample: '7 + ___ = 10',
  sheetDefaults: { count: 20, columns: 4 },
  fields: [
    { kind: 'select', key: 'target', label: 'Do ilu uzupełniamy', options: targetOptions },
    {
      kind: 'number',
      key: 'customTarget',
      label: 'Własna liczba',
      min: 2,
      max: 1000000,
      showIf: (cfg) => target(cfg) === 'custom',
    },
    {
      kind: 'number',
      key: 'maxValue',
      label: 'Największa liczba',
      min: 2,
      max: 1000000,
      step: 10,
      showIf: (cfg) => target(cfg) === 'nextTen',
    },
    { kind: 'select', key: 'form', label: 'Postać działania', options: formOptions },
    { kind: 'select', key: 'blank', label: 'Która liczba zakryta', options: blankOptions },
  ],
  defaults: { target: 'ten', customTarget: 10, maxValue: 100, form: 'add', blank: 'second' },
  validate: (cfg) => {
    if (target(cfg) === 'nextTen' && num(cfg, 'maxValue', 100) < 2) {
      return 'Największa liczba musi być co najmniej 2.';
    }
    if (target(cfg) === 'custom' && num(cfg, 'customTarget', 10) < 2) {
      return 'Uzupełniać można do liczby co najmniej 2.';
    }
    return null;
  },
  generate: (cfg: Config, count, rnd) => {
    const form = choice<Form>(cfg, 'form', 'add');
    const blank = choice<BlankPos>(cfg, 'blank', 'second');
    return collect<InlineProblem>(
      count,
      () => {
        const pair = pickPair(rnd, cfg);
        if (!pair) return null;
        const [n, full] = pair;
        const rest = full - n;
        const adding = form === 'mixed' ? rnd.int(0, 1) === 0 : form === 'add';
        const blankIndex = blank === 'mixed' ? rnd.int(0, 1) : blank === 'first' ? 0 : 1;
        // dodawanie: n + reszta = pełna; odejmowanie: pełna − reszta = n
        const terms = adding ? [n, rest] : [full, rest];
        return {
          kind: 'inline',
          terms,
          op: adding ? '+' : '-',
          result: adding ? full : n,
          answer: terms[blankIndex],
          blankIndex,
        };
      },
      (p) => `${p.terms.join('|')}${p.op}${p.blankIndex}`,
    );
  },
};
