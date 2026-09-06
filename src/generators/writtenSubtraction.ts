import type { ColumnProblem, Config, GeneratorDef } from '../types';
import { borrowOptions, collect, makeSubtraction, termsKey } from './arithmetic';
import type { CarryMode } from './arithmetic';
import { choice, maxForDigits, num } from './helpers';

export const writtenSubtraction: GeneratorDef = {
  id: 'odejmowanie-pisemne',
  title: 'Odejmowanie pisemne',
  description: 'Odjemna nad odjemnikiem, znak −, kreska i kratki na wynik.',
  sample: 'słupek: 502 − 178',
  sheetDefaults: { count: 12, columns: 4 },
  fields: [
    { kind: 'number', key: 'digitsA', label: 'Ilość cyfr odjemnej (górna liczba)', min: 1, max: 6 },
    { kind: 'number', key: 'digitsB', label: 'Ilość cyfr odjemnika (dolna liczba)', min: 1, max: 6 },
    { kind: 'select', key: 'borrow', label: 'Pożyczki', options: borrowOptions },
    { kind: 'boolean', key: 'grid', label: 'Kratki pod cyframi wyniku', help: 'Miejsce na wpisanie wyniku.' },
    {
      kind: 'boolean',
      key: 'carryRow',
      label: 'Wiersz na pożyczki',
      help: 'Pusty pasek nad działaniem na zapisywanie pożyczek.',
    },
  ],
  defaults: { digitsA: 3, digitsB: 3, borrow: 'with', grid: true, carryRow: false },
  validate: (cfg) => {
    const a = num(cfg, 'digitsA', 3);
    const b = num(cfg, 'digitsB', 3);
    if (b > a) return 'Odjemnik nie może mieć więcej cyfr niż odjemna — wynik byłby ujemny.';
    return null;
  },
  generate: (cfg: Config, count, rnd) => {
    const digitsA = num(cfg, 'digitsA', 3);
    const digitsB = num(cfg, 'digitsB', 3);
    const borrow = choice<CarryMode>(cfg, 'borrow', 'any');
    return collect<ColumnProblem>(
      count,
      () => {
        const terms = makeSubtraction(rnd, [digitsA, digitsB], maxForDigits(digitsA), borrow);
        if (!terms) return null;
        return {
          kind: 'column',
          terms,
          op: '-',
          answer: terms[0] - terms[1],
          answerWidth: digitsA,
        };
      },
      (p) => termsKey(p.terms),
    );
  },
};
