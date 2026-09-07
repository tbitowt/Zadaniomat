import { generators } from './generators';
import type { CategoryId, GeneratorDef, Grade, Subject } from './types';

/** Nazwy przedmiotów; filtr przedmiotu pokazuje się dopiero, gdy jest ich więcej niż jeden. */
export const subjectLabels: Record<Subject, string> = {
  matematyka: 'Matematyka',
};

/** Działy przeglądarki — kolejność tej listy jest kolejnością sekcji na stronie. */
export const categories: { id: CategoryId; label: string; description: string }[] = [
  {
    id: 'rachunek',
    label: 'Rachunek pamięciowy',
    description: 'Działania liczone w głowie — od dodawania do tabliczki mnożenia.',
  },
  {
    id: 'pisemne',
    label: 'Działania pisemne',
    description: 'Słupki z kratkami na wynik i miejscem na przeniesienia.',
  },
  {
    id: 'liczby',
    label: 'Liczby i ich własności',
    description: 'Porównywanie, kolejność, ciągi i oś liczbowa.',
  },
  {
    id: 'praktyka',
    label: 'Miary i sytuacje z życia',
    description: 'Zegar i pieniądze — matematyka poza zeszytem.',
  },
  {
    id: 'lamiglowki',
    label: 'Łamigłówki i kolorowanki',
    description: 'Te same działania, ale opakowane w zabawę.',
  },
];

export const grades: Grade[] = [1, 2, 3];

export interface Filters {
  /** Fraza wpisana w wyszukiwarce; pusty tekst nie filtruje. */
  query: string;
  /** `null` oznacza „wszystkie”. */
  subject: Subject | null;
  grade: Grade | null;
  category: CategoryId | null;
}

export const emptyFilters: Filters = { query: '', subject: null, grade: null, category: null };

export const hasFilters = (f: Filters) =>
  f.query.trim() !== '' || f.subject !== null || f.grade !== null || f.category !== null;

/** Przedmioty faktycznie obecne w rejestrze — filtr nie pokazuje pustych opcji. */
export const usedSubjects = (): Subject[] => [...new Set(generators.map((g) => g.subject))];

/**
 * Bez znaków diakrytycznych i wielkości liter, żeby „slupek” znalazł „słupek”.
 * „ł” trzeba podmienić ręcznie — jako osobny znak Unicode nie rozkłada się w NFD.
 */
const fold = (text: string) =>
  text
    .toLocaleLowerCase('pl')
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

const matchesQuery = (g: GeneratorDef, query: string) => {
  const needle = fold(query.trim());
  if (!needle) return true;
  const haystack = fold(`${g.title} ${g.description} ${g.sample}`);
  // wszystkie słowa muszą się znaleźć — „pisemne mnozenie” zawęża, a nie rozszerza
  return needle.split(/\s+/).every((word) => haystack.includes(word));
};

export const matches = (g: GeneratorDef, f: Filters) =>
  matchesQuery(g, f.query) &&
  (f.subject === null || g.subject === f.subject) &&
  (f.grade === null || g.grades.includes(f.grade)) &&
  (f.category === null || g.category === f.category);

export const filterGenerators = (f: Filters) => generators.filter((g) => matches(g, f));

/** Wyniki rozłożone na działy, z pominięciem tych, które nic nie zwróciły. */
export const groupByCategory = (found: GeneratorDef[]) =>
  categories
    .map((c) => ({ ...c, items: found.filter((g) => g.category === c.id) }))
    .filter((c) => c.items.length > 0);

/** Ile zadań zostałoby po dołożeniu jednego warunku — liczba na etykiecie filtra. */
export const countWith = (f: Filters, patch: Partial<Filters>) =>
  generators.filter((g) => matches(g, { ...f, ...patch })).length;
