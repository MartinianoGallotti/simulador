// "¿Qué pasó?": explicación en lenguaje simple de un período ya jugado.

import { calcularProduccion } from '../produccion';
import { descomponerDemanda, type DescomposicionDemanda } from '../mercado';
import { datosDePartida, parametrosDemandaDe, ranking, type Partida } from '../partida';

export type Tono = 'bien' | 'mal' | 'neutro';

export interface PuntoExplicacion {
  tono: Tono;
  titulo: string;
  detalle: string;
}

export interface ExplicacionPeriodo {
  periodo: number;
  resumen: string;
  tono: Tono;
  demanda: DescomposicionDemanda & { ordenesRecibidas: number; precio: number; marketing: number; idAcumulado: number };
  /** Por qué tuviste esa demanda. */
  porQueDemanda: PuntoExplicacion[];
  /** Si sobró stock o se perdieron ventas. */
  ofertaYDemanda: PuntoExplicacion[];
  /** Dónde ganaste o perdiste plata. */
  plata: PuntoExplicacion[];
}

const fmt = (x: number) => Math.round(x).toLocaleString('es-AR');
const plata = (x: number) => (x < 0 ? `− U$S ${fmt(-x)}` : `U$S ${fmt(x)}`);
const pct = (f: number) => `${f >= 1 ? '+' : '−'}${Math.abs(Math.round((f - 1) * 100))}%`;
const costo = (x: number) => x.toFixed(2).replace('.', ',');

/** Puesto en el ranking de un período (1 = primero), sin contar a las quebradas. */
function puestoEn(p: Partida, numero: number): number {
  const parcial = { ...p, historial: p.historial.slice(0, numero + 1) };
  const tabla = ranking(parcial).filter((f) => !f.quebrada || f.esJugador);
  return tabla.findIndex((f) => f.esJugador) + 1;
}

export function explicarPeriodo(p: Partida, numero: number): ExplicacionPeriodo | null {
  const periodo = p.historial[numero];
  const r = periodo?.resultado.empresas[p.indiceJugador];
  if (!periodo || !r || numero === 0) return null;
  const inicio = p.historial[numero - 1].resultado.zona;
  const datos = datosDePartida(p, numero);
  const nombresBancos = p.config.reglas.nombresBancos;

  // --- Demanda ---
  const activos = inicio.empresas.map((e, i) => ({ e, i })).filter(({ e }) => !e.quebrada);
  const entradas = activos.map(({ e, i }) => ({
    precio: periodo.resultado.empresas[i]!.decisiones.precio,
    marketing: periodo.resultado.empresas[i]!.decisiones.marketing,
    idAcumulado: e.idAcumulado,
  }));
  const k = activos.findIndex(({ i }) => i === p.indiceJugador);
  const desc = descomponerDemanda(entradas, k, datos.demanda, parametrosDemandaDe(p));
  const yo = entradas[k];
  const porQueDemanda: PuntoExplicacion[] = [];
  const mercadoAnterior = numero > 1 ? p.historial[numero - 1].resultado.industrial.unidades.totalOrdenesRecibidas : null;
  const mercadoReal = periodo.resultado.industrial.unidades.totalOrdenesRecibidas;
  porQueDemanda.push({
    tono: 'neutro',
    titulo: `El mercado de la zona fue de ${fmt(mercadoReal)} órdenes`,
    detalle:
      (mercadoAnterior
        ? `El período anterior había sido de ${fmt(mercadoAnterior)} (${pct(mercadoReal / mercadoAnterior)}). `
        : '') +
      `Entre ${activos.length} empresas, si todas hubieran jugado igual te tocaban unas ${fmt(desc.parteJusta)}. Recibiste ${fmt(r.marketing.ordenesRecibidas)}.`,
  });
  const difPrecio = yo.precio - desc.precioPromedio;
  porQueDemanda.push({
    tono: desc.factorPrecio > 1.02 ? 'bien' : desc.factorPrecio < 0.98 ? 'mal' : 'neutro',
    titulo: `Precio: ${pct(desc.factorPrecio)} de órdenes`,
    detalle:
      Math.abs(difPrecio) < 0.5
        ? `Cobraste ${fmt(yo.precio)}, igual que el promedio de la zona (${desc.precioPromedio.toFixed(1).replace('.', ',')}).`
        : `Cobraste ${fmt(yo.precio)}, ${Math.abs(difPrecio).toFixed(1).replace('.', ',')} ${difPrecio > 0 ? 'por encima' : 'por debajo'} del promedio de la zona (${desc.precioPromedio.toFixed(1).replace('.', ',')}). La demanda es muy sensible al precio: cada peso cuenta, y estar arriba castiga más de lo que premia estar abajo.`,
  });
  const relMkt = desc.marketingPromedio > 0 ? yo.marketing / desc.marketingPromedio - 1 : 0;
  porQueDemanda.push({
    tono: desc.factorMarketing > 1.02 ? 'bien' : desc.factorMarketing < 0.98 ? 'mal' : 'neutro',
    titulo: `Marketing: ${pct(desc.factorMarketing)} de órdenes`,
    detalle: `Invertiste ${plata(yo.marketing)}, ${Math.abs(relMkt) < 0.02 ? 'casi lo mismo que' : `${Math.abs(Math.round(relMkt * 100))}% ${relMkt > 0 ? 'más' : 'menos'} que`} el promedio de la zona (${plata(desc.marketingPromedio)}). El marketing rinde cada vez menos: duplicarlo no duplica las ventas.`,
  });
  const pesoID = datos.demanda.pesoID;
  porQueDemanda.push({
    tono: desc.factorID > 1.02 ? 'bien' : desc.factorID < 0.98 ? 'mal' : 'neutro',
    titulo: `Investigación y desarrollo: ${pct(desc.factorID)} de órdenes`,
    detalle: `Arrancaste el período con ${plata(yo.idAcumulado)} de I&D acumulado; el promedio de la zona era ${plata(desc.idPromedio)}. Lo que invertiste este período recién cuenta en el próximo.${pesoID !== undefined && pesoID >= 0.6 ? ' En este período el público valoraba mucho la calidad.' : pesoID !== undefined && pesoID <= 0.15 ? ' En este período al público casi no le importaba la calidad.' : ''}`,
  });
  if (datos.demanda.conRuido && Math.abs(r.marketing.ordenesRecibidas - desc.ordenesSinRuido) >= 1) {
    porQueDemanda.push({
      tono: 'neutro',
      titulo: 'Un poco de azar',
      detalle: `Sin el azar de ±2% hubieras recibido ${fmt(desc.ordenesSinRuido)} órdenes.`,
    });
  }

  // --- Oferta y demanda ---
  const ofertaYDemanda: PuntoExplicacion[] = [];
  const m = r.marketing;
  const margenUnidad = r.decisiones.precio - r.produccion.costoUnitario;
  if (m.ordenesNoRealizadas > 0) {
    ofertaYDemanda.push({
      tono: 'mal',
      titulo: `Te quedaste sin mercadería: perdiste ${fmt(m.ordenesNoRealizadas)} ventas`,
      detalle: `Tenías ${fmt(m.oferta)} unidades (producción + stock) y te pidieron ${fmt(m.ordenesRecibidas)}. Esas ventas se pierden: no pasan al período siguiente. A tu margen de ${costo(margenUnidad)} por unidad, dejaste de ganar unos ${plata(m.ordenesNoRealizadas * margenUnidad)}. Podías producir más (subir el nivel) o subir el precio para vender lo mismo ganando más por unidad.`,
    });
  }
  if (m.stockUnidades > 0) {
    ofertaYDemanda.push({
      tono: 'mal',
      titulo: `Te sobraron ${fmt(m.stockUnidades)} unidades`,
      detalle: `Pagaste ${plata(r.resultados.mantenimientoStock)} de mantenimiento de stock y la plata de fabricarlas quedó inmovilizada en el depósito (${plata(r.balance.stock)}). Podías bajar el nivel de producción, bajar un poco el precio o subir el marketing.`,
    });
  }
  if (m.ordenesNoRealizadas === 0 && m.stockUnidades === 0) {
    ofertaYDemanda.push({
      tono: 'bien',
      titulo: 'Oferta y demanda igualadas',
      detalle: `Vendiste las ${fmt(m.ventasRealizadas)} unidades que tenías y no perdiste ventas. Es lo que enseña el video: igualar la oferta con la demanda.`,
    });
  }

  // --- Plata ---
  const er = r.resultados;
  const plataPuntos: PuntoExplicacion[] = [];
  plataPuntos.push({
    tono: 'neutro',
    titulo: `Margen bruto: ${plata(er.margenBruto)}`,
    detalle: `Vendiste ${fmt(m.ventasRealizadas)} unidades a ${plata(r.decisiones.precio)} con un costo de ${costo(r.produccion.costoUnitario)} cada una (al ${r.produccion.nivel}%). Te quedan ${costo(margenUnidad)} por unidad para pagar todo lo demás.`,
  });
  const gastos: [string, number][] = (
    [
      ['Marketing', er.marketing],
      ['Mantenimiento de la planta', er.mantenimiento],
      ['Intereses', er.intereses],
      ['Capacitación', er.capacitacion],
      ['I&D', er.investigacion],
      ['Mantenimiento de stock', er.mantenimientoStock],
      ['Indemnizaciones', er.indemnizaciones],
    ] as [string, number][]
  )
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  plataPuntos.push({
    tono: 'neutro',
    titulo: 'En qué se fue la plata',
    detalle: gastos.map(([n, v]) => `${n}: ${plata(v)}`).join(' · ') + '.',
  });
  if (er.penalidad > 0) {
    const adic = r.creditos.bancos.map((b, i) => (b.prestamoAdicional > 0 ? `${plata(b.prestamoAdicional)} del Banco ${nombresBancos[i]}` : '')).filter(Boolean);
    plataPuntos.push({
      tono: 'mal',
      titulo: `Penalidad de ${plata(er.penalidad)}`,
      detalle: `Gastaste más de lo que tenías, así que el simulador te dio un préstamo adicional${adic.length ? ` (${adic.join(' y ')})` : ''} y te cobró la penalidad. ${r.fondos.adicionalAlCierre > 0 ? 'Además el efectivo dio negativo al cierre (las ventas no alcanzaron para pagar el stock, los impuestos o la penalidad). ' : ''}Revisá la hoja de trabajo: la necesidad de dinero tiene que ser menor o igual a los fondos a utilizar.`,
    });
  }
  if (r.creditos.giroTotal > 0) {
    plataPuntos.push({
      tono: 'mal',
      titulo: `Tenés ${plata(r.creditos.giroTotal)} de giro en descubierto`,
      detalle: `Es deuda por encima del máximo crédito de los bancos. Si el giro supera ${plata(datos.economia.limiteGiro)}, la empresa quiebra.${r.quebrada ? ' Y eso pasó: la empresa quedó descalificada.' : ' Devolvé al banco del giro en cuanto puedas: la devolución cancela primero el giro.'}`,
    });
  }
  if (er.indemnizaciones > 0) {
    plataPuntos.push({
      tono: 'mal',
      titulo: `Despediste ${fmt(r.produccion.despedidos)} empleados`,
      detalle: `Al bajar la producción pagaste ${plata(er.indemnizaciones)} de indemnizaciones.`,
    });
  }
  if (er.recursosHumanos > 0) {
    plataPuntos.push({
      tono: 'bien',
      titulo: `Contrataste ${fmt(r.produccion.contratados)} empleados`,
      detalle: `Recursos Humanos te dio un ingreso de ${plata(er.recursosHumanos)} (U$S ${fmt(p.config.reglas.ingresoPorContratado)} por cada contratado).`,
    });
  }
  if (r.correcciones.length > 0) {
    plataPuntos.push({
      tono: 'mal',
      titulo: 'El moderador corrigió tu cupón',
      detalle: r.correcciones.map((c) => c.motivo).join(' '),
    });
  }
  const ultimo = numero >= p.config.cantidadPeriodos;
  if (ultimo && er.capacitacion + er.investigacion > 0) {
    plataPuntos.push({
      tono: 'mal',
      titulo: 'Invertiste en el último período',
      detalle: `Los ${plata(er.capacitacion + er.investigacion)} de capacitación e I&D se restaron de la utilidad y ya no tenías un período para aprovecharlos.`,
    });
  } else if (!ultimo && r.decisiones.capacitacion > 0) {
    const antes = calcularProduccion(r.balance.planta, r.proximo.capacitacionAcumulada - r.decisiones.capacitacion, 75, p.config.reglas).costoUnitario;
    const despues = calcularProduccion(r.balance.planta, r.proximo.capacitacionAcumulada, 75, p.config.reglas).costoUnitario;
    plataPuntos.push({
      tono: 'bien',
      titulo: 'La capacitación baja tu costo desde el período que viene',
      detalle: `Con ${plata(r.proximo.capacitacionAcumulada)} acumulados, al 75% el costo por unidad pasa de ${costo(antes)} a ${costo(despues)}.`,
    });
  }

  // --- Resumen ---
  const puesto = puestoEn(p, numero);
  const puestoAntes = numero > 1 ? puestoEn(p, numero - 1) : null;
  const total = periodo.resultado.industrial.competicion.length;
  const movimiento =
    puestoAntes === null || puestoAntes === puesto ? '' : puesto < puestoAntes ? ` (subiste desde el ${puestoAntes}°)` : ` (bajaste desde el ${puestoAntes}°)`;
  const resumen = r.quebrada
    ? `La empresa quebró en el período ${numero}: el giro en descubierto superó el límite.`
    : `${er.utilidad >= 0 ? 'Ganaste' : 'Perdiste'} ${plata(Math.abs(er.utilidad))} en el período ${numero} y quedaste ${puesto}° de ${total}${movimiento}.`;

  return {
    periodo: numero,
    resumen,
    tono: r.quebrada || er.utilidad < 0 ? 'mal' : puesto === 1 ? 'bien' : 'neutro',
    demanda: { ...desc, ordenesRecibidas: r.marketing.ordenesRecibidas, precio: yo.precio, marketing: yo.marketing, idAcumulado: yo.idAcumulado },
    porQueDemanda,
    ofertaYDemanda,
    plata: plataPuntos,
  };
}
