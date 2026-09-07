import { useState } from 'react';
import { ConfigForm } from './components/ConfigForm';
import { Worksheet } from './components/Worksheet';
import { generators, getGenerator } from './generators';
import { createRnd, randomSeed } from './rng';
import type { GeneratorDef, Section, SheetBlock, SheetOptions } from './types';

const sheetBase: Omit<SheetOptions, 'title'> = {
  answers: false,
  variants: 1,
  nameLine: true,
  numbering: true,
  fontSize: 'normal',
  spacing: 'normal',
};

/** Kolejne zestawy różnią się ziarnem, ale całość nadal zależy tylko od `seed`. */
const variantSeed = (seed: number, i: number) => (seed + i * 7919) >>> 0;

/** Pierwszy blok, którego konfiguracja jest niewykonalna. */
function firstBadBlock(def: GeneratorDef, sections: Section[]) {
  for (const [index, s] of sections.entries()) {
    const message = def.validate?.(s.config) ?? null;
    if (message) return { index, message };
  }
  return null;
}

/**
 * Strony arkusza: na każdej te same bloki, ale wylosowane z innego ziarna.
 * W obrębie strony bloki ciągną z jednego generatora po kolei, więc ziarno
 * odtwarza całą stronę.
 */
const buildPages = (def: GeneratorDef, sections: Section[], variants: number, seed: number): SheetBlock[][] =>
  Array.from({ length: variants }, (_, i) => {
    const rnd = createRnd(variantSeed(seed, i));
    return sections.map((s) => {
      // wyjaśnienie idzie przed zadaniami, więc i przykłady losujemy jako pierwsze
      const rule = s.intro ? (def.explain?.(s.config) ?? null) : null;
      return {
        heading: s.heading,
        columns: s.columns,
        intro: rule ? { rule, examples: def.generate(s.config, s.introCount, rnd) } : null,
        problems: def.generate(s.config, s.count, rnd),
        grid: s.config.grid === true,
        carryRow: s.config.carryRow === true,
      };
    });
  });

export default function App() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [sheet, setSheet] = useState<SheetOptions>({ title: '', ...sheetBase });
  const [seed, setSeed] = useState(randomSeed);

  const def = activeId ? getGenerator(activeId) : undefined;

  const open = (id: string) => {
    const g = getGenerator(id)!;
    setActiveId(id);
    setSections([
      {
        config: { ...g.defaults },
        count: g.sheetDefaults.count,
        columns: g.sheetDefaults.columns,
        heading: '',
        intro: false,
        introCount: 2,
      },
    ]);
    setSheet({ title: g.title, ...sheetBase });
    setSeed(randomSeed());
  };

  if (!def) {
    return (
      <div className="app">
        <header className="app-header">
          <h1>Zadaniomat</h1>
          <p>Wybierz rodzaj zadań, ustaw parametry i wydrukuj kartę pracy.</p>
        </header>
        <ul className="picker">
          {generators.map((g) => (
            <li key={g.id}>
              <button type="button" className="card" onClick={() => open(g.id)}>
                <span className="card-title">{g.title}</span>
                <span className="card-desc">{g.description}</span>
                <span className="card-sample">{g.sample}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const badBlock = firstBadBlock(def, sections);
  const pages = badBlock ? [] : buildPages(def, sections, sheet.variants, seed);

  const label = (i: number) => (sections.length > 1 ? `Blok ${i + 1}: ` : '');
  // najmniej zadań, jakie udało się ułożyć w danym bloku (liczone po wszystkich zestawach)
  const short = sections
    .map((s, i) => ({ i, want: s.count, got: Math.min(...pages.map((blocks) => blocks[i].problems.length)) }))
    .find((b) => pages.length && b.got < b.want);
  const total = pages[0]?.reduce((a, b) => a + b.problems.length, 0) ?? 0;

  return (
    <div className="app app-editor">
      <aside className="panel">
        <button type="button" className="link-back" onClick={() => setActiveId(null)}>
          ← Wszystkie rodzaje zadań
        </button>
        <h2>{def.title}</h2>
        <ConfigForm
          def={def}
          sections={sections}
          onSections={setSections}
          sheet={sheet}
          onSheet={setSheet}
          seed={seed}
          onSeed={setSeed}
        />
        {badBlock && (
          <p className="alert">
            {label(badBlock.index)}
            {badBlock.message}
          </p>
        )}
        {short && (
          <p className="alert alert-warn">
            {label(short.i)}udało się ułożyć tylko {short.got} z {short.want} zadań — poluzuj warunki (np.
            przeniesienia lub liczbę cyfr).
          </p>
        )}
        <div className="actions">
          <button type="button" onClick={() => setSeed(randomSeed())}>
            Losuj ponownie
          </button>
          <button type="button" className="primary" onClick={() => window.print()} disabled={!total}>
            Drukuj / zapisz PDF
          </button>
        </div>
      </aside>
      <main className="preview">
        <Worksheet pages={pages} sheet={sheet} />
      </main>
    </div>
  );
}
