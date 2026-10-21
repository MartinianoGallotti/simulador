// Objetivos del modelo de demanda (CLAUDE.md). Si se recalibra parametrosDemanda.json,
// estos tests dicen si el modelo sigue cumpliendo lo que sabemos del certamen.

import { crearRng } from '../azar';
import { calcularOrdenes, PARAMETROS_DEMANDA, type EntradaMercado } from '../mercado';

const igual: EntradaMercado = { precio: 90, marketing: 8500, idAcumulado: 1000 };
const zona = (primera: Partial<EntradaMercado>, n = 4): EntradaMercado[] => [
  { ...igual, ...primera },
  ...Array.from({ length: n - 1 }, () => igual),
];
/** Cambio relativo de las órdenes de la primera empresa frente a la zona toda igual. */
const cambio = (primera: Partial<EntradaMercado>, n = 4) => {
  const base = calcularOrdenes(zona({}, n)).ordenes[0];
  return calcularOrdenes(zona(primera, n)).ordenes[0] / base - 1;
};

describe('calibración', () => {
  it('4 empresas iguales (90 / 8.500 / I&D 1.000) reciben 1.346 órdenes cada una', () => {
    expect(calcularOrdenes(zona({})).ordenes).toEqual([1346, 1346, 1346, 1346]);
  });

  it('con otra cantidad de empresas iguales, cada una recibe lo mismo', () => {
    for (const n of [3, 5, 8]) expect(new Set(calcularOrdenes(zona({}, n)).ordenes)).toEqual(new Set([1346]));
  });
});

describe('precio: elasticidad muy alta', () => {
  it('bajar 1 peso da entre +5% y +7% de órdenes', () => {
    const c = cambio({ precio: 89 });
    expect(c).toBeGreaterThanOrEqual(0.05);
    expect(c).toBeLessThanOrEqual(0.07);
  });

  it('estar 3 pesos arriba del promedio de la zona da −20% o menos', () => {
    // A 94 con las otras tres a 90, el promedio es 91: está 3 pesos arriba.
    expect(calcularOrdenes(zona({ precio: 94 })).precioPromedio).toBe(91);
    expect(cambio({ precio: 94 })).toBeLessThanOrEqual(-0.2);
  });

  it('subir el precio castiga más que lo que premia bajarlo (asimetría)', () => {
    expect(-cambio({ precio: 92 })).toBeGreaterThan(cambio({ precio: 88 }));
  });

  it('el mercado total responde poco al precio promedio (elasticidad agregada ~1)', () => {
    const base = calcularOrdenes(zona({})).mercadoTotal;
    const todosSuben = calcularOrdenes(Array.from({ length: 4 }, () => ({ ...igual, precio: 90.9 }))).mercadoTotal;
    const caida = 1 - todosSuben / base; // precio +1%
    expect(caida).toBeGreaterThan(0.005);
    expect(caida).toBeLessThan(0.015);
  });
});

describe('marketing: rendimientos decrecientes', () => {
  it('+8% de marketing da cerca de +5% de órdenes', () => {
    const c = cambio({ marketing: 8500 * 1.08 });
    expect(c).toBeGreaterThanOrEqual(0.04);
    expect(c).toBeLessThanOrEqual(0.06);
  });

  it('cada peso extra de marketing rinde menos', () => {
    const c50 = cambio({ marketing: 8500 * 1.5 });
    const c100 = cambio({ marketing: 8500 * 2 });
    expect(c100).toBeGreaterThan(c50);
    expect(c100 - c50).toBeLessThan(c50);
  });

  it('sin marketing se pierden casi todas las ventas', () => {
    expect(cambio({ marketing: 0 })).toBeLessThan(-0.6);
  });
});

describe('investigación y desarrollo', () => {
  it('más I&D acumulado que el promedio da más órdenes', () => {
    expect(cambio({ idAcumulado: 10000 })).toBeGreaterThan(0.05);
  });

  it('su peso depende del escenario: si el público no valora la calidad, no cambia nada', () => {
    const conPeso = (pesoID: number) => {
      const r = calcularOrdenes(zona({ idAcumulado: 10000 }), { crecimiento: 1, pesoID });
      return r.ordenes[0] / r.ordenes[1];
    };
    expect(conPeso(0)).toBe(1);
    expect(conPeso(0.9)).toBeGreaterThan(conPeso(0.3));
  });
});

describe('eventos del comentario', () => {
  it('boom y recesión agrandan o achican el mercado', () => {
    expect(calcularOrdenes(zona({}), { crecimiento: 1.2 }).ordenes[0]).toBe(Math.round(1346 * 1.2));
    expect(calcularOrdenes(zona({}), { crecimiento: 0.85 }).ordenes[0]).toBe(Math.round(1346 * 0.85));
  });

  it('inflación: si el precio de referencia sube 10%, cobrar 10% más no achica el mercado', () => {
    const todos99 = Array.from({ length: 4 }, () => ({ ...igual, precio: 99 }));
    expect(calcularOrdenes(todos99, { crecimiento: 1, precioReferencia: 99 }).ordenes[0]).toBe(1346);
  });

  it('competidores externos se llevan una parte del mercado', () => {
    expect(calcularOrdenes(zona({}), { crecimiento: 1, competidoresExternos: 0.1 }).ordenes[0]).toBe(Math.round(1346 * 0.9));
  });
});

describe('ruido', () => {
  it('queda dentro de ±2% y con la misma semilla da lo mismo', () => {
    const conRuido = (semilla: number) => calcularOrdenes(zona({}), { crecimiento: 1, conRuido: true }, PARAMETROS_DEMANDA, crearRng(semilla)).ordenes;
    for (let s = 1; s <= 50; s++) {
      for (const o of conRuido(s)) {
        expect(o).toBeGreaterThanOrEqual(Math.floor(1346 * 0.98));
        expect(o).toBeLessThanOrEqual(Math.ceil(1346 * 1.02));
      }
    }
    expect(conRuido(7)).toEqual(conRuido(7));
  });
});
