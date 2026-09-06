import type { Rnd } from './types';

/** Mulberry32 — mały, szybki PRNG; ten sam seed daje ten sam arkusz. */
export function createRnd(seed: number): Rnd {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (items) => items[Math.floor(next() * items.length)],
  };
}

export const randomSeed = () => Math.floor(Math.random() * 2 ** 31);
