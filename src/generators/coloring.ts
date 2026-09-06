import type { Config, GeneratorDef, Operator, PixelCell, PixelColor, PixelProblem, Rnd } from '../types';
import { PALETTE, PATTERNS, getPattern } from '../data/pixelArt';
import { bool, choice, num } from './helpers';

type Source = 'pattern' | 'image';

const sourceOptions = [
  { value: 'pattern', label: 'gotowy wzór' },
  { value: 'image', label: 'własny obrazek (JPG / PNG)' },
];

const patternOptions = PATTERNS.map((p) => ({ value: p.id, label: p.label }));

const opFields: { key: string; label: string; op: Operator }[] = [
  { key: 'opAdd', label: 'Dodawanie', op: '+' },
  { key: 'opSub', label: 'Odejmowanie', op: '-' },
  { key: 'opMul', label: 'Mnożenie', op: '×' },
];

const source = (cfg: Config) => choice<Source>(cfg, 'source', 'pattern');

const enabledOps = (cfg: Config): Operator[] => opFields.filter((f) => bool(cfg, f.key, false)).map((f) => f.op);

/** Siatka znaków: albo gotowy wzór, albo obrazek wczytany w formularzu. */
function rowsOf(cfg: Config): string[] {
  if (source(cfg) === 'pattern') return getPattern(choice(cfg, 'pattern', 'serce')).rows;
  const picture = cfg.picture as { rows?: unknown } | undefined;
  const rows = Array.isArray(picture?.rows) ? (picture.rows as unknown[]) : [];
  return rows.filter((r): r is string => typeof r === 'string' && r.length > 0);
}

/** Dzielniki do 10 — z nich budujemy mnożenie o zadanym wyniku. */
const divisors = (v: number) => {
  const out: number[] = [];
  for (let d = 1; d <= Math.min(v, 10); d++) if (v % d === 0 && v / d <= 10) out.push(d);
  return out;
};

/** Czy danym działaniem da się w ogóle zapisać ten wynik. */
const canExpress = (op: Operator, v: number) => op !== '×' || v === 0 || divisors(v).length > 0;

/**
 * Wyniki, które nadają się na legendę: takie, że każde z wybranych działań
 * potrafi je zapisać. Bez tego przy samym mnożeniu wypadłaby np. 11.
 */
const resultPool = (ops: Operator[], max: number) => {
  const out: number[] = [];
  for (let v = 1; v <= max; v++) if (ops.every((op) => canExpress(op, v))) out.push(v);
  return out;
};

/** Losowe działanie, którego wynikiem jest `value`. */
function cellFor(rnd: Rnd, value: number, ops: Operator[], max: number, color: number): PixelCell {
  const usable = ops.filter((o) => canExpress(o, value));
  const op = usable.length ? rnd.pick(usable) : '+';
  if (op === '-') {
    const a = rnd.int(value + 1, Math.min(value + 9, max + 9));
    return { terms: [a, a - value], op, value, color };
  }
  if (op === '×') {
    if (value === 0) return { terms: [0, rnd.int(2, 9)], op, value, color };
    const d = rnd.pick(divisors(value));
    return { terms: [d, value / d], op, value, color };
  }
  const a = rnd.int(0, value);
  return { terms: [a, value - a], op: '+', value, color };
}

/** Wyniki przypisane kolorom — równo rozłożone, żeby nie myliły się ze sobą. */
function values(count: number, pool: number[], rnd: Rnd): number[] {
  const stride = Math.max(1, Math.floor(pool.length / count));
  const start = rnd.int(0, Math.max(0, stride - 1));
  return Array.from({ length: count }, (_, i) => pool[Math.min(pool.length - 1, start + i * stride)]);
}

export const coloring: GeneratorDef = {
  id: 'kolorowanka',
  title: 'Kolorowanka według wyniku',
  description: 'Obrazek ukryty w kratkach: policz działanie i pokoloruj według legendy.',
  sample: 'policz i pokoloruj',
  sheetDefaults: { count: 1, columns: 1 },
  fields: [
    { kind: 'select', key: 'source', label: 'Skąd obrazek', options: sourceOptions },
    {
      kind: 'select',
      key: 'pattern',
      label: 'Wzór',
      options: patternOptions,
      showIf: (cfg) => source(cfg) === 'pattern',
    },
    {
      kind: 'number',
      key: 'gridWidth',
      label: 'Szerokość siatki (kratki)',
      min: 8,
      max: 18,
      showIf: (cfg) => source(cfg) === 'image',
      help: 'Im szersza siatka, tym mniejsze kratki i drobniejszy druk.',
    },
    {
      kind: 'number',
      key: 'maxColors',
      label: 'Ile kolorów',
      min: 2,
      max: 6,
      showIf: (cfg) => source(cfg) === 'image',
    },
    {
      kind: 'image',
      key: 'picture',
      label: 'Obrazek',
      widthKey: 'gridWidth',
      colorsKey: 'maxColors',
      maxHeight: 20,
      showIf: (cfg) => source(cfg) === 'image',
      help: 'Zdjęcie zamieniane jest na kratki i sprowadzane do wybranej liczby kolorów.',
    },
    ...opFields.map((f) => ({ kind: 'boolean' as const, key: f.key, label: f.label })),
    { kind: 'number', key: 'maxResult', label: 'Największy wynik', min: 3, max: 100 },
  ],
  defaults: {
    source: 'pattern',
    pattern: 'serce',
    gridWidth: 12,
    maxColors: 4,
    picture: null,
    opAdd: true,
    opSub: false,
    opMul: false,
    maxResult: 10,
  },
  validate: (cfg) => {
    if (!enabledOps(cfg).length) return 'Zaznacz przynajmniej jedno działanie.';
    const rows = rowsOf(cfg);
    if (!rows.length) return 'Wczytaj obrazek — na razie nie ma czego pokolorować.';
    const colors = new Set(rows.join(''));
    const pool = resultPool(enabledOps(cfg), num(cfg, 'maxResult', 10));
    if (colors.size > pool.length) {
      return `Obrazek ma ${colors.size} kolorów, a przy tych działaniach da się rozdać tylko ${pool.length} różnych wyników — zwiększ największy wynik.`;
    }
    return null;
  },
  generate: (cfg: Config, count, rnd) => {
    const rows = rowsOf(cfg);
    if (!rows.length) return [];
    const ops = enabledOps(cfg);
    const max = num(cfg, 'maxResult', 10);
    const width = Math.max(...rows.map((r) => r.length));
    const pool = resultPool(ops, max);
    if (!pool.length) return [];
    // kolory w kolejności pojawiania się — legenda ma być przewidywalna
    const chars: string[] = [];
    for (const ch of rows.join('')) if (!chars.includes(ch)) chars.push(ch);
    return Array.from({ length: count }, () => {
      const targets = values(chars.length, pool, rnd);
      const palette: PixelColor[] = chars.map((ch, i) => ({
        name: PALETTE[ch]?.name ?? 'kolor',
        css: PALETTE[ch]?.css ?? '#ffffff',
        value: targets[i],
      }));
      const cells: PixelCell[] = [];
      for (const row of rows) {
        for (let x = 0; x < width; x++) {
          const color = Math.max(0, chars.indexOf(row[x] ?? chars[0]));
          cells.push(cellFor(rnd, targets[color], ops, max, color));
        }
      }
      return { kind: 'pixel', width, cells, palette } satisfies PixelProblem;
    });
  },
};
