// Una partida: la zona, los bots y el historial de períodos. Puede tener un solo equipo humano
// (modo individual) o varios que juegan por turnos en el mismo dispositivo (modo moderador).
// Todo es inmutable: cada función devuelve una partida nueva (sirve para deshacer y guardar).

import { crearRng } from './azar';
import type { Dificultad } from './bots/comun';
import { armarPlantel, decidirBot, type Personalidad } from './bots/personalidades';
import type { ConfigReglas } from './config';
import type { ResultadoEmpresa } from './empresa';
import { buscarEscenario, periodoOProvisorio, type PeriodoEscenario } from './escenarios';
import { crearZona, datosDelPeriodo, procesarPeriodo, type DatosPeriodo, type ResultadoPeriodo, type Zona } from './periodo';
import type { ContextoReporteCompania, FilaCompeticion } from './reportes';
import { decisionesVacias, type Decisiones, type EstadoEmpresa } from './tipos';

export type ModoPartida = 'entrenamiento' | 'examen';

/** Duración de cada período en el modo examen (minutos). El video dice ~30 el primero y después menos. */
export const MINUTOS_POR_PERIODO = [30, 25, 20, 15, 15, 15, 15];

export interface ConfigPartida {
  /** Entrenamiento: con ayudas. Examen: hoja manual, sin ayudas y con tiempo. */
  modo?: ModoPartida;
  /** Minutos de cada período en el modo examen (el índice 0 es el período 1). */
  minutosPorPeriodo?: number[];
  nombreEmpresa: string;
  /** Modo moderador: nombres de todos los equipos humanos (si no está, el único equipo es `nombreEmpresa`). */
  equiposHumanos?: string[];
  cantidadBots: number;
  dificultad: Dificultad;
  escenarioId: string;
  cantidadPeriodos: number;
  semilla: number;
  /** Ruido aleatorio de ±2% en la demanda. */
  conRuido: boolean;
  reglas: ConfigReglas;
}

export interface PeriodoJugado {
  numero: number;
  /** Las decisiones tal como se cargaron (antes de corregir), una por empresa. */
  decisiones: Decisiones[];
  resultado: ResultadoPeriodo;
}

export interface Partida {
  version: 1;
  /** Identificador para la lista de partidas guardadas. */
  id?: string;
  /** Última vez que se guardó (ms). */
  actualizada?: number;
  /** Cuándo empezó el período actual (ms), para el temporizador del modo examen. */
  inicioPeriodo?: number;
  config: ConfigPartida;
  nombres: string[];
  indiceJugador: number;
  /** Personalidad de cada empresa (null para los humanos), en el mismo orden que `nombres`. */
  personalidades: (Personalidad | null)[];
  /** Índices de las empresas que manejan personas (modo moderador). Si no está, solo `indiceJugador`. */
  equipos?: number[];
  /** Modo moderador: cupones ya entregados en el período actual, ocultos hasta procesar. */
  pendientes?: Record<number, Decisiones>;
  /** historial[0] es el período 0 (jugado por los organizadores). */
  historial: PeriodoJugado[];
}

const NOMBRES_BOTS = [
  'ALFA', 'DELTA', 'ZENIT', 'NOVA', 'ORION', 'ATLAS', 'FENIX', 'TITAN', 'VEGA', 'KRONOS', 'POLARIS', 'CENIT',
  'SIRIO', 'LYNX', 'AURORA', 'DRACO', 'HELIOS', 'NEXO', 'OMNIA', 'PULSAR', 'QUANTA', 'RIGEL',
];

export function crearPartida(config: ConfigPartida): Partida {
  const escenario = buscarEscenario(config.escenarioId);
  const rng = crearRng(config.semilla);
  const humanos = (config.equiposHumanos?.length ? config.equiposHumanos : [config.nombreEmpresa]).map((n) => n.toUpperCase());
  const disponibles = NOMBRES_BOTS.filter((n) => !humanos.includes(n));
  const bots: string[] = [];
  while (bots.length < config.cantidadBots) {
    const i = Math.floor(rng() * disponibles.length);
    bots.push(disponibles.splice(i, 1)[0]);
  }
  const plantel = armarPlantel(config.dificultad, config.cantidadBots, rng);
  // Cada equipo humano queda en un lugar al azar de la zona.
  const empresas: { nombre: string; personalidad: Personalidad | null }[] = bots.map((nombre, k) => ({ nombre, personalidad: plantel[k] }));
  for (const nombre of humanos) empresas.splice(Math.floor(rng() * (empresas.length + 1)), 0, { nombre, personalidad: null });
  const nombres = empresas.map((e) => e.nombre);
  const personalidades = empresas.map((e) => e.personalidad);
  const equipos = humanos.map((h) => nombres.indexOf(h));

  const zona = crearZona(escenario, nombres, config.reglas);
  const decisiones = nombres.map(() => escenario.periodo0.decisiones);
  const resultado = procesarPeriodo(zona, decisiones, datosDelPeriodo(escenario, 0, config.reglas), config.reglas, { semilla: config.semilla });
  return {
    version: 1,
    config,
    nombres,
    indiceJugador: equipos[0],
    personalidades,
    ...(humanos.length > 1 ? { equipos } : {}),
    historial: [{ numero: 0, decisiones, resultado }],
  };
}

/** Índices de los equipos humanos. */
export function equiposDe(p: Partida): number[] {
  return p.equipos ?? [p.indiceJugador];
}

/** La misma partida vista por un equipo (sus reportes privados, su hoja, su cupón). */
export function vistaDeEquipo(p: Partida, indice: number): Partida {
  return { ...p, indiceJugador: indice };
}

export function quebrada(p: Partida, indice: number): boolean {
  return zonaActual(p).empresas[indice].quebrada;
}

/** Número del período que se está por jugar. */
export function periodoActual(p: Partida): number {
  return p.historial.length;
}

/** Termina al pasar el último período, o antes si quebraron todos los equipos humanos (quedan descalificados). */
export function partidaTerminada(p: Partida): boolean {
  return periodoActual(p) > p.config.cantidadPeriodos || equiposDe(p).every((i) => quebrada(p, i));
}

export function jugadorQuebrado(p: Partida): boolean {
  return zonaActual(p).empresas[p.indiceJugador].quebrada;
}

export function zonaActual(p: Partida): Zona {
  return p.historial[p.historial.length - 1].resultado.zona;
}

export function ultimoPeriodo(p: Partida): PeriodoJugado {
  return p.historial[p.historial.length - 1];
}

export function estadoJugador(p: Partida): EstadoEmpresa {
  return zonaActual(p).empresas[p.indiceJugador];
}

/** Resultado del jugador en un período ya jugado. */
export function resultadoJugador(p: Partida, numero: number): ResultadoEmpresa | null {
  return p.historial[numero]?.resultado.empresas[p.indiceJugador] ?? null;
}

/** Comentario económico (noticia + límites) del período `numero`. */
export function comentarioDelPeriodo(p: Partida, numero: number): PeriodoEscenario {
  const c = periodoOProvisorio(buscarEscenario(p.config.escenarioId), numero);
  // Los textos dicen {banco1} y {banco2}: se reemplazan por los nombres de la configuración.
  const [b1, b2] = p.config.reglas.nombresBancos;
  const t = (x: string) => x.split('{banco1}').join(b1).split('{banco2}').join(b2);
  return {
    ...c,
    titulo: t(c.titulo),
    volanta: c.volanta && t(c.volanta),
    copete: c.copete && t(c.copete),
    noticia: c.noticia.map(t),
  };
}

export function datosDePartida(p: Partida, numero: number): DatosPeriodo {
  const datos = datosDelPeriodo(buscarEscenario(p.config.escenarioId), numero, p.config.reglas);
  return { ...datos, demanda: { ...datos.demanda, conRuido: p.config.conRuido } };
}

/** Contexto para el texto del Reporte de la Compañía de un período ya jugado. */
export function contextoReporte(p: Partida, numero: number): ContextoReporteCompania {
  const escenario = buscarEscenario(p.config.escenarioId);
  return {
    periodo: numero,
    nombresBancos: p.config.reglas.nombresBancos,
    ...(numero === 0
      ? { nombreEnTitulo: escenario.periodo0.nombreEnReporte, decisionesMostradas: escenario.periodo0.decisionesMostradas }
      : {}),
  };
}

/** Juega el período actual con las decisiones del jugador y las de los bots. */
export function jugarPeriodo(p: Partida, decisionJugador: Decisiones): Partida {
  return jugarPeriodoEquipos(p, { [p.indiceJugador]: decisionJugador });
}

/** Juega el período con el cupón de cada equipo humano (modo moderador) y las decisiones de los bots. */
export function jugarPeriodoEquipos(p: Partida, porEquipo: Record<number, Decisiones>): Partida {
  if (partidaTerminada(p)) throw new Error('La partida ya terminó.');
  const numero = periodoActual(p);
  const datos = datosDePartida(p, numero);
  const anterior = ultimoPeriodo(p).resultado;
  const zona = anterior.zona;
  const tags = comentarioDelPeriodo(p, numero).tags ?? [];
  const humanos = equiposDe(p);
  const decisiones = zona.empresas.map((estado, i) => {
    if (humanos.includes(i)) {
      if (estado.quebrada) return decisionesVacias();
      const d = porEquipo[i];
      if (!d) throw new Error(`Falta el cupón de ${p.nombres[i]}.`);
      return d;
    }
    return decidirBot(personalidadDe(p, i), {
      indice: i,
      nombre: p.nombres[i],
      estado,
      anterior: anterior.empresas[i],
      industrial: anterior.industrial,
      datos,
      tags,
      periodosRestantes: p.config.cantidadPeriodos - numero + 1,
      reglas: p.config.reglas,
      rng: crearRng(p.config.semilla * 7919 + numero * 101 + i),
      dificultad: p.config.dificultad,
    });
  });
  const resultado = procesarPeriodo(zona, decisiones, datos, p.config.reglas, { semilla: p.config.semilla + numero });
  const siguiente: Partida = { ...p, historial: [...p.historial, { numero, decisiones, resultado }] };
  delete siguiente.pendientes;
  return siguiente;
}

/** Personalidad de un bot (las partidas guardadas antes de la Fase 3 no la tienen: juegan como racional). */
export function personalidadDe(p: Partida, indice: number): Personalidad {
  return p.personalidades?.[indice] ?? 'racional';
}

/** Ranking por utilidad acumulada, del primero al último. Las quebradas quedan al final (descalificadas). */
export function ranking(p: Partida): (FilaCompeticion & { esJugador: boolean; esHumano: boolean })[] {
  const nombreJugador = p.nombres[p.indiceJugador];
  const humanos = equiposDe(p).map((i) => p.nombres[i]);
  return [...ultimoPeriodo(p).resultado.industrial.competicion]
    .sort((a, b) => Number(a.quebrada) - Number(b.quebrada) || b.utilidadAcumulada - a.utilidadAcumulada)
    .map((f) => ({ ...f, esJugador: f.nombre === nombreJugador, esHumano: humanos.includes(f.nombre) }));
}

/** Decisiones con las que arranca el cupón: las del período anterior, sin pedidos ni devoluciones. */
export function decisionesSugeridas(p: Partida): Decisiones {
  const previas = ultimoPeriodo(p).resultado.empresas[p.indiceJugador]?.decisiones;
  const lim = datosDePartida(p, periodoActual(p)).limites;
  const base: Decisiones = previas
    ? { ...previas, pedidos: [0, 0], devoluciones: [0, 0] }
    : { precio: 90, marketing: 8500, investigacion: 0, capacitacion: 0, ampliacion: 0, pedidos: [0, 0], devoluciones: [0, 0], nivel: 75 };
  return {
    ...base,
    precio: Math.max(lim.precioMin, Math.min(lim.precioMax, base.precio)),
    marketing: Math.max(lim.marketingMin, Math.min(lim.marketingMax, base.marketing)),
    investigacion: Math.min(lim.investigacionMax, base.investigacion),
    ampliacion: Math.min(lim.ampliacionMax, base.ampliacion),
  };
}

export function modoDe(p: Partida): ModoPartida {
  return p.config.modo ?? 'entrenamiento';
}

/** Minutos que dura el período `numero` en el modo examen. */
export function minutosDelPeriodo(p: Partida, numero: number): number {
  const lista = p.config.minutosPorPeriodo ?? MINUTOS_POR_PERIODO;
  return lista[Math.min(numero, lista.length) - 1] ?? lista[lista.length - 1];
}

/** Vuelve al período anterior (solo en entrenamiento). Los bots van a repetir lo que hicieron. */
export function deshacerPeriodo(p: Partida): Partida {
  if (p.historial.length <= 1) throw new Error('No hay períodos para deshacer.');
  if (modoDe(p) === 'examen') throw new Error('En el modo examen no se puede deshacer.');
  return { ...p, historial: p.historial.slice(0, -1) };
}
