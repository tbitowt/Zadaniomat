import type { Config, GeneratorDef, InlineProblem } from '../types';
import { borrowOptions, collect, makeSubtraction, pickBlank, termsKey, unknownOptions } from './arithmetic';
import type { CarryMode, UnknownMode } from './arithmetic';
import { choice, digitsList, maxForDigits, minForDigits, num } from './helpers';

export const mentalSubtraction: GeneratorDef = {
  id: 'odejmowanie-pamiec',
  title: 'Odejmowanie w pamięci',
  description: 'Działania w jednej linii, wynik nigdy nie jest ujemny.',
  sample: '84 − 27 = ____',
  sheetDefaults: { count: 30, columns: 3 },
  fields: [
    { kind: 'number', key: 'termCount', label: 'Ile liczb w działaniu', min: 2, max: 4 },
    {
      kind: 'digitsList',
      key: 'digits',
      label: 'Ilość cyfr w poszczególnych liczbach',
      countKey: 'termCount',
      min: 1,
      max: 4,
      help: 'Pierwsza liczba to odjemna.',
    },
    { kind: 'number', key: 'maxValue', label: 'Największa liczba w działaniu', min: 2, max: 1000000, step: 10 },
    { kind: 'select', key: 'borrow', label: 'Pożyczka (przekraczanie progu)', options: borrowOptions },
    {
      kind: 'select',
      key: 'unknown',
      label: 'Szukana liczba',
      options: unknownOptions,
      help: 'Zamiast wyniku można zakryć odjemną lub odjemnik: 84 − ___ = 57.',
    },
  ],
  defaults: { termCount: 2, digits: [2, 1], maxValue: 100, borrow: 'any', unknown: 'result' },
  validate: (cfg) => {
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
  generate: (cfg: Config, count, rnd) => {
    const termCount = num(cfg, 'termCount', 2);
    const digits = digitsList(cfg, 'digits', termCount);
    const maxValue = num(cfg, 'maxValue', 100);
    const borrow = choice<CarryMode>(cfg, 'borrow', 'any');
    const unknown = choice<UnknownMode>(cfg, 'unknown', 'result');
    return collect<InlineProblem>(
      count,
      () => {
        const terms = makeSubtraction(rnd, digits, maxValue, borrow);
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
    );
  },
};
