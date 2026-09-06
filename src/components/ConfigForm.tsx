import { useState } from 'react';
import type { Config, Field, FontSize, GeneratorDef, Section, SheetOptions, Spacing } from '../types';
import { digitsList, num } from '../generators/helpers';
import type { Picture } from '../data/imageToPixels';
import { pictureFromSource, readFile } from '../data/imageToPixels';
import { PALETTE } from '../data/pixelArt';

interface Props {
  def: GeneratorDef;
  sections: Section[];
  onSections: (sections: Section[]) => void;
  sheet: SheetOptions;
  onSheet: (sheet: SheetOptions) => void;
  seed: number;
  onSeed: (seed: number) => void;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

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
        <input
          type="number"
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          value={num(config, field.key, field.min)}
          onChange={(e) => set(clamp(Number(e.target.value) || field.min, field.min, field.max))}
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
    return (
      <label className="field">
        <span className="field-label">{field.label}</span>
        <select value={String(config[field.key] ?? field.options[0].value)} onChange={(e) => set(e.target.value)}>
          {field.options.map((o) => (
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
            <input
              type="number"
              min={field.min}
              max={field.max}
              value={v}
              onChange={(e) => {
                const next = [...values];
                next[i] = clamp(Number(e.target.value) || field.min, field.min, field.max);
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

  const stale = picture !== null && (picture.width !== width || picture.colors !== colors);

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
 * przy jednym formularz wygląda tak, jak wyglądał zawsze.
 */
function SectionForm({
  def,
  section,
  index,
  many,
  onSection,
  onRemove,
  onMove,
}: {
  def: GeneratorDef;
  section: Section;
  index: number;
  many: boolean;
  onSection: (s: Section) => void;
  onRemove: () => void;
  onMove: (delta: number) => void;
}) {
  const fields = def.fields.filter((f) => !f.showIf || f.showIf(section.config));
  return (
    <div className={many ? 'block-config' : undefined}>
      {many && (
        <div className="block-head">
          <span className="block-name">Blok {index + 1}</span>
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
        <input
          type="number"
          min={1}
          max={200}
          value={section.count}
          onChange={(e) => onSection({ ...section, count: clamp(Number(e.target.value) || 1, 1, 200) })}
        />
      </label>
      <label className="field">
        <span className="field-label">Kolumny</span>
        <input
          type="number"
          min={1}
          max={6}
          value={section.columns}
          onChange={(e) => onSection({ ...section, columns: clamp(Number(e.target.value) || 1, 1, 6) })}
        />
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
          <input
            type="number"
            min={1}
            max={6}
            value={section.introCount}
            onChange={(e) => onSection({ ...section, introCount: clamp(Number(e.target.value) || 1, 1, 6) })}
          />
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

export function ConfigForm({ def, sections, onSections, sheet, onSheet, seed, onSeed }: Props) {
  const many = sections.length > 1;

  const replace = (i: number, section: Section) =>
    onSections(sections.map((s, k) => (k === i ? section : s)));

  /** Nowy blok powiela ostatni — zwykle zmienia się w nim tylko jedno ustawienie. */
  const add = () => {
    const last = sections[sections.length - 1];
    onSections([
      ...sections,
      {
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
            def={def}
            section={s}
            index={i}
            many={many}
            onSection={(next) => replace(i, next)}
            onRemove={() => remove(i)}
            onMove={(delta) => move(i, delta)}
          />
        ))}
        <button type="button" className="add-block" onClick={add}>
          + Dodaj blok zadań
        </button>
        <span className="field-help">
          Kolejny blok to te same zadania z innymi ustawieniami — np. 20 uzupełnień do 10, a pod spodem 20 do
          najbliższej dziesiątki.
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
          <input
            type="number"
            min={1}
            max={10}
            value={sheet.variants}
            onChange={(e) => onSheet({ ...sheet, variants: clamp(Number(e.target.value) || 1, 1, 10) })}
          />
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
          <input
            type="number"
            min={0}
            max={2147483647}
            value={seed}
            onChange={(e) => onSeed(clamp(Number(e.target.value) || 0, 0, 2147483647))}
          />
          <span className="field-help">Ten sam numer daje dokładnie ten sam arkusz.</span>
        </label>
      </section>
    </div>
  );
}
