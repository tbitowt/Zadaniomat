import type { GeneratorDef } from '../types';
import { clock } from './clock';
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

/** Rejestr typów zadań — nowy generator wystarczy dopisać tutaj. */
export const generators: GeneratorDef[] = [
  mentalAddition,
  writtenAddition,
  mentalSubtraction,
  writtenSubtraction,
  mentalMultiplication,
  writtenMultiplication,
  mentalDivision,
  completion,
  comparison,
  neighbours,
  evenOdd,
  sequence,
  numberLine,
  clock,
  money,
  crossword,
];

export const getGenerator = (id: string) => generators.find((g) => g.id === id);
