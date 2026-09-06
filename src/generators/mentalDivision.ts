import type { Config, GeneratorDef, InlineProblem } from '../types';
import { collect, makeDivision, pickBlank, unknownOptions } from './arithmetic';
import type { UnknownMode } from './arithmetic';
import { bool, choice, num } from './helpers';

/** Zakres dzielników po odrzuceniu dzielenia przez 1, jeśli go nie chcemy. */
const divisorRange = (cfg: Config): [number, number] => {
  const from = num(cfg, 'divisorFrom', 2);
  const to = num(cfg, 'divisorTo', 10);
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  return [bool(cfg, 'allowTrivial', false) ? lo : Math.max(lo, 2), hi];
};

const withRemainder = (cfg: Config) => bool(cfg, 'remainder', false);

export const mentalDivision: GeneratorDef = {
  id: 'dzielenie-pamiec',
  title: 'Dzielenie w pamięci',
  description: 'Dzielenie bez reszty albo z resztą, w jednej linii.',
  sample: '18 : 3 = ____',
  sheetDefaults: { count: 30, columns: 3 },
  fields: [
    { kind: 'number', key: 'divisorFrom', label: 'Dzielnik od', min: 1, max: 20 },
    {
      kind: 'number',
      key: 'divisorTo',
      label: 'Dzielnik do',
      min: 1,
      max: 20,
      help: 'Od 2 do 10 to dzielenie w zakresie tabliczki mnożenia.',
    },
    { kind: 'number', key: 'maxDividend', label: 'Największa liczba dzielona', min: 2, max: 1000000, step: 10 },
    {
      kind: 'number',
      key: 'maxQuotient',
      label: 'Największy wynik',
      min: 1,
      max: 1000,
      help: 'Wynik 10 przy dzielniku do 10 to dokładnie zakres tabliczki mnożenia.',
    },
    {
      kind: 'boolean',
      key: 'allowTrivial',
      label: 'Dopuść dzielenie przez 1 i wynik 1',
      help: 'Wyłączone odsiewa najłatwiejsze przypadki.',
    },
    {
      kind: 'boolean',
      key: 'remainder',
      label: 'Dzielenie z resztą',
      help: 'Zadania w postaci 17 : 5 = ___ r. ___ — reszta zawsze niezerowa.',
    },
    {
      kind: 'select',
      key: 'unknown',
      label: 'Szukana liczba',
      options: unknownOptions,
      showIf: (cfg) => !withRemainder(cfg),
      help: 'Zamiast wyniku można zakryć dzielną albo dzielnik: 18 : ___ = 6.',
    },
  ],
  defaults: {
    divisorFrom: 2,
    divisorTo: 10,
    maxDividend: 100,
    maxQuotient: 10,
    allowTrivial: false,
    remainder: false,
    unknown: 'result',
  },
  validate: (cfg) => {
    const [lo, hi] = divisorRange(cfg);
    if (lo > hi) {
      return 'Po odrzuceniu dzielnika 1 nie zostaje żaden dzielnik — poszerz zakres albo dopuść dzielenie przez 1.';
    }
    if (withRemainder(cfg) && hi < 2) {
      return 'Dzielenie z resztą wymaga dzielnika co najmniej 2 — zwiększ górny zakres dzielnika.';
    }
    const minQuotient = bool(cfg, 'allowTrivial', false) ? 1 : 2;
    if (num(cfg, 'maxQuotient', 10) < minQuotient) {
      return `Największy wynik musi być co najmniej ${minQuotient}.`;
    }
    const minDividend = Math.max(2, lo) * minQuotient;
    if (minDividend > num(cfg, 'maxDividend', 100)) {
      return `Najmniejsza możliwa dzielna to ${minDividend} — zwiększ największą liczbę dzieloną.`;
    }
    return null;
  },
  generate: (cfg: Config, count, rnd) => {
    const [lo, hi] = divisorRange(cfg);
    const maxDividend = num(cfg, 'maxDividend', 100);
    const maxQuotient = num(cfg, 'maxQuotient', 10);
    const minQuotient = bool(cfg, 'allowTrivial', false) ? 1 : 2;
    const rest = withRemainder(cfg);
    // przy dzieleniu z resztą szukamy zawsze wyniku — zakryta dzielna nie
    // dałaby jednego rozwiązania, bo reszta jest wtedy dwiema niewiadomymi
    const unknown = rest ? 'result' : choice<UnknownMode>(cfg, 'unknown', 'result');
    return collect<InlineProblem>(
      count,
      () => {
        const d = makeDivision(rnd, lo, hi, maxDividend, minQuotient, maxQuotient, rest);
        if (!d) return null;
        const terms = [d.a, d.b];
        const blankIndex = pickBlank(rnd, unknown, terms, ':');
        return {
          kind: 'inline',
          terms,
          op: ':',
          result: d.q,
          answer: blankIndex < 0 ? d.q : terms[blankIndex],
          blankIndex,
          ...(rest ? { remainder: d.r } : {}),
        };
      },
      (p) => p.terms.join('|'),
    );
  },
};
