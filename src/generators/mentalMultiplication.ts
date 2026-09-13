import type { Config, GeneratorDef, InlineProblem } from '../types';
import { collect, makeMultiplication, makeRangedMultiplication, pickBlank, termsKey, unknownOptions } from './arithmetic';
import type { UnknownMode } from './arithmetic';
import type { Range } from './helpers';
import { bool, choice, digitsList, digitsRange, minForDigits, num, rangeList } from './helpers';

type Mode = 'table' | 'digits' | 'ranges';

const modeOptions = [
  { value: 'table', label: 'tabliczka mnożenia (zakres czynników)' },
  { value: 'digits', label: 'według liczby cyfr' },
  { value: 'ranges', label: 'według zakresu od–do' },
];

const mode = (cfg: Config) => choice<Mode>(cfg, 'mode', 'table');
const isTable = (cfg: Config) => mode(cfg) === 'table';
const isDigits = (cfg: Config) => mode(cfg) === 'digits';
const isRanges = (cfg: Config) => mode(cfg) === 'ranges';

/** Zakresy od–do czynników, tak jak wpisał je uczący; nieustawione wynikają z liczby cyfr. */
const ranges = (cfg: Config): Range[] => {
  const count = num(cfg, 'termCount', 2);
  const digits = digitsList(cfg, 'digits', count);
  return rangeList(cfg, 'ranges', count, (i) => digitsRange(digits[i]));
};

/** Zakresy czynników po odrzuceniu 0 i 1, jeśli ich nie chcemy. */
const factorRanges = (cfg: Config): Range[] =>
  bool(cfg, 'allowTrivial', false) ? ranges(cfg) : ranges(cfg).map(([lo, hi]) => [Math.max(lo, 2), hi]);

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
  subject: 'matematyka',
  grades: [2, 3],
  category: 'rachunek',
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
      showIf: (cfg) => !isTable(cfg),
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
      kind: 'rangeList',
      key: 'ranges',
      label: 'Zakres poszczególnych czynników',
      countKey: 'termCount',
      min: 0,
      max: 1000000,
      fallback: (cfg, i) => ranges(cfg)[i],
      showIf: isRanges,
      help: 'Np. pierwszy czynnik od 11 do 20, drugi od 2 do 5.',
    },
    {
      kind: 'number',
      key: 'maxResult',
      label: 'Maksymalny wynik',
      min: 2,
      max: 1000000,
      step: 10,
      showIf: (cfg) => !isTable(cfg),
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
      options: (cfg) => unknownOptions(isTable(cfg) ? 2 : num(cfg, 'termCount', 2)),
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
    if (isRanges(cfg)) {
      const empty = factorRanges(cfg).findIndex(([lo, hi]) => lo > hi);
      if (empty >= 0) {
        return `Po odrzuceniu 0 i 1 czynnik ${empty + 1} nie ma żadnej wartości — poszerz jego zakres albo dopuść mnożenie przez 0 i 1.`;
      }
      const minProduct = factorRanges(cfg).reduce((a, r) => a * r[0], 1);
      if (minProduct > num(cfg, 'maxResult', 1000)) {
        return `Przy tych zakresach najmniejszy możliwy iloczyn to ${minProduct} — zwiększ maksymalny wynik.`;
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
  generate: (cfg: Config, count, rnd, seen) => {
    const unknown = choice<UnknownMode>(cfg, 'unknown', 'result');
    const [lo, hi] = tableRange(cfg);
    const termRanges = factorRanges(cfg);
    const termCount = num(cfg, 'termCount', 2);
    const digits = digitsList(cfg, 'digits', termCount);
    const maxResult = num(cfg, 'maxResult', 1000);
    const minFactor = bool(cfg, 'allowTrivial', false) ? 1 : 2;

    const factors = isTable(cfg)
      ? () => (lo > hi ? null : [rnd.int(lo, hi), rnd.int(lo, hi)])
      : isRanges(cfg)
        ? () => (termRanges.some(([a, b]) => a > b) ? null : makeRangedMultiplication(rnd, termRanges, maxResult))
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
      seen,
    );
  },
};
