import { columnaCapacitacion, costoUnitario, detalleCosto, filaPlanilla } from '../planillaCostos';

describe('planilla de costos', () => {
  it('lee las celdas del video tal cual', () => {
    expect(costoUnitario(80000, 0, 75)).toBe(59.97);
    expect(costoUnitario(65000, 2000, 100)).toBe(65.74);
    expect(costoUnitario(65000, 2000, 75)).toBe(60.54);
    expect(filaPlanilla(25000, 0)).toEqual([124.4, 109.4, 91.14, 97.52]);
  });

  it('el 75% es siempre el nivel más barato', () => {
    for (const planta of [25000, 80000, 150000, 300000]) {
      for (const cap of [0, 4000, 12000, 20000]) {
        const [c25, c50, c75, c100] = filaPlanilla(planta, cap);
        expect(c75).toBeLessThan(c25);
        expect(c75).toBeLessThan(c50);
        expect(c75).toBeLessThan(c100);
      }
    }
  });

  it('interpola linealmente las plantas intermedias', () => {
    // 73.000 está a 3/5 del camino entre 70.000 y 75.000
    const c70 = filaPlanilla(70000, 2000)[2];
    const c75 = filaPlanilla(75000, 2000)[2];
    const d = detalleCosto(73000, 2000, 75);
    expect(d.interpolado).toBe(true);
    expect(d.plantaInferior).toBe(70000);
    expect(d.plantaSuperior).toBe(75000);
    expect(d.costoUnitario).toBeCloseTo(c70 + (c75 - c70) * 0.6, 10);
  });

  it('fuera de la tabla usa el extremo', () => {
    expect(costoUnitario(20000, 0, 75)).toBe(filaPlanilla(25000, 0)[2]);
    expect(costoUnitario(320000, 0, 100)).toBe(filaPlanilla(300000, 0)[3]);
    expect(detalleCosto(320000, 0, 100).fueraDeTabla).toBe(true);
  });

  it('la capacitación se toma por múltiplo de 2.000 y con tope en 20.000', () => {
    expect(columnaCapacitacion(7999)).toBe(6000);
    expect(columnaCapacitacion(22000)).toBe(20000);
    expect(costoUnitario(90000, 24000, 75)).toBe(filaPlanilla(90000, 20000)[2]);
  });

  it('nivel 0% no tiene costo', () => {
    expect(costoUnitario(80000, 0, 0)).toBe(0);
  });

  it('marca las columnas reconstruidas por regla', () => {
    expect(detalleCosto(80000, 4000, 75).columnaReconstruida).toBe(false);
    expect(detalleCosto(80000, 6000, 75).columnaReconstruida).toBe(true);
    expect(detalleCosto(80000, 0, 75).fuente).toBe('video');
  });
});
