// Capacidad, producción, costo y empleados. Lo usan la hoja de trabajo y el procesamiento del período.

import type { ConfigReglas } from './config';
import { detalleCosto, type DetalleCosto } from './planillaCostos';
import type { Nivel } from './tipos';

const EPS = 1e-9;

/** Capacidad al 100% = 2% del valor de la planta. */
export function capacidadPlanta(planta: number, reglas: Pick<ConfigReglas, 'porcentajeCapacidad'>): number {
  // SUPUESTO: si la cuenta da decimales (planta que no es múltiplo de 50), se redondea hacia abajo.
  return Math.floor(planta * reglas.porcentajeCapacidad + EPS);
}

/** Producción = capacidad × nivel. */
export function produccionDelNivel(capacidad: number, nivel: Nivel): number {
  // SUPUESTO: si da decimales, se redondea hacia abajo.
  return Math.floor((capacidad * nivel) / 100 + EPS);
}

/** Empleados = producción / 20. */
export function empleadosNecesarios(produccion: number, reglas: Pick<ConfigReglas, 'unidadesPorEmpleado'>): number {
  // SUPUESTO: si da decimales (975 / 20 = 48,75), se redondea al entero más cercano.
  return Math.round(produccion / reglas.unidadesPorEmpleado);
}

export interface Produccion {
  capacidad: number;
  nivel: Nivel;
  produccion: number;
  costoUnitario: number;
  /** Costo total bruto de producción, con todos los decimales. */
  costoTotal: number;
  detalle: DetalleCosto;
}

/**
 * Producción del período con los Valores del Próximo Período del reporte anterior
 * (planta y capacitación acumulada). Lo invertido este período recién cuenta en el siguiente.
 */
export function calcularProduccion(
  planta: number,
  capacitacionAcumulada: number,
  nivel: Nivel,
  reglas: Pick<ConfigReglas, 'porcentajeCapacidad'>,
): Produccion {
  const capacidad = capacidadPlanta(planta, reglas);
  const produccion = produccionDelNivel(capacidad, nivel);
  const detalle = detalleCosto(planta, capacitacionAcumulada, nivel);
  return {
    capacidad,
    nivel,
    produccion,
    costoUnitario: detalle.costoUnitario,
    costoTotal: produccion * detalle.costoUnitario,
    detalle,
  };
}
