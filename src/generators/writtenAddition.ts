import type { ColumnProblem, Config, GeneratorDef } from '../types';
import {
  byDigits,
  byRanges,
  carryOptions,
  collect,
  makeAddition,
  makeRangedAddition,
  numbersOptions,
  termsKey,
} from './arithmetic';
import type { CarryMode } from './arithmetic';
import { choice, digitCount, digitsList, digitsRange, maxForDigits, num, rangeList } from './helpers';

/** Zakresy od–do składników; nieustawione wynikają z liczby cyfr. */
const ranges = (cfg: Config) => {
  const count = num(cfg, 'termCount', 2);
  const digits = digitsList(cfg, 'digits', count, 3);
  return rangeList(cfg, 'ranges', count, (i) => digitsRange(digits[i]));
};

export const writtenAddition: GeneratorDef = {
  id: 'dodawanie-pisemne',
  title: 'Dodawanie pisemne',
  description: 'Liczby zapisane w słupku, znak +, kreska i kratki na wynik.',
  sample: 'słupek: 348 + 176',
  subject: 'matematyka',
  grades: [2, 3],
  category: 'pisemne',
  sheetDefaults: { count: 12, columns: 4 },
  fields: [
    { kind: 'number', key: 'termCount', label: 'Ile liczb do dodania', min: 2, max: 4 },
    { kind: 'select', key: 'numbers', label: 'Jak dobierać liczby', options: numbersOptions },
    {
      kind: 'digitsList',
      key: 'digits',
      label: 'Ilość cyfr w poszczególnych liczbach',
      countKey: 'termCount',
      min: 1,
      max: 6,
      showIf: byDigits,
    },
    {
      kind: 'rangeList',
      key: 'ranges',
      label: 'Zakres poszczególnych liczb',
      countKey: 'termCount',
      min: 0,
      max: 999999,
      fallback: (cfg, i) => ranges(cfg)[i],
      showIf: byRanges,
      help: 'Np. pierwsza liczba od 100 do 500, druga od 10 do 99.',
    },
    { kind: 'select', key: 'carry', label: 'Przeniesienia', options: carryOptions },
    { kind: 'boolean', key: 'grid', label: 'Kratki pod cyframi wyniku', help: 'Miejsce na wpisanie wyniku.' },
    {
      kind: 'boolean',
      key: 'carryRow',
      label: 'Wiersz na przeniesienia',
      help: 'Pusty pasek nad działaniem na zapisywanie przeniesień.',
    },
  ],
  defaults: { termCount: 2, numbers: 'digits', digits: [3, 3], carry: 'with', grid: true, carryRow: false },
  generate: (cfg: Config, count, rnd, seen) => {
    const termCount = num(cfg, 'termCount', 2);
    const digits = digitsList(cfg, 'digits', termCount, 3);
    const carry = choice<CarryMode>(cfg, 'carry', 'any');
    const termRanges = byRanges(cfg) ? ranges(cfg) : null;
    // szerokość wyniku liczona z konfiguracji, nie z konkretnego wyniku —
    // inaczej liczba kratek zdradzałaby odpowiedź
    const answerWidth = digitCount(
      termRanges ? termRanges.reduce((a, r) => a + r[1], 0) : digits.reduce((a, d) => a + maxForDigits(d), 0),
    );
    return collect<ColumnProblem>(
      count,
      () => {
        const terms = termRanges
          ? makeRangedAddition(rnd, termRanges, 0, Number.MAX_SAFE_INTEGER, carry)
          : makeAddition(rnd, digits, Number.MAX_SAFE_INTEGER, carry);
        if (!terms) return null;
        return {
          kind: 'column',
          terms,
          op: '+',
          answer: terms.reduce((a, b) => a + b, 0),
          answerWidth,
        };
      },
      (p) => termsKey(p.terms),
      seen,
    );
  },
};
