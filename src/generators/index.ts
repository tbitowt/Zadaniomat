import type { GeneratorDef, Section } from '../types';
import { additionStrategies } from './additionStrategies';
import { clock } from './clock';
import { coloring } from './coloring';
import { comparison } from './comparison';
import { completion } from './completion';
import { crossword } from './crossword';
import { evenOdd } from './evenOdd';
import { mentalAddition } from './mentalAddition';
import { mentalDivision } from './mentalDivision';
import { mentalMultiplication } from './mentalMultiplication';
import { mentalSubtraction } from './mentalSubtraction';
import { money } from './money';
import { neighbours } from './neighbours';
import { numberLine } from './numberLine';
import { sequence } from './sequence';
import { writtenAddition } from './writtenAddition';
import { writtenMultiplication } from './writtenMultiplication';
import { writtenSubtraction } from './writtenSubtraction';
import { zerosDivision } from './zerosDivision';

/** Rejestr typów zadań — nowy generator wystarczy dopisać tutaj. */
export const generators: GeneratorDef[] = [
  mentalAddition,
  writtenAddition,
  mentalSubtraction,
  writtenSubtraction,
  mentalMultiplication,
  writtenMultiplication,
  mentalDivision,
  zerosDivision,
  additionStrategies,
  completion,
  comparison,
  neighbours,
  evenOdd,
  sequence,
  numberLine,
  clock,
  money,
  coloring,
  crossword,
];

export const getGenerator = (id: string) => generators.find((g) => g.id === id);

/** Świeży blok zadań danego rodzaju — z domyślnymi ustawieniami generatora. */
export const newSection = (g: GeneratorDef): Section => ({
  generatorId: g.id,
  config: { ...g.defaults },
  count: g.sheetDefaults.count,
  columns: g.sheetDefaults.columns,
  heading: '',
  intro: g.sheetDefaults.intro ?? false,
  introCount: 2,
});
