import type { Config, GeneratorDef, InlineProblem } from '../types';
import { collect, makeMultiplication, pickBlank, termsKey, unknownOptions } from './arithmetic';
import type { UnknownMode } from './arithmetic';
import { bool, choice, digitsList, minForDigits, num } from './helpers';

type Mode = 'table' | 'digits';

const modeOptions = [
  { value: 'table', label: 'tabliczka mnożenia (zakres czynników)' },
  { value: 'digits', label: 'według liczby cyfr' },
];

const isTable = (cfg: Config) => choice<Mode>(cfg, 'mode', 'table') === 'table';
const isDigits = (cfg: Config) => !isTable(cfg);

/** Dolna granica czynników w trybie tabliczki — bez 0 i 1, jeśli ich nie chcemy. */
const tableRange = (cfg: Config): [number, number] => {
  const from = num(cfg, 'tableFrom', 2);
  const to = num(cfg, 'tableTo', 10);
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  return [bool(cfg, 'allowTrivial', false) ? lo : Math.max(lo, 2), hi];
};

export const mentalMultiplication: GeneratorDef = {
  id: 'mnozenie-pamiec',
  title: 'Mnożenie w pamięci',
  description: 'Tabliczka mnożenia albo iloczyny liczb o zadanej liczbie cyfr.',
  sample: '7 × 8 = ____',
  sheetDefaults: { count: 30, columns: 3 },
  fields: [
    { kind: 'select', key: 'mode', label: 'Skąd brać czynniki', options: modeOptions },
    {
      kind: 'number',
      key: 'tableFrom',
      label: 'Czynniki od',
      min: 0,
      max: 20,
      showIf: isTable,
    },
    {
      kind: 'number',
      key: 'tableTo',
      label: 'Czynniki do',
      min: 1,
      max: 20,
      showIf: isTable,
      help: 'Np. od 2 do 10 to klasyczna tabliczka mnożenia.',
    },
    {
      kind: 'number',
      key: 'termCount',
      label: 'Ile czynników',
      min: 2,
      max: 3,
      showIf: isDigits,
    },
    {
      kind: 'digitsList',
      key: 'digits',
      label: 'Ilość cyfr w poszczególnych liczbach',
      countKey: 'termCount',
      min: 1,
      max: 3,
      showIf: isDigits,
    },
    {
      kind: 'number',
      key: 'maxResult',
      label: 'Maksymalny wynik',
      min: 2,
      max: 1000000,
      step: 10,
      showIf: isDigits,
    },
    {
      kind: 'boolean',
      key: 'allowTrivial',
      label: 'Dopuść mnożenie przez 0 i 1',
      help: 'Wyłączone odsiewa najłatwiejsze przypadki.',
    },
    {
      kind: 'select',
      key: 'unknown',
      label: 'Szukana liczba',
      options: unknownOptions,
      help: 'Zamiast wyniku można zakryć czynnik: 7 × ___ = 56.',
    },
  ],
  defaults: {
    mode: 'table',
    tableFrom: 2,
    tableTo: 10,
    termCount: 2,
    digits: [2, 1],
    maxResult: 1000,
    allowTrivial: false,
    unknown: 'result',
  },
  validate: (cfg) => {
    if (isTable(cfg)) {
      const [lo, hi] = tableRange(cfg);
      if (lo > hi) {
        return 'Po odrzuceniu 0 i 1 nie zostaje żaden czynnik — poszerz zakres albo dopuść mnożenie przez 0 i 1.';
      }
      return null;
    }
    const digits = digitsList(cfg, 'digits', num(cfg, 'termCount', 2));
    const minProduct = digits.reduce((a, d) => a * minForDigits(d), 1);
    if (minProduct > num(cfg, 'maxResult', 1000)) {
      return `Przy tej liczbie cyfr najmniejszy możliwy iloczyn to ${minProduct} — zwiększ maksymalny wynik.`;
    }
    return null;
  },
  generate: (cfg: Config, count, rnd) => {
    const unknown = choice<UnknownMode>(cfg, 'unknown', 'result');
    const table = isTable(cfg);
    const [lo, hi] = tableRange(cfg);
    const termCount = num(cfg, 'termCount', 2);
    const digits = digitsList(cfg, 'digits', termCount);
    const maxResult = num(cfg, 'maxResult', 1000);
    const minFactor = bool(cfg, 'allowTrivial', false) ? 1 : 2;

    const factors = table
      ? () => (lo > hi ? null : [rnd.int(lo, hi), rnd.int(lo, hi)])
      : () => makeMultiplication(rnd, digits, maxResult, minFactor);

    return collect<InlineProblem>(
      count,
      () => {
        const terms = factors();
        if (!terms) return null;
        const result = terms.reduce((a, b) => a * b, 1);
        const blankIndex = pickBlank(rnd, unknown, terms, '×');
        return {
          kind: 'inline',
          terms,
          op: '×',
          result,
          answer: blankIndex < 0 ? result : terms[blankIndex],
          blankIndex,
        };
      },
      (p) => termsKey(p.terms),
    );
  },
};
