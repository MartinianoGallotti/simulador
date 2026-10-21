// Generador de números aleatorios con semilla (mulberry32): misma semilla, misma partida.

export type Rng = () => number;

export function crearRng(semilla: number): Rng {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Número uniforme entre min y max. */
export function entre(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng();
}
