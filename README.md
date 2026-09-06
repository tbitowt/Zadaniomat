# Zadania matematyczne — generator kart pracy

Aplikacja webowa, która generuje gotowe do druku arkusze z zadaniami.
Wydruk odbywa się przez przeglądarkę (Ctrl+P → „Zapisz jako PDF”); układ A4
jest opisany w CSS, więc podgląd na ekranie odpowiada wydrukowi 1:1.

## Uruchomienie

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # wersja produkcyjna do katalogu dist/
npm run check    # weryfikacja poprawności generatorów (wymaga działającego npm run dev na porcie 5199)
```

## Dostępne rodzaje zadań

| Typ | Konfiguracja |
| --- | --- |
| Dodawanie w pamięci | ile liczb, ilość cyfr każdej z nich, minimalny i maksymalny wynik, przekraczanie progu, szukana liczba |
| Dodawanie pisemne | ile liczb, ilość cyfr, przeniesienia, kratki na wynik, wiersz na przeniesienia |
| Odejmowanie w pamięci | ile liczb, ilość cyfr, największa liczba, pożyczki, szukana liczba |
| Odejmowanie pisemne | cyfry odjemnej i odjemnika, pożyczki, kratki na wynik, wiersz na pożyczki |
| Mnożenie w pamięci | tabliczka mnożenia (zakres czynników) albo liczba cyfr czynników, maksymalny wynik, mnożenie przez 0 i 1, szukana liczba |
| Mnożenie pisemne | cyfry mnożnej i mnożnika, przeniesienia, wiersze na iloczyny częściowe, kratki na wynik, wiersz na przeniesienia |
| Dzielenie w pamięci | zakres dzielnika, największa dzielna, największy wynik, dzielenie przez 1, dzielenie z resztą, szukana liczba |
| Uzupełnianie do pełnej liczby | do ilu uzupełniamy (10, 20, 100, najbliższa dziesiątka, własna liczba), postać działania, która liczba zakryta |
| Porównywanie liczb | co porównujemy (liczby, działania), które działania, największa liczba, ile zadań ze znakiem „=” |
| Poprzednik i następnik | zakres liczb, o ile mniej i więcej, co uzupełnia uczeń |
| Liczby parzyste i nieparzyste | czego szukamy, zakres liczb, ile liczb w zadaniu |
| Ciągi liczbowe | długość ciągu, kierunek, zakres kroku, największa liczba, ile liczb zakryć i gdzie |
| Oś liczbowa | ile podziałek, co ile, największa liczba, ile liczb zakryć, czy oś zaczyna się od zera |
| Zegar — godziny | dokładność (godziny, pół, kwadranse, 5 minut, minuty), odczyt albo rysowanie wskazówek, zapis 12/24-godzinny, podziałka minutowa |
| Pieniądze — ile to razem? | czym płacimy (złote, grosze, jedno i drugie), banknoty, ile monet, największa kwota |
| Krzyżówki matematyczne | ile działań, które działania (+ − × :), największa liczba, co zakrywać (liczby, wyniki, znaki), ile kratek zakryć |

**Krzyżówka matematyczna** to działania `a ⚬ b = c` rozłożone poziomo i pionowo
i splecione ze sobą na wspólnych liczbach — tak jak słowa w zwykłej krzyżówce.
Uczeń uzupełnia puste kratki. Generator pilnuje trzech rzeczy: żadne działanie
nie jest wypisane w całości (każde ma co najmniej jedną niewiadomą), każdą
zakrytą kratkę da się wyliczyć krok po kroku z działania, w którym brakuje już
tylko jej, a zakryty znak zostaje zakryty tylko wtedy, gdy pasuje do niego
dokładnie jedno z wybranych działań. Suwak „ile kratek zakryć” steruje tym, co
ponad wymagane minimum — 100% to najwięcej, ile da się zakryć, nie tracąc
rozwiązywalności.

**Szukana liczba** pozwala zakryć wynik (`24 + 13 = ___`) albo jedną z liczb
działania (`24 + ___ = 37`); tryb „losowo” miesza jedno z drugim. Przy mnożeniu
czynnik nie zostanie zakryty, jeśli inny czynnik jest zerem — takie zadanie nie
miałoby jednego rozwiązania.

**Zegar** rysowany jest jako SVG: tarcza z godzinami, opcjonalną podziałką
minutową i wskazówkami. W trybie „odczytaj godzinę” wskazówki są narysowane, a
uczeń wpisuje godzinę pod tarczą; w trybie „narysuj wskazówki” jest odwrotnie —
godzina jest podpisana, a tarcza pusta. Arkusz odpowiedzi zawsze pokazuje
tarczę ze wskazówkami.

**Pieniądze** to monety (1, 2, 5, 10, 20, 50 gr oraz 1, 2, 5 zł) i banknoty
(10, 20, 50, 100 zł) rysowane w rzędzie do zsumowania. Kwoty liczone są w
groszach i zapisywane po polsku („12 zł 50 gr”), więc nie ma zaokrągleń.

**Oś liczbowa** ma równe podziałki i opisy pod nimi; odstęp podziałek dopasowuje
się do najdłuższej liczby, żeby opisy się nie zlewały. **Ciągi liczbowe** i
**oś** nigdy nie zakrywają pierwszej liczby, a w ciągu zostają co najmniej dwie
widoczne liczby — inaczej kroku nie dałoby się odczytać.

Wspólne ustawienia arkusza: tytuł, liczba kolumn, wielkość czcionki, odstępy
między zadaniami, liczba zestawów (każdy to osobna strona z innymi zadaniami),
numeracja zadań, miejsce na imię i datę, opcjonalny arkusz odpowiedzi
(drukowany na osobnej stronie) oraz ziarno losowania — ten sam numer odtwarza
dokładnie ten sam arkusz.

## Bloki zadań

Jeden arkusz może zawierać kilka bloków tego samego typu zadań, każdy z własną
konfiguracją, własną liczbą zadań i własnym nagłówkiem — na przykład 20
uzupełnień do 10, a pod spodem 20 uzupełnień do najbliższej dziesiątki, albo
osiem zegarów do odczytania i osiem do narysowania wskazówek. „Dodaj blok
zadań" powiela ostatni blok, bo zwykle zmienia się w nim tylko jedno
ustawienie; strzałki zmieniają kolejność bloków.

Numeracja biegnie przez całą stronę, a nie od nowa w każdym bloku. Szerokość
pola na odpowiedź liczona jest raz dla całej strony, więc pola we wszystkich
blokach są równe i nie podpowiadają, ile cyfr ma wynik. Bloki losowane są po
kolei z jednego generatora liczb losowych, więc ziarno nadal odtwarza całą
stronę.

Wyniki nigdy nie są ujemne, a zadania w obrębie arkusza nie powtarzają się.
Liczba kratek na wynik wynika z konfiguracji, a nie z konkretnego wyniku —
dzięki temu nie zdradza odpowiedzi.

## Jak dodać nowy typ zadań

1. Utwórz `src/generators/<nazwa>.ts` i wyeksportuj obiekt `GeneratorDef`
   (`src/types.ts`): `id`, `title`, `description`, `sample`, `fields`,
   `defaults`, `sheetDefaults`, opcjonalnie `validate`, oraz `generate`.
2. `fields` opisuje formularz deklaratywnie (`number`, `boolean`, `select`,
   `digitsList`) — `ConfigForm` renderuje go automatycznie. Pole z `showIf`
   pokazuje się tylko wtedy, gdy warunek na konfiguracji jest spełniony
   (tak działa np. przełączanie trybu w mnożeniu w pamięci).
3. `generate(config, count, rnd)` zwraca listę zadań: `inline` (jedna linia),
   `column` (słupek) lub `crossword` (krzyżówka). Losowość bierz wyłącznie
   z `rnd`, żeby ten sam arkusz dało się odtworzyć.
4. Dopisz generator do tablicy w `src/generators/index.ts`.

W zadaniu `inline` pole `blankIndex` wskazuje zakrytą liczbę (`-1` to wynik),
`result` to wartość działania, a `answer` to liczba, którą wpisuje uczeń.
W zadaniu `column` opcjonalne `partials` to iloczyny częściowe (bez
przesunięcia — wiersz `j` rysowany jest przesunięty o `j` pozycji).
Zadanie `crossword` to prostokątna tablica kratek (`null` poza krzyżówką);
każda kratka to liczba, znak działania albo „=”, a liczby i znaki niosą flagę
`hidden`.

Wariantów zadań jest więcej niż trzy: `inline`, `column`, `crossword`,
`compare`, `sequence`, `neighbor`, `mark`, `clock`, `money` i `numberline`.
Jeśli nowy typ nie mieści się w żadnym z nich, dodaj wariant do `Problem`
w `src/types.ts`, jego komponent w `src/components/Worksheet.tsx` i atrybuty
`data-*` w `problemData` — z nich korzystają skrypty sprawdzające wydruk.
Rysunki (zegar, monety, oś) to inline'owy SVG stylowany w `sheet.css`, więc
skalują się razem z ustawieniem wielkości czcionki arkusza.

## Struktura

```
src/
  types.ts                 wspólne typy (zadania, pola konfiguracji, GeneratorDef)
  rng.ts                   deterministyczny generator liczb losowych
  generators/
    arithmetic.ts          dobór liczb: limity, przeniesienia, pożyczki, dzielenie, niewiadoma
    crossword.ts           układanie i zakrywanie splecionych krzyżówek
    helpers.ts             funkcje pomocnicze (cyfry, przeniesienia, losowanie, odczyt konfiguracji)
    index.ts               rejestr typów zadań
  components/
    ConfigForm.tsx         formularz budowany z opisu pól, blok po bloku
    Worksheet.tsx          arkusz (bloki zadań) + arkusz odpowiedzi
  styles/
    app.css                interfejs aplikacji
    sheet.css              arkusz i reguły @media print
scripts/
  ui.mjs                   pomocniki: formularz, odczyt krzyżówek z wydruku
  check-answers.mjs        czy wydrukowane odpowiedzi zgadzają się z działaniami
  check-constraints.mjs    czy zadania mieszczą się w zadanych ograniczeniach
```
