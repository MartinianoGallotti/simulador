import { REGLAS_POR_DEFECTO } from '../config';
import {
  crearPartida,
  decisionesSugeridas,
  estadoJugador,
  jugadorQuebrado,
  jugarPeriodo,
  partidaTerminada,
  periodoActual,
  personalidadDe,
  ranking,
  type ConfigPartida,
} from '../partida';
import type { Dificultad } from '../bots/comun';
import { sugerirFinanciamiento } from '../hojaDeTrabajo';
import { datosDePartida, type Partida } from '../partida';
import type { Decisiones } from '../tipos';

/** Un jugador prolijo: repite precio y marketing, no invierte y cierra la hoja de trabajo. */
function jugadaProlija(p: Partida): Decisiones {
  const d = { ...decisionesSugeridas(p), ampliacion: 0, capacitacion: 0, investigacion: 0 };
  const s = sugerirFinanciamiento({
    estado: estadoJugador(p),
    economia: datosDePartida(p, periodoActual(p)).economia,
    decisiones: d,
    fondoFijo: 500,
    reglas: REGLAS_POR_DEFECTO,
  });
  return { ...d, pedidos: s.pedidos, devoluciones: s.devoluciones };
}

const config = (cambios: Partial<ConfigPartida> = {}): ConfigPartida => ({
  nombreEmpresa: 'OMEGA',
  cantidadBots: 3,
  dificultad: 'normal',
  escenarioId: 'holtec',
  cantidadPeriodos: 5,
  semilla: 42,
  conRuido: true,
  reglas: REGLAS_POR_DEFECTO,
  ...cambios,
});

describe('partida para un jugador', () => {
  it('arranca con el período 0 jugado y todas las empresas iguales', () => {
    const p = crearPartida(config());
    expect(p.nombres).toHaveLength(4);
    expect(p.nombres[p.indiceJugador]).toBe('OMEGA');
    expect(periodoActual(p)).toBe(1);
    expect(estadoJugador(p).efectivo).toBeCloseTo(115060.9, 0);
    expect(p.historial[0].resultado.empresas.every((e) => e?.marketing.ordenesRecibidas === 1346)).toBe(true);
  });

  it('se juegan los 5 períodos y termina con un ranking', () => {
    let p = crearPartida(config());
    while (!partidaTerminada(p)) p = jugarPeriodo(p, jugadaProlija(p));
    expect(p.historial).toHaveLength(6);
    const r = ranking(p);
    expect(r).toHaveLength(4);
    expect(r.filter((f) => f.esJugador)).toHaveLength(1);
    for (let i = 1; i < r.length; i++) expect(r[i - 1].utilidadAcumulada).toBeGreaterThanOrEqual(r[i].utilidadAcumulada);
  });

  it('si el jugador quiebra, la partida termina y queda último (descalificado)', () => {
    let p = crearPartida(config());
    // Pide 60.000 a Nación con un margen de 35.000: 25.000 van a giro y el límite es 10.000.
    p = jugarPeriodo(p, { ...decisionesSugeridas(p), pedidos: [60000, 0] });
    expect(jugadorQuebrado(p)).toBe(true);
    expect(partidaTerminada(p)).toBe(true);
    const r = ranking(p);
    expect(r[r.length - 1].esJugador).toBe(true);
    expect(() => jugarPeriodo(p, decisionesSugeridas(p))).toThrow();
  });

  it('es determinista: misma semilla, mismo resultado', () => {
    const jugar = () => {
      let p = crearPartida(config({ semilla: 7 }));
      while (!partidaTerminada(p)) p = jugarPeriodo(p, jugadaProlija(p));
      return ranking(p).map((f) => [f.nombre, Math.round(f.utilidadAcumulada)]);
    };
    expect(jugar()).toEqual(jugar());
  });

  it('los bots (salvo el novato) nunca quedan penalizados por falta de fondos', () => {
    const dificultades: Dificultad[] = ['facil', 'normal', 'dificil'];
    for (let semilla = 1; semilla <= 20; semilla++) {
      let p = crearPartida(config({ semilla, cantidadBots: 2 + (semilla % 6), dificultad: dificultades[semilla % 3] }));
      while (!partidaTerminada(p)) p = jugarPeriodo(p, jugadaProlija(p));
      for (const periodo of p.historial.slice(1)) {
        periodo.resultado.empresas.forEach((r, i) => {
          if (i === p.indiceJugador || !r || personalidadDe(p, i) === 'novato') return;
          expect(r.resultados.penalidad, `bot ${r.nombre} (${personalidadDe(p, i)}), período ${periodo.numero}, semilla ${semilla}`).toBe(0);
          expect(r.quebrada).toBe(false);
        });
      }
    }
  });
});
