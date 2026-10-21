// Validación de decisiones y corrección al límite más cercano, como hacen los moderadores.

import type { ConfigReglas, Limites } from './config';
import { NIVELES, deudaTotal, type Decisiones, type DeudaBanco, type Nivel } from './tipos';

export type CampoDecision =
  | 'precio'
  | 'marketing'
  | 'investigacion'
  | 'capacitacion'
  | 'ampliacion'
  | 'pedido1'
  | 'pedido2'
  | 'devolucion1'
  | 'devolucion2'
  | 'nivel';

export interface Correccion {
  campo: CampoDecision;
  original: number;
  corregido: number;
  motivo: string;
}

export interface DecisionesCorregidas {
  decisiones: Decisiones;
  correcciones: Correccion[];
}

function entero(valor: number): number {
  // SUPUESTO: si llega un número con decimales, se toma la parte entera
  // ("todas las decisiones deben ser cifras sin decimales").
  if (!Number.isFinite(valor)) return 0;
  return Math.trunc(valor);
}

function acotar(valor: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, valor));
}

/**
 * Corrige las decisiones como lo haría el certamen:
 * - todo entero;
 * - precio, marketing, I&D y ampliación al límite más cercano del comentario;
 * - capacitación hacia abajo al múltiplo de 2.000 (7.999 → 6.000);
 * - nivel de producción a 0/25/50/75/100;
 * - no se puede pedir y devolver al mismo banco en el mismo período;
 * - no se puede devolver más de lo que se debe.
 */
export function corregirDecisiones(
  original: Decisiones,
  limites: Limites,
  deudas: [DeudaBanco, DeudaBanco],
  reglas: Pick<ConfigReglas, 'capacitacionMultiplo' | 'nombresBancos'>,
): DecisionesCorregidas {
  const correcciones: Correccion[] = [];
  const registrar = (campo: CampoDecision, antes: number, despues: number, motivo: string) => {
    if (antes !== despues) correcciones.push({ campo, original: antes, corregido: despues, motivo });
  };

  const conLimites = (campo: CampoDecision, valor: number, min: number, max: number, nombre: string) => {
    const e = entero(valor);
    if (e !== valor) registrar(campo, valor, e, 'Las decisiones van sin decimales.');
    const c = acotar(e, min, max);
    if (c !== e) {
      registrar(
        campo,
        e,
        c,
        c === max
          ? `${nombre} supera el máximo del comentario (${max}); se corrige al límite más cercano.`
          : `${nombre} está por debajo del mínimo del comentario (${min}); se corrige al límite más cercano.`,
      );
    }
    return c;
  };

  const precio = conLimites('precio', original.precio, limites.precioMin, limites.precioMax, 'El precio');
  const marketing = conLimites('marketing', original.marketing, limites.marketingMin, limites.marketingMax, 'El marketing');
  const investigacion = conLimites('investigacion', original.investigacion, 0, limites.investigacionMax, 'La inversión en I&D');
  const ampliacion = conLimites('ampliacion', original.ampliacion, 0, limites.ampliacionMax, 'La ampliación de planta');

  // Capacitación: múltiplo de 2.000 hacia abajo. El tope acumulado (20.000) NO corrige:
  // lo que se invierta por encima se paga igual y no sirve (pérdida pura).
  let capacitacion = Math.max(0, entero(original.capacitacion));
  const multiplo = Math.floor(capacitacion / reglas.capacitacionMultiplo) * reglas.capacitacionMultiplo;
  if (multiplo !== capacitacion) {
    registrar(
      'capacitacion',
      original.capacitacion,
      multiplo,
      `La capacitación tiene que ser múltiplo de ${reglas.capacitacionMultiplo}; se redondea hacia abajo.`,
    );
  }
  capacitacion = multiplo;
  if (limites.capacitacionMaxPeriodo !== undefined && capacitacion > limites.capacitacionMaxPeriodo) {
    registrar('capacitacion', capacitacion, limites.capacitacionMaxPeriodo, 'La capacitación supera el máximo del período.');
    capacitacion = limites.capacitacionMaxPeriodo;
  }

  const nivel = nivelValido(original.nivel);
  if (nivel !== original.nivel) {
    registrar('nivel', original.nivel, nivel, 'El nivel de producción solo puede ser 0, 25, 50, 75 o 100%.');
  }

  const pedidos: [number, number] = [0, 0];
  const devoluciones: [number, number] = [0, 0];
  for (const i of [0, 1] as const) {
    const campoPedido: CampoDecision = i === 0 ? 'pedido1' : 'pedido2';
    const campoDev: CampoDecision = i === 0 ? 'devolucion1' : 'devolucion2';
    const banco = reglas.nombresBancos[i];
    pedidos[i] = Math.max(0, entero(original.pedidos[i]));
    registrar(campoPedido, original.pedidos[i], pedidos[i], 'Los pedidos de préstamo van sin decimales y no pueden ser negativos.');
    let dev = Math.max(0, entero(original.devoluciones[i]));
    registrar(campoDev, original.devoluciones[i], dev, 'Las devoluciones van sin decimales y no pueden ser negativas.');
    if (pedidos[i] > 0 && dev > 0) {
      // SUPUESTO: si se pide y se devuelve al mismo banco, vale el pedido y la devolución se anula.
      registrar(campoDev, dev, 0, `No se puede pedir y devolver al Banco ${banco} en el mismo período; la devolución se anula.`);
      dev = 0;
    }
    const debe = deudaTotal(deudas[i]);
    if (dev > debe) {
      // SUPUESTO: no se puede devolver más de lo que se le debe al banco.
      registrar(campoDev, dev, debe, `No se puede devolver más de lo que se le debe al Banco ${banco} (${debe}).`);
      dev = debe;
    }
    devoluciones[i] = dev;
  }

  return {
    decisiones: { precio, marketing, investigacion, capacitacion, ampliacion, pedidos, devoluciones, nivel },
    correcciones,
  };
}

/** Lleva cualquier número al nivel válido más cercano. */
export function nivelValido(valor: number): Nivel {
  // SUPUESTO: un nivel inválido se corrige al nivel válido más cercano.
  let mejor: Nivel = 0;
  for (const n of NIVELES) if (Math.abs(n - valor) < Math.abs(mejor - valor)) mejor = n;
  return mejor;
}

export interface ResultadoNombre {
  valido: boolean;
  motivo?: string;
}

/** Nombre de la empresa: hasta 10 caracteres, solo letras y números. */
export function validarNombreEmpresa(nombre: string, maxCaracteres: number): ResultadoNombre {
  if (nombre.trim().length === 0) return { valido: false, motivo: 'El nombre no puede estar vacío.' };
  if (nombre.length > maxCaracteres) return { valido: false, motivo: `El nombre puede tener hasta ${maxCaracteres} caracteres.` };
  if (!/^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ ]+$/.test(nombre)) return { valido: false, motivo: 'El nombre no puede tener símbolos.' };
  return { valido: true };
}
