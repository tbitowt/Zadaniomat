/**
 * Wzory do kolorowanki: każdy obrazek to siatka znaków, jeden znak na kratkę.
 * Znaki odsyłają do palety poniżej; kropka to tło, którego się nie koloruje.
 */

export interface PaintColor {
  name: string;
  css: string;
}

/** Kolory dobrane tak, żeby dało się je pokazać zwykłymi kredkami. */
export const PALETTE: Record<string, PaintColor> = {
  '.': { name: 'zostaw białe', css: '#ffffff' },
  c: { name: 'czerwony', css: '#e03131' },
  p: { name: 'pomarańczowy', css: '#f76707' },
  y: { name: 'żółty', css: '#f0c419' },
  z: { name: 'zielony', css: '#2f9e44' },
  n: { name: 'niebieski', css: '#1c7ed6' },
  r: { name: 'różowy', css: '#e64980' },
  b: { name: 'brązowy', css: '#8b5a2b' },
  s: { name: 'szary', css: '#868e96' },
  k: { name: 'czarny', css: '#212529' },
};

/** Znaki kolorów, na które wolno zamienić wczytany obrazek (bez bieli i czerni). */
export const IMAGE_COLORS = ['c', 'p', 'y', 'z', 'n', 'r', 'b', 's'];

export interface PixelPattern {
  id: string;
  label: string;
  rows: string[];
}

export const PATTERNS: PixelPattern[] = [
  {
    id: 'serce',
    label: 'serce',
    rows: [
      '............',
      '..cc....cc..',
      '.cccc..cccc.',
      'cccccccccccc',
      'cccccccccccc',
      'cccccccccccc',
      '.cccccccccc.',
      '..cccccccc..',
      '...cccccc...',
      '....cccc....',
      '.....cc.....',
      '............',
    ],
  },
  {
    id: 'choinka',
    label: 'choinka',
    rows: [
      '.....yy.....',
      '.....zz.....',
      '....zzzz....',
      '...zzzzzz...',
      '..zzzzzzzz..',
      '....zzzz....',
      '...zzzzzz...',
      '..zzzzzzzz..',
      '.zzzzzzzzzz.',
      'zzzzzzzzzzzz',
      '.....bb.....',
      '.....bb.....',
    ],
  },
  {
    id: 'rybka',
    label: 'rybka',
    rows: [
      '............',
      '.......nnn..',
      '....nnnnnnnn',
      'n...nnnnnnnn',
      'nn..nnnnnnkn',
      'nnnnnnnnnnnn',
      'nn..nnnnnnnn',
      'n...nnnnnnnn',
      '....nnnnnnnn',
      '.......nnn..',
      '............',
      '............',
    ],
  },
  {
    id: 'kwiatek',
    label: 'kwiatek',
    rows: [
      '...rr..rr...',
      '..rrrrrrrr..',
      '..rrryyrrr..',
      '..rrryyrrr..',
      '..rrrrrrrr..',
      '...rr..rr...',
      '.....zz.....',
      '.....zz.....',
      '...zzzz.....',
      '.....zz.....',
      '.....zz.....',
      '............',
    ],
  },
  {
    id: 'dom',
    label: 'dom',
    rows: [
      '............',
      '.....cc.....',
      '....cccc....',
      '...cccccc...',
      '..cccccccc..',
      '.cccccccccc.',
      'cccccccccccc',
      '.bbbbbbbbbb.',
      '.bnnbbbbnnb.',
      '.bnnbbbbnnb.',
      '.bbbbkkbbbb.',
      '.bbbbkkbbbb.',
    ],
  },
  {
    id: 'zaglowka',
    label: 'żaglówka',
    rows: [
      '.....k......',
      '.....ky.....',
      '.....kyy....',
      '.....kyyy...',
      '..yy.kyyyy..',
      '.yyy.kyyyyy.',
      'yyyy.kyyyyyy',
      '..bbbbbbbb..',
      '...bbbbbb...',
      'nnnnnnnnnnnn',
      'nnnnnnnnnnnn',
      '............',
    ],
  },
  {
    id: 'motyl',
    label: 'motyl',
    rows: [
      '.pp......pp.',
      'pppp....pppp',
      'pppppkkppppp',
      'pppppkkppppp',
      '.ppppkkpppp.',
      '..pppkkppp..',
      '..pppkkppp..',
      '.ppppkkpppp.',
      'pppppkkppppp',
      'pppp.kk.pppp',
      '.pp..kk..pp.',
      '............',
    ],
  },
  {
    id: 'kotek',
    label: 'kotek',
    rows: [
      '............',
      '.ss......ss.',
      '.sss....sss.',
      '.ssssssssss.',
      'ssssssssssss',
      'ssskssssksss',
      'ssssssssssss',
      'ssssskksssss',
      '.ssssssssss.',
      '..ssssssss..',
      '...ssssss...',
      '............',
    ],
  },
];

export const getPattern = (id: string) => PATTERNS.find((p) => p.id === id) ?? PATTERNS[0];
