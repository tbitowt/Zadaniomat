import type { Config, GeneratorDef, SequenceProblem } from '../types';
import { collect } from './arithmetic';
import { choice, num, range, sample } from './helpers';

type Direction = 'up' | 'down' | 'mixed';
type Where = 'end' | 'any';

const directionOptions = [
  { value: 'up', label: 'rosnący' },
  { value: 'down', label: 'malejący' },
  { value: 'mixed', label: 'losowo' },
];

const whereOptions = [
  { value: 'end', label: 'na końcu ciągu' },
  { value: 'any', label: 'w dowolnych miejscach' },
];

const stepRange = (cfg: Config): [number, number] => {
  const from = num(cfg, 'stepFrom', 1);
  const to = num(cfg, 'stepTo', 5);
  return [Math.min(from, to), Math.max(from, to)];
};

/** Ile wyrazów wolno zakryć — dwa muszą zostać, żeby dało się odczytać krok. */
const blankCount = (cfg: Config) =>
  Math.max(1, Math.min(num(cfg, 'blanks', 2), num(cfg, 'length', 6) - 2));

export const sequence: GeneratorDef = {
  id: 'ciagi',
  title: 'Ciągi liczbowe',
  description: 'Uczeń odczytuje krok i dopisuje brakujące liczby.',
  sample: '2, 4, 6, ___, ___',
  sheetDefaults: { count: 16, columns: 2 },
  fields: [
    { kind: 'number', key: 'length', label: 'Ile liczb w ciągu', min: 4, max: 12 },
    { kind: 'select', key: 'direction', label: 'Kierunek', options: directionOptions },
    { kind: 'number', key: 'stepFrom', label: 'Krok od', min: 1, max: 1000 },
    { kind: 'number', key: 'stepTo', label: 'Krok do', min: 1, max: 1000, help: 'Ten sam krok od i do daje ciągi o stałym skoku.' },
    { kind: 'number', key: 'maxValue', label: 'Największa liczba', min: 4, max: 1000000, step: 10 },
    { kind: 'number', key: 'blanks', label: 'Ile liczb zakryć', min: 1, max: 8 },
    { kind: 'select', key: 'where', label: 'Gdzie zakryte liczby', options: whereOptions },
  ],
  defaults: { length: 6, direction: 'up', stepFrom: 1, stepTo: 5, maxValue: 100, blanks: 2, where: 'end' },
  validate: (cfg) => {
    const [lo] = stepRange(cfg);
    const span = (num(cfg, 'length', 6) - 1) * lo;
    if (span > num(cfg, 'maxValue', 100)) {
      return `Najkrótszy taki ciąg rozciąga się na ${span} — zwiększ największą liczbę, skróć ciąg albo zmniejsz krok.`;
    }
    return null;
  },
  generate: (cfg: Config, count, rnd) => {
    const length = num(cfg, 'length', 6);
    const direction = choice<Direction>(cfg, 'direction', 'up');
    const [stepLo, stepHi] = stepRange(cfg);
    const maxValue = num(cfg, 'maxValue', 100);
    const blanks = blankCount(cfg);
    const where = choice<Where>(cfg, 'where', 'end');
    return collect<SequenceProblem>(
      count,
      () => {
        const size = rnd.int(stepLo, stepHi);
        const span = (length - 1) * size;
        if (span > maxValue) return null;
        const up = direction === 'mixed' ? rnd.int(0, 1) === 0 : direction === 'up';
        const step = up ? size : -size;
        // ciąg musi się zmieścić w [0, maxValue] w obie strony
        const first = up ? rnd.int(0, maxValue - span) : rnd.int(span, maxValue);
        const values = Array.from({ length }, (_, i) => first + i * step);
        const hidden = new Array<boolean>(length).fill(false);
        // pierwszy wyraz zostaje widoczny — od niego uczeń zaczyna liczyć
        const spots = where === 'end' ? range(length - blanks, length - 1) : sample(rnd, range(1, length - 1), blanks);
        for (const i of spots) hidden[i] = true;
        return { kind: 'sequence', values, hidden, step };
      },
      (p) => `${p.values.join(',')}|${p.hidden.map((h) => (h ? 1 : 0)).join('')}`,
    );
  },
};
