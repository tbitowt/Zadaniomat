// Wdrożenie: przenosi gotowe zmiany z develop na main, czyli publikuje stronę.
// Każdy push na main uruchamia GitHub Pages, więc scalenie jest tu świadomą
// decyzją, a nie efektem ubocznym — stąd komplet zabezpieczeń przed startem.
import { execFileSync } from 'node:child_process';

const DRY_RUN = process.argv.includes('--dry-run');
const ROBOCZA = 'develop';
const PRODUKCYJNA = 'main';
const ADRES = 'https://tbitowt.github.io/Zadaniomat/';
const AKCJE = 'https://github.com/tbitowt/Zadaniomat/actions';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

const krok = (tekst) => console.log(`\n\u2192 ${tekst}`);
const ok = (tekst) => console.log(`  \u2713 ${tekst}`);

function przerwij(powod, rada) {
  console.error(`\n\u2717 Wdrożenie przerwane: ${powod}`);
  if (rada) console.error(`  ${rada}`);
  process.exit(1);
}

function wykonaj(opis, fn) {
  if (DRY_RUN) {
    console.log(`  [dry-run] pominięto: ${opis}`);
    return null;
  }
  return fn();
}

if (DRY_RUN) console.log('TRYB PRÓBNY — nic nie zostanie scalone ani wypchnięte.');

// 1. Czyste drzewo. Bez tego przełączanie gałęzi przenosiłoby zmiany w poprzek.
krok('Sprawdzam stan katalogu roboczego');
if (git('status', '--porcelain') !== '') {
  przerwij(
    'w katalogu roboczym są niezapisane zmiany',
    'Zacommituj je albo odłóż przez `git stash`, potem spróbuj ponownie.',
  );
}
ok('czysto');

// 2. Właściwa gałąź.
krok('Sprawdzam gałąź');
const biezaca = git('rev-parse', '--abbrev-ref', 'HEAD');
if (biezaca !== ROBOCZA) {
  przerwij(
    `jesteś na gałęzi "${biezaca}", a wdrażamy z "${ROBOCZA}"`,
    `Przełącz się: git switch ${ROBOCZA}`,
  );
}
ok(biezaca);

// 3. Build musi przejść LOKALNIE. Gdy build padnie na CI, zadanie deploy jest
//    pomijane i na stronie zostaje poprzednia wersja — bez żadnego sygnału.
//    Lepiej dowiedzieć się tutaj niż patrzeć na zamrożoną produkcję.
krok('Buduję projekt (to samo, co zrobi CI)');
try {
  execFileSync('npm', ['run', 'build'], { stdio: 'pipe', shell: true });
} catch (e) {
  console.error(e.stdout?.toString() ?? '');
  console.error(e.stderr?.toString() ?? '');
  przerwij('build się nie powiódł', 'Napraw błędy — inaczej CI też ich nie przepuści.');
}
ok('build przechodzi');

// 4. Synchronizacja z serwerem, żeby ocena scalenia opierała się na aktualnych danych.
krok('Pobieram stan zdalny');
git('fetch', 'origin', '--quiet');
ok('pobrano');

const zaległe = git('rev-list', '--count', `origin/${ROBOCZA}..${ROBOCZA}`);
if (zaległe !== '0') {
  console.log(`  uwaga: ${zaległe} commit(ów) na ${ROBOCZA} jeszcze nie wysłano — wyślę je przy okazji`);
}

// 5. Czy w ogóle jest co wdrażać.
krok('Sprawdzam różnicę względem produkcji');
const doWdrozenia = git('rev-list', '--count', `origin/${PRODUKCYJNA}..${ROBOCZA}`);
if (doWdrozenia === '0') {
  console.log(`\n  Nie ma czego wdrażać — ${PRODUKCYJNA} zawiera już wszystko z ${ROBOCZA}.`);
  process.exit(0);
}
console.log(git('log', '--oneline', `origin/${PRODUKCYJNA}..${ROBOCZA}`).replace(/^/gm, '    '));
ok(`${doWdrozenia} commit(ów) do opublikowania`);

// 6. main nie może mieć nic, czego nie ma develop — inaczej scalenie zrobiłoby
//    merge commit albo konflikt. Wymuszamy fast-forward.
const rozbieznosc = git('rev-list', '--count', `${ROBOCZA}..origin/${PRODUKCYJNA}`);
if (rozbieznosc !== '0') {
  przerwij(
    `${PRODUKCYJNA} ma ${rozbieznosc} commit(ów), których nie ma na ${ROBOCZA}`,
    `Najpierw pobierz je na gałąź roboczą: git switch ${ROBOCZA} && git merge origin/${PRODUKCYJNA}`,
  );
}

// 7. Wdrożenie. Od tego miejsca cofamy się na gałąź roboczą także przy błędzie.
krok(`Scalam ${ROBOCZA} → ${PRODUKCYJNA} i publikuję`);
wykonaj(`git switch ${PRODUKCYJNA}`, () => git('switch', PRODUKCYJNA));
try {
  wykonaj('git merge --ff-only', () => git('merge', '--ff-only', ROBOCZA));
  wykonaj('git push', () => git('push', 'origin', PRODUKCYJNA));
  ok('wypchnięto na produkcję');
} catch (e) {
  wykonaj('powrót na gałąź roboczą', () => git('switch', ROBOCZA));
  przerwij(e.message.split('\n')[0], 'Produkcja nie została zmieniona.');
} finally {
  wykonaj(`git switch ${ROBOCZA}`, () => git('switch', ROBOCZA));
}

// Gałąź robocza też ma być wysłana, żeby nie została tylko lokalnie.
wykonaj(`git push origin ${ROBOCZA}`, () => git('push', 'origin', ROBOCZA));

console.log(`\nGotowe. Wdrożenie trwa 1–2 minuty.`);
console.log(`  Postęp: ${AKCJE}`);
console.log(`  Strona: ${ADRES}`);
console.log(`\nPrzypomnienie: CI nie uruchamia \`npm run check\`. Jeśli zmieniałeś`);
console.log(`generatory, sprawdź je lokalnie — błędny wynik na karcie pracy`);
console.log(`przejdzie build bez ostrzeżenia.`);
