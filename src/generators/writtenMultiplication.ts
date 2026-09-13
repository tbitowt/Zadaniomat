import type { ColumnProblem, Config, GeneratorDef } from '../types';
import {
  byDigits,
  byRanges,
  carryOptions,
  collect,
  makeMultiplicationPair,
  makeRangedMultiplicationPair,
  numbersOptions,
  termsKey,
} from './arithmetic';
import type { CarryMode } from './arithmetic';
import type { Range } from './helpers';
import { bool, choice, digitCount, digitsRange, num, partialProducts, rangeList } from './helpers';

/** Zakresy od–do mnożnej i mnożnika; nieustawione wynikają z liczby cyfr. */
const ranges = (cfg: Config): Range[] =>
  rangeList(cfg, 'ranges', 2, (i) => digitsRange(num(cfg, i === 0 ? 'digitsA' : 'digitsB', i === 0 ? 3 : 2)));

/** Ile cyfr może mieć mnożnik — od tego zależą wiersze na iloczyny częściowe. */
const multiplierDigits = (cfg: Config) => (byRanges(cfg) ? digitCount(ranges(cfg)[1][1]) : num(cfg, 'digitsB', 2));

export const writtenMultiplication: GeneratorDef = {
  id: 'mnozenie-pisemne',
  title: 'Mnożenie pisemne',
  description: 'Mnożna nad mnożnikiem, znak ×, iloczyny częściowe i kratki na wynik.',
  sample: 'słupek: 246 × 37',
  subject: 'matematyka',
  grades: [3],
  category: 'pisemne',
  sheetDefaults: { count: 9, columns: 3 },
  fields: [
    { kind: 'select', key: 'numbers', label: 'Jak dobierać liczby', options: numbersOptions },
    {
      kind: 'number',
      key: 'digitsA',
      label: 'Ilość cyfr mnożnej (górna liczba)',
      min: 1,
      max: 6,
      showIf: byDigits,
    },
    {
      kind: 'number',
      key: 'digitsB',
      label: 'Ilość cyfr mnożnika (dolna liczba)',
      min: 1,
      max: 3,
      showIf: byDigits,
    },
    {
      kind: 'rangeList',
      key: 'ranges',
      label: 'Zakres liczb',
      labels: ['mnożna', 'mnożnik'],
      min: 0,
      max: 999999,
      fallback: (cfg, i) => ranges(cfg)[i],
      showIf: byRanges,
      help: 'Np. mnożna od 100 do 300, mnożnik od 2 do 9.',
    },
    { kind: 'select', key: 'carry', label: 'Przeniesienia', options: carryOptions },
    {
      kind: 'boolean',
      key: 'partials',
      label: 'Wiersze na iloczyny częściowe',
      help: 'Po jednym wierszu na każdą cyfrę mnożnika.',
      showIf: (cfg) => multiplierDigits(cfg) > 1,
    },
    { kind: 'boolean', key: 'grid', label: 'Kratki pod cyframi wyniku', help: 'Miejsce na wpisanie wyniku.' },
    {
      kind: 'boolean',
      key: 'carryRow',
      label: 'Wiersz na przeniesienia',
      help: 'Pusty pasek nad działaniem na zapisywanie przeniesień.',
    },
  ],
  defaults: { numbers: 'digits', digitsA: 3, digitsB: 2, carry: 'with', partials: true, grid: true, carryRow: false },
  validate: (cfg) => {
    if (byRanges(cfg)) return null;
    const a = num(cfg, 'digitsA', 3);
    const b = num(cfg, 'digitsB', 2);
    if (choice<CarryMode>(cfg, 'carry', 'any') === 'without' && a + b > 7) {
      return 'Bez przeniesień tak długich liczb praktycznie nie da się ułożyć — zmniejsz liczbę cyfr.';
    }
    return null;
  },
  generate: (cfg: Config, count, rnd, seen) => {
    const digitsA = num(cfg, 'digitsA', 3);
    const digitsB = num(cfg, 'digitsB', 2);
    const carry = choice<CarryMode>(cfg, 'carry', 'any');
    const termRanges = byRanges(cfg) ? ranges(cfg) : null;
    const showPartials = bool(cfg, 'partials', true) && multiplierDigits(cfg) > 1;
    // szerokość wyniku liczona z konfiguracji, nie z konkretnego iloczynu —
    // inaczej liczba kratek zdradzałaby odpowiedź
    const answerWidth = termRanges ? digitCount(termRanges[0][1] * termRanges[1][1]) : digitsA + digitsB;
    return collect<ColumnProblem>(
      count,
      () => {
        const pair = termRanges
          ? makeRangedMultiplicationPair(rnd, termRanges[0], termRanges[1], carry)
          : makeMultiplicationPair(rnd, digitsA, digitsB, carry);
        if (!pair) return null;
        const [a, b] = pair;
        return {
          kind: 'column',
          terms: [a, b],
          op: '×',
          answer: a * b,
          answerWidth,
          partials: showPartials ? partialProducts(a, b) : undefined,
        };
      },
      (p) => termsKey(p.terms),
      seen,
    );
  },
};
