import { useState } from 'react';
import type { Config, Field, FontSize, Section, SheetOptions, Spacing } from '../types';
import { getGenerator } from '../generators';
import { digitsList, num, rangeList } from '../generators/helpers';
import type { Picture } from '../data/imageToPixels';
import { pictureFromSource, readFile } from '../data/imageToPixels';
import { PALETTE } from '../data/pixelArt';

interface Props {
  sections: Section[];
  onSections: (sections: Section[]) => void;
  /** Otwiera przeglądarkę, żeby dołożyć blok innego rodzaju zadań. */
  onAddKind: () => void;
  /** Ile zadań udało się ułożyć w każdym bloku; `null`, gdy karta się nie ułożyła. */
  got: (number | null)[];
  sheet: SheetOptions;
  onSheet: (sheet: SheetOptions) => void;
  seed: number;
  onSeed: (seed: number) => void;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Pole liczbowe, które nie przeszkadza w pisaniu. Tekst żyje w polu, a do
 * konfiguracji trafia dopiero wtedy, gdy jest liczbą z zakresu — przycinanie
 * przy każdym klawiszu zamieniało „1” w minimum i „15” wychodziło jako „25”.
 * Po wyjściu z pola wartość spoza zakresu jest przycinana, a pusta wraca
 * do ostatniej poprawnej.
 */
function NumberInput({
  value,
  min,
  max,
  step,
  onChange,
  ...rest
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  'aria-label'?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      {...rest}
      type="number"
      min={min}
      max={max}
      step={step ?? 1}
      value={draft ?? String(value)}
      onChange={(e) => {
        const text = e.target.value;
        setDraft(text);
        const n = Number(text);
        if (text.trim() !== '' && Number.isFinite(n) && n >= min && n <= max) onChange(n);
      }}
      onBlur={() => {
        if (draft === null) return;
        const n = Number(draft);
        if (draft.trim() !== '' && Number.isFinite(n)) {
          const next = clamp(n, min, max);
          if (next !== value) onChange(next);
        }
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
}

const fontSizes: { value: FontSize; label: string }[] = [
  { value: 'small', label: 'mała' },
  { value: 'normal', label: 'średnia' },
  { value: 'large', label: 'duża' },
];

const spacings: { value: Spacing; label: string }[] = [
  { value: 'tight', label: 'ciasno' },
  { value: 'normal', label: 'normalnie' },
  { value: 'loose', label: 'luźno' },
];

function FieldRow({ field, config, onConfig }: { field: Field; config: Config; onConfig: (c: Config) => void }) {
  const set = (value: unknown) => onConfig({ ...config, [field.key]: value });

  if (field.kind === 'number') {
    return (
      <label className="field">
        <span className="field-label">{field.label}</span>
        <NumberInput
          min={field.min}
          max={field.max}
          step={field.step}
          value={num(config, field.key, field.min)}
          onChange={set}
        />
        {field.help && <span className="field-help">{field.help}</span>}
      </label>
    );
  }

  if (field.kind === 'boolean') {
    return (
      <label className="field field-inline">
        <input
          type="checkbox"
          checked={config[field.key] === true}
          onChange={(e) => set(e.target.checked)}
        />
        <span className="field-label">{field.label}</span>
        {field.help && <span className="field-help">{field.help}</span>}
      </label>
    );
  }

  if (field.kind === 'select') {
    const options = typeof field.options === 'function' ? field.options(config) : field.options;
    // wartość, której nie ma już na liście (np. „trzecia liczba” przy dwóch
    // składnikach), pokazujemy jako pierwszą opcję — tak ją traktuje generator
    const value = options.find((o) => o.value === config[field.key])?.value ?? options[0].value;
    return (
      <label className="field">
        <span className="field-label">{field.label}</span>
        <select value={value} onChange={(e) => set(e.target.value)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {field.help && <span className="field-help">{field.help}</span>}
      </label>
    );
  }

  if (field.kind === 'image') {
    return <ImageField field={field} config={config} onConfig={onConfig} />;
  }

  if (field.kind === 'rangeList') {
    const count = field.countKey ? num(config, field.countKey, 2) : (field.labels?.length ?? 2);
    const ranges = rangeList(config, field.key, count, (i) => field.fallback(config, i), false);
    const name = (i: number) => field.labels?.[i] ?? `${i + 1}. liczba`;
    const setAt = (i: number, part: 0 | 1, n: number) => {
      const next = ranges.map((r) => [...r]);
      next[i][part] = n;
      onConfig({ ...config, [field.key]: next });
    };
    return (
      <div className="field">
        <span className="field-label">{field.label}</span>
        <div className="ranges">
          {ranges.map(([lo, hi], i) => (
            <div className="range-row" key={i}>
              <span className="range-name">{name(i)}</span>
              <span className="range-word">od</span>
              <NumberInput
                aria-label={`${name(i)} od`}
                min={field.min}
                max={field.max}
                value={lo}
                onChange={(n) => setAt(i, 0, n)}
              />
              <span className="range-word">do</span>
              <NumberInput
                aria-label={`${name(i)} do`}
                min={field.min}
                max={field.max}
                value={hi}
                onChange={(n) => setAt(i, 1, n)}
              />
            </div>
          ))}
        </div>
        {field.help && <span className="field-help">{field.help}</span>}
      </div>
    );
  }

  // digitsList — jedno pole na każdą liczbę w działaniu
  const count = num(config, field.countKey, 2);
  const values = digitsList(config, field.key, count);
  return (
    <div className="field">
      <span className="field-label">{field.label}</span>
      <div className="digits-row">
        {values.map((v, i) => (
          <span className="digit-box" key={i}>
            <span className="digit-index">{i + 1}.</span>
            <NumberInput
              min={field.min}
              max={field.max}
              value={v}
              onChange={(n) => {
                const next = [...values];
                next[i] = n;
                onConfig({ ...config, [field.key]: next });
              }}
            />
          </span>
        ))}
      </div>
      {field.help && <span className="field-help">{field.help}</span>}
    </div>
  );
}


/**
 * Obrazek zamieniany na kratki: plik z dysku trafia do konfiguracji jako siatka
 * znaków palety. Oryginał zostaje przy zadaniu, więc po zmianie szerokości
 * siatki albo liczby kolorów wystarczy jedno kliknięcie, żeby go przeliczyć.
 */
function ImageField({
  field,
  config,
  onConfig,
}: {
  field: Extract<Field, { kind: 'image' }>;
  config: Config;
  onConfig: (c: Config) => void;
}) {
  const picture = (config[field.key] ?? null) as Picture | null;
  const width = num(config, field.widthKey, 12);
  const colors = num(config, field.colorsKey, 4);
  const [error, setError] = useState<string | null>(null);

  const build = async (src: string, name: string) => {
    try {
      const next = await pictureFromSource(src, name, width, field.maxHeight, colors);
      onConfig({ ...config, [field.key]: next });
      setError(null);
    } catch {
      setError('Nie udało się wczytać obrazka — spróbuj innego pliku.');
    }
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    try {
      await build(await readFile(file), file.name);
    } catch {
      setError('Nie udało się odczytać pliku.');
    }
  };

  const stale = picture !== null && (picture.asked !== width || picture.colors !== colors);

  return (
    <div className="field">
      <span className="field-label">{field.label}</span>
      <input type="file" accept="image/*" className="file-input" onChange={(e) => void pick(e.target.files?.[0])} />
      {picture && (
        <div className="picture-preview">
          <div className="picture-grid" style={{ ['--px' as string]: picture.width }}>
            {picture.rows.flatMap((row, y) =>
              [...row].map((ch, x) => (
                <span key={`${y}-${x}`} style={{ background: PALETTE[ch]?.css ?? '#ffffff' }} />
              )),
            )}
          </div>
          <span className="field-help">
            {picture.name} — {picture.width} × {picture.height} kratek, {picture.colors} kolorów
          </span>
        </div>
      )}
      {stale && (
        <button type="button" className="add-block" onClick={() => void build(picture.src, picture.name)}>
          Przelicz na {width} kratek i {colors} kolorów
        </button>
      )}
      {error && <span className="field-help field-error">{error}</span>}
      {field.help && <span className="field-help">{field.help}</span>}
    </div>
  );
}

/**
 * Jeden blok zadań: liczba zadań, opcjonalny nagłówek na wydruku i pola
 * generatora. Ramka i przyciski pojawiają się dopiero przy kilku blokach —
 * przy jednym formularz wygląda tak, jak wyglądał zawsze. Na karcie z kilku
 * rodzajów zadań nagłówek ramki mówi też, jaki to rodzaj.
 */
function SectionForm({
  section,
  index,
  many,
  mixed,
  got,
  onSection,
  onRemove,
  onMove,
}: {
  section: Section;
  index: number;
  many: boolean;
  mixed: boolean;
  got: number | null;
  onSection: (s: Section) => void;
  onRemove: () => void;
  onMove: (delta: number) => void;
}) {
  const def = getGenerator(section.generatorId)!;
  const fields = def.fields.filter((f) => !f.showIf || f.showIf(section.config));
  return (
    <div className={many ? 'block-config' : undefined}>
      {many && (
        <div className="block-head">
          <span className="block-name">
            Blok {index + 1}
            {mixed && <span className="block-kind">{def.title}</span>}
          </span>
          <span className="block-tools">
            <button type="button" onClick={() => onMove(-1)} title="Przenieś wyżej">
              ↑
            </button>
            <button type="button" onClick={() => onMove(1)} title="Przenieś niżej">
              ↓
            </button>
            <button type="button" onClick={onRemove} title="Usuń blok">
              ✕
            </button>
          </span>
        </div>
      )}
      {many && (
        <label className="field">
          <span className="field-label">Nagłówek nad blokiem</span>
          <input
            type="text"
            value={section.heading}
            placeholder="np. Uzupełnij do 10"
            onChange={(e) => onSection({ ...section, heading: e.target.value })}
          />
        </label>
      )}
      <label className="field">
        <span className="field-label">Liczba zadań</span>
        <NumberInput min={1} max={200} value={section.count} onChange={(n) => onSection({ ...section, count: n })} />
      </label>
      {got !== null && got < section.count && (
        <p className="alert alert-warn alert-field">
          W tych ustawieniach jest tylko {got} różnych zadań, a zamówionych było {section.count}. Powtórek nie
          drukujemy — poluzuj warunki (np. przeniesienia lub liczbę cyfr) albo zmniejsz liczbę zadań.
        </p>
      )}
      <label className="field">
        <span className="field-label">Kolumny</span>
        <NumberInput min={1} max={6} value={section.columns} onChange={(n) => onSection({ ...section, columns: n })} />
      </label>
      {def.explain && (
        <label className="field field-inline">
          <input
            type="checkbox"
            checked={section.intro}
            onChange={(e) => onSection({ ...section, intro: e.target.checked })}
          />
          <span className="field-label">Zacznij od wyjaśnienia i przykładów</span>
        </label>
      )}
      {def.explain && section.intro && (
        <label className="field">
          <span className="field-label">Ile przykładów</span>
          <NumberInput min={1} max={6} value={section.introCount} onChange={(n) => onSection({ ...section, introCount: n })} />
        </label>
      )}
      {fields.map((f) => (
        <FieldRow
          key={f.key}
          field={f}
          config={section.config}
          onConfig={(config) => onSection({ ...section, config })}
        />
      ))}
    </div>
  );
}

export function ConfigForm({ sections, onSections, onAddKind, got, sheet, onSheet, seed, onSeed }: Props) {
  const many = sections.length > 1;
  const mixed = new Set(sections.map((s) => s.generatorId)).size > 1;

  const replace = (i: number, section: Section) =>
    onSections(sections.map((s, k) => (k === i ? section : s)));

  /** Nowy blok powiela ostatni — zwykle zmienia się w nim tylko jedno ustawienie. */
  const add = () => {
    const last = sections[sections.length - 1];
    onSections([
      ...sections,
      {
        generatorId: last.generatorId,
        config: { ...last.config },
        count: last.count,
        columns: last.columns,
        heading: '',
        intro: false,
        introCount: last.introCount,
      },
    ]);
  };

  const remove = (i: number) => onSections(sections.filter((_, k) => k !== i));

  const move = (i: number, delta: number) => {
    const to = i + delta;
    if (to < 0 || to >= sections.length) return;
    const next = [...sections];
    [next[i], next[to]] = [next[to], next[i]];
    onSections(next);
  };

  return (
    <div className="config">
      <section className="config-group">
        <h3>Zadania</h3>
        {sections.map((s, i) => (
          <SectionForm
            key={i}
            section={s}
            index={i}
            many={many}
            mixed={mixed}
            got={got[i] ?? null}
            onSection={(next) => replace(i, next)}
            onRemove={() => remove(i)}
            onMove={(delta) => move(i, delta)}
          />
        ))}
        <div className="add-blocks">
          <button type="button" className="add-block" onClick={add}>
            + Ten sam rodzaj
          </button>
          <button type="button" className="add-block" onClick={onAddKind}>
            + Inny rodzaj
          </button>
        </div>
        <span className="field-help">
          Kolejny blok może powtórzyć ostatni z innymi ustawieniami — np. 20 uzupełnień do 10, a pod spodem 20
          do najbliższej dziesiątki — albo dołożyć zupełnie inne zadania, np. zegary pod dodawaniem.
        </span>
      </section>

      <section className="config-group">
        <h3>Arkusz</h3>
        <label className="field">
          <span className="field-label">Tytuł na wydruku</span>
          <input type="text" value={sheet.title} onChange={(e) => onSheet({ ...sheet, title: e.target.value })} />
        </label>
        <label className="field">
          <span className="field-label">Wielkość czcionki</span>
          <select
            value={sheet.fontSize}
            onChange={(e) => onSheet({ ...sheet, fontSize: e.target.value as FontSize })}
          >
            {fontSizes.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Odstępy między zadaniami</span>
          <select
            value={sheet.spacing}
            onChange={(e) => onSheet({ ...sheet, spacing: e.target.value as Spacing })}
          >
            {spacings.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Liczba zestawów</span>
          <NumberInput min={1} max={10} value={sheet.variants} onChange={(n) => onSheet({ ...sheet, variants: n })} />
          <span className="field-help">Każdy zestaw to osobna strona z innymi zadaniami.</span>
        </label>
        <label className="field field-inline">
          <input
            type="checkbox"
            checked={sheet.numbering}
            onChange={(e) => onSheet({ ...sheet, numbering: e.target.checked })}
          />
          <span className="field-label">Numeruj zadania</span>
        </label>
        <label className="field field-inline">
          <input
            type="checkbox"
            checked={sheet.nameLine}
            onChange={(e) => onSheet({ ...sheet, nameLine: e.target.checked })}
          />
          <span className="field-label">Miejsce na imię i datę</span>
        </label>
        <label className="field field-inline">
          <input
            type="checkbox"
            checked={sheet.answers}
            onChange={(e) => onSheet({ ...sheet, answers: e.target.checked })}
          />
          <span className="field-label">Dołącz arkusz odpowiedzi</span>
        </label>
        <label className="field">
          <span className="field-label">Ziarno losowania</span>
          <NumberInput min={0} max={2147483647} value={seed} onChange={(n) => onSeed(n)} />
          <span className="field-help">Ten sam numer daje dokładnie ten sam arkusz.</span>
        </label>
      </section>
    </div>
  );
}
