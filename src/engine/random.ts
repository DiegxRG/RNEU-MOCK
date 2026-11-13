/** Versioned, serializable Mulberry32 stream. Never uses Math.random(). */
export interface RandomStream {
  algorithm: 'mulberry32-v1';
  state: number;
  next(): number;
}

export function createRandom(seed: number): RandomStream {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new Error('La semilla debe ser un entero entre 0 y 4294967295.');
  }
  return {
    algorithm: 'mulberry32-v1',
    state: seed >>> 0,
    next() {
      this.state = (this.state + 0x6d2b79f5) >>> 0;
      let value = this.state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    },
  };
}

export function shuffle<T>(values: readonly T[], random: RandomStream): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const target = Math.floor(random.next() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}
