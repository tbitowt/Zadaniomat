// Pomocniki do sterowania formularzem — etykiety bywają swoimi podłańcuchami
// („Przeniesienia” i „Wiersz na przeniesienia”), więc szukamy pola po typie
// kontrolki wewnątrz pasującej etykiety.
export const APP_URL = 'http://localhost:5199/';

const field = (page, label) => page.locator('label.field', { hasText: label });

export const setSelect = (page, label, value) =>
  field(page, label).locator('select').first().selectOption(value);

export const setNumber = (page, label, value) =>
  field(page, label).locator('input[type=number]').first().fill(String(value));

export const toggle = (page, label) => field(page, label).locator('input[type=checkbox]').first().click();

/** Otwiera edytor wybranego rodzaju zadań. */
export async function openCard(page, card) {
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.getByText(card, { exact: true }).first().click();
}

/**
 * Odczyt krzyżówek z arkusza: dla każdej siatka {t, v, hidden, text} wiersz po
 * wierszu (null poza krzyżówką) oraz liczba działań zapisana przez generator.
 */
export const readCrosswords = (page, sel) => page.$$eval(sel, (els) => els.map((el) => {
  const w = Number(el.dataset.w);
  const flat = [...el.querySelectorAll('.cw-gap, .cw-cell')].map((c) => (
    c.dataset.t ? { t: c.dataset.t, v: c.dataset.v, hidden: c.dataset.h === '1', text: c.textContent.trim() } : null
  ));
  const rows = [];
  for (let i = 0; i < flat.length; i += w) rows.push(flat.slice(i, i + w));
  return { rows, eqs: Number(el.dataset.eqs) };
}));

export const applyOp = (op, a, b) => {
  if (op === '+') return a + b;
  if (op === '-') return a - b;
  if (op === '×') return a * b;
  return b !== 0 && a % b === 0 ? a / b : null;
};

/** Wszystkie ciągi kratek „liczba znak liczba = liczba” w obu kierunkach. */
export function findEquations(rows) {
  const at = (r, c) => (rows[r] && rows[r][c]) || null;
  const out = [];
  const pattern = ['n', 'o', 'n', 'e', 'n'];
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[0].length; c++) {
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const cells = pattern.map((_, i) => at(r + dr * i, c + dc * i));
        if (cells.some((x, i) => !x || x.t !== pattern[i])) continue;
        if (at(r - dr, c - dc) || at(r + dr * 5, c + dc * 5)) continue;
        out.push({
          keys: [0, 1, 2, 4].map((i) => `${r + dr * i},${c + dc * i}`),
          a: Number(cells[0].v), op: cells[1].v, b: Number(cells[2].v), c: Number(cells[4].v),
        });
      }
    }
  }
  return out;
}

