// Las 6 personalidades de bot. Todas usan la misma hoja de trabajo que el jugador.
// Salvo el novato, ninguna se deja penalizar por falta de fondos.

import { entre, type Rng } from '../azar';
import type { Decisiones } from '../tipos';
import {
  acotar,
  capacitacionUtil,
  cerrarCuentas,
  convieneAmpliar,
  hayTag,
  mejorPlan,
  precioPromedioEsperado,
  PRECISION,
  redondear100,
  type ContextoBot,
  type Dificultad,
} from './comun';

export type Personalidad = 'racional' | 'agresivo' | 'calidad' | 'conservador' | 'imitador' | 'novato';

export const PERSONALIDADES: Record<Personalidad, { nombre: string; descripcion: string }> = {
  racional: {
    nombre: 'Racional',
    descripcion: 'Estima su demanda con el período anterior e iguala oferta con demanda, como enseña el video.',
  },
  agresivo: { nombre: 'Agresivo', descripcion: 'Precio bajo, mucho marketing y ampliación al máximo.' },
  calidad: { nombre: 'Calidad', descripcion: 'Mucho I&D y precio alto.' },
  conservador: { nombre: 'Conservador', descripcion: 'Invierte poco y devuelve préstamos.' },
  imitador: { nombre: 'Imitador', descripcion: 'Copia el precio del líder del período anterior.' },
  novato: {
    nombre: 'Novato',
    descripcion: 'Se equivoca a veces: usa el Reporte de Producción, pide de más al banco, se pasa de los límites.',
  },
};

/** Fondo fijo que deja cada bot. */
const FONDO_FIJO = 300;

const ultimo = (ctx: ContextoBot) => ctx.periodosRestantes <= 1;

function ruidoPrecio(ctx: ContextoBot): number {
  const r = PRECISION[ctx.dificultad].ruidoPrecio;
  return Math.round(entre(ctx.rng, -r, r));
}

/** I&D según lo que pide el comentario: si el público valora la calidad, invierte más. */
function investigacionBase(ctx: ContextoBot, normal: number): number {
  if (ultimo(ctx)) return 0;
  const max = ctx.datos.limites.investigacionMax;
  return Math.min(max, hayTag(ctx, 'calidad') ? Math.max(normal, max * 0.6) : normal);
}

function racional(ctx: ContextoBot): Decisiones {
  const lim = ctx.datos.limites;
  const plan = mejorPlan(ctx);
  const precio = acotar(plan.precio + ruidoPrecio(ctx), lim.precioMin, lim.precioMax);
  const ampliar = convieneAmpliar(ctx, plan.demandaEsperada);
  const d: Decisiones = {
    precio,
    marketing: plan.marketing,
    investigacion: investigacionBase(ctx, 2000),
    capacitacion: ultimo(ctx) ? 0 : capacitacionUtil(ctx, ctx.periodosRestantes >= 3 ? 6000 : 4000),
    ampliacion: ampliar ? lim.ampliacionMax : 0,
    pedidos: [0, 0],
    devoluciones: [0, 0],
    nivel: plan.nivel,
  };
  return cerrarCuentas(ctx, d, { fondoFijo: FONDO_FIJO, demandaEsperada: plan.demandaEsperada, devolverSobrante: true });
}

function agresivo(ctx: ContextoBot): Decisiones {
  const lim = ctx.datos.limites;
  const precio = acotar(Math.round(precioPromedioEsperado(ctx) - 2) + ruidoPrecio(ctx), lim.precioMin, lim.precioMax);
  const marketing = lim.marketingMax;
  // Siempre juega fuerte (75 o 100%), pero no fabrica para el depósito.
  const plan = mejorPlan(ctx, { precios: [precio], marketings: [marketing], niveles: [75, 100] });
  const d: Decisiones = {
    precio,
    marketing,
    investigacion: investigacionBase(ctx, 1000),
    capacitacion: ultimo(ctx) ? 0 : capacitacionUtil(ctx, 4000),
    ampliacion: ultimo(ctx) || hayTag(ctx, 'crisis') ? 0 : lim.ampliacionMax,
    pedidos: [0, 0],
    devoluciones: [0, 0],
    nivel: plan.nivel,
  };
  return cerrarCuentas(ctx, d, { fondoFijo: FONDO_FIJO, demandaEsperada: plan.demandaEsperada, devolverSobrante: false, marketingMinimo: lim.marketingMax * 0.8 });
}

function calidad(ctx: ContextoBot): Decisiones {
  const lim = ctx.datos.limites;
  const enCrisis = hayTag(ctx, 'recesion', 'crisis');
  const sobre = enCrisis ? 1 : hayTag(ctx, 'calidad') ? 3 : 2;
  const precio = acotar(Math.round(precioPromedioEsperado(ctx) + sobre) + ruidoPrecio(ctx), lim.precioMin, lim.precioMax);
  const plan = mejorPlan(ctx, { precios: [precio] });
  const d: Decisiones = {
    precio,
    marketing: plan.marketing,
    investigacion: ultimo(ctx) ? 0 : enCrisis ? redondear100(lim.investigacionMax * 0.4) : lim.investigacionMax,
    capacitacion: ultimo(ctx) ? 0 : capacitacionUtil(ctx, 2000),
    ampliacion: convieneAmpliar(ctx, plan.demandaEsperada) ? Math.min(lim.ampliacionMax, 5000) : 0,
    pedidos: [0, 0],
    devoluciones: [0, 0],
    nivel: plan.nivel,
  };
  return cerrarCuentas(ctx, d, { fondoFijo: FONDO_FIJO, demandaEsperada: plan.demandaEsperada, devolverSobrante: true });
}

function conservador(ctx: ContextoBot): Decisiones {
  const lim = ctx.datos.limites;
  const precio = acotar(Math.round(precioPromedioEsperado(ctx)) + ruidoPrecio(ctx), lim.precioMin, lim.precioMax);
  const marketing = acotar(ctx.anterior?.decisiones.marketing ?? 8500, lim.marketingMin, lim.marketingMax);
  const plan = mejorPlan(ctx, { precios: [precio], marketings: [marketing], niveles: [0, 25, 50, 75] });
  const d: Decisiones = {
    precio,
    marketing,
    // Invierte poco, pero si el comentario dice que el público valora la calidad, no se queda afuera.
    investigacion: investigacionBase(ctx, 0),
    capacitacion: ctx.periodosRestantes >= 2 && ctx.estado.capacitacionAcumulada < 8000 ? capacitacionUtil(ctx, 2000) : 0,
    ampliacion: 0,
    pedidos: [0, 0],
    devoluciones: [0, 0],
    nivel: plan.nivel,
  };
  return cerrarCuentas(ctx, d, { fondoFijo: 1000, demandaEsperada: plan.demandaEsperada, devolverSobrante: true });
}

function imitador(ctx: ContextoBot): Decisiones {
  const lider = ctx.industrial?.competicion
    .filter((f) => f.nombre !== ctx.nombre && !f.quebrada)
    .sort((a, b) => b.utilidadAcumulada - a.utilidadAcumulada)[0];
  const propia = ctx.industrial?.competicion.find((f) => f.nombre === ctx.nombre);
  // Si el líder es él mismo (o no hay datos), juega como racional.
  if (!lider || (propia && propia.utilidadAcumulada >= lider.utilidadAcumulada)) return racional(ctx);
  const lim = ctx.datos.limites;
  const precio = acotar(lider.precio, lim.precioMin, lim.precioMax);
  const plan = mejorPlan(ctx, { precios: [precio] });
  const d: Decisiones = {
    precio,
    marketing: plan.marketing,
    investigacion: investigacionBase(ctx, 1000),
    capacitacion: ultimo(ctx) ? 0 : capacitacionUtil(ctx, 4000),
    ampliacion: convieneAmpliar(ctx, plan.demandaEsperada) ? Math.min(lim.ampliacionMax, 10000) : 0,
    pedidos: [0, 0],
    devoluciones: [0, 0],
    nivel: plan.nivel,
  };
  return cerrarCuentas(ctx, d, { fondoFijo: FONDO_FIJO, demandaEsperada: plan.demandaEsperada, devolverSobrante: true });
}

/**
 * Novato: decide con reglas simples y a veces comete los errores típicos del certamen.
 * Es el único bot que puede quedar penalizado (y, con mala suerte, quebrar).
 */
function novato(ctx: ContextoBot): Decisiones {
  const lim = ctx.datos.limites;
  const prob = PRECISION[ctx.dificultad].probErrorNovato;
  const seEquivoca = () => ctx.rng() < prob;
  const a = ctx.anterior;

  // Error típico: usar el Reporte de Producción (planta y capacitación del período pasado)
  // en vez de los Valores del Próximo Período. Calcula menos costo y menos producción de los que va a tener.
  const usaReporteDeProduccion = a !== null && seEquivoca();
  const estadoVisto = usaReporteDeProduccion
    ? {
        ...ctx.estado,
        planta: ctx.estado.planta - a.decisiones.ampliacion,
        capacitacionAcumulada: ctx.estado.capacitacionAcumulada - a.decisiones.capacitacion,
      }
    : ctx.estado;
  const ctxVisto = { ...ctx, estado: estadoVisto };

  // Decide con reglas parecidas a las de un equipo que hace la hoja, pero sin afinar.
  const plan = mejorPlan(ctxVisto, { niveles: [25, 50, 75, 100] });
  let precio = plan.precio + Math.round(entre(ctx.rng, -1, 1));
  if (seEquivoca()) precio = lim.precioMax + 2; // no leyó los límites del comentario
  // No sabe que lo que invierte en el último período ya no le sirve.
  const capacitacion = seEquivoca() ? 3000 : capacitacionUtil(ctx, 4000);
  const d: Decisiones = {
    precio,
    marketing: plan.marketing,
    investigacion: Math.max(2000, investigacionBase(ctx, 2000)),
    capacitacion,
    ampliacion: convieneAmpliar(ctx, plan.demandaEsperada) || seEquivoca() ? Math.min(lim.ampliacionMax, 10000) : 0,
    pedidos: [0, 0],
    devoluciones: [0, 0],
    nivel: plan.nivel,
  };
  const cerrado = cerrarCuentas(ctxVisto, d, { fondoFijo: 100, demandaEsperada: plan.demandaEsperada, devolverSobrante: true });

  // Error típico: pedir de más al banco (el excedente del margen va a giro en descubierto).
  const sinGiro = ctx.estado.deudas.every((x) => x.giro === 0);
  if (sinGiro && seEquivoca()) {
    const i = ctx.datos.economia.bancos[0].tasaAnual <= ctx.datos.economia.bancos[1].tasaAnual ? 0 : 1;
    const margen = Math.max(0, ctx.datos.economia.bancos[i].maximoCredito - ctx.estado.deudas[i].tomados);
    const pedidos: [number, number] = [...cerrado.pedidos];
    pedidos[i] = Math.max(pedidos[i], margen) + Math.round(entre(ctx.rng, 1000, 3000));
    const devoluciones: [number, number] = [...cerrado.devoluciones];
    devoluciones[i] = 0;
    return { ...cerrado, pedidos, devoluciones };
  }
  return cerrado;
}

const ESTRATEGIAS: Record<Personalidad, (ctx: ContextoBot) => Decisiones> = {
  racional,
  agresivo,
  calidad,
  conservador,
  imitador,
  novato,
};

export function decidirBot(personalidad: Personalidad, ctx: ContextoBot): Decisiones {
  return ESTRATEGIAS[personalidad](ctx);
}

/** Qué bots hay en la zona según la dificultad (se toman los primeros y se mezclan). */
const PLANTELES: Record<Dificultad, Personalidad[]> = {
  facil: ['novato', 'conservador', 'imitador', 'novato', 'calidad', 'conservador', 'novato', 'imitador', 'racional', 'conservador', 'novato'],
  normal: ['racional', 'conservador', 'agresivo', 'imitador', 'calidad', 'novato', 'racional', 'agresivo', 'calidad', 'conservador', 'imitador'],
  dificil: ['racional', 'agresivo', 'calidad', 'racional', 'imitador', 'agresivo', 'conservador', 'calidad', 'racional', 'imitador', 'agresivo'],
};

export function armarPlantel(dificultad: Dificultad, cantidad: number, rng: Rng): Personalidad[] {
  const lista = PLANTELES[dificultad].slice(0, cantidad);
  while (lista.length < cantidad) lista.push('racional');
  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista;
}
