import type { Config, GeneratorDef, MarkProblem } from '../types';
import { collect } from './arithmetic';
import { choice, num, range, sample } from './helpers';

type Mode = 'even' | 'odd' | 'mixed';

const modeOptions = [
  { value: 'even', label: 'parzyste' },
  { value: 'odd', label: 'nieparzyste' },
  { value: 'mixed', label: 'losowo — raz parzyste, raz nieparzyste' },
];

export const evenOdd: GeneratorDef = {
  id: 'parzyste',
  title: 'Liczby parzyste i nieparzyste',
  description: 'Uczeń otacza kółkiem liczby pasujące do polecenia.',
  sample: 'parzyste: 3 8 5 12',
  sheetDefaults: { count: 16, columns: 2 },
  fields: [
    { kind: 'select', key: 'mode', label: 'Czego szukamy', options: modeOptions },
    { kind: 'number', key: 'minValue', label: 'Liczby od', min: 0, max: 1000000, step: 10 },
    { kind: 'number', key: 'maxValue', label: 'Liczby do', min: 1, max: 1000000, step: 10 },
    { kind: 'number', key: 'perTask', label: 'Ile liczb w zadaniu', min: 3, max: 12 },
  ],
  defaults: { mode: 'even', minValue: 1, maxValue: 50, perTask: 6 },
  validate: (cfg) => {
    const lo = num(cfg, 'minValue', 1);
    const hi = num(cfg, 'maxValue', 50);
    if (lo >= hi) return 'Zakres liczb jest pusty — „do” musi być większe niż „od”.';
    if (hi - lo + 1 < num(cfg, 'perTask', 6)) {
      return 'W tym zakresie nie ma tylu różnych liczb — poszerz zakres albo zmniejsz ich liczbę w zadaniu.';
    }
    return null;
  },
  generate: (cfg: Config, count, rnd) => {
    const mode = choice<Mode>(cfg, 'mode', 'even');
    const lo = num(cfg, 'minValue', 1);
    const hi = num(cfg, 'maxValue', 50);
    const perTask = num(cfg, 'perTask', 6);
    const pool = range(lo, hi);
    return collect<MarkProblem>(
      count,
      () => {
        const even = mode === 'mixed' ? rnd.int(0, 1) === 0 : mode === 'even';
        // zadanie ma sens tylko wtedy, gdy jest co otoczyć i co zostawić
        for (let attempt = 0; attempt < 40; attempt++) {
          const numbers = sample(rnd, pool, perTask);
          if (numbers.length < perTask) return null;
          const marked = numbers.map((n) => (n % 2 === 0) === even);
          if (marked.some(Boolean) && marked.some((m) => !m)) {
            return { kind: 'mark', label: even ? 'parzyste' : 'nieparzyste', numbers, marked };
          }
        }
        return null;
      },
      (p) => `${p.label}|${p.numbers.join(',')}`,
    );
  },
};
