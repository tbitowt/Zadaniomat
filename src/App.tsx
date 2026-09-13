import { useLayoutEffect, useRef, useState } from 'react';
import { emptyFilters } from './catalog';
import type { Filters } from './catalog';
import { ConfigForm } from './components/ConfigForm';
import { Picker } from './components/Picker';
import { Worksheet } from './components/Worksheet';
import { getGenerator, newSection } from './generators';
import { createRnd, randomSeed } from './rng';
import type { Section, SheetBlock, SheetOptions } from './types';

const sheetBase: Omit<SheetOptions, 'title'> = {
  answers: false,
  variants: 1,
  nameLine: true,
  numbering: true,
  fontSize: 'normal',
  spacing: 'normal',
};

/** Tytuł karty złożonej z kilku rodzajów zadań, póki uczący nie wpisze własnego. */
const MIXED_TITLE = 'Karta pracy';

/** Kolejne zestawy różnią się ziarnem, ale całość nadal zależy tylko od `seed`. */
const variantSeed = (seed: number, i: number) => (seed + i * 7919) >>> 0;

const defOf = (s: Section) => getGenerator(s.generatorId)!;

/** Pierwszy blok, którego konfiguracja jest niewykonalna. */
function firstBadBlock(sections: Section[]) {
  for (const [index, s] of sections.entries()) {
    const message = defOf(s).validate?.(s.config) ?? null;
    if (message) return { index, message };
  }
  return null;
}

/**
 * Strony arkusza: na każdej te same bloki, ale wylosowane z innego ziarna.
 * W obrębie strony bloki ciągną z jednego generatora liczb po kolei, więc
 * ziarno odtwarza całą stronę — także wtedy, gdy bloki są różnych rodzajów.
 */
const buildPages = (sections: Section[], variants: number, seed: number): SheetBlock[][] =>
  Array.from({ length: variants }, (_, i) => {
    const rnd = createRnd(variantSeed(seed, i));
    // jeden zestaw kluczy na rodzaj zadań na całą stronę — dzięki temu żadne
    // zadanie nie wraca w kolejnym bloku ani w przykładach z ramki; osobny dla
    // każdego rodzaju, bo „3|4” z dodawania nie jest powtórką „3|4” z mnożenia
    const seenByKind = new Map<string, Set<string>>();
    return sections.map((s) => {
      const def = defOf(s);
      let seen = seenByKind.get(def.id);
      if (!seen) seenByKind.set(def.id, (seen = new Set()));
      // wyjaśnienie idzie przed zadaniami, więc i przykłady losujemy jako pierwsze
      const rule = s.intro ? (def.explain?.(s.config) ?? null) : null;
      return {
        heading: s.heading,
        columns: s.columns,
        intro: rule ? { rule, examples: def.generate(s.config, s.introCount, rnd, seen) } : null,
        problems: def.generate(s.config, s.count, rnd, seen),
        grid: s.config.grid === true,
        carryRow: s.config.carryRow === true,
      };
    });
  });

export default function App() {
  // pusta lista bloków to przeglądarka zadań; pierwszy wybrany rodzaj otwiera edytor
  const [sections, setSections] = useState<Section[]>([]);
  // przeglądarka otwarta z edytora, żeby dołożyć blok innego rodzaju
  const [adding, setAdding] = useState(false);
  const [sheet, setSheet] = useState<SheetOptions>({ title: '', ...sheetBase });
  const [seed, setSeed] = useState(randomSeed);
  // filtry przeglądarki żyją tutaj, żeby powrót z edytora wracał do tej samej listy
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  // gdzie był edytor przed wyjściem do przeglądarki i czy wracamy z nowym blokiem
  const editorScroll = useRef(0);
  const added = useRef(false);

  // przeglądarka zaczyna się od góry; po powrocie edytor wraca tam, gdzie był,
  // a jeśli doszedł blok — pokazuje jego ustawienia
  useLayoutEffect(() => {
    if (adding) {
      window.scrollTo(0, 0);
      return;
    }
    window.scrollTo(0, editorScroll.current);
    if (added.current) {
      added.current = false;
      [...document.querySelectorAll('.block-config')].at(-1)?.scrollIntoView({ block: 'start' });
    }
  }, [adding]);

  const startAdding = () => {
    editorScroll.current = window.scrollY;
    setAdding(true);
  };

  const open = (id: string) => {
    const g = getGenerator(id)!;
    if (adding) {
      const kinds = new Set(sections.map((s) => s.generatorId));
      // tytuł wzięty z pierwszego rodzaju przestaje pasować, gdy dochodzi inny —
      // ale tylko jeśli uczący go nie zmienił
      if (!kinds.has(id) && sheet.title === defOf(sections[0]).title) {
        setSheet({ ...sheet, title: MIXED_TITLE });
      }
      setSections([...sections, newSection(g)]);
      added.current = true;
      setAdding(false);
      return;
    }
    setSections([newSection(g)]);
    editorScroll.current = 0;
    setSheet({ title: g.title, ...sheetBase });
    setSeed(randomSeed());
  };

  if (sections.length === 0 || adding) {
    return (
      <Picker
        filters={filters}
        onFilters={setFilters}
        onOpen={open}
        onCancel={adding ? () => setAdding(false) : undefined}
      />
    );
  }

  const kinds = [...new Set(sections.map((s) => s.generatorId))];
  const badBlock = firstBadBlock(sections);
  const pages = badBlock ? [] : buildPages(sections, sheet.variants, seed);

  const label = (i: number) => (sections.length > 1 ? `Blok ${i + 1}: ` : '');
  // najmniej zadań, jakie udało się ułożyć w danym bloku (liczone po wszystkich zestawach)
  const short = sections
    .map((s, i) => ({ i, want: s.count, got: Math.min(...pages.map((blocks) => blocks[i].problems.length)) }))
    .find((b) => pages.length && b.got < b.want);
  const total = pages[0]?.reduce((a, b) => a + b.problems.length, 0) ?? 0;

  return (
    <div className="app app-editor">
      <aside className="panel">
        <button type="button" className="link-back" onClick={() => setSections([])}>
          ← Wszystkie rodzaje zadań
        </button>
        <h2>{kinds.length === 1 ? getGenerator(kinds[0])!.title : 'Karta z kilku rodzajów zadań'}</h2>
        <ConfigForm
          sections={sections}
          onSections={setSections}
          onAddKind={startAdding}
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
            {label(short.i)}w tych ustawieniach jest tylko {short.got} różnych zadań, a zamówionych było{' '}
            {short.want}. Powtórek nie drukujemy — poluzuj warunki (np. przeniesienia lub liczbę cyfr) albo
            zmniejsz liczbę zadań.
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
