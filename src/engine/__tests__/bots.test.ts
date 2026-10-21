// Comportamiento de las 6 personalidades de bot en los 3 escenarios.

import { crearRng } from '../azar';
import type { Dificultad } from '../bots/comun';
import { armarPlantel, type Personalidad } from '../bots/personalidades';
import { REGLAS_POR_DEFECTO } from '../config';
import { corregirDecisiones } from '../decisiones';
import { ESCENARIOS } from '../escenarios';
import { sugerirFinanciamiento } from '../hojaDeTrabajo';
import {
  crearPartida,
  datosDePartida,
  decisionesSugeridas,
  estadoJugador,
  jugarPeriodo,
  partidaTerminada,
  periodoActual,
  personalidadDe,
  type Partida,
} from '../partida';
import type { Decisiones } from '../tipos';

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

function jugarCompleta(escenarioId: string, dificultad: Dificultad, semilla: number, cantidadBots = 6): Partida {
  let p = crearPartida({
    nombreEmpresa: 'YO',
    cantidadBots,
    dificultad,
    escenarioId,
    cantidadPeriodos: 5,
    semilla,
    conRuido: true,
    reglas: REGLAS_POR_DEFECTO,
  });
  while (!partidaTerminada(p)) p = jugarPeriodo(p, jugadaProlija(p));
  return p;
}

/** Recorre cada decisión de cada bot en partidas de todos los escenarios y dificultades. */
const partidas: Partida[] = [];
for (const e of ESCENARIOS) {
  for (const dif of ['facil', 'normal', 'dificil'] as Dificultad[]) {
    for (let semilla = 1; semilla <= 3; semilla++) partidas.push(jugarCompleta(e.id, dif, semilla * 13));
  }
}

function cadaDecision(fn: (args: { p: Partida; personalidad: Personalidad; d: Decisiones; periodo: number; i: number }) => void) {
  for (const p of partidas) {
    for (const h of p.historial.slice(1)) {
      h.decisiones.forEach((d, i) => {
        if (i === p.indiceJugador || !h.resultado.empresas[i]) return;
        fn({ p, personalidad: personalidadDe(p, i), d, periodo: h.numero, i });
      });
    }
  }
}

describe('bots', () => {
  it('salvo el novato, ninguno queda penalizado ni quiebra', () => {
    for (const p of partidas) {
      for (const h of p.historial.slice(1)) {
        h.resultado.empresas.forEach((r, i) => {
          if (!r || i === p.indiceJugador || personalidadDe(p, i) === 'novato') return;
          expect(r.resultados.penalidad, `${personalidadDe(p, i)} en ${p.config.escenarioId} período ${h.numero}`).toBe(0);
          expect(r.quebrada).toBe(false);
        });
      }
    }
  });

  it('salvo el novato, sus decisiones respetan los límites (el moderador no corrige nada)', () => {
    cadaDecision(({ p, personalidad, d, periodo, i }) => {
      if (personalidad === 'novato') return;
      const datos = datosDePartida(p, periodo);
      const deudas = p.historial[periodo - 1].resultado.zona.empresas[i].deudas;
      expect(corregirDecisiones(d, datos.limites, deudas, REGLAS_POR_DEFECTO).correcciones).toEqual([]);
    });
  });

  it('el novato a veces se equivoca (corrección de límites o penalidad)', () => {
    let errores = 0;
    for (const p of partidas) {
      for (const h of p.historial.slice(1)) {
        h.resultado.empresas.forEach((r, i) => {
          if (r && personalidadDe(p, i) === 'novato' && (r.correcciones.length > 0 || r.resultados.penalidad > 0)) errores++;
        });
      }
    }
    expect(errores).toBeGreaterThan(0);
  });

  it('el racional no invierte en el último período (ya no le serviría)', () => {
    cadaDecision(({ p, personalidad, d, periodo }) => {
      if (personalidad !== 'racional' || periodo !== p.config.cantidadPeriodos) return;
      expect(d.ampliacion + d.capacitacion + d.investigacion).toBe(0);
    });
  });

  it('el agresivo pone precios más bajos que el de calidad', () => {
    const promedio = (pers: Personalidad) => {
      const precios: number[] = [];
      cadaDecision(({ personalidad, d }) => personalidad === pers && precios.push(d.precio));
      return precios.reduce((a, b) => a + b, 0) / precios.length;
    };
    expect(promedio('agresivo')).toBeLessThan(promedio('calidad') - 2);
  });

  it('el de calidad invierte más en I&D que el conservador', () => {
    const total = (pers: Personalidad) => {
      let t = 0;
      cadaDecision(({ personalidad, d }) => personalidad === pers && (t += d.investigacion));
      return t;
    };
    expect(total('calidad')).toBeGreaterThan(total('conservador') * 2);
  });

  it('el conservador no amplía la planta', () => {
    cadaDecision(({ personalidad, d }) => personalidad === 'conservador' && expect(d.ampliacion).toBe(0));
  });

  it('leen el comentario: en plena crisis nadie (salvo el novato) amplía la planta', () => {
    cadaDecision(({ p, personalidad, d, periodo }) => {
      if (p.config.escenarioId !== 'recesion' || periodo !== 3 || personalidad === 'novato') return;
      expect(d.ampliacion).toBe(0);
    });
  });

  it('leen el comentario: si el público valora la calidad, invierten en I&D', () => {
    cadaDecision(({ p, personalidad, d, periodo }) => {
      if (p.config.escenarioId !== 'calidad' || periodo >= p.config.cantidadPeriodos) return;
      if (['racional', 'calidad', 'conservador'].includes(personalidad)) expect(d.investigacion).toBeGreaterThan(2000);
    });
  });
});

describe('plantel según la dificultad', () => {
  it('en difícil no hay novatos y en fácil sí', () => {
    const rng = crearRng(1);
    expect(armarPlantel('dificil', 7, rng)).not.toContain('novato');
    expect(armarPlantel('facil', 3, rng)).toContain('novato');
  });

  it('siempre devuelve la cantidad pedida', () => {
    for (const n of [2, 3, 7]) expect(armarPlantel('normal', n, crearRng(n))).toHaveLength(n);
  });
});
