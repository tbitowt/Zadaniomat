---
name: wdrozenie
description: Publikuje Zadaniomat na produkcję — scala develop na main, co uruchamia GitHub Pages. Użyj, gdy użytkownik prosi o wdrożenie, publikację, wypuszczenie zmian na stronę, "wypchnij na produkcję" albo pyta, czy zmiany są już widoczne na żywo.
---

# Wdrożenie Zadaniomata

`main` jest gałęzią produkcyjną: każdy push publikuje stronę pod
https://tbitowt.github.io/Zadaniomat/. Praca odbywa się na `develop`.
Wdrożenie to świadome scalenie jednej w drugą.

## Zanim wdrożysz

Jeśli użytkownik zmieniał cokolwiek w `src/generators/`, zaproponuj
uruchomienie `npm run check` — CI tego nie robi, więc karta pracy z błędnym
wynikiem przejdzie build bez ostrzeżenia. Wymaga to `npm run dev` na porcie
5199 w tle.

Nie wdrażaj bez wyraźnej prośby. Sam commit na `develop` nie jest zgodą
na publikację.

## Wdrożenie

```bash
npm run deploy
```

Skrypt (`scripts/publish.mjs`) sam pilnuje warunków: czystego drzewa,
właściwej gałęzi, przechodzącego buildu oraz tego, że scalenie da się zrobić
przez fast-forward. Gdy któryś warunek nie jest spełniony, przerywa i pisze,
co poprawić — nie obchodź tych zabezpieczeń i nie wykonuj scalenia ręcznie
poleceniami gita. Jeśli skrypt odmawia, napraw przyczynę albo zapytaj.

Przydatne przy pokazywaniu, co się wydarzy, bez wdrażania:

```bash
node scripts/publish.mjs --dry-run
```

## Po wdrożeniu — zweryfikuj, nie zakładaj

Push kończy się natychmiast, ale publikacja trwa 1–2 minuty i **może się nie
udać już po pushu**. Nie meldują sukcesu, dopóki tego nie sprawdzisz.

Status przebiegu (repo jest publiczne, więc bez uwierzytelniania):

```bash
curl -s "https://api.github.com/repos/tbitowt/Zadaniomat/actions/runs?per_page=1" \
  | grep -E '"head_branch"|"status"|"conclusion"'
```

Gdy przebieg się zakończy, potwierdź samą stroną:

```bash
curl -s -o /dev/null -w "%{http_code}\n" "https://tbitowt.github.io/Zadaniomat/"
```

Uwaga: `GET /repos/tbitowt/Zadaniomat/pages` **nie nadaje się** do tej
weryfikacji — wymaga uwierzytelnienia i zwraca 404 także wtedy, gdy witryna
działa poprawnie.

## Gdy deploy padnie

Nieudany build nie psuje strony, tylko ją zamraża: zadanie `deploy` zostaje
pominięte i na żywo zostaje poprzednia wersja. Powiedz o tym użytkownikowi
wprost — łatwo wtedy uwierzyć, że zmiana jest opublikowana, gdy nie jest.
Logi nieudanego przebiegu wymagają uwierzytelnienia, więc jeśli przyczyna nie
wynika z nazw kroków, poproś użytkownika o zajrzenie w zakładkę Actions.
