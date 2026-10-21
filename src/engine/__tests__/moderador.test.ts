// Modo moderador (varios equipos humanos en el mismo dispositivo) y configuración de reglas.

import { REGLAS_POR_DEFECTO } from '../config';
import {
  comentarioDelPeriodo,
  crearPartida,
  datosDePartida,
  decisionesSugeridas,
  equiposDe,
  jugarPeriodoEquipos,
  partidaTerminada,
  personalidadDe,
  quebrada,
  ranking,
  resultadoJugador,
  vistaDeEquipo,
  type ConfigPartida,
  type Partida,
} from '../partida';
import type { Decisiones } from '../tipos';

const config = (cambios: Partial<ConfigPartida> = {}): ConfigPartida => ({
  nombreEmpresa: 'ROJO',
  equiposHumanos: ['ROJO', 'AZUL', 'VERDE'],
  cantidadBots: 2,
  dificultad: 'normal',
  escenarioId: 'holtec',
  cantidadPeriodos: 5,
  semilla: 5,
  conRuido: false,
  reglas: REGLAS_POR_DEFECTO,
  ...cambios,
});

/** Cupón de cada equipo humano: lo que sugiere el juego, con un precio distinto por equipo. */
function cupones(p: Partida, precios: number[]): Record<number, Decisiones> {
  const r: Record<number, Decisiones> = {};
  equiposDe(p).forEach((i, k) => {
    if (!quebrada(p, i)) r[i] = { ...decisionesSugeridas(vistaDeEquipo(p, i)), ampliacion: 0, precio: precios[k] };
  });
  return r;
}

describe('modo moderador', () => {
  const p = crearPartida(config());

  it('arma la zona con los equipos humanos y los bots', () => {
    expect(p.nombres).toHaveLength(5);
    expect(equiposDe(p).map((i) => p.nombres[i]).sort()).toEqual(['AZUL', 'ROJO', 'VERDE']);
    for (const i of equiposDe(p)) expect(p.personalidades[i]).toBeNull();
    const bots = p.nombres.map((_, i) => i).filter((i) => !equiposDe(p).includes(i));
    for (const i of bots) expect(personalidadDe(p, i)).toBeTruthy();
  });

  it('no se procesa el período si falta el cupón de algún equipo', () => {
    const c = cupones(p, [90, 90, 90]);
    delete c[equiposDe(p)[1]];
    expect(() => jugarPeriodoEquipos(p, c)).toThrow(/Falta el cupón/);
  });

  it('cada equipo ve su propio reporte', () => {
    const p1 = jugarPeriodoEquipos(p, cupones(p, [88, 90, 92]));
    const [a, b, c] = equiposDe(p1).map((i) => resultadoJugador(vistaDeEquipo(p1, i), 1)!);
    expect([a.decisiones.precio, b.decisiones.precio, c.decisiones.precio]).toEqual([88, 90, 92]);
    expect(a.marketing.ordenesRecibidas).toBeGreaterThan(c.marketing.ordenesRecibidas);
    expect(ranking(p1).filter((f) => f.esHumano)).toHaveLength(3);
  });

  it('se juega completa; si un equipo quiebra, los demás siguen', () => {
    let q = crearPartida(config());
    // El primer equipo pide de más al banco y quiebra en el período 1.
    const c = cupones(q, [90, 90, 90]);
    const primero = equiposDe(q)[0];
    c[primero] = { ...c[primero], pedidos: [60000, 0] };
    q = jugarPeriodoEquipos(q, c);
    expect(quebrada(q, primero)).toBe(true);
    expect(partidaTerminada(q)).toBe(false);
    while (!partidaTerminada(q)) q = jugarPeriodoEquipos(q, cupones(q, [90, 89, 91]));
    expect(q.historial).toHaveLength(6);
    expect(ranking(q)[ranking(q).length - 1].nombre).toBe(q.nombres[primero]);
  });

  it('los cupones pendientes se borran al procesar el período', () => {
    const conPendientes: Partida = { ...p, pendientes: cupones(p, [90, 90, 90]) };
    expect(jugarPeriodoEquipos(conPendientes, conPendientes.pendientes!).pendientes).toBeUndefined();
  });
});

describe('configuración de reglas', () => {
  it('se puede cambiar la economía inicial, y los cambios del comentario van encima', () => {
    const reglas = {
      ...REGLAS_POR_DEFECTO,
      economia: { tasaImpuesto: 30, bancos: [{ tasaAnual: 20 }, {}] as [{ tasaAnual: number }, object] },
    };
    const p = crearPartida(config({ reglas, equiposHumanos: undefined }));
    expect(datosDePartida(p, 1).economia.tasaImpuesto).toBe(30);
    expect(datosDePartida(p, 1).economia.bancos[0].tasaAnual).toBe(20);
    expect(datosDePartida(p, 1).economia.bancos[1].tasaAnual).toBe(36);
    // En el período 3 de HOLTEC el comentario sube Provincia a 40%.
    expect(datosDePartida(p, 3).economia.bancos[1].tasaAnual).toBe(40);
    // El período 0 también usa la economía configurada: el interés baja.
    expect(p.historial[0].resultado.empresas[0]!.resultados.intereses).toBeCloseTo((55000 * 20) / 300 + (65000 * 36) / 300, 6);
  });

  it('los comentarios usan los nombres de banco de la configuración', () => {
    const reglas = { ...REGLAS_POR_DEFECTO, nombresBancos: ['REPUBLICA', 'SANTANDER'] as [string, string] };
    const p = crearPartida(config({ reglas, equiposHumanos: undefined }));
    const texto = comentarioDelPeriodo(p, 3).noticia.join(' ');
    expect(texto).toContain('Banco SANTANDER');
    expect(texto).not.toContain('{banco');
  });
});
