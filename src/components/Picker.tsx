import type { ReactNode } from 'react';
import {
  categories,
  countWith,
  emptyFilters,
  filterGenerators,
  grades as allGrades,
  groupByCategory,
  hasFilters,
  subjectLabels,
  usedSubjects,
} from '../catalog';
import type { Filters } from '../catalog';
import type { GeneratorDef, Grade } from '../types';

/** „1 rodzaj”, „2 rodzaje”, „5 rodzajów” — polska odmiana po liczebniku. */
function countLabel(n: number): string {
  const ones = n % 10;
  const tens = n % 100;
  if (n === 1) return '1 rodzaj zadań';
  if (ones >= 2 && ones <= 4 && (tens < 12 || tens > 14)) return `${n} rodzaje zadań`;
  return `${n} rodzajów zadań`;
}

/** „kl. 1–3” dla ciągłego zakresu, „kl. 1, 3” dla dziur. */
function gradeLabel(grades: Grade[]): string {
  const sorted = [...grades].sort((a, b) => a - b);
  if (sorted.length === 0) return '';
  const contiguous = sorted.every((g, i) => i === 0 || g === sorted[i - 1] + 1);
  if (sorted.length > 1 && contiguous) return `kl. ${sorted[0]}–${sorted[sorted.length - 1]}`;
  return `kl. ${sorted.join(', ')}`;
}

/** Jeden przycisk filtra; `count` to liczba zadań, która zostanie po jego wybraniu. */
function Chip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`chip${active ? ' chip-on' : ''}`}
      aria-pressed={active}
      disabled={count === 0 && !active}
      onClick={onClick}
    >
      {label}
      <span className="chip-count">{count}</span>
    </button>
  );
}

function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="filter-row">
      <span className="filter-label">{label}</span>
      <div className="chips">{children}</div>
    </div>
  );
}

export function Picker({
  filters,
  onFilters,
  onOpen,
}: {
  filters: Filters;
  onFilters: (f: Filters) => void;
  onOpen: (id: string) => void;
}) {
  const found = filterGenerators(filters);
  const groups = groupByCategory(found);
  const subjects = usedSubjects();
  const set = (patch: Partial<Filters>) => onFilters({ ...filters, ...patch });

  return (
    <div className="app">
      <header className="app-header">
        <h1>Zadaniomat</h1>
        <p>Przeglądaj rodzaje zadań, ustaw parametry i wydrukuj kartę pracy.</p>
      </header>

      <section className="filters" aria-label="Filtry">
        <div className="search">
          <input
            type="search"
            value={filters.query}
            placeholder="Szukaj: mnożenie, zegar, słupek…"
            aria-label="Szukaj rodzaju zadań"
            onChange={(e) => set({ query: e.target.value })}
          />
        </div>

        {subjects.length > 1 && (
          <ChipRow label="Przedmiot">
            <Chip
              label="wszystkie"
              count={countWith(filters, { subject: null })}
              active={filters.subject === null}
              onClick={() => set({ subject: null })}
            />
            {subjects.map((s) => (
              <Chip
                key={s}
                label={subjectLabels[s]}
                count={countWith(filters, { subject: s })}
                active={filters.subject === s}
                onClick={() => set({ subject: filters.subject === s ? null : s })}
              />
            ))}
          </ChipRow>
        )}

        <ChipRow label="Klasa">
          <Chip
            label="wszystkie"
            count={countWith(filters, { grade: null })}
            active={filters.grade === null}
            onClick={() => set({ grade: null })}
          />
          {allGrades.map((g) => (
            <Chip
              key={g}
              label={`klasa ${g}`}
              count={countWith(filters, { grade: g })}
              active={filters.grade === g}
              onClick={() => set({ grade: filters.grade === g ? null : g })}
            />
          ))}
        </ChipRow>

        <ChipRow label="Dział">
          <Chip
            label="wszystkie"
            count={countWith(filters, { category: null })}
            active={filters.category === null}
            onClick={() => set({ category: null })}
          />
          {categories.map((c) => (
            <Chip
              key={c.id}
              label={c.label}
              count={countWith(filters, { category: c.id })}
              active={filters.category === c.id}
              onClick={() => set({ category: filters.category === c.id ? null : c.id })}
            />
          ))}
        </ChipRow>

        <p className="filter-summary">
          <span>{countLabel(found.length)}</span>
          {hasFilters(filters) && (
            <button type="button" className="link-reset" onClick={() => onFilters(emptyFilters)}>
              wyczyść filtry
            </button>
          )}
        </p>
      </section>

      {groups.length === 0 ? (
        <p className="empty">
          Nic nie pasuje do tych warunków.{' '}
          <button type="button" className="link-reset" onClick={() => onFilters(emptyFilters)}>
            Wyczyść filtry
          </button>
        </p>
      ) : (
        groups.map((c) => (
          <section key={c.id} className="group">
            <div className="group-head">
              <h2>{c.label}</h2>
              <p>{c.description}</p>
            </div>
            <ul className="picker">
              {c.items.map((g: GeneratorDef) => (
                <li key={g.id}>
                  <button type="button" className="card" onClick={() => onOpen(g.id)}>
                    <span className="card-title">{g.title}</span>
                    <span className="card-desc">{g.description}</span>
                    <span className="card-sample">{g.sample}</span>
                    <span className="card-meta">{gradeLabel(g.grades)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
