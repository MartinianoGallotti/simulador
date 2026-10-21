// Procesamiento de una empresa en un período: fondos, producción, ventas,
// estado de resultados, balance y valores del próximo período.

import {
  aplicarDevolucion,
  aplicarPedido,
  asignarPrestamoAdicional,
  calcularIntereses,
  type Par,
} from './banco';
import type { ConfigReglas, Economia } from './config';
import type { Correccion } from './decisiones';
import { calcularProduccion, capacidadPlanta, empleadosNecesarios, type Produccion } from './produccion';
import {
  deudaTotal,
  unidadesEnStock,
  valorStock,
  type Decisiones,
  type DeudaBanco,
  type EstadoEmpresa,
  type LoteStock,
} from './tipos';

export interface EstadoResultados {
  ventas: number;
  costoMercaderiaVendida: number;
  margenBruto: number;
  recursosHumanos: number;
  marketing: number;
  mantenimiento: number;
  capacitacion: number;
  investigacion: number;
  indemnizaciones: number;
  mantenimientoStock: number;
  intereses: number;
  penalidad: number;
  utilidadAntesImpuestos: number;
  impuestos: number;
  utilidad: number;
}

export interface Balance {
  efectivo: number;
  stock: number;
  planta: number;
  totalActivo: number;
  prestamos: number;
  utilidadesAcumuladas: number;
  capital: number;
  pasivoMasPatrimonio: number;
}

export interface CreditoBanco {
  maximoCredito: number;
  tasaAnual: number;
  prestamosTomados: number;
  prestamoAdicional: number;
  giro: number;
}

export interface ResultadoEmpresa {
  nombre: string;
  decisiones: Decisiones;
  correcciones: Correccion[];
  produccion: Produccion & {
    empleados: number;
    contratados: number;
    despedidos: number;
  };
  marketing: {
    ordenesRecibidas: number;
    oferta: number;
    ventasRealizadas: number;
    ordenesNoRealizadas: number;
    stockUnidades: number;
  };
  resultados: EstadoResultados;
  balance: Balance;
  creditos: { bancos: Par<CreditoBanco>; giroTotal: number };
  fondos: {
    /** Efectivo inicial + pedidos de préstamo. */
    disponible: number;
    /** Gastos e inversiones que se pagan durante el período. */
    gastosDelPeriodo: number;
    /** Préstamo adicional por gastar más de lo disponible. */
    adicionalPorGastos: number;
    /** Préstamo adicional porque el efectivo de cierre dio negativo. */
    adicionalAlCierre: number;
  };
  proximo: {
    capacitacionAcumulada: number;
    planta: number;
    capacidad: number;
    idAcumulado: number;
  };
  quebrada: boolean;
  /** Estado con el que la empresa arranca el período siguiente. */
  estadoFinal: EstadoEmpresa;
}

/** Saca unidades del stock, primero las más viejas. Devuelve el costo de lo vendido y lo que queda. */
// SUPUESTO: el costo de la mercadería vendida sale primero del stock viejo (FIFO).
function venderFifo(lotes: LoteStock[], unidades: number): { costo: number; restantes: LoteStock[] } {
  let falta = unidades;
  let costo = 0;
  const restantes: LoteStock[] = [];
  for (const lote of lotes) {
    const usar = Math.min(falta, lote.unidades);
    costo += usar * lote.costoUnitario;
    falta -= usar;
    if (lote.unidades - usar > 0) restantes.push({ unidades: lote.unidades - usar, costoUnitario: lote.costoUnitario });
  }
  return { costo, restantes };
}

/**
 * Procesa una empresa con decisiones ya corregidas y las órdenes que le asignó el mercado.
 * `economia` son los datos vigentes en el período (tasas, máximos, impuesto, mantenimiento).
 */
export function procesarEmpresa(
  inicio: EstadoEmpresa,
  d: Decisiones,
  correcciones: Correccion[],
  ordenesRecibidas: number,
  economia: Economia,
  reglas: ConfigReglas,
): ResultadoEmpresa {
  // 1. Producción (con los valores del próximo período del reporte anterior)
  const prod = calcularProduccion(inicio.planta, inicio.capacitacionAcumulada, d.nivel, reglas);
  const empleados = empleadosNecesarios(prod.produccion, reglas);
  const contratados = Math.max(0, empleados - inicio.empleados);
  const despedidos = Math.max(0, inicio.empleados - empleados);
  const recursosHumanos = contratados * reglas.ingresoPorContratado;
  const indemnizaciones = despedidos * reglas.indemnizacionPorDespedido;

  // 2. Bancos: devoluciones y pedidos
  let deudas = [0, 1].map((i) => {
    const conDevolucion = aplicarDevolucion(inicio.deudas[i], d.devoluciones[i]);
    return aplicarPedido(economia.bancos[i], conDevolucion, d.pedidos[i]).deuda;
  }) as Par<DeudaBanco>;
  const intereses = calcularIntereses(reglas.modoIntereses, economia.bancos, inicio.deudas, deudas).total;

  // 3. Chequeo de fondos: lo que el software real hace antes de vender
  const mantenimiento = (inicio.planta * economia.tasaMantenimiento) / 100;
  const disponible = inicio.efectivo + d.pedidos[0] + d.pedidos[1];
  const gastosDelPeriodo =
    prod.costoTotal +
    mantenimiento +
    intereses +
    d.marketing +
    d.investigacion +
    d.capacitacion +
    d.ampliacion +
    d.devoluciones[0] +
    d.devoluciones[1];
  const adicional: Par<number> = [0, 0];
  let penalizada = false;
  let adicionalPorGastos = 0;
  let efectivo = disponible - gastosDelPeriodo;
  if (efectivo < 0) {
    adicionalPorGastos = -efectivo;
    const asignado = asignarPrestamoAdicional(economia.bancos, deudas, adicionalPorGastos);
    deudas = asignado.deudas;
    adicional[0] += asignado.adicionalPorBanco[0];
    adicional[1] += asignado.adicionalPorBanco[1];
    efectivo = 0;
    penalizada = true;
  }

  // 4. Mercado: oferta, ventas y stock
  const stockInicialUnidades = unidadesEnStock(inicio.stock);
  const oferta = prod.produccion + stockInicialUnidades;
  const ventasRealizadas = Math.min(ordenesRecibidas, oferta);
  const ordenesNoRealizadas = ordenesRecibidas - ventasRealizadas;
  const lotes: LoteStock[] = [...inicio.stock];
  if (prod.produccion > 0) lotes.push({ unidades: prod.produccion, costoUnitario: prod.costoUnitario });
  const { costo: costoMercaderiaVendida, restantes: stockFinal } = venderFifo(lotes, ventasRealizadas);
  const stockUnidades = unidadesEnStock(stockFinal);
  const mantenimientoStock = stockUnidades * economia.costoStockUnidad;
  const ventas = ventasRealizadas * d.precio;

  // 5. Estado de resultados y cierre de caja (ventas, RRHH, indemnizaciones,
  //    mantenimiento de stock, penalidad e impuestos se cobran o pagan al cierre)
  const armarResultados = (penalidad: number): EstadoResultados => {
    const margenBruto = ventas - costoMercaderiaVendida;
    const utilidadAntesImpuestos =
      margenBruto +
      recursosHumanos -
      d.marketing -
      mantenimiento -
      d.capacitacion -
      d.investigacion -
      indemnizaciones -
      mantenimientoStock -
      intereses -
      penalidad;
    // SUPUESTO: no hay quebrantos acumulados; si la utilidad es negativa no se paga impuesto.
    const impuestos = utilidadAntesImpuestos > 0 ? (utilidadAntesImpuestos * economia.tasaImpuesto) / 100 : 0;
    return {
      ventas,
      costoMercaderiaVendida,
      margenBruto,
      recursosHumanos,
      marketing: d.marketing,
      mantenimiento,
      capacitacion: d.capacitacion,
      investigacion: d.investigacion,
      indemnizaciones,
      mantenimientoStock,
      intereses,
      penalidad,
      utilidadAntesImpuestos,
      impuestos,
      utilidad: utilidadAntesImpuestos - impuestos,
    };
  };
  const cierre = (er: EstadoResultados) =>
    efectivo + er.ventas + er.recursosHumanos - er.indemnizaciones - er.mantenimientoStock - er.penalidad - er.impuestos;

  let resultados = armarResultados(penalizada ? reglas.penalidad : 0);
  let efectivoCierre = cierre(resultados);
  if (efectivoCierre < 0 && !penalizada) {
    // La penalidad se cobra una sola vez por período.
    penalizada = true;
    resultados = armarResultados(reglas.penalidad);
    efectivoCierre = cierre(resultados);
  }
  let adicionalAlCierre = 0;
  if (efectivoCierre < 0) {
    adicionalAlCierre = -efectivoCierre;
    const asignado = asignarPrestamoAdicional(economia.bancos, deudas, adicionalAlCierre);
    deudas = asignado.deudas;
    adicional[0] += asignado.adicionalPorBanco[0];
    adicional[1] += asignado.adicionalPorBanco[1];
    efectivoCierre = 0;
  }

  // 6. Balance
  const plantaNueva = inicio.planta + d.ampliacion;
  const stockValor = valorStock(stockFinal);
  const prestamos = deudaTotal(deudas[0]) + deudaTotal(deudas[1]);
  const utilidadesAcumuladas = inicio.utilidadAcumulada + resultados.utilidad;
  const balance: Balance = {
    efectivo: efectivoCierre,
    stock: stockValor,
    planta: plantaNueva,
    totalActivo: efectivoCierre + stockValor + plantaNueva,
    prestamos,
    utilidadesAcumuladas,
    capital: inicio.capital,
    pasivoMasPatrimonio: prestamos + utilidadesAcumuladas + inicio.capital,
  };

  // 7. Quiebra y valores del próximo período
  const giroTotal = deudas[0].giro + deudas[1].giro;
  const quebrada = inicio.quebrada || giroTotal > economia.limiteGiro;
  const proximo = {
    capacitacionAcumulada: inicio.capacitacionAcumulada + d.capacitacion,
    planta: plantaNueva,
    capacidad: capacidadPlanta(plantaNueva, reglas),
    idAcumulado: inicio.idAcumulado + d.investigacion,
  };

  return {
    nombre: inicio.nombre,
    decisiones: d,
    correcciones,
    produccion: { ...prod, empleados, contratados, despedidos },
    marketing: { ordenesRecibidas, oferta, ventasRealizadas, ordenesNoRealizadas, stockUnidades },
    resultados,
    balance,
    creditos: {
      bancos: [0, 1].map((i) => ({
        maximoCredito: economia.bancos[i].maximoCredito,
        tasaAnual: economia.bancos[i].tasaAnual,
        prestamosTomados: deudas[i].tomados,
        prestamoAdicional: adicional[i],
        giro: deudas[i].giro,
      })) as Par<CreditoBanco>,
      giroTotal,
    },
    fondos: { disponible, gastosDelPeriodo, adicionalPorGastos, adicionalAlCierre },
    proximo,
    quebrada,
    estadoFinal: {
      nombre: inicio.nombre,
      efectivo: efectivoCierre,
      planta: plantaNueva,
      capacitacionAcumulada: proximo.capacitacionAcumulada,
      idAcumulado: proximo.idAcumulado,
      stock: stockFinal,
      empleados,
      deudas,
      utilidadAcumulada: utilidadesAcumuladas,
      capital: inicio.capital,
      quebrada,
    },
  };
}
