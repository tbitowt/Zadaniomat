import type { Config, GeneratorDef, InlineProblem } from '../types';
import {
  byDigits,
  byRanges,
  carryOptions,
  collect,
  makeAddition,
  makeRangedAddition,
  numbersOptions,
  pickBlank,
  termsKey,
  unknownOptions,
} from './arithmetic';
import type { CarryMode, UnknownMode } from './arithmetic';
import { choice, digitsList, digitsRange, minForDigits, num, rangeList } from './helpers';

/** Zakresy od–do składników; nieustawione wynikają z liczby cyfr. */
const ranges = (cfg: Config) => {
  const count = num(cfg, 'termCount', 2);
  const digits = digitsList(cfg, 'digits', count);
  return rangeList(cfg, 'ranges', count, (i) => digitsRange(digits[i]));
};

export const mentalAddition: GeneratorDef = {
  id: 'dodawanie-pamiec',
  title: 'Dodawanie w pamięci',
  description: 'Działania w jednej linii z miejscem na wynik.',
  sample: '24 + 13 = ____',
  subject: 'matematyka',
  grades: [1, 2, 3],
  category: 'rachunek',
  sheetDefaults: { count: 30, columns: 3 },
  fields: [
    { kind: 'number', key: 'termCount', label: 'Ile liczb do dodania', min: 2, max: 5 },
    { kind: 'select', key: 'numbers', label: 'Jak dobierać liczby', options: numbersOptions },
    {
      kind: 'digitsList',
      key: 'digits',
      label: 'Ilość cyfr w poszczególnych liczbach',
      countKey: 'termCount',
      min: 1,
      max: 4,
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
      help: 'Np. pierwsza liczba od 10 do 20, druga od 1 do 10.',
    },
    { kind: 'number', key: 'minResult', label: 'Minimalny wynik', min: 0, max: 1000000, step: 10 },
    { kind: 'number', key: 'maxResult', label: 'Maksymalny wynik', min: 2, max: 1000000, step: 10 },
    { kind: 'select', key: 'carry', label: 'Przekraczanie progu', options: carryOptions },
    {
      kind: 'select',
      key: 'unknown',
      label: 'Szukana liczba',
      options: (cfg) => unknownOptions(num(cfg, 'termCount', 2)),
      help: 'Zamiast wyniku można zakryć jeden ze składników: 24 + ___ = 37.',
    },
  ],
  defaults: { termCount: 2, numbers: 'digits', digits: [2, 1], minResult: 0, maxResult: 100, carry: 'any', unknown: 'result' },
  validate: (cfg) => {
    const maxResult = num(cfg, 'maxResult', 100);
    const minResult = num(cfg, 'minResult', 0);
    if (minResult > maxResult) {
      return 'Minimalny wynik nie może być większy od maksymalnego.';
    }
    if (byRanges(cfg)) {
      const minSum = ranges(cfg).reduce((a, r) => a + r[0], 0);
      const maxSum = ranges(cfg).reduce((a, r) => a + r[1], 0);
      if (minSum > maxResult) {
        return `Przy tych zakresach najmniejsza możliwa suma to ${minSum} — zwiększ maksymalny wynik albo zmniejsz liczby.`;
      }
      if (maxSum < minResult) {
        return `Przy tych zakresach największa możliwa suma to ${maxSum} — zmniejsz minimalny wynik albo zwiększ liczby.`;
      }
      return null;
    }
    const digits = digitsList(cfg, 'digits', num(cfg, 'termCount', 2));
    const minSum = digits.reduce((a, d) => a + minForDigits(d), 0);
    if (minSum > maxResult) {
      return `Przy tej liczbie cyfr najmniejsza możliwa suma to ${minSum} — zwiększ maksymalny wynik.`;
    }
    return null;
  },
  generate: (cfg: Config, count, rnd, seen) => {
    const termCount = num(cfg, 'termCount', 2);
    const digits = digitsList(cfg, 'digits', termCount);
    const maxResult = num(cfg, 'maxResult', 100);
    const minResult = num(cfg, 'minResult', 0);
    const carry = choice<CarryMode>(cfg, 'carry', 'any');
    const unknown = choice<UnknownMode>(cfg, 'unknown', 'result');
    const termRanges = byRanges(cfg) ? ranges(cfg) : null;
    return collect<InlineProblem>(
      count,
      () => {
        const terms = termRanges
          ? makeRangedAddition(rnd, termRanges, minResult, maxResult, carry)
          : makeAddition(rnd, digits, maxResult, carry, minResult);
        if (!terms) return null;
        const result = terms.reduce((a, b) => a + b, 0);
        const blankIndex = pickBlank(rnd, unknown, terms, '+');
        return {
          kind: 'inline',
          terms,
          op: '+',
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
