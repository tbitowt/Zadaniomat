import { IMAGE_COLORS, PALETTE } from './pixelArt';

/** Obrazek sprowadzony do siatki kratek — dokładnie to, czego potrzebuje kolorowanka. */
export interface Picture {
  name: string;
  /** Oryginał w postaci data URL, żeby dało się przeliczyć obrazek po zmianie ustawień. */
  src: string;
  /** O tyle kratek poproszono w formularzu — po tym widać, że podgląd jest nieaktualny. */
  asked: number;
  width: number;
  height: number;
  /** Ile kolorów zostawiono. */
  colors: number;
  rows: string[];
}

type Rgb = [number, number, number];
/** Kolor w OKLab: [jasność, oś zielony↔czerwony, oś niebieski↔żółty]. */
type Lab = [number, number, number];

const srgb = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

function toLab(r: number, g: number, b: number): Lab {
  const R = srgb(r);
  const G = srgb(g);
  const B = srgb(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

const rgbOf = (css: string): Rgb => [
  parseInt(css.slice(1, 3), 16),
  parseInt(css.slice(3, 5), 16),
  parseInt(css.slice(5, 7), 16),
];

const labOf = (css: string): Lab => toLab(...rgbOf(css));

const distance = (a: Lab, b: Lab) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

/** Nasycenie koloru — po nim poznajemy piksel rysunku, a nie szarego cienia. */
const chroma = (lab: Lab) => Math.hypot(lab[1], lab[2]);

/** Odcień jako kąt; różnicę liczymy po krótszej stronie koła barw. */
const hue = (lab: Lab) => Math.atan2(lab[2], lab[1]);
const hueGap = (a: number, b: number) => {
  const d = Math.abs(a - b) % (2 * Math.PI);
  return (d > Math.PI ? 2 * Math.PI - d : d) / Math.PI;
};

const LAB: Record<string, Lab> = Object.fromEntries(
  Object.entries(PALETTE).map(([ch, c]) => [ch, labOf(c.css)]),
);

/** Poniżej tej jasności kolor jest już tylko konturem albo cieniem. */
const DARK = 0.27;

/**
 * Ile nasycenia musi mieć kolor, żeby dostał kredkę zamiast bieli. Jasne
 * kolory potrzebują go więcej: pastelowy błękit na papierze i tak czyta się
 * jak biel, a pomalowany na niebiesko zlałby się z rysunkiem.
 */
const colorful = (lab: Lab) => chroma(lab) > 0.03 + 0.3 * Math.max(0, lab[0] - 0.65);

/**
 * Kredki są nasycone, obrazki zwykle nie, więc szukanie po prostu najbliższego
 * koloru palety wpycha wszystko w szarość: przygaszony błękit rysunku ma bliżej
 * do szarego niż do niebieskiego. Dlatego najpierw rozstrzygamy, czy kolor jest
 * w ogóle kolorowy, a dopiero potem dobieramy odcień — jasność tylko rozsądza
 * między kredkami o tym samym odcieniu (pomarańczową i brązową).
 */
const HUES = IMAGE_COLORS.filter((ch) => ch !== 's').map((ch) => ({
  ch,
  h: hue(LAB[ch]),
  l: LAB[ch][0],
}));
const LIGHTNESS_WEIGHT = 0.8;

function classify(lab: Lab): string {
  if (lab[0] < DARK) return 'k';
  if (!colorful(lab)) return lab[0] > 0.78 ? '.' : 's';
  const h = hue(lab);
  let best = HUES[0];
  let bestScore = Infinity;
  for (const c of HUES) {
    const score = hueGap(h, c.h) ** 2 + LIGHTNESS_WEIGHT * (lab[0] - c.l) ** 2;
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best.ch;
}

/**
 * Waga piksela przy głosowaniu w kratce. Kontur, biały pyszczek czy brzuch
 * zajmują mało miejsca, więc przy zwykłej większości znikają pod barwą dookoła
 * — a to właśnie one niosą kształt. Dlatego kontur ma głos najmocniejszy, tło
 * najsłabszy, a biel wewnątrz rysunku liczy się więcej niż biel tła.
 */
const WEIGHT: Record<string, number> = { '.': 1.5, s: 1.3, k: 2.4 };
const BACKGROUND_WEIGHT = 1;
const weightOf = (ch: string) => WEIGHT[ch] ?? 1.8;

/** Najbliższa kredka spośród podanych — używane przy zmniejszaniu palety. */
const nearest = (lab: Lab, chars: string[]) =>
  chars.reduce((best, ch) => (distance(lab, LAB[ch]) < distance(lab, LAB[best]) ? ch : best));

interface Pixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Szerokość robocza: na niej odcinamy tło i uśredniamy kratki. */
const WORK_WIDTH = 640;

/** Powyżej tej jasności piksel jest już czystą kartką. */
const PAPER = 0.85;

/** Ile w pikselu jest tuszu: 0 dla bieli, 1 dla czerni. */
const inkOf = (lightness: number) => Math.min(1, Math.max(0, (PAPER - lightness) / PAPER));

/** O tyle kratka musi przebijać tuszem swoje otoczenie, żeby wyszła na czarno. */
const INK_CONTRAST = 1.05;

/** Najmniejszy udział tuszu w kratce, przy którym w ogóle bierzemy ją pod uwagę. */
const INK_FLOOR = 0.02;

/** Jak blisko koloru ramki musi być piksel brzegu, żeby zacząć od niego zalewanie. */
const SEED_TOLERANCE = 0.02;

/**
 * O tyle może różnić się sąsiedni piksel, żeby wciąż był tym samym tłem.
 * Próg jest celowo ciasny: łagodna plama akwareli i tak zmienia się między
 * sąsiednimi pikselami o wiele mniej, a przy luźniejszym progu zalewanie
 * potrafi przejść przez miękko cieniowany kontur i zjeść pół rysunku.
 */
const STEP_TOLERANCE = 0.0004;

/** Powyżej tego udziału po obrazku nie zostaje już nic do pokolorowania. */
const MAX_BACKGROUND = 0.985;

/** Jak gęsto rysunek musi wypełniać swój prostokąt, żeby uznać go za rysunek. */
const MIN_SOLIDITY = 0.2;

/** Obraz przygotowany do dalszej pracy: kolory w OKLab i wskazane tło. */
interface Work {
  labs: Float32Array;
  width: number;
  height: number;
  /** 1 = piksel jest tłem, nie rysunkiem. */
  background: Uint8Array;
  /** Czy to gotowa kolorowanka: biała kartka i same kreski. */
  lineArt: boolean;
}

const labAt = (labs: Float32Array, i: number): Lab => [labs[i * 3], labs[i * 3 + 1], labs[i * 3 + 2]];

const gap = (labs: Float32Array, i: number, j: number) =>
  (labs[i * 3] - labs[j * 3]) ** 2 +
  (labs[i * 3 + 1] - labs[j * 3 + 1]) ** 2 +
  (labs[i * 3 + 2] - labs[j * 3 + 2]) ** 2;

/** Najmniejszy udział w rysunku, przy którym osobna plamka trafia do kadru. */
const MIN_ISLAND = 0.01;

/**
 * Spójne kawałki rysunku wraz z ich rozmiarami. Sąsiedztwo jest ośmiokierunkowe,
 * bo ukośna kreska styka się tylko rogami i inaczej rozpadłaby się na okruchy.
 */
function islands(background: Uint8Array, width: number, height: number) {
  const label = new Int32Array(background.length).fill(-1);
  const sizes: number[] = [];
  const stack: number[] = [];
  for (let start = 0; start < background.length; start++) {
    if (background[start] || label[start] >= 0) continue;
    const id = sizes.length;
    let size = 0;
    label[start] = id;
    stack.push(start);
    while (stack.length) {
      const i = stack.pop() as number;
      size++;
      const x = i % width;
      const y = (i - x) / width;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const j = ny * width + nx;
          if (background[j] || label[j] >= 0) continue;
          label[j] = id;
          stack.push(j);
        }
      }
    }
    sizes.push(size);
  }
  return { label, sizes };
}

/**
 * Prostokąt samego rysunku. Bez przycięcia obrazek z szerokim marginesem oddaje
 * na rysunek ledwie część kratek i nie da się go poznać. Drobne wysepki — znak
 * wodny w rogu, iskierka na tle — pomijamy: rozciągają kadr, a same i tak nie
 * zmieszczą się w kratce.
 */
function subjectBox(background: Uint8Array, width: number, height: number): Box {
  const { label, sizes } = islands(background, width, height);
  const total = sizes.reduce((a, b) => a + b, 0);
  const big = sizes.map((n) => n >= total * MIN_ISLAND);
  const counts = big.some(Boolean) ? big : sizes.map(() => true);

  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const id = label[y * width + x];
      if (id < 0 || !counts[id]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < x0 || y1 < y0) return { x: 0, y: 0, w: width, h: height };
  // margines, żeby rysunek nie dotykał krawędzi siatki
  const pad = Math.round(Math.min(width, height) * 0.02);
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(width - 1, x1 + pad);
  y1 = Math.min(height - 1, y1 + pad);
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/**
 * Tło odcinamy zalewaniem od krawędzi: piksel dołącza do tła wtedy, gdy różni
 * się od sąsiada tylko odrobinę. Dzięki temu zalewanie przechodzi przez
 * akwarelową plamę albo cieniowanie — gdzie kolor zmienia się łagodnie — a
 * zatrzymuje się na konturze rysunku, gdzie zmienia się skokowo. Bez tego
 * pstrokate tło zostaje pokolorowane razem z rysunkiem i wszystko się zlewa.
 *
 * Zwraca `null`, gdy wynik nie wygląda na tło: albo nie zostało nic, albo to,
 * co zostało, jest garścią rozsypanych plamek zamiast zwartego rysunku. Tak
 * właśnie kończy się zalewanie zdjęcia, na którym tła po prostu nie ma —
 * wtedy lepiej nie wycinać niczego.
 */
function backgroundMask(labs: Float32Array, clear: Uint8Array, width: number, height: number) {
  const mask = new Uint8Array(width * height);
  const stack: number[] = [];
  let filled = 0;
  const add = (i: number) => {
    if (mask[i]) return;
    mask[i] = 1;
    filled++;
    stack.push(i);
  };

  // przezroczystość to tło z definicji
  for (let i = 0; i < clear.length; i++) if (clear[i]) add(i);

  // z brzegu bierzemy tylko piksele w kolorze ramki: gdy rysunek dotyka
  // krawędzi, nie chcemy zacząć zalewania od samego rysunku
  const border: number[] = [];
  for (let x = 0; x < width; x++) {
    border.push(x, (height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    border.push(y * width, y * width + width - 1);
  }
  const opaque = border.filter((i) => !clear[i]);
  if (opaque.length) {
    const mid = (k: 0 | 1 | 2) =>
      opaque.map((i) => labs[i * 3 + k]).sort((a, b) => a - b)[opaque.length >> 1];
    const frame: Lab = [mid(0), mid(1), mid(2)];
    for (const i of opaque) if (distance(labAt(labs, i), frame) <= SEED_TOLERANCE) add(i);
  }

  while (stack.length) {
    const i = stack.pop() as number;
    // przezroczysty piksel ma w canvasie czarne RGB, więc porównywanie po nim
    // kolorów wpuściłoby zalewanie prosto w ciemny kontur rysunku
    if (clear[i]) continue;
    const x = i % width;
    const y = (i - x) / width;
    if (x > 0 && !mask[i - 1] && gap(labs, i, i - 1) <= STEP_TOLERANCE) add(i - 1);
    if (x < width - 1 && !mask[i + 1] && gap(labs, i, i + 1) <= STEP_TOLERANCE) add(i + 1);
    if (y > 0 && !mask[i - width] && gap(labs, i, i - width) <= STEP_TOLERANCE) add(i - width);
    if (y < height - 1 && !mask[i + width] && gap(labs, i, i + width) <= STEP_TOLERANCE) add(i + width);
  }
  if (filled > width * height * MAX_BACKGROUND) return null;
  const box = subjectBox(mask, width, height);
  return width * height - filled < box.w * box.h * MIN_SOLIDITY ? null : mask;
}

/**
 * Rysunek konturowy to gotowa kolorowanka: biała kartka i czarne kreski, bez
 * ani jednego koloru. Takiego obrazka nie wolno traktować jak kolorowego —
 * kreska zajmuje ułamek kratki i w głosowaniu przegrywa z bielą, więc cały
 * rysunek znika, a zostają tylko zamalowane na czarno oczy.
 */
function looksLikeLineArt(labs: Float32Array, clear: Uint8Array, count: number) {
  let paper = 0;
  let colored = 0;
  for (let i = 0; i < count; i++) {
    if (clear[i] || labs[i * 3] > PAPER) paper++;
    else if (colorful(labAt(labs, i))) colored++;
  }
  return paper > count * 0.6 && colored < count * 0.02;
}

/** Obrazek przeliczony na OKLab wraz z maską tła. */
function analyse({ data, width, height }: Pixels): Work {
  const count = width * height;
  const labs = new Float32Array(count * 3);
  const clear = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    const p = i * 4;
    const lab = toLab(data[p], data[p + 1], data[p + 2]);
    labs[i * 3] = lab[0];
    labs[i * 3 + 1] = lab[1];
    labs[i * 3 + 2] = lab[2];
    if (data[p + 3] < 128) clear[i] = 1;
  }
  const lineArt = looksLikeLineArt(labs, clear, count);
  // w rysunku konturowym tłem jest po prostu kartka — zalewanie nic tu nie wnosi,
  // a przez cienkie kreski i tak by przeciekło
  const background = new Uint8Array(count);
  if (lineArt) {
    for (let i = 0; i < count; i++) if (clear[i] || labs[i * 3] > PAPER) background[i] = 1;
  } else {
    background.set(backgroundMask(labs, clear, width, height) ?? background);
  }
  return { labs, width, height, background, lineArt };
}

/**
 * Kratki rysunku konturowego: liczy się ilość tuszu, nie większość pikseli.
 * Próg dobieramy z samego obrazka — z mediany zabrudzonych kratek — więc
 * kreska zostaje kreską niezależnie od tego, jak gruba była w oryginale
 * i na ile kratek dzielimy rysunek. Mediana, a nie średnia, bo duże czarne
 * plamy (oczy) inaczej podniosłyby próg i zjadły cienkie kreski.
 */
function inkChars(work: Work, box: Box, width: number, height: number): string[] {
  const ink: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [x0, x1, y0, y1] = cellBounds(box, x, y, width, height);
      let sum = 0;
      let n = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          sum += inkOf(work.labs[(sy * work.width + sx) * 3]);
          n++;
        }
      }
      ink.push(n ? sum / n : 0);
    }
  }
  // próg liczony lokalnie: w gęstwinie kresek (pysk, zęby) czernią się tylko te
  // kratki, które przebijają otoczenie, a pojedyncza kreska na pustej kartce
  // wychodzi nawet wtedy, gdy tuszu ma niewiele
  const r = Math.max(1, Math.round(width / 16));
  return ink.map((v, i) => {
    const x = i % width;
    const y = (i - x) / width;
    let sum = 0;
    let n = 0;
    for (let dy = Math.max(0, y - r); dy <= Math.min(height - 1, y + r); dy++) {
      for (let dx = Math.max(0, x - r); dx <= Math.min(width - 1, x + r); dx++) {
        sum += ink[dy * width + dx];
        n++;
      }
    }
    return v >= Math.max(INK_FLOOR, (sum / n) * INK_CONTRAST) ? 'k' : '.';
  });
}

/** Wycinek obrazka przypadający na jedną kratkę siatki. */
function cellBounds(box: Box, x: number, y: number, width: number, height: number) {
  const x0 = Math.floor((x * box.w) / width);
  const y0 = Math.floor((y * box.h) / height);
  return [
    box.x + x0,
    box.x + Math.max(x0 + 1, Math.floor(((x + 1) * box.w) / width)),
    box.y + y0,
    box.y + Math.max(y0 + 1, Math.floor(((y + 1) * box.h) / height)),
  ] as const;
}

/**
 * Kolor każdej kratki: nie średnia z jej pikseli, tylko zwycięzca głosowania,
 * w którym kolorowe i ciemne piksele ważą więcej. Uśrednianie robi wokół
 * kształtów szarą obwódkę, a zwykła większość gubi kontury.
 */
function cellChars(work: Work, box: Box, width: number, height: number): string[] {
  const out: string[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [x0, x1, y0, y1] = cellBounds(box, x, y, width, height);
      const votes = new Map<string, number>();
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = sy * work.width + sx;
          const bg = work.background[i] === 1;
          const ch = bg ? '.' : classify(labAt(work.labs, i));
          votes.set(ch, (votes.get(ch) ?? 0) + (bg ? BACKGROUND_WEIGHT : weightOf(ch)));
        }
      }
      out.push([...votes.entries()].sort((a, b) => b[1] - a[1])[0][0]);
    }
  }
  return out;
}

/**
 * Zostawia tylko kolory najważniejsze, a resztę przyciąga do najbliższego
 * z nich. O wadze koloru nie decyduje sama liczba kratek: kontur zajmuje ich
 * mało, a bez niego rysunek się rozpada, więc czerń i mocne barwy liczą się
 * podwójnie. Biel zostaje tłem, którego się nie koloruje.
 */
export function reduceColors(chars: string[], width: number, height: number, maxColors: number): string[] {
  const counts = new Map<string, number>();
  for (const ch of chars) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  const score = (ch: string, n: number) => n * (ch === 'k' ? 2 : 1 + chroma(LAB[ch]));
  const kept = [...counts.entries()]
    .filter(([ch]) => ch !== '.')
    .sort((a, b) => score(b[0], b[1]) - score(a[0], a[1]))
    .slice(0, maxColors)
    .map(([ch]) => ch);
  const palette = counts.has('.') ? ['.', ...kept] : kept.length ? kept : ['.'];
  const remap = new Map<string, string>();
  for (const ch of counts.keys()) {
    remap.set(ch, palette.includes(ch) ? ch : nearest(LAB[ch], palette));
  }

  const rows: string[] = [];
  for (let y = 0; y < height; y++) {
    rows.push(
      chars
        .slice(y * width, (y + 1) * width)
        .map((ch) => remap.get(ch) ?? '.')
        .join(''),
    );
  }
  return rows;
}

const load = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('nie udało się wczytać obrazka'));
    image.src = src;
  });

/** Obrazek przerysowany na canvas w rozdzielczości roboczej i odczytany jako piksele. */
function sample(image: HTMLImageElement, target: number): Pixels {
  const width = Math.max(1, Math.min(image.width, target));
  const height = Math.max(1, Math.round((width * image.height) / image.width));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('brak kontekstu 2D');
  ctx.drawImage(image, 0, 0, width, height);
  return { data: ctx.getImageData(0, 0, width, height).data, width, height };
}

/** Wczytanie obrazka z data URL i zamiana go na siatkę o zadanej szerokości. */
export async function pictureFromSource(
  src: string,
  name: string,
  width: number,
  maxHeight: number,
  colors: number,
): Promise<Picture> {
  const image = await load(src);
  const work = analyse(sample(image, WORK_WIDTH));
  const box = subjectBox(work.background, work.width, work.height);
  // wysoki obrazek zwężamy, zamiast go przycinać do maksymalnej wysokości —
  // inaczej rysunek wyszedłby spłaszczony
  let cols = width;
  let height = Math.max(1, Math.round((width * box.h) / box.w));
  if (height > maxHeight) {
    height = maxHeight;
    cols = Math.max(4, Math.round((height * box.w) / box.h));
  }
  const chars = work.lineArt ? inkChars(work, box, cols, height) : cellChars(work, box, cols, height);
  return {
    name,
    src,
    asked: width,
    width: cols,
    height,
    colors,
    rows: reduceColors(chars, cols, height, colors),
  };
}

/** Odczyt pliku z dysku jako data URL. */
export const readFile = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('nie udało się odczytać pliku'));
    reader.readAsDataURL(file);
  });
