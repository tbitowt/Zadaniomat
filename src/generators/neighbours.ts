import type { Config, GeneratorDef, NeighborProblem } from '../types';
import { collect } from './arithmetic';
import { choice, num } from './helpers';

type Which = 'both' | 'before' | 'after' | 'mixed';

const whichOptions = [
  { value: 'both', label: 'poprzednik i następnik' },
  { value: 'before', label: 'tylko poprzednik' },
  { value: 'after', label: 'tylko następnik' },
  { value: 'mixed', label: 'losowo' },
];

/** Zakres, z którego wolno losować liczbę środkową — obaj sąsiedzi muszą się zmieścić. */
const middleRange = (cfg: Config): [number, number] => {
  const step = num(cfg, 'step', 1);
  const lo = Math.max(num(cfg, 'minValue', 1), step);
  return [lo, num(cfg, 'maxValue', 100) - step];
};

export const neighbours: GeneratorDef = {
  id: 'sasiedzi',
  title: 'Poprzednik i następnik',
  description: 'Liczba o jeden (albo o dziesięć) mniejsza i większa.',
  sample: '___ ← 47 → ___',
  sheetDefaults: { count: 24, columns: 3 },
  fields: [
    { kind: 'number', key: 'minValue', label: 'Liczby od', min: 0, max: 1000000, step: 10 },
    { kind: 'number', key: 'maxValue', label: 'Liczby do', min: 1, max: 1000000, step: 10 },
    {
      kind: 'number',
      key: 'step',
      label: 'O ile mniej i więcej',
      min: 1,
      max: 1000,
      help: '1 to poprzednik i następnik, 10 to „o 10 mniej i o 10 więcej”.',
    },
    { kind: 'select', key: 'which', label: 'Co uzupełnia uczeń', options: whichOptions },
  ],
  defaults: { minValue: 1, maxValue: 100, step: 1, which: 'both' },
  validate: (cfg) => {
    const [lo, hi] = middleRange(cfg);
    if (lo > hi) {
      return `Przy kroku ${num(cfg, 'step', 1)} żadna liczba z zakresu nie ma obu sąsiadów — poszerz zakres.`;
    }
    return null;
  },
  generate: (cfg: Config, count, rnd) => {
    const step = num(cfg, 'step', 1);
    const which = choice<Which>(cfg, 'which', 'both');
    const [lo, hi] = middleRange(cfg);
    if (lo > hi) return [];
    return collect<NeighborProblem>(
      count,
      () => {
        const value = rnd.int(lo, hi);
        const mode = which === 'mixed' ? rnd.pick(['both', 'before', 'after'] as const) : which;
        return {
          kind: 'neighbor',
          value,
          step,
          before: mode === 'after' ? null : value - step,
          after: mode === 'before' ? null : value + step,
        };
      },
      (p) => `${p.value}|${p.before === null ? '' : 'b'}${p.after === null ? '' : 'a'}`,
    );
  },
};
