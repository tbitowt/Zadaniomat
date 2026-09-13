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
  nameLine: false,
  numbering: true,
  fontSize: 'normal',
  spacing: 'normal',
};

/** Tytuł karty złożonej z kilku rodzajów zadań, póki uczący nie wpisze własnego. */
const MIXED_TITLE = 'Karta pracy';

/** Kolejne zestawy różnią się ziarnem, ale całość nadal zależy tylko od `seed`. */
const variantSeed = (seed: number, i: number) => (seed + i * 7919) >>> 0;

const defOf = (s: Section) => getGenerator(s.generatorId)!;

/** Na wąskim ekranie edytor pokazuje naraz albo ustawienia, albo podgląd (app.css). */
type View = 'config' | 'preview';

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
    return sections.map((s) => {
      const def = defOf(s);
      // jeden zestaw kluczy na blok — zadanie nie wraca w tym samym bloku ani
      // w przykładach z jego ramki, ale kolejny blok może je powtórzyć
      const seen = new Set<string>();
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
  // zakładka edytora na wąskim ekranie; każda pamięta, dokąd była przewinięta
  const [view, setView] = useState<View>('config');
  const viewScroll = useRef<Record<View, number>>({ config: 0, preview: 0 });

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

  useLayoutEffect(() => {
    window.scrollTo(0, viewScroll.current[view]);
  }, [view]);

  const show = (next: View) => {
    if (next === view) return;
    viewScroll.current[view] = window.scrollY;
    setView(next);
  };

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
    // karta klikana nisko na liście zostawiałaby edytor przewinięty do połowy formularza
    window.scrollTo(0, 0);
    setSections([newSection(g)]);
    editorScroll.current = 0;
    viewScroll.current = { config: 0, preview: 0 };
    setView('config');
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
  const got = sections.map((_, i) =>
    pages.length ? Math.min(...pages.map((blocks) => blocks[i].problems.length)) : null,
  );
  const total = pages[0]?.reduce((a, b) => a + b.problems.length, 0) ?? 0;

  return (
    <div className={`app app-editor view-${view}`}>
      <aside className="panel">
        <button type="button" className="link-back" onClick={() => setSections([])}>
          ← Wszystkie rodzaje zadań
        </button>
        <h2>{kinds.length === 1 ? getGenerator(kinds[0])!.title : 'Karta z kilku rodzajów zadań'}</h2>
        <ConfigForm
          sections={sections}
          onSections={setSections}
          onAddKind={startAdding}
          got={got}
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
        {badBlock && <p className="preview-empty">Karty nie da się ułożyć — popraw ustawienia.</p>}
        <Worksheet pages={pages} sheet={sheet} />
      </main>
      {/* na tablecie i telefonie zamiast przycisków pod formularzem — widoczny w obu zakładkach */}
      <nav className="editor-bar" aria-label="Karta pracy">
        <button
          type="button"
          className={`tab${view === 'config' ? ' tab-on' : ''}${badBlock ? ' tab-alert' : ''}`}
          aria-pressed={view === 'config'}
          onClick={() => show('config')}
        >
          Ustawienia
        </button>
        <button
          type="button"
          className={`tab${view === 'preview' ? ' tab-on' : ''}`}
          aria-pressed={view === 'preview'}
          onClick={() => show('preview')}
        >
          Podgląd
        </button>
        <button type="button" onClick={() => setSeed(randomSeed())}>
          Losuj
        </button>
        <button type="button" className="primary" onClick={() => window.print()} disabled={!total}>
          Drukuj
        </button>
      </nav>
    </div>
  );
}
