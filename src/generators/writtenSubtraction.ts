import type { ColumnProblem, Config, GeneratorDef } from '../types';
import {
  borrowOptions,
  byDigits,
  byRanges,
  collect,
  makeRangedSubtraction,
  makeSubtraction,
  numbersOptions,
  termsKey,
} from './arithmetic';
import type { CarryMode } from './arithmetic';
import type { Range } from './helpers';
import { choice, digitCount, digitsRange, maxForDigits, num, rangeList } from './helpers';

/** Zakresy od–do odjemnej i odjemnika; nieustawione wynikają z liczby cyfr. */
const ranges = (cfg: Config): Range[] =>
  rangeList(cfg, 'ranges', 2, (i) => digitsRange(num(cfg, i === 0 ? 'digitsA' : 'digitsB', 3)));

export const writtenSubtraction: GeneratorDef = {
  id: 'odejmowanie-pisemne',
  title: 'Odejmowanie pisemne',
  description: 'Odjemna nad odjemnikiem, znak −, kreska i kratki na wynik.',
  sample: 'słupek: 502 − 178',
  subject: 'matematyka',
  grades: [2, 3],
  category: 'pisemne',
  sheetDefaults: { count: 12, columns: 4 },
  fields: [
    { kind: 'select', key: 'numbers', label: 'Jak dobierać liczby', options: numbersOptions },
    {
      kind: 'number',
      key: 'digitsA',
      label: 'Ilość cyfr odjemnej (górna liczba)',
      min: 1,
      max: 6,
      showIf: byDigits,
    },
    {
      kind: 'number',
      key: 'digitsB',
      label: 'Ilość cyfr odjemnika (dolna liczba)',
      min: 1,
      max: 6,
      showIf: byDigits,
    },
    {
      kind: 'rangeList',
      key: 'ranges',
      label: 'Zakres liczb',
      labels: ['odjemna', 'odjemnik'],
      min: 0,
      max: 999999,
      fallback: (cfg, i) => ranges(cfg)[i],
      showIf: byRanges,
      help: 'Np. odjemna od 100 do 200, odjemnik od 10 do 99.',
    },
    { kind: 'select', key: 'borrow', label: 'Pożyczki', options: borrowOptions },
    { kind: 'boolean', key: 'grid', label: 'Kratki pod cyframi wyniku', help: 'Miejsce na wpisanie wyniku.' },
    {
      kind: 'boolean',
      key: 'carryRow',
      label: 'Wiersz na pożyczki',
      help: 'Pusty pasek nad działaniem na zapisywanie pożyczek.',
    },
  ],
  defaults: { numbers: 'digits', digitsA: 3, digitsB: 3, borrow: 'with', grid: true, carryRow: false },
  validate: (cfg) => {
    if (byRanges(cfg)) {
      const [[, hiA], [loB]] = ranges(cfg);
      if (loB > hiA) return `Odjemnik to co najmniej ${loB}, a odjemna nie przekroczy ${hiA} — wynik byłby ujemny.`;
      return null;
    }
    const a = num(cfg, 'digitsA', 3);
    const b = num(cfg, 'digitsB', 3);
    if (b > a) return 'Odjemnik nie może mieć więcej cyfr niż odjemna — wynik byłby ujemny.';
    return null;
  },
  generate: (cfg: Config, count, rnd, seen) => {
    const digitsA = num(cfg, 'digitsA', 3);
    const digitsB = num(cfg, 'digitsB', 3);
    const borrow = choice<CarryMode>(cfg, 'borrow', 'any');
    const termRanges = byRanges(cfg) ? ranges(cfg) : null;
    // szerokość wyniku z konfiguracji, a nie z konkretnej odjemnej — inaczej zdradzałaby odpowiedź
    const answerWidth = termRanges ? digitCount(termRanges[0][1]) : digitsA;
    return collect<ColumnProblem>(
      count,
      () => {
        const terms = termRanges
          ? makeRangedSubtraction(rnd, termRanges, borrow)
          : makeSubtraction(rnd, [digitsA, digitsB], maxForDigits(digitsA), borrow);
        if (!terms) return null;
        return {
          kind: 'column',
          terms,
          op: '-',
          answer: terms[0] - terms[1],
          answerWidth,
        };
      },
      (p) => termsKey(p.terms),
      seen,
    );
  },
};
