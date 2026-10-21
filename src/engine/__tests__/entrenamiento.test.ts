import { REGLAS_POR_DEFECTO } from '../config';
import { revisarHoja, type HojaManual } from '../entrenamiento/avisos';
import { explicarPeriodo } from '../entrenamiento/explicar';
import { barridoDePrecios, simularYSi } from '../entrenamiento/ysi';
import type { EntradaHoja } from '../hojaDeTrabajo';
import {
  crearPartida,
  datosDePartida,
  decisionesSugeridas,
  deshacerPeriodo,
  estadoJugador,
  jugarPeriodo,
  minutosDelPeriodo,
  periodoActual,
  resultadoJugador,
  type ConfigPartida,
  type Partida,
} from '../partida';
import type { Decisiones } from '../tipos';

const config = (cambios: Partial<ConfigPartida> = {}): ConfigPartida => ({
  nombreEmpresa: 'OMEGA',
  cantidadBots: 3,
  dificultad: 'normal',
  escenarioId: 'holtec',
  cantidadPeriodos: 5,
  semilla: 99,
  conRuido: true,
  reglas: REGLAS_POR_DEFECTO,
  ...cambios,
});

/** Período 1 de HOLTEC: efectivo ~115.061, planta 90.000, márgenes 35.000 (Nación) y 10.000 (Provincia). */
const p1 = crearPartida(config());
const base: Decisiones = { ...decisionesSugeridas(p1), ampliacion: 0 };

function entrada(cambios: Partial<Decisiones> = {}, fondoFijo = 100, p: Partida = p1): EntradaHoja {
  return {
    estado: estadoJugador(p),
    economia: datosDePartida(p, periodoActual(p)).economia,
    decisiones: { ...base, ...cambios },
    fondoFijo,
    reglas: REGLAS_POR_DEFECTO,
  };
}
const contexto = (p: Partida = p1, manual?: HojaManual) => ({
  anterior: resultadoJugador(p, periodoActual(p) - 1),
  limites: datosDePartida(p, periodoActual(p)).limites,
  periodosRestantes: p.config.cantidadPeriodos - periodoActual(p) + 1,
  manual,
});
const ids = (e: EntradaHoja, p: Partida = p1, manual?: HojaManual) => revisarHoja(e, contexto(p, manual)).map((a) => a.id);

describe('avisos de errores frecuentes', () => {
  it('una hoja prolija no tiene errores', () => {
    expect(revisarHoja(entrada(), contexto()).filter((a) => a.nivel === 'error')).toEqual([]);
  });

  it('pedido mayor que el margen (va a giro) y aviso de quiebra si pasa el límite', () => {
    expect(ids(entrada({ pedidos: [40000, 0] }))).toContain('pedido-margen-0');
    expect(ids(entrada({ pedidos: [40000, 0] }))).not.toContain('quiebra');
    expect(ids(entrada({ pedidos: [50000, 0] }))).toContain('quiebra');
  });

  it('confundir "pedido" con "préstamos tomados"', () => {
    expect(ids(entrada({ pedidos: [55000, 0] }))).toContain('pedido-tomados-0');
  });

  it('pedir y devolver al mismo banco', () => {
    expect(ids(entrada({ pedidos: [1000, 0], devoluciones: [1000, 0] }))).toContain('mismo-banco-0');
  });

  it('capacitación que no es múltiplo de 2.000 o que pasa los 20.000 acumulados', () => {
    expect(ids(entrada({ capacitacion: 5000 }))).toContain('capacitacion-multiplo');
    expect(ids(entrada({ capacitacion: 18000 }))).toContain('capacitacion-tope'); // ya tiene 4.000
  });

  it('necesidad de dinero mayor que los fondos (penalidad)', () => {
    expect(ids(entrada({ ampliacion: 15000, marketing: 10000, investigacion: 10000 }))).toContain('penalidad');
  });

  it('mucha plata ociosa en el fondo fijo', () => {
    expect(ids(entrada({}, 5000))).toContain('plata-ociosa');
    expect(ids(entrada({}, 10))).toContain('fondo-fijo-minimo');
  });

  it('hoja manual: datos del Reporte de Producción en vez de los Valores del Próximo Período', () => {
    // El Reporte de Producción del período 0 dice capacidad 1.600 y costo 59,97; los valores del próximo período, 1.800 y 51,57.
    const avisos = revisarHoja(entrada(), contexto(p1, { capacidad: 1600, costoUnitario: 59.97 }));
    const capacidad = avisos.find((a) => a.id === 'manual-capacidad')!;
    expect(capacidad.titulo).toContain('Reporte de Producción');
    expect(avisos.find((a) => a.id === 'manual-costoUnitario')!.titulo).toContain('Reporte de Producción');
  });

  it('hoja manual: mantenimiento con la planta ya ampliada e intereses mal copiados', () => {
    const avisos = revisarHoja(entrada({ ampliacion: 10000 }), contexto(p1, { mantenimiento: 10000, intereses: 12000 }));
    expect(avisos.find((a) => a.id === 'manual-mantenimiento')!.detalle).toContain('ANTES de ampliar');
    expect(avisos.map((a) => a.id)).toContain('manual-intereses');
  });

  it('hoja manual: lo bien copiado no da error', () => {
    const avisos = revisarHoja(entrada(), contexto(p1, { capacidad: 1800, mantenimiento: 9000, intereses: 12750, efectivo: 115061 }));
    expect(avisos.filter((a) => a.id.startsWith('manual-'))).toEqual([]);
  });

  it('copiar los intereses del período anterior cuando cambiaron los préstamos', () => {
    const p2 = jugarPeriodo(p1, { ...base, pedidos: [20000, 0] });
    expect(ids(entrada({}, 100, p2), p2)).toContain('intereses-copiados');
    const avisos = revisarHoja(entrada({}, 100, p2), contexto(p2, { intereses: 12750 }));
    expect(avisos.find((a) => a.id === 'manual-intereses')!.titulo).toContain('Copiaste los intereses');
  });

  it('invertir en capacitación o I&D en el último período', () => {
    let p = crearPartida(config({ cantidadPeriodos: 1 }));
    expect(ids(entrada({ capacitacion: 4000 }, 100, p), p)).toContain('ultimo-periodo');
    p = crearPartida(config({ cantidadPeriodos: 3 }));
    expect(ids(entrada({ capacitacion: 4000 }, 100, p), p)).not.toContain('ultimo-periodo');
  });
});

describe('¿Qué pasó?', () => {
  it('explica la demanda con precio, marketing e I&D frente al promedio', () => {
    const p = jugarPeriodo(p1, { ...base, precio: 88 });
    const e = explicarPeriodo(p, 1)!;
    expect(e.porQueDemanda.find((x) => x.titulo.startsWith('Precio'))!.tono).toBe('bien');
    expect(e.demanda.factorPrecio).toBeGreaterThan(1);
    expect(e.resumen).toMatch(/período 1/);
  });

  it('avisa si se perdieron ventas o sobró stock', () => {
    const caro = explicarPeriodo(jugarPeriodo(p1, { ...base, precio: 94, marketing: 2000, nivel: 100 }), 1)!;
    expect(caro.ofertaYDemanda[0].titulo).toMatch(/sobraron/);
    const barato = explicarPeriodo(jugarPeriodo(p1, { ...base, precio: 86, marketing: 10000, nivel: 50 }), 1)!;
    expect(barato.ofertaYDemanda[0].titulo).toMatch(/perdiste/);
  });

  it('explica la penalidad', () => {
    const p = jugarPeriodo(p1, { ...base, ampliacion: 15000, marketing: 10000, investigacion: 10000 });
    expect(explicarPeriodo(p, 1)!.plata.some((x) => x.titulo.startsWith('Penalidad'))).toBe(true);
  });

  it('el período 0 no tiene explicación (lo jugaron los organizadores)', () => {
    expect(explicarPeriodo(p1, 0)).toBeNull();
  });
});

describe('¿Y si…?', () => {
  it('no avanza la partida', () => {
    const antes = JSON.stringify(p1);
    simularYSi(p1, base);
    expect(JSON.stringify(p1)).toBe(antes);
  });

  it('a mayor precio, menos órdenes', () => {
    const filas = barridoDePrecios(p1, base);
    expect(filas[0].precio).toBe(86);
    expect(filas[filas.length - 1].precio).toBe(94);
    for (let i = 1; i < filas.length; i++) expect(filas[i].ordenes).toBeLessThan(filas[i - 1].ordenes);
  });

  it('muestra la penalidad si la decisión no tiene fondos', () => {
    expect(simularYSi(p1, { ...base, ampliacion: 15000, marketing: 10000, investigacion: 10000 }).resultado.resultados.penalidad).toBe(500);
  });
});

describe('deshacer y modo examen', () => {
  it('deshacer y reintentar con las mismas decisiones da el mismo resultado (los bots repiten)', () => {
    const jugado = jugarPeriodo(p1, base);
    const otraVez = jugarPeriodo(deshacerPeriodo(jugado), base);
    expect(JSON.stringify(otraVez.historial)).toBe(JSON.stringify(jugado.historial));
  });

  it('en el modo examen no se puede deshacer', () => {
    const p = jugarPeriodo(crearPartida(config({ modo: 'examen' })), base);
    expect(() => deshacerPeriodo(p)).toThrow();
  });

  it('el primer período dura 30 minutos y después baja', () => {
    expect(minutosDelPeriodo(p1, 1)).toBe(30);
    expect(minutosDelPeriodo(p1, 2)).toBeLessThan(30);
    expect(minutosDelPeriodo(p1, 6)).toBeGreaterThan(0);
  });
});
