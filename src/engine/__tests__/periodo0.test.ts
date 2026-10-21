// Caso de prueba 1: Reporte del Período 0 del manual 2026. Tiene que dar exacto (±2 por redondeo).

import { REGLAS_POR_DEFECTO } from '../config';
import type { ResultadoEmpresa } from '../empresa';
import { buscarEscenario } from '../escenarios';
import { crearZona, datosDelPeriodo, procesarPeriodo } from '../periodo';
import { textoReporteCompania, textoReporteIndustrial } from '../reportes';

const escenario = buscarEscenario('holtec');
const nombres = ['CUARENTENA', 'FOREX', 'GOUP', 'NACIONAL2020'];

function jugarPeriodo0() {
  const zona = crearZona(escenario, nombres, REGLAS_POR_DEFECTO);
  const decisiones = nombres.map(() => escenario.periodo0.decisiones);
  return procesarPeriodo(zona, decisiones, datosDelPeriodo(escenario, 0), REGLAS_POR_DEFECTO, {
    ordenesForzadas: [1346, 1346, 1346, 1346],
  });
}

const cerca = (real: number, esperado: number) => expect(Math.abs(real - esperado)).toBeLessThanOrEqual(2);

describe('Caso de prueba 1: período 0 del manual 2026', () => {
  const resultado = jugarPeriodo0();
  const r = resultado.empresas[0] as ResultadoEmpresa;

  it('reporte de producción', () => {
    expect(r.produccion.capacidad).toBe(1600);
    expect(r.produccion.produccion).toBe(1200);
    expect(r.produccion.costoUnitario.toFixed(2)).toBe('59.97');
    expect(r.produccion.empleados).toBe(60);
  });

  it('reporte de marketing', () => {
    expect(r.marketing.ordenesRecibidas).toBe(1346);
    expect(r.marketing.ventasRealizadas).toBe(1200);
    expect(r.marketing.ordenesNoRealizadas).toBe(146);
    expect(r.marketing.stockUnidades).toBe(0);
  });

  it('estado de resultados', () => {
    const er = r.resultados;
    expect(er.ventas).toBe(108000);
    cerca(er.costoMercaderiaVendida, 71962);
    cerca(er.margenBruto, 36038);
    expect(er.recursosHumanos).toBe(6000);
    expect(er.marketing).toBe(8500);
    expect(er.mantenimiento).toBe(8000);
    expect(er.capacitacion).toBe(4000);
    expect(er.investigacion).toBe(1000);
    expect(er.indemnizaciones).toBe(0);
    expect(er.mantenimientoStock).toBe(0);
    expect(er.intereses).toBeCloseTo(12750, 9);
    expect(er.penalidad).toBe(0);
    cerca(er.utilidadAntesImpuestos, 7787);
    cerca(er.impuestos, 2726);
    cerca(er.utilidad, 5061);
  });

  it('balance', () => {
    const b = r.balance;
    cerca(b.efectivo, 115061);
    expect(b.stock).toBe(0);
    expect(b.planta).toBe(90000);
    cerca(b.totalActivo, 205061);
    expect(b.prestamos).toBe(120000);
    cerca(b.utilidadesAcumuladas, 5061);
    expect(b.capital).toBe(80000);
    expect(b.pasivoMasPatrimonio).toBeCloseTo(b.totalActivo, 6);
  });

  it('reporte de créditos', () => {
    const [n, p] = r.creditos.bancos;
    expect([n.maximoCredito, n.tasaAnual, n.prestamosTomados, n.prestamoAdicional]).toEqual([90000, 27, 55000, 0]);
    expect([p.maximoCredito, p.tasaAnual, p.prestamosTomados, p.prestamoAdicional]).toEqual([75000, 36, 65000, 0]);
    expect(r.creditos.giroTotal).toBe(0);
    expect(r.quebrada).toBe(false);
  });

  it('valores del próximo período', () => {
    expect(r.proximo).toEqual({ capacitacionAcumulada: 4000, planta: 90000, capacidad: 1800, idAcumulado: 1000 });
  });

  it('las 4 empresas quedan iguales', () => {
    for (const otra of resultado.empresas) expect(otra?.resultados.utilidad).toBeCloseTo(r.resultados.utilidad, 9);
  });

  it('reporte industrial', () => {
    const ind = resultado.industrial;
    expect(ind.unidades).toEqual({
      capacidadTotal: 6400,
      totalProducido: 4800,
      totalOrdenesRecibidas: 5384,
      totalVendido: 4800,
      stockTotal: 0,
    });
    expect(ind.dolares.ingresoPorVentas).toBe(432000);
    expect(ind.dolares.precioPromedio).toBe(90);
    expect(ind.dolares.costoProduccionPromedio.toFixed(2)).toBe('59.97');
    expect(ind.productividad.empleados).toBe(240);
    expect(ind.productividad.ventasPorEmpleado).toBe(1800);
    expect(ind.productividad.capacidadUtilizada).toBe(75);
    expect(ind.productividad.idAcumuladoPromedio).toBe(0);
    for (const f of ind.competicion) {
      expect(f.porcentajeMercado).toBe(25);
      expect(f.posicion).toBeNull();
    }
    expect(ind.competicion.map((f) => f.nombre)).toEqual(nombres);
  });

  it('el modelo de demanda está calibrado: 4 empresas iguales reciben 1.346 órdenes cada una', () => {
    const zona = crearZona(escenario, nombres, REGLAS_POR_DEFECTO);
    const sinForzar = procesarPeriodo(
      zona,
      nombres.map(() => escenario.periodo0.decisiones),
      datosDelPeriodo(escenario, 0),
      REGLAS_POR_DEFECTO,
    );
    for (const e of sinForzar.empresas) expect(e?.marketing.ordenesRecibidas).toBe(1346);
  });

  it('texto en formato certamen', () => {
    const compania = textoReporteCompania(r, {
      periodo: 0,
      nombresBancos: REGLAS_POR_DEFECTO.nombresBancos,
      nombreEnTitulo: escenario.periodo0.nombreEnReporte,
      decisionesMostradas: escenario.periodo0.decisionesMostradas,
    });
    const industrial = textoReporteIndustrial(resultado.industrial, REGLAS_POR_DEFECTO.nombresBancos);
    expect(compania).toMatchSnapshot();
    expect(industrial).toMatchSnapshot();
    expect(compania).toContain('Reporte de la Compañía IGUALES para el Período');
    expect(compania).toMatch(/Ped\. de Prest\. Bco {3}NACION +u\$s +55000/);
    expect(compania).toMatch(/Prod\. Costo\/Unid\. +59\.97/);
    expect(industrial).toContain('Informe Industrial de la Zona 1 para el Período 0');
  });
});
