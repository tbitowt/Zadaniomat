import type { Config, GeneratorDef, Rnd, ZerosProblem, ZerosScaffold } from '../types';
import { collect } from './arithmetic';
import { choice, num } from './helpers';

/**
 * Gdzie stoją zera: w obu liczbach (skreślamy, wynik bez zer), tylko w dzielnej
 * (przechodzą do wyniku), w obu z nadwyżką w dzielnej albo losowo.
 */
type ZerosKind = 'both' | 'dividend' | 'mixed' | 'any';

const kindOptions = [
  { value: 'both', label: 'zera w obu liczbach — skreślamy (40 000 : 5 000 = 8)' },
  { value: 'dividend', label: 'zera tylko w dzielnej — idą do wyniku (40 000 : 5 = 8 000)' },
  { value: 'mixed', label: 'skreślamy i dopisujemy (400 000 : 500 = 800)' },
  { value: 'any', label: 'losowo' },
];

const scaffoldOptions = [
  { value: 'full', label: 'pełne — zera już skreślone, zostaje działanie z tabliczki' },
  { value: 'short', label: 'skrócone — uczeń sam skreśla i zapisuje działanie' },
  { value: 'bare', label: 'samo działanie — bez podpowiedzi' },
];

const rangeOptions = [
  { value: '1000', label: 'do 1 000' },
  { value: '10000', label: 'do 10 000' },
  { value: '100000', label: 'do 100 000' },
  { value: '1000000', label: 'do 1 000 000' },
  { value: '10000000', label: 'do 10 000 000' },
];

const RULES: Record<ZerosKind, string> = {
  both:
    'Gdy obie liczby kończą się zerami, skreśl w każdej tyle samo zer — wynik się nie zmieni. ' +
    '40 000 : 5 000 to to samo co 40 : 5, czyli 8.',
  dividend:
    'Gdy zera ma tylko dzielna, odłóż z jej końca tyle zer, żeby zostało działanie z tabliczki mnożenia. ' +
    'Podziel, a odłożone zera dopisz do wyniku: 40 000 : 5 to 40 : 5 = 8 i trzy zera, czyli 8 000.',
  mixed:
    'Najpierw skreśl w obu liczbach tyle zer, ile ma dzielnik. Zera, które zostały w dzielnej, odłóż, ' +
    'podziel resztę i dopisz je do wyniku: 400 000 : 500 to 4 000 : 5, czyli 40 : 5 = 8 i dwa zera — 800.',
  any:
    'Skreśl w obu liczbach tyle zer, ile ma dzielnik — wynik się nie zmieni. Jeśli w dzielnej zostały ' +
    'jeszcze zera, odłóż je, podziel to, co zostało, i dopisz je do wyniku. ' +
    '40 000 : 5 000 = 40 : 5 = 8, a 40 000 : 5 = 8 000.',
};

/** Dopisek pod regułą: jak czytać oznaczenia w przykładach. */
const LEGEND = ' W przykładach skreślone zera są przekreślone, a zera, które idą do wyniku — podkreślone.';

const kind = (cfg: Config) => choice<ZerosKind>(cfg, 'kind', 'any');

/** Dzielniki z tabliczki mnożenia, po wyprostowaniu zakresu wpisanego odwrotnie. */
const divisorRange = (cfg: Config): [number, number] => {
  const from = num(cfg, 'divisorFrom', 2);
  const to = num(cfg, 'divisorTo', 9);
  return [Math.max(2, Math.min(from, to)), Math.min(9, Math.max(from, to))];
};

const maxDividend = (cfg: Config) => Number(choice(cfg, 'range', '100000')) || 100000;

/** Ile zer musi mieć dzielna ponad działanie z tabliczki: po jednym na skreślenie i na wynik. */
const zerosNeeded = (k: ZerosKind) => (k === 'mixed' ? 2 : 1);

/**
 * Jedno zadanie: działanie z tabliczki `A : B = q`, a do niego zera — `crossed`
 * w obu liczbach i `moved` tylko w dzielnej. Wynik mnożymy tylko przez `moved`.
 */
function makeZeros(rnd: Rnd, cfg: Config, scaffold: ZerosScaffold): ZerosProblem | null {
  const [lo, hi] = divisorRange(cfg);
  const max = maxDividend(cfg);
  const wanted = kind(cfg);
  for (let attempt = 0; attempt < 200; attempt++) {
    const b = rnd.int(lo, hi);
    const q = rnd.int(2, 9);
    const a = b * q;
    // najwięcej zer, jakie da się dopisać do dzielnej bez wyjścia poza zakres
    let room = 0;
    while (a * 10 ** (room + 1) <= max) room++;
    const k = wanted === 'any' ? rnd.pick<ZerosKind>(['both', 'dividend', 'mixed']) : wanted;
    if (room < zerosNeeded(k)) continue;
    const total = rnd.int(zerosNeeded(k), room);
    const crossed = k === 'dividend' ? 0 : k === 'both' ? total : rnd.int(1, total - 1);
    const moved = total - crossed;
    return {
      kind: 'zeros',
      dividend: a * 10 ** total,
      divisor: b * 10 ** crossed,
      crossed,
      moved,
      fact: [a, b, q],
      result: q * 10 ** moved,
      scaffold,
    };
  }
  return null;
}

export const zerosDivision: GeneratorDef = {
  id: 'dzielenie-zera',
  title: 'Sprytne dzielenie z zerami',
  description: 'Skreślanie zer w dzielnej i dzielniku, zera dopisywane do wyniku — z podpowiedziami krok po kroku.',
  sample: '40 000 : 5 000 = 40 : 5 = ___',
  subject: 'matematyka',
  grades: [3],
  category: 'rachunek',
  sheetDefaults: { count: 12, columns: 2, intro: true },
  fields: [
    { kind: 'select', key: 'kind', label: 'Gdzie są zera', options: kindOptions },
    {
      kind: 'select',
      key: 'scaffold',
      label: 'Ile podpowiedzi',
      options: scaffoldOptions,
      help: 'Ta sama karta od gotowych skreśleń po samo działanie — dobre na kolejne bloki arkusza.',
    },
    { kind: 'select', key: 'range', label: 'Największa liczba dzielona', options: rangeOptions },
    { kind: 'number', key: 'divisorFrom', label: 'Dzielnik bez zer od', min: 2, max: 9 },
    {
      kind: 'number',
      key: 'divisorTo',
      label: 'Dzielnik bez zer do',
      min: 2,
      max: 9,
      help: 'Po odłożeniu zer zostaje zawsze działanie z tabliczki mnożenia.',
    },
  ],
  defaults: {
    kind: 'any',
    scaffold: 'full',
    range: '100000',
    divisorFrom: 2,
    divisorTo: 9,
  },
  validate: (cfg) => {
    const [lo, hi] = divisorRange(cfg);
    if (lo > hi) return 'Dzielnik bez zer musi leżeć między 2 a 9.';
    const k = kind(cfg);
    const smallest = lo * 2 * 10 ** (k === 'any' ? 1 : zerosNeeded(k));
    if (smallest > maxDividend(cfg)) {
      return `Najmniejsza możliwa dzielna to ${smallest} — wybierz większy zakres albo mniejszy dzielnik.`;
    }
    return null;
  },
  // twarda spacja w „40 000”, żeby liczba nie złamała się na dwie linie
  explain: (cfg) => (RULES[kind(cfg)] + LEGEND).replace(/(\d) (\d{3})/g, '$1 $2'),
  generate: (cfg: Config, count, rnd, seen) => {
    const scaffold = choice<ZerosScaffold>(cfg, 'scaffold', 'full');
    return collect<ZerosProblem>(
      count,
      () => makeZeros(rnd, cfg, scaffold),
      (p) => `${p.dividend}:${p.divisor}`,
      seen,
    );
  },
};
