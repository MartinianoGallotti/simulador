import {
  aplicarDevolucion,
  aplicarPedido,
  asignarPrestamoAdicional,
  calcularIntereses,
  margenDisponible,
} from '../banco';
import type { BancoEconomia } from '../config';
import type { DeudaBanco } from '../tipos';

const nacion: BancoEconomia = { maximoCredito: 90000, tasaAnual: 27 };
const provincia: BancoEconomia = { maximoCredito: 75000, tasaAnual: 36 };
const deuda = (tomados: number, giro = 0): DeudaBanco => ({ tomados, giro });

describe('intereses', () => {
  it('ejemplos del material: 12.750 y 9.200', () => {
    const r1 = calcularIntereses('periodo_siguiente', [nacion, provincia], [deuda(55000), deuda(65000)], [deuda(55000), deuda(65000)]);
    expect(r1.total).toBeCloseTo(12750, 9);
    const b2014: [BancoEconomia, BancoEconomia] = [
      { maximoCredito: 90000, tasaAnual: 18 },
      { maximoCredito: 80000, tasaAnual: 30 },
    ];
    const r2 = calcularIntereses('periodo_siguiente', b2014, [deuda(70000), deuda(50000)], [deuda(70000), deuda(50000)]);
    expect(r2.total).toBeCloseTo(9200, 9);
  });

  it('lo pedido en t empieza a cobrar intereses en t+1', () => {
    const inicio: [DeudaBanco, DeudaBanco] = [deuda(55000), deuda(65000)];
    const despues: [DeudaBanco, DeudaBanco] = [deuda(70000), deuda(65000)];
    expect(calcularIntereses('periodo_siguiente', [nacion, provincia], inicio, despues).total).toBeCloseTo(12750, 9);
    // Con el modo alternativo, el pedido ya cobra en el mismo período.
    expect(calcularIntereses('mismo_periodo', [nacion, provincia], inicio, despues).total).toBeCloseTo(12750 + 1350, 9);
  });
});

describe('pedidos, devoluciones y giro', () => {
  it('margen disponible = máximo crédito − tomados', () => {
    expect(margenDisponible(nacion, deuda(55000))).toBe(35000);
  });

  it('el pedido que supera el margen se otorga igual, como giro', () => {
    const r = aplicarPedido(provincia, deuda(65000), 30000);
    expect(r.aTomados).toBe(10000);
    expect(r.aGiro).toBe(20000);
    expect(r.deuda).toEqual({ tomados: 75000, giro: 20000 });
  });

  it('la devolución cancela primero el giro', () => {
    expect(aplicarDevolucion(deuda(75000, 5000), 8000)).toEqual({ tomados: 72000, giro: 0 });
  });

  it('el préstamo adicional va primero al banco de menor tasa con margen, después al otro y después a giro', () => {
    const r1 = asignarPrestamoAdicional([nacion, provincia], [deuda(55000), deuda(65000)], 20000);
    expect(r1.adicionalPorBanco).toEqual([20000, 0]);
    const r2 = asignarPrestamoAdicional([nacion, provincia], [deuda(85000), deuda(65000)], 20000);
    expect(r2.adicionalPorBanco).toEqual([5000, 10000]);
    expect(r2.aGiro).toBe(5000);
    expect(r2.deudas[1]).toEqual({ tomados: 75000, giro: 5000 });
  });
});
