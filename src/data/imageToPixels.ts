import { IMAGE_COLORS, PALETTE } from './pixelArt';

/** Obrazek sprowadzony do siatki kratek — dokładnie to, czego potrzebuje kolorowanka. */
export interface Picture {
  name: string;
  /** Oryginał w postaci data URL, żeby dało się przeliczyć obrazek po zmianie ustawień. */
  src: string;
  width: number;
  height: number;
  /** Ile kolorów zostawiono. */
  colors: number;
  rows: string[];
}

type Rgb = [number, number, number];

const rgbOf = (css: string): Rgb => [
  parseInt(css.slice(1, 3), 16),
  parseInt(css.slice(3, 5), 16),
  parseInt(css.slice(5, 7), 16),
];

const distance = (a: Rgb, b: Rgb) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

/** Najbliższy kolor palety spośród dozwolonych znaków. */
const nearest = (pixel: Rgb, chars: string[]) =>
  chars.reduce((best, ch) =>
    distance(pixel, rgbOf(PALETTE[ch].css)) < distance(pixel, rgbOf(PALETTE[best].css)) ? ch : best,
  );

/**
 * Kolor każdej kratki: nie średnia z jej pikseli, tylko kolor, który występuje
 * w niej najczęściej. Uśrednianie robi wokół kształtów szarą obwódkę, która
 * potrafi wyprzeć z palety prawdziwe kolory obrazka.
 */
function cellChars(
  data: Uint8ClampedArray,
  sourceWidth: number,
  sourceHeight: number,
  width: number,
  height: number,
): string[] {
  const candidates = ['.', ...IMAGE_COLORS];
  const out: string[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const x0 = Math.floor((x * sourceWidth) / width);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * sourceWidth) / width));
      const y0 = Math.floor((y * sourceHeight) / height);
      const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * sourceHeight) / height));
      const counts = new Map<string, number>();
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * sourceWidth + sx) * 4;
          const ch = data[i + 3] < 128 ? '.' : nearest([data[i], data[i + 1], data[i + 2]], candidates);
          counts.set(ch, (counts.get(ch) ?? 0) + 1);
        }
      }
      out.push([...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]);
    }
  }
  return out;
}

/**
 * Zostawia tylko kolory najczęstsze, a resztę przyciąga do najbliższego z nich.
 * Biel zostaje tłem, którego się nie koloruje — o ile w obrazku w ogóle jest.
 */
export function reduceColors(chars: string[], width: number, height: number, maxColors: number): string[] {
  const counts = new Map<string, number>();
  for (const ch of chars) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  const kept = [...counts.entries()]
    .filter(([ch]) => ch !== '.')
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxColors)
    .map(([ch]) => ch);
  const palette = counts.has('.') ? ['.', ...kept] : kept.length ? kept : ['.'];
  const remap = new Map<string, string>();
  for (const ch of counts.keys()) {
    remap.set(ch, palette.includes(ch) ? ch : nearest(rgbOf(PALETTE[ch].css), palette));
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

/** Wczytanie obrazka z data URL i zamiana go na siatkę o zadanej szerokości. */
export async function pictureFromSource(
  src: string,
  name: string,
  width: number,
  maxHeight: number,
  colors: number,
): Promise<Picture> {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('nie udało się wczytać obrazka'));
    image.src = src;
  });
  const height = Math.max(1, Math.min(maxHeight, Math.round((width * image.height) / image.width)));
  // obrazek oglądamy w rozdzielczości roboczej: dość dużej, żeby każda kratka
  // miała z czego wybrać kolor, i dość małej, żeby liczyło się od ręki
  const sourceWidth = Math.max(width, Math.min(image.width, width * 16));
  const sourceHeight = Math.max(1, Math.round((sourceWidth * image.height) / image.width));
  const canvas = document.createElement('canvas');
  canvas.width = sourceWidth;
  canvas.height = sourceHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('brak kontekstu 2D');
  ctx.drawImage(image, 0, 0, sourceWidth, sourceHeight);
  const { data } = ctx.getImageData(0, 0, sourceWidth, sourceHeight);
  const chars = cellChars(data, sourceWidth, sourceHeight, width, height);
  return { name, src, width, height, colors, rows: reduceColors(chars, width, height, colors) };
}

/** Odczyt pliku z dysku jako data URL. */
export const readFile = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('nie udało się odczytać pliku'));
    reader.readAsDataURL(file);
  });
