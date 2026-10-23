// Arranque al azar: cada partida empieza en una situación distinta (planta, préstamos, tasas,
// impuesto, mantenimiento y decisiones del período 0), igual para todas las empresas de la zona.
// Los escenarios se acomodan: los límites de precio se corren según el precio inicial, los de
// marketing y ampliación se escalan, y el mercado se calibra para que el período 0 tenga sentido.

import { entre, type Rng } from './azar';
import type { ConfigReglas, Economia, Limites } from './config';
import { calcularHojaDeTrabajo } from './hojaDeTrabajo';
import type { ContextoDemanda, ParametrosDemanda } from './mercado';
import { calcularProduccion } from './produccion';
import type { Decisiones, EstadoEmpresa, Nivel } from './tipos';

/** El arranque del manual 2026, contra el que se miden los corrimientos. */
const PRECIO_MANUAL = 90;
const MARKETING_MANUAL = 8500;
const PLANTA_MANUAL = 80000;

export interface Arranque {
  estadoInicial: {
    efectivo: number;
    planta: number;
    capacitacionAcumulada: number;
    idAcumulado: number;
    empleados: number;
    prestamosTomados: [number, number];
  };
  economia: Economia;
  decisiones0: Decisiones;
  /** Precio inicial − 90: cuánto se corren los límites de precio y el precio de referencia. */
  desplazamientoPrecio: number;
  /** Planta inicial / 80.000: escala de los límites de ampliación. */
  escalaPlanta: number;
  /** Marketing inicial / 8.500: escala de los límites de marketing. */
  escalaMarketing: number;
  /** Calibración del mercado para este arranque. */
  demanda: Pick<ParametrosDemanda, 'ordenesBasePorEmpresa' | 'precioReferencia' | 'marketingReferencia'>;
}

/** Entero al azar entre min y max (los dos incluidos). */
function entero(rng: Rng, min: number, max: number): number {
  return Math.min(max, Math.floor(entre(rng, min, max + 1)));
}

// SUPUESTO: rangos del arranque al azar elegidos para que el juego siga siendo parecido al certamen.
export function generarArranque(rng: Rng, reglas: ConfigReglas, base: Economia): Arranque {
  const planta = 5000 * entero(rng, 12, 22); // 60.000 a 110.000
  const precio = entero(rng, 84, 98);
  const marketing = 100 * Math.round(entre(rng, 6000, 11000) / 100);
  const nivel: Nivel = rng() < 0.8 ? 75 : 100;
  const decisiones0: Decisiones = {
    precio,
    marketing,
    investigacion: 500 * entero(rng, 0, 6),
    capacitacion: 2000 * entero(rng, 0, 3),
    ampliacion: 5000 * entero(rng, 0, 3),
    pedidos: [0, 0],
    devoluciones: [0, 0],
    nivel,
  };

  // Tasas: casi siempre el Banco 1 es el más barato, pero no siempre.
  let tasa1 = entero(rng, 18, 30);
  let tasa2 = tasa1 + entero(rng, 4, 12);
  if (rng() < 0.3) [tasa1, tasa2] = [tasa2, tasa1];
  const economia: Economia = {
    ...base,
    bancos: [
      { maximoCredito: 0, tasaAnual: tasa1 },
      { maximoCredito: 0, tasaAnual: tasa2 },
    ],
    tasaImpuesto: entero(rng, 30, 40),
    tasaMantenimiento: entero(rng, 8, 13),
    costoStockUnidad: entero(rng, 8, 12),
  };

  // El efectivo alcanza justo para las decisiones del período 0 (con un poco de colchón), y los
  // préstamos salen de que el balance cierre: efectivo + planta = préstamos + capital.
  const proporcion = entre(rng, 0.4, 0.6);
  const colchon = entre(rng, 1.01, 1.08);
  let prestamos = 120000;
  let tomados: [number, number] = [0, 0];
  let efectivo = 0;
  for (let i = 0; i < 6; i++) {
    const t1 = Math.round((prestamos * proporcion) / 1000) * 1000;
    tomados = [t1, prestamos - t1];
    const estado: EstadoEmpresa = {
      nombre: '',
      efectivo: prestamos + reglas.capital - planta,
      planta,
      capacitacionAcumulada: 0,
      idAcumulado: 0,
      stock: [],
      empleados: 0,
      deudas: [
        { tomados: tomados[0], giro: 0 },
        { tomados: tomados[1], giro: 0 },
      ],
      utilidadAcumulada: 0,
      capital: reglas.capital,
      quebrada: false,
    };
    const hoja = calcularHojaDeTrabajo({ estado, economia, decisiones: decisiones0, fondoFijo: 0, reglas });
    efectivo = Math.ceil((hoja.necesidadDeDinero * colchon) / 1000) * 1000;
    prestamos = efectivo + planta - reglas.capital;
  }
  const t1 = Math.round((prestamos * proporcion) / 1000) * 1000;
  tomados = [t1, prestamos - t1];

  // Que el arranque sea exigente pero jugable: los gastos fijos (intereses + mantenimiento) no
  // pueden pasar el 21% de las ventas del período 0 (en el manual son el 19%). Si se pasan,
  // bajan el mantenimiento y las tasas.
  const ventas0 = calcularProduccion(planta, 0, nivel, reglas).produccion * precio;
  const fijos = () =>
    (tomados[0] * tasa1 + tomados[1] * tasa2) / 100 / 3 + (planta * economia.tasaMantenimiento) / 100;
  while (fijos() > ventas0 * 0.21) {
    if (economia.tasaMantenimiento > 8) economia.tasaMantenimiento -= 1;
    else if (Math.max(tasa1, tasa2) > 15) {
      if (tasa1 >= tasa2) tasa1 -= 1;
      else tasa2 -= 1;
    } else break;
  }

  economia.bancos = [
    { maximoCredito: tomados[0] + 1000 * entero(rng, 10, 40), tasaAnual: tasa1 },
    { maximoCredito: tomados[1] + 1000 * entero(rng, 10, 40), tasaAnual: tasa2 },
  ];

  // Mercado: en el período 0 cada empresa recibe entre 2% y 18% más órdenes de las que fabrica
  // (en el manual: 1.346 órdenes para 1.200 unidades).
  const produccion = calcularProduccion(planta, 0, nivel, reglas).produccion;
  return {
    estadoInicial: { efectivo, planta, capacitacionAcumulada: 0, idAcumulado: 0, empleados: 0, prestamosTomados: tomados },
    economia,
    decisiones0,
    desplazamientoPrecio: precio - PRECIO_MANUAL,
    escalaPlanta: planta / PLANTA_MANUAL,
    escalaMarketing: marketing / MARKETING_MANUAL,
    demanda: {
      ordenesBasePorEmpresa: Math.round(produccion * entre(rng, 1.02, 1.18)),
      precioReferencia: precio,
      marketingReferencia: marketing,
    },
  };
}

const redondear = (x: number, paso: number) => Math.round(x / paso) * paso;

/** Límites del comentario acomodados al arranque. */
export function ajustarLimites(lim: Limites, a: Arranque): Limites {
  return {
    ...lim,
    precioMin: lim.precioMin + a.desplazamientoPrecio,
    precioMax: lim.precioMax + a.desplazamientoPrecio,
    marketingMin: redondear(lim.marketingMin * a.escalaMarketing, 500),
    marketingMax: Math.max(1000, redondear(lim.marketingMax * a.escalaMarketing, 500)),
    ampliacionMax: Math.max(5000, redondear(lim.ampliacionMax * a.escalaPlanta, 5000)),
  };
}

/** Lo que el comentario dice del mercado, acomodado al arranque (la inflación se mide desde el precio inicial). */
export function ajustarDemanda(d: ContextoDemanda, a: Arranque): ContextoDemanda {
  return d.precioReferencia === undefined ? d : { ...d, precioReferencia: d.precioReferencia + a.desplazamientoPrecio };
}
