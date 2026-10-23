// Escenarios: estado inicial, período 0 y, para cada período, el Comentario Económico
// (noticia + límites) y lo que cambia en la economía y en la demanda.
// Para agregar un escenario alcanza con sumar un JSON y registrarlo acá.

import { combinarEconomia, type CambiosEconomia, type Economia, type Limites } from '../config';
import type { ContextoDemanda } from '../mercado';
import type { Decisiones } from '../tipos';
import calidad from './calidad.json';
import holtec from './holtec.json';
import recesion from './recesion.json';

export interface PeriodoEscenario {
  numero: number;
  ronda?: string;
  volanta?: string;
  titulo: string;
  copete?: string;
  noticia: string[];
  limites: Limites;
  /** Cambios anunciados en el comentario (tasas, máximos, impuesto, mantenimiento…). */
  cambiosEconomia?: CambiosEconomia;
  /** Lo que el comentario anticipa sobre el mercado. */
  demanda?: Partial<ContextoDemanda>;
  /** Pistas para los bots: "recesion", "boom", "calidad", "inflacion"… */
  tags?: string[];
}

export interface Escenario {
  id: string;
  nombre: string;
  descripcion: string;
  estadoInicial: {
    efectivo: number;
    planta: number;
    capacitacionAcumulada: number;
    idAcumulado: number;
    empleados: number;
    prestamosTomados: [number, number];
  };
  economiaInicial: Economia;
  periodo0: {
    nombreEnReporte: string;
    decisiones: Decisiones;
    /** Lo que muestra el reporte del período 0 en "Decisiones tomadas", si difiere de lo procesado. */
    // SUPUESTO: en el reporte real del período 0 los préstamos iniciales figuran como pedidos;
    // se muestran así, pero la empresa ya arranca con esa deuda y no se procesan como pedidos.
    decisionesMostradas?: Partial<Decisiones>;
    demanda?: Partial<ContextoDemanda>;
  };
  periodos: PeriodoEscenario[];
}

export const ESCENARIOS: Escenario[] = [holtec, recesion, calidad] as unknown as Escenario[];

export function buscarEscenario(id: string): Escenario {
  const e = ESCENARIOS.find((x) => x.id === id);
  if (!e) throw new Error(`No existe el escenario ${id}`);
  return e;
}

export function periodoDelEscenario(escenario: Escenario, numero: number): PeriodoEscenario {
  const p = escenario.periodos.find((x) => x.numero === numero);
  if (!p) throw new Error(`El escenario ${escenario.id} no tiene el período ${numero}`);
  return p;
}

/**
 * Igual que periodoDelEscenario, pero si el escenario todavía no tiene ese período
 * arma un comentario provisorio con los límites del último período cargado.
 */
// Red de seguridad para escenarios nuevos con menos períodos que la partida (los 3 de fábrica tienen 6).
export function periodoOProvisorio(escenario: Escenario, numero: number): PeriodoEscenario {
  const existente = escenario.periodos.find((x) => x.numero === numero);
  if (existente) return existente;
  const ultimo = [...escenario.periodos].sort((a, b) => b.numero - a.numero)[0];
  return {
    numero,
    titulo: 'EL MERCADO SIGUE SU CURSO',
    noticia: [
      'No hay grandes novedades en el mercado. Las condiciones se mantienen similares a las del período anterior.',
      'Los límites de las decisiones son los mismos que en el último comentario.',
    ],
    limites: ultimo.limites,
    demanda: { crecimiento: 1 },
    tags: [],
  };
}

/** Economía vigente en un período: la inicial más todos los cambios anunciados hasta ese período. */
export function economiaDelPeriodo(escenario: Escenario, numero: number, ajustes?: CambiosEconomia, inicioPropio?: Economia): Economia {
  // La configuración puede cambiar la economía inicial; los cambios del comentario van encima.
  let eco = combinarEconomia(escenario.economiaInicial, ajustes);
  // Con un arranque propio (al azar), los cambios del comentario se aplican como diferencias:
  // "la tasa sube de 36% a 40%" pasa a ser "la tasa sube 4 puntos".
  let propio = inicioPropio;
  for (const p of escenario.periodos) {
    if (p.numero > numero || !p.cambiosEconomia) continue;
    const nueva = combinarEconomia(eco, p.cambiosEconomia);
    if (propio) propio = aplicarDiferencias(propio, eco, nueva);
    eco = nueva;
  }
  return propio ?? eco;
}

/** Suma a `base` lo que cambió de `antes` a `despues`. */
function aplicarDiferencias(base: Economia, antes: Economia, despues: Economia): Economia {
  const d = (campo: 'tasaImpuesto' | 'tasaMantenimiento' | 'costoStockUnidad' | 'limiteGiro') =>
    Math.max(0, base[campo] + despues[campo] - antes[campo]);
  return {
    tasaImpuesto: d('tasaImpuesto'),
    tasaMantenimiento: d('tasaMantenimiento'),
    costoStockUnidad: d('costoStockUnidad'),
    limiteGiro: d('limiteGiro'),
    bancos: [0, 1].map((i) => ({
      maximoCredito: Math.max(0, base.bancos[i].maximoCredito + despues.bancos[i].maximoCredito - antes.bancos[i].maximoCredito),
      tasaAnual: Math.max(1, base.bancos[i].tasaAnual + despues.bancos[i].tasaAnual - antes.bancos[i].tasaAnual),
    })) as Economia['bancos'],
  };
}
