import type { Config, GeneratorDef, InlineProblem } from '../types';
import {
  borrowOptions,
  byDigits,
  byRanges,
  collect,
  makeRangedSubtraction,
  makeSubtraction,
  numbersOptions,
  pickBlank,
  termsKey,
  unknownOptions,
} from './arithmetic';
import type { CarryMode, UnknownMode } from './arithmetic';
import { choice, digitsList, digitsRange, maxForDigits, minForDigits, num, rangeList } from './helpers';

/** Zakresy od–do odjemnej i odjemników; nieustawione wynikają z liczby cyfr. */
const ranges = (cfg: Config) => {
  const count = num(cfg, 'termCount', 2);
  const digits = digitsList(cfg, 'digits', count);
  return rangeList(cfg, 'ranges', count, (i) => digitsRange(digits[i]));
};

export const mentalSubtraction: GeneratorDef = {
  id: 'odejmowanie-pamiec',
  title: 'Odejmowanie w pamięci',
  description: 'Działania w jednej linii, wynik nigdy nie jest ujemny.',
  sample: '84 − 27 = ____',
  subject: 'matematyka',
  grades: [1, 2, 3],
  category: 'rachunek',
  sheetDefaults: { count: 30, columns: 3 },
  fields: [
    { kind: 'number', key: 'termCount', label: 'Ile liczb w działaniu', min: 2, max: 4 },
    { kind: 'select', key: 'numbers', label: 'Jak dobierać liczby', options: numbersOptions },
    {
      kind: 'digitsList',
      key: 'digits',
      label: 'Ilość cyfr w poszczególnych liczbach',
      countKey: 'termCount',
      min: 1,
      max: 4,
      help: 'Pierwsza liczba to odjemna.',
      showIf: byDigits,
    },
    {
      kind: 'rangeList',
      key: 'ranges',
      label: 'Zakres poszczególnych liczb',
      countKey: 'termCount',
      min: 0,
      max: 1000000,
      fallback: (cfg, i) => ranges(cfg)[i],
      showIf: byRanges,
      help: 'Pierwsza liczba to odjemna. Np. odjemna od 10 do 20, odjemnik od 1 do 10.',
    },
    {
      kind: 'number',
      key: 'maxValue',
      label: 'Największa liczba w działaniu',
      min: 2,
      max: 1000000,
      step: 10,
      showIf: byDigits,
    },
    { kind: 'select', key: 'borrow', label: 'Pożyczka (przekraczanie progu)', options: borrowOptions },
    {
      kind: 'select',
      key: 'unknown',
      label: 'Szukana liczba',
      options: (cfg) => unknownOptions(num(cfg, 'termCount', 2)),
      help: 'Zamiast wyniku można zakryć odjemną lub odjemnik: 84 − ___ = 57.',
    },
  ],
  defaults: { termCount: 2, numbers: 'digits', digits: [2, 1], maxValue: 100, borrow: 'any', unknown: 'result' },
  validate: (cfg) => {
    if (byRanges(cfg)) {
      const [first, ...rest] = ranges(cfg);
      const minRest = rest.reduce((a, r) => a + r[0], 0);
      if (minRest > first[1]) {
        return `Odjemniki dają minimum ${minRest}, a odjemna nie przekroczy ${first[1]} — wynik byłby ujemny.`;
      }
      return null;
    }
    const digits = digitsList(cfg, 'digits', num(cfg, 'termCount', 2));
    const maxValue = num(cfg, 'maxValue', 100);
    const minMinuend = minForDigits(digits[0]);
    if (minMinuend > maxValue) {
      return `Odjemna o ${digits[0]} cyfrach to minimum ${minMinuend} — zwiększ największą liczbę.`;
    }
    const minRest = digits.slice(1).reduce((a, d) => a + minForDigits(d), 0);
    const maxMinuend = Math.min(maxForDigits(digits[0]), maxValue);
    if (minRest > maxMinuend) {
      return `Odjemniki dają minimum ${minRest}, a odjemna nie przekroczy ${maxMinuend} — wynik byłby ujemny.`;
    }
    return null;
  },
  generate: (cfg: Config, count, rnd, seen) => {
    const termCount = num(cfg, 'termCount', 2);
    const digits = digitsList(cfg, 'digits', termCount);
    const maxValue = num(cfg, 'maxValue', 100);
    const borrow = choice<CarryMode>(cfg, 'borrow', 'any');
    const unknown = choice<UnknownMode>(cfg, 'unknown', 'result');
    const termRanges = byRanges(cfg) ? ranges(cfg) : null;
    return collect<InlineProblem>(
      count,
      () => {
        const terms = termRanges
          ? makeRangedSubtraction(rnd, termRanges, borrow)
          : makeSubtraction(rnd, digits, maxValue, borrow);
        if (!terms) return null;
        const result = terms.slice(1).reduce((a, b) => a - b, terms[0]);
        const blankIndex = pickBlank(rnd, unknown, terms, '-');
        return {
          kind: 'inline',
          terms,
          op: '-',
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
