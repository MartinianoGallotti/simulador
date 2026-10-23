// Arranque al azar: cada partida empieza distinto, pero siempre coherente.

import { crearRng } from '../azar';
import { decidirBot } from '../bots/personalidades';
import { REGLAS_POR_DEFECTO } from '../config';
import { ESCENARIOS } from '../escenarios';
import {
  comentarioDelPeriodo,
  contextoReporte,
  crearPartida,
  datosDePartida,
  estadoJugador,
  jugarPeriodo,
  partidaTerminada,
  periodoActual,
  personalidadDe,
  type ConfigPartida,
  type Partida,
} from '../partida';
import { textoReporteCompania } from '../reportes';
import type { Decisiones } from '../tipos';

const config = (cambios: Partial<ConfigPartida> = {}): ConfigPartida => ({
  nombreEmpresa: 'OMEGA',
  cantidadBots: 3,
  dificultad: 'normal',
  escenarioId: 'holtec',
  cantidadPeriodos: 5,
  semilla: 1,
  conRuido: true,
  arranqueAlAzar: true,
  reglas: REGLAS_POR_DEFECTO,
  ...cambios,
});

function jugadaRacional(p: Partida): Decisiones {
  const numero = periodoActual(p);
  const anterior = p.historial[numero - 1].resultado;
  return decidirBot('racional', {
    indice: p.indiceJugador,
    nombre: p.nombres[p.indiceJugador],
    estado: estadoJugador(p),
    anterior: anterior.empresas[p.indiceJugador],
    industrial: anterior.industrial,
    datos: datosDePartida(p, numero),
    tags: comentarioDelPeriodo(p, numero).tags ?? [],
    periodosRestantes: p.config.cantidadPeriodos - numero + 1,
    reglas: p.config.reglas,
    rng: crearRng(numero),
    dificultad: 'normal',
  });
}

describe('arranque al azar', () => {
  const partidas = Array.from({ length: 40 }, (_, s) => crearPartida(config({ semilla: s + 1, escenarioId: ESCENARIOS[s % 3].id })));

  it('cada partida arranca distinto', () => {
    const plantas = new Set(partidas.map((p) => p.arranque!.estadoInicial.planta));
    const tasas = new Set(partidas.map((p) => p.arranque!.economia.bancos[0].tasaAnual));
    const precios = new Set(partidas.map((p) => p.arranque!.decisiones0.precio));
    expect(plantas.size).toBeGreaterThan(5);
    expect(tasas.size).toBeGreaterThan(5);
    expect(precios.size).toBeGreaterThan(5);
  });

  it('el balance inicial cierra y los préstamos no pasan el máximo', () => {
    for (const p of partidas) {
      const a = p.arranque!;
      const ini = a.estadoInicial;
      expect(ini.efectivo + ini.planta).toBe(ini.prestamosTomados[0] + ini.prestamosTomados[1] + REGLAS_POR_DEFECTO.capital);
      for (const i of [0, 1]) {
        expect(ini.prestamosTomados[i]).toBeGreaterThan(0);
        expect(ini.prestamosTomados[i]).toBeLessThan(a.economia.bancos[i].maximoCredito);
      }
      expect(ini.planta).toBeGreaterThanOrEqual(60000);
      expect(ini.planta).toBeLessThanOrEqual(110000);
    }
  });

  it('el período 0 sale bien para todos: sin penalidad, con ganancia y todas iguales', () => {
    for (const p of partidas) {
      const r0 = p.historial[0].resultado.empresas;
      for (const r of r0) {
        expect(r!.resultados.penalidad).toBe(0);
        expect(r!.balance.totalActivo).toBeCloseTo(r!.balance.pasivoMasPatrimonio, 6);
        expect(r!.marketing.ordenesNoRealizadas).toBeGreaterThan(0); // en el período 0 sobra demanda, como en el manual
        expect(r!.resultados.utilidad).toBeCloseTo(r0[0]!.resultados.utilidad, 6);
      }
    }
  });

  it('los límites del comentario se corren según el precio y el tamaño de la planta', () => {
    for (const p of partidas) {
      const a = p.arranque!;
      const lim = datosDePartida(p, 1).limites;
      // En el período 1 el precio inicial queda dentro de los límites, como en el manual (90 entre 86 y 94).
      expect(a.decisiones0.precio).toBeGreaterThanOrEqual(lim.precioMin);
      expect(a.decisiones0.precio).toBeLessThanOrEqual(lim.precioMax);
      expect(lim.ampliacionMax).toBeGreaterThanOrEqual(5000);
      expect(comentarioDelPeriodo(p, 1).limites).toEqual(lim);
    }
  });

  it('los cambios del comentario se aplican como diferencias (HOLTEC 3: Provincia +4 puntos)', () => {
    const p = partidas.find((x) => x.config.escenarioId === 'holtec')!;
    const t2 = (n: number) => datosDePartida(p, n).economia.bancos[1].tasaAnual;
    expect(t2(3) - t2(2)).toBe(4);
    const texto = comentarioDelPeriodo(p, 3).noticia.join(' ');
    expect(texto).toContain(`del ${t2(2)}% al ${t2(3)}%`);
    expect(texto).not.toMatch(/\{\w+\}/);
  });

  it('sin arranque al azar los textos quedan como los escribimos', () => {
    const p = crearPartida(config({ arranqueAlAzar: false }));
    expect(p.arranque).toBeUndefined();
    expect(comentarioDelPeriodo(p, 3).noticia.join(' ')).toContain('del 36% al 40%');
    expect(comentarioDelPeriodo(p, 5).noticia.join(' ')).toContain('del 35% al 30%');
  });

  it('el reporte del período 0 muestra los préstamos iniciales como pedidos', () => {
    const p = partidas[0];
    const texto = textoReporteCompania(p.historial[0].resultado.empresas[0]!, contextoReporte(p, 0));
    expect(texto).toContain(String(p.arranque!.estadoInicial.prestamosTomados[0]));
  });

  it('es determinista: la misma semilla da el mismo arranque', () => {
    expect(crearPartida(config({ semilla: 77 })).arranque).toEqual(crearPartida(config({ semilla: 77 })).arranque);
  });

  it('se juega completa en los tres escenarios y los bots (salvo el novato) no quedan penalizados', () => {
    for (let s = 1; s <= 9; s++) {
      let p = crearPartida(config({ semilla: s * 11, escenarioId: ESCENARIOS[s % 3].id, cantidadBots: 5, cantidadPeriodos: 7 }));
      while (!partidaTerminada(p)) p = jugarPeriodo(p, jugadaRacional(p));
      for (const h of p.historial.slice(1)) {
        h.resultado.empresas.forEach((r, i) => {
          if (!r || personalidadDe(p, i) === 'novato') return;
          expect(r.resultados.penalidad, `${p.config.escenarioId} semilla ${s * 11}: ${r.nombre} período ${h.numero}`).toBe(0);
          expect(r.balance.totalActivo).toBeCloseTo(r.balance.pasivoMasPatrimonio, 6);
        });
      }
    }
  });
});
