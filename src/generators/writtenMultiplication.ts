import type { ColumnProblem, Config, GeneratorDef } from '../types';
import { carryOptions, collect, makeMultiplicationPair, termsKey } from './arithmetic';
import type { CarryMode } from './arithmetic';
import { bool, choice, num, partialProducts } from './helpers';

export const writtenMultiplication: GeneratorDef = {
  id: 'mnozenie-pisemne',
  title: 'Mnożenie pisemne',
  description: 'Mnożna nad mnożnikiem, znak ×, iloczyny częściowe i kratki na wynik.',
  sample: 'słupek: 246 × 37',
  sheetDefaults: { count: 9, columns: 3 },
  fields: [
    { kind: 'number', key: 'digitsA', label: 'Ilość cyfr mnożnej (górna liczba)', min: 1, max: 6 },
    { kind: 'number', key: 'digitsB', label: 'Ilość cyfr mnożnika (dolna liczba)', min: 1, max: 3 },
    { kind: 'select', key: 'carry', label: 'Przeniesienia', options: carryOptions },
    {
      kind: 'boolean',
      key: 'partials',
      label: 'Wiersze na iloczyny częściowe',
      help: 'Po jednym wierszu na każdą cyfrę mnożnika.',
      showIf: (cfg) => num(cfg, 'digitsB', 2) > 1,
    },
    { kind: 'boolean', key: 'grid', label: 'Kratki pod cyframi wyniku', help: 'Miejsce na wpisanie wyniku.' },
    {
      kind: 'boolean',
      key: 'carryRow',
      label: 'Wiersz na przeniesienia',
      help: 'Pusty pasek nad działaniem na zapisywanie przeniesień.',
    },
  ],
  defaults: { digitsA: 3, digitsB: 2, carry: 'with', partials: true, grid: true, carryRow: false },
  validate: (cfg) => {
    const a = num(cfg, 'digitsA', 3);
    const b = num(cfg, 'digitsB', 2);
    if (choice<CarryMode>(cfg, 'carry', 'any') === 'without' && a + b > 7) {
      return 'Bez przeniesień tak długich liczb praktycznie nie da się ułożyć — zmniejsz liczbę cyfr.';
    }
    return null;
  },
  generate: (cfg: Config, count, rnd) => {
    const digitsA = num(cfg, 'digitsA', 3);
    const digitsB = num(cfg, 'digitsB', 2);
    const carry = choice<CarryMode>(cfg, 'carry', 'any');
    const showPartials = bool(cfg, 'partials', true) && digitsB > 1;
    // szerokość wyniku liczona z konfiguracji, nie z konkretnego iloczynu —
    // inaczej liczba kratek zdradzałaby odpowiedź
    const answerWidth = digitsA + digitsB;
    return collect<ColumnProblem>(
      count,
      () => {
        const pair = makeMultiplicationPair(rnd, digitsA, digitsB, carry);
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
    );
  },
};
