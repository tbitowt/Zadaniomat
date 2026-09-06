import type { Config, GeneratorDef, MoneyProblem } from '../types';
import { collect } from './arithmetic';
import { bool, choice, num } from './helpers';

type Unit = 'gr' | 'zl' | 'both';

const unitOptions = [
  { value: 'gr', label: 'tylko grosze' },
  { value: 'zl', label: 'tylko złote' },
  { value: 'both', label: 'złote i grosze' },
];

/** Nominały w groszach — tak liczymy wszystko, żeby uniknąć ułamków. */
const GROSZE = [1, 2, 5, 10, 20, 50];
const ZLOTE = [100, 200, 500];
const NOTES = [1000, 2000, 5000, 10000];

const unit = (cfg: Config) => choice<Unit>(cfg, 'unit', 'both');

const pool = (cfg: Config): number[] => {
  const u = unit(cfg);
  const coins = u === 'gr' ? GROSZE : u === 'zl' ? ZLOTE : [...GROSZE, ...ZLOTE];
  return u !== 'gr' && bool(cfg, 'notes', false) ? [...coins, ...NOTES] : coins;
};

/** Kwota w groszach zapisana po polsku: „12 zł 50 gr”. */
export function formatMoney(total: number): string {
  const zl = Math.floor(total / 100);
  const gr = total % 100;
  if (!zl) return `${gr} gr`;
  return gr ? `${zl} zł ${gr} gr` : `${zl} zł`;
}

export const money: GeneratorDef = {
  id: 'pieniadze',
  title: 'Pieniądze — ile to razem?',
  description: 'Sumowanie monet i banknotów.',
  sample: '2 zł + 50 gr + 20 gr = ____',
  sheetDefaults: { count: 10, columns: 2 },
  fields: [
    { kind: 'select', key: 'unit', label: 'Czym płacimy', options: unitOptions },
    {
      kind: 'boolean',
      key: 'notes',
      label: 'Dopuść banknoty',
      showIf: (cfg) => unit(cfg) !== 'gr',
      help: 'Banknoty 10, 20, 50 i 100 zł.',
    },
    { kind: 'number', key: 'items', label: 'Ile monet i banknotów', min: 2, max: 8 },
    {
      kind: 'number',
      key: 'maxAmount',
      label: 'Największa kwota (w zł)',
      min: 1,
      max: 1000,
      showIf: (cfg) => unit(cfg) !== 'gr',
    },
    {
      kind: 'number',
      key: 'maxGrosze',
      label: 'Największa kwota (w gr)',
      min: 10,
      max: 500,
      step: 10,
      showIf: (cfg) => unit(cfg) === 'gr',
    },
  ],
  defaults: { unit: 'zl', notes: false, items: 4, maxAmount: 20, maxGrosze: 100 },
  validate: (cfg) => {
    const cap = unit(cfg) === 'gr' ? num(cfg, 'maxGrosze', 100) : num(cfg, 'maxAmount', 20) * 100;
    const smallest = Math.min(...pool(cfg));
    const items = num(cfg, 'items', 4);
    if (smallest * items > cap) {
      return `Nawet ${items} najmniejszych nominałów daje ${formatMoney(smallest * items)} — zwiększ największą kwotę.`;
    }
    return null;
  },
  generate: (cfg: Config, count, rnd) => {
    const denominations = pool(cfg);
    const smallest = Math.min(...denominations);
    const cap = unit(cfg) === 'gr' ? num(cfg, 'maxGrosze', 100) : num(cfg, 'maxAmount', 20) * 100;
    const items = num(cfg, 'items', 4);
    return collect<MoneyProblem>(
      count,
      () => {
        // każdy kolejny nominał musi zostawić miejsce na te, które jeszcze wylosujemy
        let budget = cap;
        const picked: number[] = [];
        for (let i = 0; i < items; i++) {
          const reserve = smallest * (items - i - 1);
          const allowed = denominations.filter((d) => d <= budget - reserve);
          if (!allowed.length) return null;
          const d = rnd.pick(allowed);
          picked.push(d);
          budget -= d;
        }
        picked.sort((a, b) => b - a);
        const total = picked.reduce((a, b) => a + b, 0);
        return { kind: 'money', items: picked, total, label: formatMoney(total) };
      },
      (p) => p.items.join('|'),
    );
  },
};
