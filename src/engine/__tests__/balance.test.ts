// El balance tiene que cerrar siempre, en cualquier período y con cualquier decisión.

import { crearRng, type Rng } from '../azar';
import { REGLAS_POR_DEFECTO, type Limites } from '../config';
import type { ResultadoEmpresa } from '../empresa';
import { buscarEscenario } from '../escenarios';
import { crearZona, datosDelPeriodo, procesarPeriodo, type DatosPeriodo } from '../periodo';
import { NIVELES, type Decisiones } from '../tipos';

const escenario = buscarEscenario('holtec');
const reglas = REGLAS_POR_DEFECTO;

function verificarBalance(r: ResultadoEmpresa) {
  const b = r.balance;
  expect(b.totalActivo).toBeCloseTo(b.efectivo + b.stock + b.planta, 6);
  expect(b.pasivoMasPatrimonio).toBeCloseTo(b.prestamos + b.utilidadesAcumuladas + b.capital, 6);
  expect(b.totalActivo).toBeCloseTo(b.pasivoMasPatrimonio, 6);
  expect(b.efectivo).toBeGreaterThanOrEqual(0);
}

function decisionAlAzar(rng: Rng): Decisiones {
  const n = (max: number) => Math.floor(rng() * max);
  const loco = rng() < 0.2; // a veces decisiones disparatadas, para forzar penalidades, giro y quiebra
  return {
    precio: 80 + n(25),
    marketing: n(loco ? 60000 : 11000),
    investigacion: n(loco ? 40000 : 11000),
    capacitacion: n(loco ? 30000 : 12000),
    ampliacion: n(loco ? 50000 : 16000),
    pedidos: [rng() < 0.4 ? n(loco ? 60000 : 30000) : 0, rng() < 0.4 ? n(loco ? 60000 : 30000) : 0],
    devoluciones: [rng() < 0.3 ? n(40000) : 0, rng() < 0.3 ? n(40000) : 0],
    nivel: NIVELES[n(NIVELES.length)],
  };
}

const limitesAmplios: Limites = {
  precioMin: 80,
  precioMax: 104,
  marketingMin: 0,
  marketingMax: 100000,
  investigacionMax: 100000,
  ampliacionMax: 100000,
};

describe('el balance cierra siempre', () => {
  it('50 partidas al azar de 6 períodos con 4 a 8 empresas', () => {
    const rng = crearRng(2026);
    let penalidades = 0;
    let quiebras = 0;
    let conStock = 0;
    for (let partida = 0; partida < 50; partida++) {
      const cant = 4 + Math.floor(rng() * 5);
      let zona = crearZona(escenario, Array.from({ length: cant }, (_, i) => `EMP${i + 1}`), reglas);
      zona = procesarPeriodo(zona, zona.empresas.map(() => escenario.periodo0.decisiones), datosDelPeriodo(escenario, 0), reglas).zona;
      for (let t = 1; t <= 6; t++) {
        const datos: DatosPeriodo = { ...datosDelPeriodo(escenario, 0), numero: t, limites: limitesAmplios };
        const res = procesarPeriodo(zona, zona.empresas.map(() => decisionAlAzar(rng)), datos, reglas, { semilla: t });
        for (const r of res.empresas) {
          if (!r) continue;
          verificarBalance(r);
          if (r.resultados.penalidad > 0) penalidades++;
          if (r.quebrada) quiebras++;
          if (r.marketing.stockUnidades > 0) conStock++;
        }
        zona = res.zona;
      }
    }
    // Que el test realmente haya pasado por los casos difíciles.
    expect(penalidades).toBeGreaterThan(0);
    expect(quiebras).toBeGreaterThan(0);
    expect(conStock).toBeGreaterThan(0);
  });
});

describe('casos puntuales del período', () => {
  const zona0 = crearZona(escenario, ['A', 'B', 'C', 'D'], reglas);
  const p0 = procesarPeriodo(zona0, zona0.empresas.map(() => escenario.periodo0.decisiones), datosDelPeriodo(escenario, 0), reglas, {
    ordenesForzadas: [1346, 1346, 1346, 1346],
  });
  const datos1 = datosDelPeriodo(escenario, 1);
  const normal: Decisiones = {
    precio: 90,
    marketing: 8500,
    investigacion: 1000,
    capacitacion: 4000,
    ampliacion: 10000,
    pedidos: [0, 0],
    devoluciones: [0, 0],
    nivel: 75,
  };
  const jugar = (d: Decisiones, ordenes = 1400) =>
    procesarPeriodo(p0.zona, [d, normal, normal, normal], datos1, reglas, { ordenesForzadas: [ordenes, 1400, 1400, 1400] })
      .empresas[0] as ResultadoEmpresa;

  it('usa los valores del próximo período: planta 90.000 y capacitación 4.000', () => {
    const r = jugar(normal);
    expect(r.produccion.capacidad).toBe(1800);
    expect(r.produccion.produccion).toBe(1350);
    expect(r.resultados.mantenimiento).toBe(9000);
    verificarBalance(r);
  });

  it('gastar más de lo disponible: préstamo adicional + penalidad de 500', () => {
    // Efectivo ~115.061: gastando de más el sistema pide por nosotros al banco más barato.
    const r = jugar({ ...normal, marketing: 10000, investigacion: 10000, capacitacion: 10000, ampliacion: 15000 });
    expect(r.fondos.adicionalPorGastos).toBeGreaterThan(0);
    expect(r.fondos.adicionalPorGastos).toBeLessThan(35000);
    expect(r.resultados.penalidad).toBe(500);
    expect(r.creditos.bancos[0].prestamoAdicional).toBeCloseTo(r.fondos.adicionalPorGastos, 6);
    expect(r.creditos.bancos[1].prestamoAdicional).toBe(0);
    expect(r.creditos.bancos[0].prestamosTomados).toBeCloseTo(55000 + r.fondos.adicionalPorGastos, 6);
    verificarBalance(r);
  });

  it('si el adicional no entra en Nación, sigue en Provincia y el resto va a giro', () => {
    const r = jugar({ ...normal, nivel: 100, marketing: 10000, investigacion: 10000, capacitacion: 16000, ampliacion: 15000 });
    const faltante = r.fondos.adicionalPorGastos;
    expect(faltante).toBeGreaterThan(45000);
    expect(r.creditos.bancos[0].prestamoAdicional).toBe(35000); // margen de Nación (27%)
    expect(r.creditos.bancos[1].prestamoAdicional).toBe(10000); // margen de Provincia (36%)
    expect(r.creditos.giroTotal).toBeCloseTo(faltante - 45000, 6);
    expect(r.resultados.penalidad).toBe(500);
    expect(r.quebrada).toBe(r.creditos.giroTotal > 10000);
    verificarBalance(r);
  });

  it('pedir de más va a giro, y si el giro supera 10.000 la empresa quiebra', () => {
    const conGiroChico = jugar({ ...normal, pedidos: [40000, 0] }); // margen Nación 35.000 → 5.000 a giro
    expect(conGiroChico.creditos.giroTotal).toBe(5000);
    expect(conGiroChico.quebrada).toBe(false);
    const conGiroGrande = jugar({ ...normal, pedidos: [50000, 0] }); // 15.000 a giro
    expect(conGiroGrande.creditos.giroTotal).toBe(15000);
    expect(conGiroGrande.quebrada).toBe(true);
    verificarBalance(conGiroGrande);
  });

  it('si sobra producción queda stock, que paga mantenimiento de stock', () => {
    const r = jugar(normal, 1000);
    expect(r.marketing.stockUnidades).toBe(350);
    expect(r.resultados.mantenimientoStock).toBe(3500);
    expect(r.balance.stock).toBeCloseTo(350 * r.produccion.costoUnitario, 6);
    verificarBalance(r);
  });

  it('bajar la producción despide empleados y paga indemnizaciones', () => {
    const r = jugar({ ...normal, nivel: 50 });
    // 1.800 × 50% = 900 unidades → 45 empleados; antes había 60.
    expect(r.produccion.empleados).toBe(45);
    expect(r.produccion.despedidos).toBe(15);
    expect(r.resultados.indemnizaciones).toBe(15 * reglas.indemnizacionPorDespedido);
    expect(r.resultados.recursosHumanos).toBe(0);
  });

  it('lo que se pide en el período 1 recién cobra intereses en el período 2', () => {
    const datos2 = { ...datos1, numero: 2 };
    const r1 = procesarPeriodo(p0.zona, [{ ...normal, pedidos: [20000, 0] }, normal, normal, normal], datos1, reglas, {
      ordenesForzadas: [1400, 1400, 1400, 1400],
    });
    expect((r1.empresas[0] as ResultadoEmpresa).resultados.intereses).toBeCloseTo(12750, 6);
    const r2 = procesarPeriodo(r1.zona, [normal, normal, normal, normal], datos2, reglas, { ordenesForzadas: [1400, 1400, 1400, 1400] });
    expect((r2.empresas[0] as ResultadoEmpresa).resultados.intereses).toBeCloseTo(12750 + 1800, 6);
  });

  it('capacitación por encima de 20.000 acumulado se paga pero no baja el costo', () => {
    const datos = datosDelPeriodo(escenario, 1);
    let zona = p0.zona;
    // Llegamos a 24.000 acumulado (4.000 + 20.000)
    zona = procesarPeriodo(zona, [{ ...normal, capacitacion: 20000 }, normal, normal, normal], datos, reglas, {
      ordenesForzadas: [1400, 1400, 1400, 1400],
    }).zona;
    expect(zona.empresas[0].capacitacionAcumulada).toBe(24000);
    const r = procesarPeriodo(zona, [normal, normal, normal, normal], { ...datos, numero: 2 }, reglas, {
      ordenesForzadas: [1400, 1400, 1400, 1400],
    }).empresas[0] as ResultadoEmpresa;
    expect(r.produccion.detalle.capacitacionColumna).toBe(20000);
  });
});
