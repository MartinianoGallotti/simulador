import { REGLAS_POR_DEFECTO, type Limites } from '../config';
import { corregirDecisiones, validarNombreEmpresa } from '../decisiones';
import type { Decisiones, DeudaBanco } from '../tipos';

const limites: Limites = {
  precioMin: 80,
  precioMax: 100,
  marketingMin: 0,
  marketingMax: 10000,
  investigacionMax: 10000,
  ampliacionMax: 15000,
};
const deudas: [DeudaBanco, DeudaBanco] = [
  { tomados: 55000, giro: 0 },
  { tomados: 65000, giro: 0 },
];
const base: Decisiones = {
  precio: 90,
  marketing: 8500,
  investigacion: 1000,
  capacitacion: 4000,
  ampliacion: 10000,
  pedidos: [0, 0],
  devoluciones: [0, 0],
  nivel: 75,
};
const corregir = (cambios: Partial<Decisiones>) =>
  corregirDecisiones({ ...base, ...cambios }, limites, deudas, REGLAS_POR_DEFECTO);

describe('corrección de decisiones al límite más cercano', () => {
  it('ejemplos del manual: 76 → 80 y 103 → 100', () => {
    expect(corregir({ precio: 76 }).decisiones.precio).toBe(80);
    expect(corregir({ precio: 103 }).decisiones.precio).toBe(100);
    expect(corregir({ precio: 90 }).correcciones).toEqual([]);
  });

  it('marketing, I&D y ampliación respetan los límites del comentario', () => {
    const r = corregir({ marketing: 12000, investigacion: 15000, ampliacion: 20000 });
    expect(r.decisiones.marketing).toBe(10000);
    expect(r.decisiones.investigacion).toBe(10000);
    expect(r.decisiones.ampliacion).toBe(15000);
    expect(r.correcciones).toHaveLength(3);
  });

  it('la ampliación puede ser cualquier entero dentro del límite', () => {
    expect(corregir({ ampliacion: 8000 }).decisiones.ampliacion).toBe(8000);
  });

  it('capacitación: hacia abajo al múltiplo de 2.000 (7.999 → 6.000)', () => {
    expect(corregir({ capacitacion: 7999 }).decisiones.capacitacion).toBe(6000);
    expect(corregir({ capacitacion: 1999 }).decisiones.capacitacion).toBe(0);
  });

  it('capacitación por encima del tope acumulado no se corrige (se paga igual)', () => {
    expect(corregir({ capacitacion: 30000 }).decisiones.capacitacion).toBe(30000);
  });

  it('las decisiones van sin decimales', () => {
    expect(corregir({ marketing: 8500.7 }).decisiones.marketing).toBe(8500);
  });

  it('no se puede pedir y devolver al mismo banco', () => {
    const r = corregir({ pedidos: [10000, 0], devoluciones: [5000, 3000] });
    expect(r.decisiones.pedidos).toEqual([10000, 0]);
    expect(r.decisiones.devoluciones).toEqual([0, 3000]);
  });

  it('no se puede devolver más de lo que se debe', () => {
    expect(corregir({ devoluciones: [0, 70000] }).decisiones.devoluciones).toEqual([0, 65000]);
  });

  it('el nivel se lleva al válido más cercano', () => {
    expect(corregir({ nivel: 80 as never }).decisiones.nivel).toBe(75);
  });
});

describe('nombre de la empresa', () => {
  it('hasta 10 caracteres y sin símbolos', () => {
    expect(validarNombreEmpresa('OMEGA', 10).valido).toBe(true);
    expect(validarNombreEmpresa('NACIONAL2020', 10).valido).toBe(false);
    expect(validarNombreEmpresa('OMEGA$', 10).valido).toBe(false);
  });
});
