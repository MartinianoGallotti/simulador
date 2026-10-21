// Planilla de costos: lookup e interpolación.
// La tabla sale de referencia/planilla_costos.json, que ya está reconstruida.
// Acá NO se recalcula nada: solo se busca la celda y se interpola entre plantas.

import datos from '../../referencia/planilla_costos.json';
import type { Nivel } from './tipos';

export type FuentePlanta = 'video' | 'documento_borroso' | 'extrapolado';

interface PlanillaJson {
  plantas: number[];
  capacitaciones: number[];
  niveles: number[];
  costo: Record<string, Record<string, [number, number, number, number]>>;
  fuente_planta: Record<string, FuentePlanta>;
}

const planilla = datos as unknown as PlanillaJson;

export const PLANTAS: readonly number[] = planilla.plantas;
export const CAPACITACIONES: readonly number[] = planilla.capacitaciones;
export const NIVELES_PLANILLA: readonly Nivel[] = [25, 50, 75, 100];
export const PLANTA_MIN = PLANTAS[0];
export const PLANTA_MAX = PLANTAS[PLANTAS.length - 1];
export const PASO_PLANTA = PLANTAS[1] - PLANTAS[0];
/** Columnas que salen tal cual del material original; las demás se reconstruyeron por regla. */
export const CAPACITACIONES_ORIGINALES: readonly number[] = [0, 2000, 4000];

/** Las 4 celdas (25/50/75/100%) de una fila exacta de la planilla. */
export function filaPlanilla(planta: number, capacitacion: number): [number, number, number, number] {
  const fila = planilla.costo[String(planta)]?.[String(capacitacion)];
  if (!fila) throw new Error(`No existe la fila planta=${planta} capacitación=${capacitacion}`);
  return fila;
}

export function fuentePlanta(planta: number): FuentePlanta {
  return planilla.fuente_planta[String(planta)];
}

function indiceNivel(nivel: Nivel): number {
  const i = NIVELES_PLANILLA.indexOf(nivel);
  if (i < 0) throw new Error(`Nivel sin columna en la planilla: ${nivel}`);
  return i;
}

/** Columna de capacitación que corresponde: múltiplo de 2.000 hacia abajo, con tope en 20.000. */
export function columnaCapacitacion(capacitacionAcumulada: number): number {
  const max = CAPACITACIONES[CAPACITACIONES.length - 1];
  const paso = CAPACITACIONES[1] - CAPACITACIONES[0];
  const c = Math.max(0, Math.min(max, capacitacionAcumulada));
  return Math.floor(c / paso) * paso;
}

export interface DetalleCosto {
  costoUnitario: number;
  nivel: Nivel;
  /** Planta pedida, antes de recortarla a la tabla. */
  planta: number;
  plantaInferior: number;
  plantaSuperior: number;
  /** 0 = exactamente la fila inferior, 1 = la superior. */
  fraccion: number;
  capacitacionColumna: number;
  costoInferior: number;
  costoSuperior: number;
  interpolado: boolean;
  /** true si la planta cae fuera de la tabla y se usó el extremo. */
  fueraDeTabla: boolean;
  fuente: FuentePlanta;
  /** true si la columna de capacitación se reconstruyó por regla (6.000 en adelante). */
  columnaReconstruida: boolean;
}

/**
 * Costo unitario = planilla(planta, capacitación acumulada, nivel).
 * Plantas intermedias: interpolación lineal entre las dos filas de la tabla.
 * Fuera de 25.000–300.000 se usa la fila del extremo.
 */
export function detalleCosto(planta: number, capacitacionAcumulada: number, nivel: Nivel): DetalleCosto {
  if (nivel === 0) {
    return {
      costoUnitario: 0,
      nivel,
      planta,
      plantaInferior: planta,
      plantaSuperior: planta,
      fraccion: 0,
      capacitacionColumna: columnaCapacitacion(capacitacionAcumulada),
      costoInferior: 0,
      costoSuperior: 0,
      interpolado: false,
      fueraDeTabla: false,
      fuente: 'video',
      columnaReconstruida: false,
    };
  }
  const col = columnaCapacitacion(capacitacionAcumulada);
  const iNivel = indiceNivel(nivel);
  const fueraDeTabla = planta < PLANTA_MIN || planta > PLANTA_MAX;
  const p = Math.max(PLANTA_MIN, Math.min(PLANTA_MAX, planta));
  const inferior = Math.min(PLANTA_MAX - PASO_PLANTA, PLANTA_MIN + Math.floor((p - PLANTA_MIN) / PASO_PLANTA) * PASO_PLANTA);
  const superior = inferior + PASO_PLANTA;
  const fraccion = (p - inferior) / PASO_PLANTA;
  const cInf = filaPlanilla(inferior, col)[iNivel];
  const cSup = filaPlanilla(superior, col)[iNivel];
  const exacta = fraccion === 0 || fraccion === 1;
  const plantaFila = fraccion === 1 ? superior : inferior;
  const costo = exacta ? filaPlanilla(plantaFila, col)[iNivel] : cInf + (cSup - cInf) * fraccion;
  return {
    costoUnitario: costo,
    nivel,
    planta,
    plantaInferior: exacta ? plantaFila : inferior,
    plantaSuperior: exacta ? plantaFila : superior,
    fraccion: exacta ? 0 : fraccion,
    capacitacionColumna: col,
    costoInferior: exacta ? costo : cInf,
    costoSuperior: exacta ? costo : cSup,
    interpolado: !exacta,
    fueraDeTabla,
    fuente: fuentePlanta(exacta ? plantaFila : fraccion < 0.5 ? inferior : superior),
    columnaReconstruida: !CAPACITACIONES_ORIGINALES.includes(col),
  };
}

export function costoUnitario(planta: number, capacitacionAcumulada: number, nivel: Nivel): number {
  return detalleCosto(planta, capacitacionAcumulada, nivel).costoUnitario;
}
