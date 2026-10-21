// Avisos de errores frecuentes en la hoja de trabajo (modo entrenamiento).
// Son los errores que el video y el manual señalan como los que más penalidades y quiebras causan.

import { margenDisponible } from '../banco';
import type { Limites } from '../config';
import { corregirDecisiones } from '../decisiones';
import type { ResultadoEmpresa } from '../empresa';
import { calcularHojaDeTrabajo, type EntradaHoja, type HojaDeTrabajo } from '../hojaDeTrabajo';
import { deudaTotal } from '../tipos';

export type NivelAviso = 'error' | 'alerta' | 'consejo';

export interface Aviso {
  id: string;
  nivel: NivelAviso;
  /** Casillero de la hoja al que se refiere (para marcarlo en rojo). */
  campo?: CampoHoja;
  titulo: string;
  detalle: string;
}

/** Casilleros que el equipo completa a mano en la hoja oficial (los que se copian o calculan). */
export type CampoHoja =
  | 'maximo1'
  | 'maximo2'
  | 'tomados1'
  | 'tomados2'
  | 'margen1'
  | 'margen2'
  | 'planta'
  | 'efectivo'
  | 'fondosAUtilizar'
  | 'capacidad'
  | 'produccion'
  | 'costoUnitario'
  | 'costoTotalBruto'
  | 'mantenimiento'
  | 'intereses'
  | 'necesidadDeDinero'
  | 'pedido1'
  | 'pedido2'
  | 'devolucion1'
  | 'devolucion2'
  | 'capacitacion'
  | 'fondoFijo';

/** Lo que el equipo escribió a mano. `null` = casillero vacío. */
export type HojaManual = Partial<Record<CampoHoja, number | null>>;

export interface ContextoAvisos {
  /** Resultado propio del período anterior (para detectar datos copiados del Reporte de Producción). */
  anterior: ResultadoEmpresa | null;
  limites: Limites;
  /** Períodos que quedan contando el actual (1 = último). */
  periodosRestantes: number;
  /** Si la hoja se completa a mano, lo que se escribió. */
  manual?: HojaManual;
}

const fmt = (x: number) => Math.round(x).toLocaleString('es-AR');

/** Valor correcto de cada casillero, según la hoja calculada. */
export function valoresCorrectos(h: HojaDeTrabajo): Record<Exclude<CampoHoja, 'pedido1' | 'pedido2' | 'devolucion1' | 'devolucion2' | 'capacitacion' | 'fondoFijo'>, number> {
  return {
    maximo1: h.bancos[0].maximoCredito,
    maximo2: h.bancos[1].maximoCredito,
    tomados1: h.bancos[0].prestamosTomados,
    tomados2: h.bancos[1].prestamosTomados,
    margen1: h.bancos[0].margenDisponible,
    margen2: h.bancos[1].margenDisponible,
    planta: h.planta,
    efectivo: h.efectivo,
    fondosAUtilizar: h.fondosAUtilizar,
    capacidad: h.capacidad,
    produccion: h.produccion,
    costoUnitario: h.costoUnitario,
    costoTotalBruto: h.costoTotalBruto,
    mantenimiento: h.mantenimiento,
    intereses: h.intereses,
    necesidadDeDinero: h.necesidadDeDinero,
  };
}

/** Tolerancia de cada casillero (redondeos que hace el equipo a mano). */
const TOLERANCIA: Partial<Record<CampoHoja, number>> = {
  costoUnitario: 0.011,
  costoTotalBruto: 1,
  mantenimiento: 1,
  intereses: 1,
  necesidadDeDinero: 2,
  fondosAUtilizar: 1,
  efectivo: 1,
};

const NOMBRES: Record<string, string> = {
  maximo1: 'Máximo crédito',
  maximo2: 'Máximo crédito',
  tomados1: 'Préstamos tomados',
  tomados2: 'Préstamos tomados',
  margen1: 'Margen de crédito disponible',
  margen2: 'Margen de crédito disponible',
  planta: 'Planta',
  efectivo: 'Efectivo',
  fondosAUtilizar: 'Fondos a utilizar',
  capacidad: 'Capacidad de producción',
  produccion: 'Producción',
  costoUnitario: 'Costo unitario',
  costoTotalBruto: 'Costo total bruto de producción',
  mantenimiento: 'Mantenimiento',
  intereses: 'Intereses',
  necesidadDeDinero: 'Necesidad de dinero',
};

/** Explicación de cómo se calcula cada casillero (para cuando está mal). */
function comoSeCalcula(campo: string, e: EntradaHoja, h: HojaDeTrabajo, banco: string): string {
  switch (campo) {
    case 'maximo1':
    case 'maximo2':
      return `Se copia del Reporte de Créditos (Banco ${banco}), salvo que el comentario lo cambie.`;
    case 'tomados1':
    case 'tomados2':
      return `Se copia de "Préstamos Tomados" del Banco ${banco} en el Reporte de Créditos.`;
    case 'margen1':
    case 'margen2':
      return 'Es Máximo Crédito − Préstamos Tomados.';
    case 'planta':
      return 'Se copia de "Planta" en los Valores del Próximo Período.';
    case 'efectivo':
      return 'Se copia de "Efectivo" en el Balance del Reporte de la Compañía.';
    case 'fondosAUtilizar':
      return 'Es Pedido Banco 1 + Pedido Banco 2 + Efectivo − Fondo Fijo.';
    case 'capacidad':
      return 'Se copia de "Cap. de Prod (100%)" en los Valores del Próximo Período.';
    case 'produccion':
      return `Es la capacidad (${fmt(h.capacidad)}) por el nivel de producción (${h.nivel}%).`;
    case 'costoUnitario':
      return `Se busca en la planilla con planta ${fmt(h.planta)}, capacitación ${fmt(h.capacitacionAcumulada)} y nivel ${h.nivel}%.`;
    case 'costoTotalBruto':
      return 'Es producción × costo unitario (redondeado hacia arriba).';
    case 'mantenimiento':
      return `Es la tasa de mantenimiento (${e.economia.tasaMantenimiento}%) por la planta de los Valores del Próximo Período (${fmt(h.planta)}), antes de la ampliación.`;
    case 'intereses':
      return 'Es la suma, banco por banco, de Préstamos Tomados × tasa anual ÷ 3.';
    case 'necesidadDeDinero':
      return 'Es costo total + mantenimiento + intereses + marketing + I&D + capacitación + ampliación + devoluciones.';
    default:
      return '';
  }
}

export function revisarHoja(e: EntradaHoja, ctx: ContextoAvisos): Aviso[] {
  const avisos: Aviso[] = [];
  const h = calcularHojaDeTrabajo(e);
  const d = e.decisiones;
  const [b1, b2] = e.reglas.nombresBancos;
  const bancos = [b1, b2];
  const limiteGiro = e.economia.limiteGiro;

  // 1 y 2. Pedidos: más que el margen, o confusión entre pedido y tomados.
  let giroNuevo = 0;
  for (const i of [0, 1] as const) {
    const margen = margenDisponible(e.economia.bancos[i], e.estado.deudas[i]);
    const tomados = e.estado.deudas[i].tomados;
    if (d.pedidos[i] > 0 && d.pedidos[i] === tomados) {
      avisos.push({
        id: `pedido-tomados-${i}`,
        nivel: 'alerta',
        campo: i === 0 ? 'pedido1' : 'pedido2',
        titulo: `¿Confundiste "pedido" con "préstamos tomados" en el Banco ${bancos[i]}?`,
        detalle: `Pediste exactamente lo que ya debés (${fmt(tomados)}). El pedido es lo que le pedís AHORA al banco, no lo que ya tenés tomado.`,
      });
    }
    if (d.pedidos[i] > margen) {
      const exceso = d.pedidos[i] - margen;
      giroNuevo += exceso;
      avisos.push({
        id: `pedido-margen-${i}`,
        nivel: 'error',
        campo: i === 0 ? 'pedido1' : 'pedido2',
        titulo: `El pedido al Banco ${bancos[i]} supera el margen disponible`,
        detalle: `El margen es ${fmt(margen)} y pediste ${fmt(d.pedidos[i])}. Los ${fmt(exceso)} de más se otorgan como giro en descubierto. Si el giro total supera ${fmt(limiteGiro)}, la empresa quiebra.`,
      });
    }
  }
  const giroExistente = e.estado.deudas[0].giro + e.estado.deudas[1].giro;
  if (giroExistente + giroNuevo > limiteGiro) {
    avisos.push({
      id: 'quiebra',
      nivel: 'error',
      titulo: '¡Con estos pedidos quebrás!',
      detalle: `El giro en descubierto quedaría en ${fmt(giroExistente + giroNuevo)} y el límite es ${fmt(limiteGiro)}. La empresa queda descalificada.`,
    });
  }

  // 5. Pedir y devolver al mismo banco.
  for (const i of [0, 1] as const) {
    if (d.pedidos[i] > 0 && d.devoluciones[i] > 0) {
      avisos.push({
        id: `mismo-banco-${i}`,
        nivel: 'error',
        campo: i === 0 ? 'devolucion1' : 'devolucion2',
        titulo: `Pedís y devolvés al Banco ${bancos[i]} en el mismo período`,
        detalle: 'No está permitido. Podés pedirle a un banco y devolverle al otro, pero no las dos cosas al mismo banco. La devolución se anula.',
      });
    }
    if (d.devoluciones[i] > deudaTotal(e.estado.deudas[i])) {
      avisos.push({
        id: `devolucion-de-mas-${i}`,
        nivel: 'alerta',
        campo: i === 0 ? 'devolucion1' : 'devolucion2',
        titulo: `Devolvés más de lo que le debés al Banco ${bancos[i]}`,
        detalle: `Le debés ${fmt(deudaTotal(e.estado.deudas[i]))}. Se corrige a ese monto.`,
      });
    }
  }

  // 4. Capacitación.
  const mult = e.reglas.capacitacionMultiplo;
  if (d.capacitacion % mult !== 0) {
    avisos.push({
      id: 'capacitacion-multiplo',
      nivel: 'alerta',
      campo: 'capacitacion',
      titulo: `La capacitación no es múltiplo de ${fmt(mult)}`,
      detalle: `Se redondea hacia abajo: de ${fmt(d.capacitacion)} quedan ${fmt(Math.floor(d.capacitacion / mult) * mult)}.`,
    });
  }
  const sobreTope = e.estado.capacitacionAcumulada + d.capacitacion - e.reglas.capacitacionMaxAcumulada;
  if (sobreTope > 0) {
    avisos.push({
      id: 'capacitacion-tope',
      nivel: 'alerta',
      campo: 'capacitacion',
      titulo: `La capacitación pasa los ${fmt(e.reglas.capacitacionMaxAcumulada)} acumulados`,
      detalle: `Ya tenés ${fmt(e.estado.capacitacionAcumulada)}. Los ${fmt(sobreTope)} que pasan del tope se pagan igual pero no bajan el costo: es plata perdida.`,
    });
  }

  // 6. Necesidad de dinero mayor que los fondos.
  if (h.diferencia < 0) {
    avisos.push({
      id: 'penalidad',
      nivel: 'error',
      campo: 'necesidadDeDinero',
      titulo: 'La necesidad de dinero supera los fondos a utilizar',
      detalle: `Te faltan ${fmt(-h.diferencia)}. El simulador te va a dar un préstamo adicional y te va a cobrar ${fmt(e.reglas.penalidad)} de penalidad. Pedí la diferencia al banco de menor tasa (sin pasarte del margen) o bajá gastos.`,
    });
  }

  // 7. Fondo fijo.
  if (e.fondoFijo < e.reglas.fondoFijoMinimo) {
    avisos.push({
      id: 'fondo-fijo-minimo',
      nivel: 'error',
      campo: 'fondoFijo',
      titulo: `El fondo fijo tiene un mínimo de ${fmt(e.reglas.fondoFijoMinimo)}`,
      detalle: 'Es un colchón obligatorio para cubrir errores de cálculo.',
    });
  }
  const ocioso = e.fondoFijo + Math.max(0, h.diferencia);
  if (ocioso > 3000) {
    const masCaro = e.economia.bancos[0].tasaAnual >= e.economia.bancos[1].tasaAnual ? 0 : 1;
    const ahorro = (Math.min(ocioso, deudaTotal(e.estado.deudas[masCaro])) * e.economia.bancos[masCaro].tasaAnual) / 100 / 3;
    avisos.push({
      id: 'plata-ociosa',
      nivel: 'consejo',
      campo: 'fondoFijo',
      titulo: 'Tenés mucha plata quieta',
      detalle: `Entre el fondo fijo y lo que sobra quedan ${fmt(ocioso)} sin usar. Si los devolvés al Banco ${bancos[masCaro]} (la tasa más alta, ${e.economia.bancos[masCaro].tasaAnual}%), ahorrás unos ${fmt(ahorro)} de intereses por período. O invertilos.`,
    });
  }

  // 8. Intereses: el manual dice copiarlos del estado de resultados anterior, pero si
  //    el período pasado cambiaron los préstamos, el interés de este período es otro.
  const interesesAnteriores = ctx.anterior?.resultados.intereses;
  if (interesesAnteriores !== undefined && Math.abs(interesesAnteriores - h.intereses) > 1 && ctx.manual === undefined) {
    avisos.push({
      id: 'intereses-copiados',
      nivel: 'consejo',
      campo: 'intereses',
      titulo: 'Este período los intereses no son los del estado de resultados anterior',
      detalle: `El manual dice copiar los intereses del período pasado (${fmt(interesesAnteriores)}), pero el período pasado tus préstamos cambiaron (pedidos, devoluciones o préstamo adicional). Lo que vas a pagar ahora es ${fmt(h.intereses)}: préstamos tomados × tasa ÷ 3.`,
    });
  }

  // Decisiones fuera de los límites del comentario.
  for (const c of corregirDecisiones(d, ctx.limites, e.estado.deudas, e.reglas).correcciones) {
    if (['pedido1', 'pedido2', 'devolucion1', 'devolucion2', 'capacitacion'].includes(c.campo)) continue;
    avisos.push({ id: `limite-${c.campo}`, nivel: 'alerta', titulo: 'Decisión fuera de los límites del comentario', detalle: c.motivo });
  }

  // Inversiones en el último período: recién servirían en un período que ya no se juega.
  if (ctx.periodosRestantes <= 1 && d.capacitacion + d.investigacion > 0) {
    avisos.push({
      id: 'ultimo-periodo',
      nivel: 'consejo',
      titulo: 'Es el último período',
      detalle: `La capacitación y el I&D recién sirven en el período siguiente, que ya no se juega. Los ${fmt(d.capacitacion + d.investigacion)} que ponés ahí se restan de tu utilidad y no te dan nada.`,
    });
  }

  // 3 y 8 (hoja manual): casilleros mal copiados o mal calculados.
  if (ctx.manual) avisos.push(...revisarManual(e, h, ctx));

  return avisos;
}

function revisarManual(e: EntradaHoja, h: HojaDeTrabajo, ctx: ContextoAvisos): Aviso[] {
  const avisos: Aviso[] = [];
  const correctos = valoresCorrectos(h);
  const a = ctx.anterior;
  const [b1, b2] = e.reglas.nombresBancos;
  for (const [campo, correcto] of Object.entries(correctos) as [keyof typeof correctos, number][]) {
    const escrito = ctx.manual?.[campo];
    if (escrito === null || escrito === undefined) continue;
    const tol = TOLERANCIA[campo] ?? 0.5;
    if (Math.abs(escrito - correcto) <= tol) continue;

    const banco = campo.endsWith('2') ? b2 : b1;
    const f = (x: number) => (campo === 'costoUnitario' ? x.toFixed(2).replace('.', ',') : fmt(x));
    let detalle = `Pusiste ${f(escrito)} y es ${f(correcto)}. ${comoSeCalcula(campo, e, h, banco)}`;
    let titulo = `${NOMBRES[campo]}${campo.match(/[12]$/) ? ` (Banco ${banco})` : ''} mal copiado o mal calculado`;

    // Error típico: datos del Reporte de Producción en vez de Valores del Próximo Período.
    if (a) {
      const delReporteDeProduccion: Partial<Record<string, number>> = {
        capacidad: a.produccion.capacidad,
        produccion: a.produccion.produccion,
        costoUnitario: a.produccion.costoUnitario,
        planta: a.balance.planta - a.decisiones.ampliacion,
      };
      const viejo = delReporteDeProduccion[campo];
      if (viejo !== undefined && Math.abs(escrito - viejo) <= tol) {
        titulo = 'Usaste el Reporte de Producción en vez de los Valores del Próximo Período';
        detalle = `${f(escrito)} es el dato del período que ya se jugó. Para este período hay que usar los Valores del Próximo Período (lo que invertiste en planta y capacitación ya cuenta): ${f(correcto)}. Este error es de los que más quiebras causan.`;
      }
      // Error típico: copiar los intereses del período anterior cuando cambiaron los préstamos.
      if (campo === 'intereses' && Math.abs(escrito - a.resultados.intereses) <= 1) {
        titulo = 'Copiaste los intereses del período pasado, pero tus préstamos cambiaron';
        detalle = `El período pasado pagaste ${fmt(a.resultados.intereses)}, pero después pediste, devolviste o te dieron un préstamo adicional. Ahora debés más o menos, así que el interés es ${fmt(correcto)} (préstamos tomados × tasa ÷ 3).`;
      }
    }
    // Error típico: calcular el mantenimiento con la planta ya ampliada.
    const conAmpliacion = ((h.planta + e.decisiones.ampliacion) * e.economia.tasaMantenimiento) / 100;
    if (campo === 'mantenimiento' && e.decisiones.ampliacion > 0 && Math.abs(escrito - conAmpliacion) <= 1) {
      detalle = `Le sumaste la ampliación de este período a la planta. El mantenimiento se calcula sobre la planta ANTES de ampliar: ${fmt(correcto)}.`;
    }
    avisos.push({ id: `manual-${campo}`, nivel: 'error', campo: campo as CampoHoja, titulo, detalle });
  }
  return avisos;
}
