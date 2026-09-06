import type { Config, GeneratorDef, InlineProblem } from '../types';
import { carryOptions, collect, makeAddition, pickBlank, termsKey, unknownOptions } from './arithmetic';
import type { CarryMode, UnknownMode } from './arithmetic';
import { choice, digitsList, minForDigits, num } from './helpers';

export const mentalAddition: GeneratorDef = {
  id: 'dodawanie-pamiec',
  title: 'Dodawanie w pamięci',
  description: 'Działania w jednej linii z miejscem na wynik.',
  sample: '24 + 13 = ____',
  sheetDefaults: { count: 30, columns: 3 },
  fields: [
    { kind: 'number', key: 'termCount', label: 'Ile liczb do dodania', min: 2, max: 5 },
    {
      kind: 'digitsList',
      key: 'digits',
      label: 'Ilość cyfr w poszczególnych liczbach',
      countKey: 'termCount',
      min: 1,
      max: 4,
    },
    { kind: 'number', key: 'minResult', label: 'Minimalny wynik', min: 0, max: 1000000, step: 10 },
    { kind: 'number', key: 'maxResult', label: 'Maksymalny wynik', min: 2, max: 1000000, step: 10 },
    { kind: 'select', key: 'carry', label: 'Przekraczanie progu', options: carryOptions },
    {
      kind: 'select',
      key: 'unknown',
      label: 'Szukana liczba',
      options: unknownOptions,
      help: 'Zamiast wyniku można zakryć jeden ze składników: 24 + ___ = 37.',
    },
  ],
  defaults: { termCount: 2, digits: [2, 1], minResult: 0, maxResult: 100, carry: 'any', unknown: 'result' },
  validate: (cfg) => {
    const digits = digitsList(cfg, 'digits', num(cfg, 'termCount', 2));
    const minSum = digits.reduce((a, d) => a + minForDigits(d), 0);
    const maxResult = num(cfg, 'maxResult', 100);
    if (minSum > maxResult) {
      return `Przy tej liczbie cyfr najmniejsza możliwa suma to ${minSum} — zwiększ maksymalny wynik.`;
    }
    if (num(cfg, 'minResult', 0) > maxResult) {
      return 'Minimalny wynik nie może być większy od maksymalnego.';
    }
    return null;
  },
  generate: (cfg: Config, count, rnd) => {
    const termCount = num(cfg, 'termCount', 2);
    const digits = digitsList(cfg, 'digits', termCount);
    const maxResult = num(cfg, 'maxResult', 100);
    const minResult = num(cfg, 'minResult', 0);
    const carry = choice<CarryMode>(cfg, 'carry', 'any');
    const unknown = choice<UnknownMode>(cfg, 'unknown', 'result');
    return collect<InlineProblem>(
      count,
      () => {
        const terms = makeAddition(rnd, digits, maxResult, carry, minResult);
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
    );
  },
};
