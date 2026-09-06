/** Wspólne typy dla wszystkich generatorów zadań. */

export type Operator = '+' | '-' | '×' | ':';

/**
 * Zadanie w jednej linii, np. „12 + 7 + 3 = ____”.
 * `blankIndex` pozwala zakryć jedną z liczb zamiast wyniku („12 + ___ = 19”).
 */
export interface InlineProblem {
  kind: 'inline';
  terms: number[];
  op: Operator;
  /** Wartość całego działania (to, co stoi po prawej stronie znaku „=”). */
  result: number;
  /** Liczba, którą wpisuje uczeń. */
  answer: number;
  /** Indeks zakrytej liczby; -1 (domyślnie) oznacza, że szukany jest wynik. */
  blankIndex?: number;
  /** Reszta z dzielenia — obecna tylko przy dzieleniu z resztą. */
  remainder?: number;
}

/** Zadanie w słupku (pisemne) — liczby jedna pod drugą, kreska, miejsce na wynik. */
export interface ColumnProblem {
  kind: 'column';
  terms: number[];
  op: Operator;
  answer: number;
  /** Liczba kratek na wynik (uwzględnia przeniesienie). */
  answerWidth: number;
  /**
   * Iloczyny częściowe mnożenia pisemnego, nieprzesunięte — wiersz `j`
   * rysowany jest z przesunięciem o `j` pozycji w lewo.
   */
  partials?: number[];
}

/** Pojedyncza kratka krzyżówki. */
export type CrosswordCell =
  | { kind: 'num'; value: number; hidden: boolean }
  | { kind: 'op'; op: Operator; hidden: boolean }
  | { kind: 'eq' };

/**
 * Krzyżówka matematyczna — działania `a ⚬ b = c` rozłożone poziomo i pionowo,
 * splecione ze sobą na wspólnych liczbach. Zakryte kratki uczeń uzupełnia;
 * generator pilnuje, żeby każdą dało się wyliczyć krok po kroku.
 */
export interface CrosswordProblem {
  kind: 'crossword';
  width: number;
  height: number;
  /** Kratki wiersz po wierszu; `null` to puste miejsce poza krzyżówką. */
  cells: (CrosswordCell | null)[][];
  /** Ile działań udało się spleść. */
  equationCount: number;
}

/**
 * Porównywanie: jedna strona to pojedyncza liczba albo działanie dwóch liczb.
 * `value` to wartość tej strony — po niej ustala się znak porównania.
 */
export interface CompareSide {
  terms: number[];
  op: Operator;
  value: number;
}

/** „24 + 3 ⬜ 30” — uczeń wstawia znak <, > albo =. */
export interface CompareProblem {
  kind: 'compare';
  left: CompareSide;
  right: CompareSide;
  answer: '<' | '>' | '=';
}

/** „2, 4, 6, ___, ___” — ciąg o stałym kroku z zakrytymi wyrazami. */
export interface SequenceProblem {
  kind: 'sequence';
  values: number[];
  /** Które wyrazy są zakryte; pierwszy zawsze widoczny. */
  hidden: boolean[];
  /** Różnica między kolejnymi wyrazami (ujemna dla ciągu malejącego). */
  step: number;
}

/** „___ ← 47 → ___” — poprzednik i następnik; `null` to pole, o które nie pytamy. */
export interface NeighborProblem {
  kind: 'neighbor';
  value: number;
  /** O ile w lewo i w prawo (1 to poprzednik i następnik, 10 to „o 10 mniej”). */
  step: number;
  before: number | null;
  after: number | null;
}

/** „parzyste: 3 8 5 12” — uczeń otacza liczby pasujące do polecenia. */
export interface MarkProblem {
  kind: 'mark';
  /** Czego szukamy — drukowane przed liczbami („parzyste”). */
  label: string;
  numbers: number[];
  marked: boolean[];
}

/**
 * Zegar: `read` — tarcza ze wskazówkami, uczeń wpisuje godzinę;
 * `draw` — podana godzina, uczeń dorysowuje wskazówki.
 */
export interface ClockProblem {
  kind: 'clock';
  hour: number;
  minute: number;
  mode: 'read' | 'draw';
  /** Godzina w zapisie, który trafia na arkusz („7:30”, „19:30”). */
  label: string;
  /** Czy rysować podziałkę minutową. */
  ticks: boolean;
}

/** „Ile to razem?” — monety i banknoty do zsumowania. */
export interface MoneyProblem {
  kind: 'money';
  /** Nominały w groszach, malejąco. */
  items: number[];
  total: number;
  /** Kwota w zapisie z arkusza odpowiedzi („12 zł 50 gr”). */
  label: string;
}

/** Oś liczbowa z równymi podziałkami i zakrytymi opisami. */
export interface NumberLineProblem {
  kind: 'numberline';
  values: number[];
  hidden: boolean[];
}

/** Element zapisu krokowego: liczba (może być zakryta), znak działania albo nawias. */
export type StepToken =
  | { kind: 'num'; value: number; hidden: boolean }
  | { kind: 'op'; text: string }
  | { kind: 'paren'; text: string };

/**
 * Działanie rozpisane na kroki: „8 + 5 = 8 + 2 + 3 = 10 + 3 = 13”.
 * Każdy krok ma tę samą wartość — zmienia się tylko zapis, a uczeń uzupełnia
 * zakryte liczby. Ile kroków zostaje na kartce, decyduje poziom rusztowania.
 */
export interface StepsProblem {
  kind: 'steps';
  steps: StepToken[][];
}

/** Kratka kolorowanki: działanie do policzenia i kolor, który oznacza jego wynik. */
export interface PixelCell {
  terms: number[];
  op: Operator;
  value: number;
  /** Indeks koloru w palecie zadania. */
  color: number;
}

/** Kolor z legendy kolorowanki. */
export interface PixelColor {
  name: string;
  css: string;
  /** Wynik działania, który każe pokolorować kratkę tym kolorem. */
  value: number;
}

/** Obrazek ukryty w kratkach — uczeń liczy działania i koloruje według wyniku. */
export interface PixelProblem {
  kind: 'pixel';
  width: number;
  cells: PixelCell[];
  palette: PixelColor[];
}

export type Problem =
  | InlineProblem
  | ColumnProblem
  | CrosswordProblem
  | CompareProblem
  | SequenceProblem
  | NeighborProblem
  | MarkProblem
  | ClockProblem
  | MoneyProblem
  | NumberLineProblem
  | StepsProblem
  | PixelProblem;

/** Część wspólna opisu pola konfiguracji. */
interface FieldBase {
  key: string;
  label: string;
  help?: string;
  /** Pole pokazywane tylko wtedy, gdy warunek jest spełniony (pola zależne). */
  showIf?: (cfg: Config) => boolean;
}

/** Opis pojedynczego pola konfiguracji — formularz renderuje się automatycznie. */
export type Field =
  | (FieldBase & {
      kind: 'number';
      min: number;
      max: number;
      step?: number;
    })
  | (FieldBase & {
      kind: 'boolean';
    })
  | (FieldBase & {
      kind: 'select';
      options: { value: string; label: string }[];
    })
  | (FieldBase & {
      /** Wczytanie obrazka (JPG/PNG) i zamiana go na siatkę kratek. */
      kind: 'image';
      /** Klucz pola liczbowego z szerokością siatki. */
      widthKey: string;
      /** Klucz pola liczbowego z liczbą kolorów. */
      colorsKey: string;
      /** Najwyższa dopuszczalna siatka — wyższe obrazki są przycinane proporcjonalnie. */
      maxHeight: number;
    })
  | (FieldBase & {
      /** Lista „ilość cyfr” — jedno pole na każdą liczbę w działaniu. */
      kind: 'digitsList';
      /** Klucz pola liczbowego, które określa długość listy. */
      countKey: string;
      min: number;
      max: number;
    });

export type Config = Record<string, unknown>;

export type FontSize = 'small' | 'normal' | 'large';
export type Spacing = 'tight' | 'normal' | 'loose';

/** Ustawienia arkusza wspólne dla wszystkich typów zadań. */
export interface SheetOptions {
  title: string;
  answers: boolean;
  /** Ile różnych zestawów zadań wydrukować (np. dla każdego ucznia inny). */
  variants: number;
  /** Linia na imię, nazwisko i datę pod tytułem. */
  nameLine: boolean;
  /** Numeracja zadań. */
  numbering: boolean;
  fontSize: FontSize;
  spacing: Spacing;
}

/** Domyślna wielkość arkusza dla danego typu zadań. */
export interface SheetDefaults {
  count: number;
  columns: number;
}

/**
 * Blok zadań na arkuszu: własna konfiguracja generatora i własna liczba zadań.
 * Dzięki temu jedna strona może mieć np. 20 uzupełnień do 10, a pod spodem
 * 20 uzupełnień do najbliższej dziesiątki.
 */
export interface Section {
  config: Config;
  count: number;
  /** Na ile kolumn rozłożyć zadania tego bloku. */
  columns: number;
  /** Nagłówek drukowany nad blokiem; pusty tekst oznacza brak nagłówka. */
  heading: string;
  /** Ramka z regułą i rozwiązanymi przykładami nad zadaniami bloku. */
  intro: boolean;
  /** Ile przykładów pokazać w ramce. */
  introCount: number;
}

/** Wyjaśnienie drukowane nad blokiem: reguła i rozwiązane przykłady. */
export interface Intro {
  rule: string;
  examples: Problem[];
}

/** Gotowy blok zadań przekazywany do arkusza. */
export interface SheetBlock {
  heading: string;
  columns: number;
  /** Ramka „jak to policzyć” nad zadaniami; `null`, gdy blok jej nie ma. */
  intro: Intro | null;
  problems: Problem[];
  /** Kratki na wynik i wiersz na przeniesienia — ustawienia z konfiguracji bloku. */
  grid: boolean;
  carryRow: boolean;
}

export interface GeneratorDef {
  id: string;
  title: string;
  description: string;
  /** Krótki wzór pokazywany na kafelku wyboru. */
  sample: string;
  fields: Field[];
  defaults: Config;
  /** Domyślna liczba zadań i kolumn dla tego typu. */
  sheetDefaults: SheetDefaults;
  /** Zwraca komunikat błędu, jeśli konfiguracja jest niewykonalna. */
  validate?: (cfg: Config) => string | null;
  /**
   * Reguła drukowana w ramce nad blokiem — jedno, dwa zdania o tym, jak liczyć.
   * Typy bez wyjaśnienia nie mają w formularzu opcji „wyjaśnienie i przykłady”.
   */
  explain?: (cfg: Config) => string | null;
  generate: (cfg: Config, count: number, rnd: Rnd) => Problem[];
}

/** Generator liczb losowych (wstrzykiwany, żeby dało się go później zseedować). */
export interface Rnd {
  /** Liczba całkowita z przedziału [min, max]. */
  int: (min: number, max: number) => number;
  pick: <T>(items: T[]) => T;
}
