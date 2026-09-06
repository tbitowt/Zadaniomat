import type { Config, GeneratorDef, NumberLineProblem } from '../types';
import { collect } from './arithmetic';
import { bool, num, range, sample } from './helpers';

/** Rozpiętość osi w jednostkach — od pierwszej do ostatniej podziałki. */
const span = (cfg: Config) => (num(cfg, 'ticks', 11) - 1) * num(cfg, 'step', 1);

/** Ile opisów wolno zakryć — pierwszy zostaje widoczny, bo od niego liczymy. */
const blankCount = (cfg: Config) =>
  Math.max(1, Math.min(num(cfg, 'blanks', 3), num(cfg, 'ticks', 11) - 2));

export const numberLine: GeneratorDef = {
  id: 'os-liczbowa',
  title: 'Oś liczbowa',
  description: 'Uczeń wpisuje liczby brakujące pod podziałkami osi.',
  sample: '0 — 1 — ⬜ — 3',
  sheetDefaults: { count: 8, columns: 1 },
  fields: [
    { kind: 'number', key: 'ticks', label: 'Ile podziałek', min: 4, max: 21 },
    { kind: 'number', key: 'step', label: 'Co ile', min: 1, max: 1000 },
    {
      kind: 'number',
      key: 'maxValue',
      label: 'Największa liczba na osi',
      min: 4,
      max: 1000000,
      step: 10,
    },
    { kind: 'number', key: 'blanks', label: 'Ile liczb zakryć', min: 1, max: 12 },
    {
      kind: 'boolean',
      key: 'fromZero',
      label: 'Oś zawsze zaczyna się od zera',
      help: 'Wyłączone daje osie zaczynające się w różnych miejscach.',
    },
  ],
  defaults: { ticks: 11, step: 1, maxValue: 20, blanks: 3, fromZero: false },
  validate: (cfg) => {
    const width = span(cfg);
    if (width > num(cfg, 'maxValue', 20)) {
      return `Taka oś rozciąga się na ${width} — zwiększ największą liczbę, zmniejsz krok albo liczbę podziałek.`;
    }
    return null;
  },
  generate: (cfg: Config, count, rnd) => {
    const ticks = num(cfg, 'ticks', 11);
    const step = num(cfg, 'step', 1);
    const maxValue = num(cfg, 'maxValue', 20);
    const blanks = blankCount(cfg);
    const fromZero = bool(cfg, 'fromZero', false);
    const width = span(cfg);
    if (width > maxValue) return [];
    return collect<NumberLineProblem>(
      count,
      () => {
        // początek osi jest wielokrotnością kroku, żeby opisy były okrągłe
        const start = fromZero ? 0 : rnd.int(0, Math.floor((maxValue - width) / step)) * step;
        const values = Array.from({ length: ticks }, (_, i) => start + i * step);
        const hidden = new Array<boolean>(ticks).fill(false);
        for (const i of sample(rnd, range(1, ticks - 1), blanks)) hidden[i] = true;
        return { kind: 'numberline', values, hidden };
      },
      (p) => `${p.values[0]}|${p.hidden.map((h) => (h ? 1 : 0)).join('')}`,
    );
  },
};
