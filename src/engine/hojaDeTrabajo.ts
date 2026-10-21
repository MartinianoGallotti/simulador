// Hoja de Trabajo: los mismos casilleros que la hoja oficial.
// Se calcula con lo que el equipo tiene a mano: el Reporte de la Compañía anterior
// (Balance, Reporte de Créditos y Valores del Próximo Período) y el Comentario Económico.

import { aplicarDevolucion, aplicarPedido, calcularIntereses, margenDisponible, ordenPorTasa, type Par } from './banco';
import type { ConfigReglas, Economia } from './config';
import { calcularProduccion } from './produccion';
import { deudaTotal, type Decisiones, type DeudaBanco, type EstadoEmpresa, type Nivel } from './tipos';

export interface EntradaHoja {
  estado: EstadoEmpresa;
  economia: Economia;
  decisiones: Decisiones;
  fondoFijo: number;
  reglas: ConfigReglas;
}

export interface FilaBancoHoja {
  nombre: string;
  maximoCredito: number;
  prestamosTomados: number;
  margenDisponible: number;
}

export interface HojaDeTrabajo {
  bancos: Par<FilaBancoHoja>;
  planta: number;
  // Cuadro de cuentas: fondos
  pedidos: Par<number>;
  efectivo: number;
  fondoFijo: number;
  fondosAUtilizar: number;
  // Cuadro de cuentas: gastos e inversiones
  capacitacionAcumulada: number;
  capacidad: number;
  nivel: Nivel;
  produccion: number;
  costoUnitario: number;
  costoTotalBruto: number;
  mantenimiento: number;
  intereses: number;
  marketing: number;
  investigacion: number;
  capacitacion: number;
  ampliacion: number;
  devoluciones: Par<number>;
  necesidadDeDinero: number;
  /** Fondos a utilizar − necesidad de dinero. Negativo = falta plata (penalidad). */
  diferencia: number;
}

const EPS = 1e-9;
/** En la hoja se trabaja sin comas: los gastos se redondean hacia arriba, como enseña el video. */
// SUPUESTO: el video lo muestra solo para el costo total; acá se aplica también a mantenimiento e intereses.
function haciaArriba(x: number): number {
  return Math.ceil(x - EPS);
}

export function calcularHojaDeTrabajo(e: EntradaHoja): HojaDeTrabajo {
  const { estado, economia, decisiones: d, fondoFijo, reglas } = e;
  const bancos: Par<FilaBancoHoja> = [0, 1].map((i) => ({
    nombre: reglas.nombresBancos[i],
    maximoCredito: economia.bancos[i].maximoCredito,
    prestamosTomados: estado.deudas[i].tomados,
    margenDisponible: margenDisponible(economia.bancos[i], estado.deudas[i]),
  })) as Par<FilaBancoHoja>;

  // El equipo copia el efectivo tal como figura en el reporte (sin decimales); el fondo fijo cubre la diferencia.
  const efectivo = Math.round(estado.efectivo);
  const fondosAUtilizar = d.pedidos[0] + d.pedidos[1] + efectivo - fondoFijo;

  const prod = calcularProduccion(estado.planta, estado.capacitacionAcumulada, d.nivel, reglas);
  const costoTotalBruto = haciaArriba(prod.costoTotal);
  const mantenimiento = haciaArriba((estado.planta * economia.tasaMantenimiento) / 100);

  const despues = [0, 1].map((i) => {
    const conDevolucion = aplicarDevolucion(estado.deudas[i], d.devoluciones[i]);
    return aplicarPedido(economia.bancos[i], conDevolucion, d.pedidos[i]).deuda;
  }) as Par<DeudaBanco>;
  const intereses = haciaArriba(calcularIntereses(reglas.modoIntereses, economia.bancos, estado.deudas, despues).total);

  const necesidadDeDinero =
    costoTotalBruto +
    mantenimiento +
    intereses +
    d.marketing +
    d.investigacion +
    d.capacitacion +
    d.ampliacion +
    d.devoluciones[0] +
    d.devoluciones[1];

  return {
    bancos,
    planta: estado.planta,
    pedidos: [...d.pedidos],
    efectivo,
    fondoFijo,
    fondosAUtilizar,
    capacitacionAcumulada: estado.capacitacionAcumulada,
    capacidad: prod.capacidad,
    nivel: d.nivel,
    produccion: prod.produccion,
    costoUnitario: prod.costoUnitario,
    costoTotalBruto,
    mantenimiento,
    intereses,
    marketing: d.marketing,
    investigacion: d.investigacion,
    capacitacion: d.capacitacion,
    ampliacion: d.ampliacion,
    devoluciones: [...d.devoluciones],
    necesidadDeDinero,
    diferencia: fondosAUtilizar - necesidadDeDinero,
  };
}

export interface SugerenciaFinanciamiento {
  pedidos: Par<number>;
  devoluciones: Par<number>;
  /** Lo que falta aun pidiendo todo el margen de los dos bancos (iría a giro). */
  faltanteSinCubrir: number;
}

/**
 * Lo que enseña el video: si falta plata, pedir primero al banco de menor tasa
 * (sin pasarse del margen); si sobra, devolver al banco de mayor tasa.
 * Parte de la hoja sin pedidos ni devoluciones.
 */
export function sugerirFinanciamiento(e: EntradaHoja): SugerenciaFinanciamiento {
  const base = calcularHojaDeTrabajo({
    ...e,
    decisiones: { ...e.decisiones, pedidos: [0, 0], devoluciones: [0, 0] },
  });
  const pedidos: Par<number> = [0, 0];
  const devoluciones: Par<number> = [0, 0];
  const orden = ordenPorTasa(e.economia.bancos);
  // Las decisiones son enteras: lo que falta se pide redondeado hacia arriba y lo que sobra se devuelve hacia abajo.
  if (base.diferencia < 0) {
    let falta = Math.ceil(-base.diferencia - EPS);
    for (const i of orden) {
      const parte = Math.min(falta, base.bancos[i].margenDisponible);
      pedidos[i] = parte;
      falta -= parte;
    }
    return { pedidos, devoluciones, faltanteSinCubrir: falta };
  }
  let sobra = Math.floor(base.diferencia + EPS);
  for (const i of [orden[1], orden[0]]) {
    const parte = Math.min(sobra, Math.floor(deudaTotal(e.estado.deudas[i])));
    devoluciones[i] = parte;
    sobra -= parte;
  }
  return { pedidos, devoluciones, faltanteSinCubrir: 0 };
}
