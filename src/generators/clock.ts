import type { ClockProblem, Config, GeneratorDef } from '../types';
import { collect } from './arithmetic';
import { bool, choice, range } from './helpers';

type Granularity = 'hour' | 'half' | 'quarter' | 'five' | 'minute';
type Task = 'read' | 'draw' | 'mixed';
type Format = '12' | '24';

const granularityOptions = [
  { value: 'hour', label: 'pełne godziny' },
  { value: 'half', label: 'co pół godziny' },
  { value: 'quarter', label: 'co kwadrans' },
  { value: 'five', label: 'co 5 minut' },
  { value: 'minute', label: 'co minutę' },
];

const taskOptions = [
  { value: 'read', label: 'odczytaj godzinę z tarczy' },
  { value: 'draw', label: 'narysuj wskazówki' },
  { value: 'mixed', label: 'losowo' },
];

const formatOptions = [
  { value: '12', label: '12-godzinny (7:30)' },
  { value: '24', label: '24-godzinny (19:30)' },
];

/** Minuty dopuszczone przy danej dokładności. */
const minutesFor = (g: Granularity): number[] => {
  if (g === 'hour') return [0];
  if (g === 'half') return [0, 30];
  if (g === 'quarter') return [0, 15, 30, 45];
  if (g === 'five') return range(0, 11).map((i) => i * 5);
  return range(0, 59);
};

const pad = (n: number) => String(n).padStart(2, '0');

export const clock: GeneratorDef = {
  id: 'zegar',
  title: 'Zegar — godziny',
  description: 'Odczytywanie godziny z tarczy albo rysowanie wskazówek.',
  sample: 'tarcza → ____',
  sheetDefaults: { count: 16, columns: 4 },
  fields: [
    { kind: 'select', key: 'granularity', label: 'Dokładność', options: granularityOptions },
    { kind: 'select', key: 'task', label: 'Co robi uczeń', options: taskOptions },
    {
      kind: 'select',
      key: 'format',
      label: 'Zapis godziny',
      options: formatOptions,
      help: 'W zapisie 24-godzinnym uczeń musi przeliczyć popołudniowe godziny na tarczę.',
    },
    {
      kind: 'boolean',
      key: 'ticks',
      label: 'Podziałka minutowa',
      help: 'Kreski co minutę ułatwiają odczyt dokładniejszych godzin.',
    },
  ],
  defaults: { granularity: 'half', task: 'read', format: '12', ticks: true },
  generate: (cfg: Config, count, rnd) => {
    const minutes = minutesFor(choice<Granularity>(cfg, 'granularity', 'half'));
    const task = choice<Task>(cfg, 'task', 'read');
    const hours24 = choice<Format>(cfg, 'format', '12') === '24';
    const ticks = bool(cfg, 'ticks', true);
    return collect<ClockProblem>(
      count,
      () => {
        const hour = hours24 ? rnd.int(0, 23) : rnd.int(1, 12);
        const minute = rnd.pick(minutes);
        const mode = task === 'mixed' ? (rnd.int(0, 1) === 0 ? 'read' : 'draw') : task;
        return {
          kind: 'clock',
          hour,
          minute,
          mode,
          label: `${hour}:${pad(minute)}`,
          ticks,
        };
      },
      (p) => `${p.hour}:${p.minute}:${p.mode}`,
    );
  },
};
