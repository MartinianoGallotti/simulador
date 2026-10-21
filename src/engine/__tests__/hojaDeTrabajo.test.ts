// Caso de prueba 2: la hoja de trabajo del video de capacitación (período 1, versión 2014).

import { REGLAS_POR_DEFECTO, type Economia } from '../config';
import { calcularHojaDeTrabajo, sugerirFinanciamiento, type EntradaHoja } from '../hojaDeTrabajo';
import type { Decisiones, EstadoEmpresa } from '../tipos';

const estado: EstadoEmpresa = {
  nombre: 'OMEGA',
  efectivo: 122182,
  planta: 65000,
  capacitacionAcumulada: 2000,
  idAcumulado: 0,
  stock: [],
  empleados: 0,
  deudas: [
    { tomados: 70000, giro: 0 },
    { tomados: 50000, giro: 0 },
  ],
  utilidadAcumulada: 0,
  capital: 80000,
  quebrada: false,
};
const economia: Economia = {
  bancos: [
    { maximoCredito: 90000, tasaAnual: 18 },
    { maximoCredito: 80000, tasaAnual: 30 },
  ],
  tasaImpuesto: 35,
  tasaMantenimiento: 13,
  costoStockUnidad: 10,
  limiteGiro: 10000,
};
const decisiones: Decisiones = {
  precio: 92,
  marketing: 8500,
  investigacion: 5000,
  capacitacion: 10000,
  ampliacion: 10000,
  pedidos: [0, 0],
  devoluciones: [0, 0],
  nivel: 100,
};
const entrada = (cambios: Partial<Decisiones> = {}): EntradaHoja => ({
  estado,
  economia,
  decisiones: { ...decisiones, ...cambios },
  fondoFijo: 1000,
  reglas: REGLAS_POR_DEFECTO,
});

describe('Caso de prueba 2: hoja de trabajo del video', () => {
  it('márgenes disponibles: 20.000 en Nación y 30.000 en Provincia', () => {
    const h = calcularHojaDeTrabajo(entrada());
    expect(h.bancos[0].margenDisponible).toBe(20000);
    expect(h.bancos[1].margenDisponible).toBe(30000);
  });

  it('jugando al 100%', () => {
    const h = calcularHojaDeTrabajo(entrada());
    expect(h.capacidad).toBe(1300);
    expect(h.produccion).toBe(1300);
    expect(h.costoUnitario).toBe(65.74);
    expect(h.costoTotalBruto).toBe(85462);
    expect(h.mantenimiento).toBe(8450);
    expect(h.intereses).toBe(9200);
    expect(h.fondosAUtilizar).toBe(121182);
    expect(h.necesidadDeDinero).toBe(136612);
    expect(h.diferencia).toBe(-15430);
  });

  it('al 100% hay que pedir 15.430 a Nación (la tasa más baja)', () => {
    const s = sugerirFinanciamiento(entrada());
    expect(s.pedidos).toEqual([15430, 0]);
    expect(s.devoluciones).toEqual([0, 0]);
    const h = calcularHojaDeTrabajo(entrada({ pedidos: s.pedidos }));
    expect(h.fondosAUtilizar).toBe(136612);
    expect(h.diferencia).toBe(0);
  });

  it('jugando al 75%', () => {
    const h = calcularHojaDeTrabajo(entrada({ nivel: 75 }));
    expect(h.produccion).toBe(975);
    expect(h.costoUnitario).toBe(60.54);
    expect(h.costoTotalBruto).toBe(59027); // 59.026,50 redondeado hacia arriba
    expect(h.necesidadDeDinero).toBe(110177);
    expect(h.diferencia).toBe(11005);
  });

  it('al 75% sobran 11.005, que conviene devolver a Provincia (la tasa más alta)', () => {
    const s = sugerirFinanciamiento(entrada({ nivel: 75 }));
    expect(s.devoluciones).toEqual([0, 11005]);
    const h = calcularHojaDeTrabajo(entrada({ nivel: 75, devoluciones: s.devoluciones }));
    expect(h.necesidadDeDinero).toBe(121182);
    expect(h.diferencia).toBe(0);
  });
});
