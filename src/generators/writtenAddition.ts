import type { ColumnProblem, Config, GeneratorDef } from '../types';
import { carryOptions, collect, makeAddition, termsKey } from './arithmetic';
import type { CarryMode } from './arithmetic';
import { choice, digitCount, digitsList, maxForDigits, num } from './helpers';

export const writtenAddition: GeneratorDef = {
  id: 'dodawanie-pisemne',
  title: 'Dodawanie pisemne',
  description: 'Liczby zapisane w słupku, znak +, kreska i kratki na wynik.',
  sample: 'słupek: 348 + 176',
  sheetDefaults: { count: 12, columns: 4 },
  fields: [
    { kind: 'number', key: 'termCount', label: 'Ile liczb do dodania', min: 2, max: 4 },
    {
      kind: 'digitsList',
      key: 'digits',
      label: 'Ilość cyfr w poszczególnych liczbach',
      countKey: 'termCount',
      min: 1,
      max: 6,
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
  defaults: { termCount: 2, digits: [3, 3], carry: 'with', grid: true, carryRow: false },
  generate: (cfg: Config, count, rnd) => {
    const termCount = num(cfg, 'termCount', 2);
    const digits = digitsList(cfg, 'digits', termCount, 3);
    const carry = choice<CarryMode>(cfg, 'carry', 'any');
    // szerokość wyniku liczona z konfiguracji, nie z konkretnego wyniku —
    // inaczej liczba kratek zdradzałaby odpowiedź
    const answerWidth = digitCount(digits.reduce((a, d) => a + maxForDigits(d), 0));
    return collect<ColumnProblem>(
      count,
      () => {
        const terms = makeAddition(rnd, digits, Number.MAX_SAFE_INTEGER, carry);
        return {
          kind: 'column',
          terms,
          op: '+',
          answer: terms.reduce((a, b) => a + b, 0),
          answerWidth,
        };
      },
      (p) => termsKey(p.terms),
    );
  },
};
