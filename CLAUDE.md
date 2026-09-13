# Zadaniomat

Generator kart pracy z matematyki dla klas 1–3. Aplikacja w całości działa
po stronie przeglądarki (React + Vite, TypeScript); wydruk odbywa się przez
Ctrl+P, a układ A4 jest opisany w CSS, więc podgląd odpowiada wydrukowi 1:1.

## Gałęzie — to jest najważniejsze

- **`main` = wyłącznie produkcja.** Każdy push na tę gałąź automatycznie
  buduje projekt i publikuje go na https://tbitowt.github.io/Zadaniomat/
  (workflow `.github/workflows/deploy.yml`). Nie commituj tu bezpośrednio.
- **`develop` = gałąź robocza.** Tu powstają wszystkie zmiany. Na `main`
  trafiają dopiero wtedy, gdy są gotowe do opublikowania — świadomą decyzją,
  nie przy okazji.

Jeśli masz coś zacommitować, a aktualną gałęzią jest `main`, przełącz się
na `develop` albo zapytaj. Push na `main` jest równoznaczny z wdrożeniem.

## Polecenia

```bash
npm run dev      # serwer deweloperski, http://localhost:5173
npm run build    # produkcyjny build do dist/
npm run lint     # oxlint
npm run check    # weryfikacja poprawności generatorów
                 # (wymaga `npm run dev` na porcie 5199)
```

## Pułapki tego projektu

- **`base` w `vite.config.ts` jest warunkowy** — ustawiany na `/Zadaniomat/`
  tylko gdy zmienna `GITHUB_ACTIONS` jest ustawiona. Nie zmieniaj tego na
  wartość stałą: serwer deweloperski podawałby aplikację pod podkatalogiem,
  a `scripts/ui.mjs` puka do `http://localhost:5199/`, więc `npm run check`
  przestałby działać.
- **Wszystko z `public/` idzie 1:1 na produkcję** i staje się publicznie
  pobieralne pod adresem strony. Nie wrzucaj tam niczego roboczego.
- **`npm run check` nie jest częścią CI.** Workflow uruchamia tylko
  `tsc -b && vite build`, więc błąd w generatorze — czyli karta pracy
  z błędnym wynikiem — przejdzie build bez ostrzeżenia. Przy zmianach
  w `src/generators/` uruchom `npm run check` lokalnie.
- **Nieudany build nie psuje strony, tylko ją zamraża.** Zadanie `deploy`
  zostaje pominięte i na żywo zostaje poprzednia wersja. Po pushu na `main`
  warto sprawdzić zakładkę Actions.
- **Nowy generator to nie tylko wpis w `src/generators/index.ts`** — definicja
  musi też podać `subject`, `grades` i `category`, bo po nich filtruje
  przeglądarka (`src/catalog.ts`, `src/components/Picker.tsx`). Nowy dział
  dopisuje się do `CategoryId` w `src/types.ts` i do listy `categories`.
- **Zadania nie powtarzają się w obrębie bloku.** `collect()` w `src/generators/arithmetic.ts`
  odrzuca duplikaty i nie dokłada powtórki nawet wtedy, gdy brakuje zadań —
  wraca ich wtedy mniej, a formularz mówi o tym uczącemu pod polem „Liczba zadań”.
  Generator musi przyjąć czwarty parametr `seen` i podać go do `collect`; to jeden
  zestaw kluczy na blok (`buildPages` w `App.tsx`), dzięki któremu zadania nie
  powtarzają się nawzajem ani z przykładami z ramki. Kolejny blok dostaje nowy
  zestaw i może powtórzyć zadania poprzedniego. Klucz musi opisywać całe zadanie tak, jak widzi je
  uczeń — jeśli pominie ustawienie, które zmienia treść (krok, podziałkę),
  generator odrzuci zadania, które wcale się nie powtarzają.
- **`temp/`** to lokalne notatki robocze, poza kontrolą wersji.
