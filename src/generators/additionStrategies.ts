import type { Config, GeneratorDef, Rnd, StepToken, StepsProblem } from '../types';
import { collect } from './arithmetic';
import { bool, choice, num } from './helpers';

type Strategy = 'toTen' | 'doubles' | 'pairsOfTen' | 'splitTens' | 'roundAdjust' | 'moveUnits';
type Scaffold = 'full' | 'short' | 'bare';
type DoubleKind = 'same' | 'near' | 'mixed';

const strategyOptions = [
  { value: 'toTen', label: 'dopełnienie do dziesiątki (8 + 5)' },
  { value: 'doubles', label: 'podwojenia i prawie podwojenia (4 + 5)' },
  { value: 'pairsOfTen', label: 'pary do 10 przy trzech liczbach (7 + 5 + 3)' },
  { value: 'splitTens', label: 'rozbicie na dziesiątki i jedności (64 + 52)' },
  { value: 'roundAdjust', label: 'zaokrąglenie z poprawką (56 + 29)' },
  { value: 'moveUnits', label: 'przerzucanie jedności (64 + 52 = 66 + 50)' },
];

const scaffoldOptions = [
  { value: 'full', label: 'pełne rusztowanie — wszystkie kroki' },
  { value: 'short', label: 'skrócone — jeden krok pośredni' },
  { value: 'bare', label: 'samo działanie — bez kroków' },
];

const doubleOptions = [
  { value: 'same', label: 'same podwojenia (4 + 4)' },
  { value: 'near', label: 'prawie podwojenia (4 + 5)' },
  { value: 'mixed', label: 'losowo' },
];

/** Reguły drukowane w ramce nad blokiem — jedna na strategię. */
const RULES: Record<Strategy, string> = {
  toTen:
    'Najpierw dopełnij pierwszą liczbę do pełnej dziesiątki, a potem dodaj to, co zostało. ' +
    '8 + 5 to 8 + 2, czyli 10, i jeszcze 3 — razem 13.',
  doubles:
    'Podwojenia warto znać na pamięć. Gdy liczby różnią się o 1, policz podwojenie i dodaj jeden: ' +
    '4 + 5 to 4 + 4 i jeszcze 1, czyli 9.',
  pairsOfTen:
    'Najpierw połącz dwie liczby, które razem dają 10, a dopiero potem dodaj trzecią: ' +
    '7 + 5 + 3 to 10 + 5, czyli 15.',
  splitTens:
    'Rozłóż obie liczby na dziesiątki i jedności. Osobno dodaj dziesiątki, osobno jedności: ' +
    '64 + 52 to 60 + 50 oraz 4 + 2, czyli 110 + 6 = 116.',
  roundAdjust:
    'Zaokrąglij drugą liczbę w górę do pełnej dziesiątki, dodaj, a na końcu oddaj to, co pożyczyłeś: ' +
    '56 + 29 to 56 + 30 bez 1, czyli 85.',
  moveUnits:
    'Przerzuć jedności z jednej liczby do drugiej tak, żeby jedna z nich stała się okrągła: ' +
    '64 + 52 to 66 + 50, czyli 116.',
};

const numToken = (value: number, hidden = false): StepToken => ({ kind: 'num', value, hidden });
const op = (text: string): StepToken => ({ kind: 'op', text });
const paren = (text: string): StepToken => ({ kind: 'paren', text });

const strategy = (cfg: Config) => choice<Strategy>(cfg, 'strategy', 'toTen');
const shows = (s: Strategy) => (cfg: Config) => strategy(cfg) === s;

const tens = (n: number) => Math.floor(n / 10) * 10;
const units = (n: number) => n % 10;

/**
 * Pełny łańcuch kroków dla jednej strategii — od zapisanego działania po wynik.
 * Ostatni krok to zawsze sam wynik; zakryte liczby to te, które liczy uczeń.
 */
type Chain = StepToken[][] | null;

/** 8 + 5 = 8 + 2 + 3 = 10 + 3 = 13 */
function toTenChain(rnd: Rnd, max: number): Chain {
  for (let attempt = 0; attempt < 200; attempt++) {
    const a = rnd.int(2, Math.max(2, max - 2));
    if (units(a) === 0) continue;
    const need = 10 - units(a);
    // przy jednościach równych 1 nie zostaje nic do dodania po dopełnieniu
    if (need > 8) continue;
    const b = rnd.int(need + 1, 9);
    if (a + b > max) continue;
    const rest = b - need;
    return [
      [numToken(a), op('+'), numToken(b)],
      [numToken(a), op('+'), numToken(need, true), op('+'), numToken(rest, true)],
      [numToken(a + need), op('+'), numToken(rest, true)],
      [numToken(a + b, true)],
    ];
  }
  return null;
}

/** 4 + 4 = 8   albo   4 + 5 = 4 + 4 + 1 = 8 + 1 = 9 */
function doublesChain(rnd: Rnd, max: number, kind: DoubleKind): Chain {
  const near = kind === 'mixed' ? rnd.int(0, 1) === 0 : kind === 'near';
  const a = rnd.int(2, Math.max(2, near ? max - 1 : max));
  if (!near) {
    return [
      [numToken(a), op('+'), numToken(a)],
      [numToken(a + a, true)],
    ];
  }
  const b = a + 1;
  // raz mniejsza liczba z przodu, raz z tyłu — żeby zapis się nie opatrzył
  const first = rnd.int(0, 1) === 0 ? [numToken(a), op('+'), numToken(b)] : [numToken(b), op('+'), numToken(a)];
  return [
    first,
    [numToken(a), op('+'), numToken(a), op('+'), numToken(1, true)],
    [numToken(a + a, true), op('+'), numToken(1)],
    [numToken(a + b, true)],
  ];
}

/** 7 + 5 + 3 = 10 + 5 = 15 — para do dziesiątki stoi na skrajnych miejscach */
function pairsChain(rnd: Rnd, max: number): Chain {
  const x = rnd.int(1, 9);
  const y = 10 - x;
  const z = rnd.int(1, Math.max(1, Math.min(9, max - 10)));
  return [
    [numToken(x), op('+'), numToken(z), op('+'), numToken(y)],
    [numToken(10, true), op('+'), numToken(z)],
    [numToken(10 + z, true)],
  ];
}

/** 64 + 52 = (60 + 50) + (4 + 2) = 110 + 6 = 116 */
function splitChain(rnd: Rnd, max: number, noCarry: boolean): Chain {
  for (let attempt = 0; attempt < 200; attempt++) {
    const a = rnd.int(11, 99);
    const b = rnd.int(11, 99);
    if (a + b > max) continue;
    if (noCarry && units(a) + units(b) > 9) continue;
    if (units(a) === 0 || units(b) === 0) continue;
    const t = tens(a) + tens(b);
    const u = units(a) + units(b);
    return [
      [numToken(a), op('+'), numToken(b)],
      [
        paren('('),
        numToken(tens(a)),
        op('+'),
        numToken(tens(b)),
        paren(')'),
        op('+'),
        paren('('),
        numToken(units(a)),
        op('+'),
        numToken(units(b)),
        paren(')'),
      ],
      [numToken(t, true), op('+'), numToken(u, true)],
      [numToken(a + b, true)],
    ];
  }
  return null;
}

/** 56 + 29 = 56 + 30 − 1 = 86 − 1 = 85 */
function roundChain(rnd: Rnd, max: number): Chain {
  for (let attempt = 0; attempt < 200; attempt++) {
    const diff = rnd.int(1, 2);
    const b = rnd.int(1, 9) * 10 - diff;
    const a = rnd.int(11, Math.max(11, max - b));
    if (a + b > max || units(a) === 0) continue;
    const round = b + diff;
    return [
      [numToken(a), op('+'), numToken(b)],
      [numToken(a), op('+'), numToken(round), op('−'), numToken(diff, true)],
      [numToken(a + round, true), op('−'), numToken(diff)],
      [numToken(a + b, true)],
    ];
  }
  return null;
}

/** 64 + 52 = 66 + 50 = 116 */
function moveChain(rnd: Rnd, max: number): Chain {
  for (let attempt = 0; attempt < 200; attempt++) {
    const move = rnd.int(1, 4);
    const b = rnd.int(2, 9) * 10 + move;
    const a = rnd.int(11, Math.max(11, max - b));
    if (a + b > max || units(a) === 0 || units(a) + move > 9) continue;
    return [
      [numToken(a), op('+'), numToken(b)],
      [numToken(a + move, true), op('+'), numToken(b - move)],
      [numToken(a + b, true)],
    ];
  }
  return null;
}

/** Ile z łańcucha zostaje na kartce: wszystko, ostatni krok pośredni albo nic. */
function scaffolded(steps: StepToken[][], level: Scaffold): StepToken[][] {
  const first = steps[0];
  const last = steps[steps.length - 1];
  if (level === 'bare') return [first, last];
  if (level === 'short' && steps.length > 3) return [first, steps[steps.length - 2], last];
  return steps;
}

const chainKey = (steps: StepToken[][]) =>
  steps[0]
    .filter((t) => t.kind === 'num')
    .map((t) => (t.kind === 'num' ? t.value : ''))
    .join('|');

export const additionStrategies: GeneratorDef = {
  id: 'dodawanie-strategie',
  title: 'Dodawanie ze strategią',
  description: 'Rachunek pamięciowy rozpisany na kroki — z wyjaśnieniem i przykładami.',
  sample: '8 + 5 = 8 + ___ + ___ = 10 + ___',
  sheetDefaults: { count: 10, columns: 1 },
  fields: [
    { kind: 'select', key: 'strategy', label: 'Strategia', options: strategyOptions },
    {
      kind: 'select',
      key: 'scaffold',
      label: 'Ile podpowiedzi',
      options: scaffoldOptions,
      help: 'Ta sama strategia od pełnego rozpisania po samo działanie — dobre na kolejne bloki arkusza.',
    },
    {
      kind: 'number',
      key: 'maxToTen',
      label: 'Największy wynik',
      min: 11,
      max: 1000,
      step: 10,
      showIf: shows('toTen'),
    },
    {
      kind: 'select',
      key: 'doubleKind',
      label: 'Co ćwiczymy',
      options: doubleOptions,
      showIf: shows('doubles'),
    },
    {
      kind: 'number',
      key: 'maxDouble',
      label: 'Największa podwajana liczba',
      min: 2,
      max: 100,
      showIf: shows('doubles'),
    },
    {
      kind: 'number',
      key: 'maxPairs',
      label: 'Największy wynik',
      min: 11,
      max: 100,
      showIf: shows('pairsOfTen'),
    },
    {
      kind: 'number',
      key: 'maxSplit',
      label: 'Największy wynik',
      min: 22,
      max: 1000,
      step: 10,
      showIf: shows('splitTens'),
    },
    {
      kind: 'boolean',
      key: 'splitNoCarry',
      label: 'Jedności bez przekraczania progu',
      help: 'Wyłączone dopuszcza działania w rodzaju 68 + 25, gdzie same jedności dają ponad 10.',
      showIf: shows('splitTens'),
    },
    {
      kind: 'number',
      key: 'maxRound',
      label: 'Największy wynik',
      min: 20,
      max: 1000,
      step: 10,
      showIf: shows('roundAdjust'),
    },
    {
      kind: 'number',
      key: 'maxMove',
      label: 'Największy wynik',
      min: 20,
      max: 1000,
      step: 10,
      showIf: shows('moveUnits'),
    },
  ],
  defaults: {
    strategy: 'toTen',
    scaffold: 'full',
    maxToTen: 20,
    doubleKind: 'mixed',
    maxDouble: 10,
    maxPairs: 20,
    maxSplit: 200,
    splitNoCarry: true,
    maxRound: 100,
    maxMove: 100,
  },
  validate: (cfg) => {
    const s = strategy(cfg);
    if (s === 'toTen' && num(cfg, 'maxToTen', 20) < 11) {
      return 'Przy dopełnianiu do dziesiątki wynik musi przekraczać 10 — zwiększ największy wynik.';
    }
    if (s === 'pairsOfTen' && num(cfg, 'maxPairs', 20) < 11) {
      return 'Trzy liczby z parą do 10 dają wynik większy od 10 — zwiększ największy wynik.';
    }
    if (s === 'splitTens' && num(cfg, 'maxSplit', 200) < 22) {
      return 'Dwie liczby dwucyfrowe dają co najmniej 22 — zwiększ największy wynik.';
    }
    if (s === 'roundAdjust' && num(cfg, 'maxRound', 100) < 20) {
      return 'Zaokrąglanie ma sens dopiero przy liczbach dwucyfrowych — zwiększ największy wynik.';
    }
    if (s === 'moveUnits' && num(cfg, 'maxMove', 100) < 20) {
      return 'Przerzucanie jedności ma sens dopiero przy liczbach dwucyfrowych — zwiększ największy wynik.';
    }
    return null;
  },
  explain: (cfg) => RULES[strategy(cfg)],
  generate: (cfg: Config, count, rnd) => {
    const s = strategy(cfg);
    const level = choice<Scaffold>(cfg, 'scaffold', 'full');
    const chain = (): Chain => {
      if (s === 'toTen') return toTenChain(rnd, num(cfg, 'maxToTen', 20));
      if (s === 'doubles') {
        return doublesChain(rnd, num(cfg, 'maxDouble', 10), choice<DoubleKind>(cfg, 'doubleKind', 'mixed'));
      }
      if (s === 'pairsOfTen') return pairsChain(rnd, num(cfg, 'maxPairs', 20));
      if (s === 'splitTens') return splitChain(rnd, num(cfg, 'maxSplit', 200), bool(cfg, 'splitNoCarry', true));
      if (s === 'roundAdjust') return roundChain(rnd, num(cfg, 'maxRound', 100));
      return moveChain(rnd, num(cfg, 'maxMove', 100));
    };
    return collect<StepsProblem>(
      count,
      () => {
        const steps = chain();
        return steps ? { kind: 'steps', steps: scaffolded(steps, level) } : null;
      },
      (p) => chainKey(p.steps),
    );
  },
};
