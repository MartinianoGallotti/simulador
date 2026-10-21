// Reporte de la Compañía (privado), Reporte Industrial (público) y su texto en
// "formato certamen": monoespaciado, con las mismas secciones y columnas que los informes reales.

import type { Economia } from './config';
import type { ResultadoEmpresa } from './empresa';
import type { DatosPeriodo, Zona } from './periodo';
import type { Decisiones } from './tipos';

export interface FilaCompeticion {
  nombre: string;
  ventas: number;
  precio: number;
  unidadesVendidas: number;
  utilidadPeriodo: number;
  utilidadAcumulada: number;
  porcentajeMercado: number;
  /** Puesto por utilidad acumulada; `null` si empata con otra empresa (se muestra "-"). */
  posicion: number | null;
  quebrada: boolean;
}

export interface ReporteIndustrial {
  zona: number;
  periodo: number;
  unidades: {
    capacidadTotal: number;
    totalProducido: number;
    totalOrdenesRecibidas: number;
    totalVendido: number;
    stockTotal: number;
  };
  dolares: {
    ingresoPorVentas: number;
    precioPromedio: number;
    costoProduccionPromedio: number;
  };
  productividad: {
    empleados: number;
    ventasPorEmpleado: number;
    capacidadUtilizada: number;
    idAcumuladoPromedio: number;
  };
  economia: Economia;
  competicion: FilaCompeticion[];
}

const suma = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

export function armarReporteIndustrial(
  zonaInicio: Zona,
  resultados: (ResultadoEmpresa | null)[],
  datos: DatosPeriodo,
): ReporteIndustrial {
  const activos = resultados.filter((r): r is ResultadoEmpresa => r !== null);
  const capacidadTotal = suma(activos.map((r) => r.produccion.capacidad));
  const totalProducido = suma(activos.map((r) => r.produccion.produccion));
  const totalVendido = suma(activos.map((r) => r.marketing.ventasRealizadas));
  const ingresoPorVentas = suma(activos.map((r) => r.resultados.ventas));
  const empleados = suma(activos.map((r) => r.produccion.empleados));
  const inicioActivos = zonaInicio.empresas.filter((e) => !e.quebrada);

  const utilAcum = (i: number) =>
    resultados[i]?.balance.utilidadesAcumuladas ?? zonaInicio.empresas[i].utilidadAcumulada;
  const filas: FilaCompeticion[] = zonaInicio.empresas.map((e, i) => {
    const r = resultados[i];
    return {
      nombre: e.nombre,
      ventas: r?.resultados.ventas ?? 0,
      precio: r?.decisiones.precio ?? 0,
      unidadesVendidas: r?.marketing.ventasRealizadas ?? 0,
      utilidadPeriodo: r?.resultados.utilidad ?? 0,
      utilidadAcumulada: utilAcum(i),
      porcentajeMercado: r && totalVendido > 0 ? (100 * r.marketing.ventasRealizadas) / totalVendido : 0,
      posicion: null,
      quebrada: r?.quebrada ?? e.quebrada,
    };
  });
  // Puesto por utilidad acumulada (comparada en pesos enteros, como se ve en el informe).
  // SUPUESTO: si una empresa empata con otra, se muestra "-" (así figura en el período 0).
  for (const f of filas) {
    const propia = Math.round(f.utilidadAcumulada);
    const empatada = filas.some((g) => g !== f && Math.round(g.utilidadAcumulada) === propia);
    f.posicion = empatada ? null : 1 + filas.filter((g) => Math.round(g.utilidadAcumulada) > propia).length;
  }
  // SUPUESTO: las empresas se listan en orden alfabético (así aparecen en el informe real).
  filas.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  return {
    zona: zonaInicio.numero,
    periodo: datos.numero,
    unidades: {
      capacidadTotal,
      totalProducido,
      totalOrdenesRecibidas: suma(activos.map((r) => r.marketing.ordenesRecibidas)),
      totalVendido,
      stockTotal: suma(activos.map((r) => r.marketing.stockUnidades)),
    },
    dolares: {
      ingresoPorVentas,
      // SUPUESTO: precio promedio = promedio simple de los precios de la zona.
      precioPromedio: activos.length ? suma(activos.map((r) => r.decisiones.precio)) / activos.length : 0,
      // SUPUESTO: costo promedio ponderado por las unidades producidas.
      costoProduccionPromedio: totalProducido > 0 ? suma(activos.map((r) => r.produccion.costoTotal)) / totalProducido : 0,
    },
    productividad: {
      empleados,
      ventasPorEmpleado: empleados > 0 ? ingresoPorVentas / empleados : 0,
      capacidadUtilizada: capacidadTotal > 0 ? (100 * totalProducido) / capacidadTotal : 0,
      // SUPUESTO: promedio del I&D acumulado al INICIO del período (en el período 0 da 0).
      idAcumuladoPromedio: inicioActivos.length ? suma(inicioActivos.map((e) => e.idAcumulado)) / inicioActivos.length : 0,
    },
    economia: datos.economia,
    competicion: filas,
  };
}

// ---------------------------------------------------------------------------
// Formato certamen
// ---------------------------------------------------------------------------

/** Montos sin decimales. */
// SUPUESTO: el motor guarda los decimales y redondea solo al mostrar. El software real usa
// un costo unitario con más decimales que la planilla impresa, por eso puede haber ±2 de diferencia.
export function fmtEntero(x: number): string {
  return String(Math.round(x) || 0);
}

/** Costos unitarios y tasas: 2 decimales con punto, como los informes reales. */
export function fmtDecimal(x: number): string {
  return x.toFixed(2);
}

type Pieza = [columna: number, texto: string, alineacion?: 'izq' | 'der'];

/**
 * Arma una línea ubicando cada texto en su columna. Con alineación 'der',
 * la columna indica dónde TERMINA el texto (los números se alinean a la derecha).
 */
function linea(...piezas: Pieza[]): string {
  const chars: string[] = [];
  for (const [col, texto, alin] of piezas) {
    const desde = alin === 'der' ? col - texto.length : col;
    for (let k = 0; k < texto.length; k++) {
      while (chars.length < desde + k) chars.push(' ');
      chars[desde + k] = texto[k];
    }
  }
  return chars.join('').trimEnd();
}

const SEPARADOR_COMPANIA = '- '.repeat(40).trimEnd();
const SEPARADOR_INDUSTRIAL = ' ' + '- '.repeat(47).trimEnd();

export interface ContextoReporteCompania {
  periodo: number;
  nombresBancos: [string, string];
  /** Nombre que figura en el título (en el período 0 dice "IGUALES"). */
  nombreEnTitulo?: string;
  /** Decisiones a mostrar en lugar de las procesadas (período 0). */
  decisionesMostradas?: Partial<Decisiones>;
}

export function textoReporteCompania(r: ResultadoEmpresa, ctx: ContextoReporteCompania): string {
  const d: Decisiones = { ...r.decisiones, ...ctx.decisionesMostradas };
  const [b1, b2] = ctx.nombresBancos;
  const er = r.resultados;
  const ba = r.balance;
  const p = r.produccion;
  const m = r.marketing;
  const c = r.creditos.bancos;
  const E = fmtEntero;
  const L: string[] = [];
  // Columnas medidas sobre el informe real (7 px por carácter).
  const porcentaje = (fin: number, valor: number): Pieza[] => [[fin, String(valor), 'der'], [fin, '%']];

  // En el período 0 el informe real no muestra el número de período.
  const periodoTitulo = ctx.periodo === 0 ? '' : ` ${ctx.periodo}`;
  L.push(linea([12, `Reporte de la Compañía ${ctx.nombreEnTitulo ?? r.nombre} para el Período${periodoTitulo}`]));
  L.push('');
  L.push(linea([19, 'DECISIONES TOMADAS DEL PERIODO']));
  L.push(linea([19, '---------- ------- --- -------']));
  const izqDecision = (t: string, v: number): Pieza[] => [[0, t], [18, 'u$s'], [28, E(v), 'der']];
  const derDecision = (t: string, v: number): Pieza[] => [[33, t], [72, 'u$s'], [82, E(v), 'der']];
  const bco = (accion: string, banco: string) => `${accion} de Prest. Bco   ${banco}`;
  L.push(linea(...izqDecision('Precio', d.precio), ...derDecision('Ampliación en Planta', d.ampliacion)));
  L.push(linea(...izqDecision('Marketing', d.marketing), ...derDecision(bco('Ped.', b1), d.pedidos[0])));
  L.push(linea([0, 'Nivel de Prod.'], ...porcentaje(28, d.nivel), ...derDecision(bco('Dev.', b1), d.devoluciones[0])));
  L.push(linea(...izqDecision('Inv. en Capac.', d.capacitacion), ...derDecision(bco('Ped.', b2), d.pedidos[1])));
  L.push(linea(...izqDecision('Inv. en I & D', d.investigacion), ...derDecision(bco('Dev.', b2), d.devoluciones[1])));
  L.push(SEPARADOR_COMPANIA);

  L.push(linea([8, 'BALANCE EN u$s'], [36, 'ESTADO DE RESULTADO EN u$s']));
  L.push(linea([8, '------- -- ---'], [36, '------ -- --------- -- ---']));
  const sepIzq: Pieza = [0, '-'.repeat(27)];
  const sepDer: Pieza = [35, '-'.repeat(27)];
  const izq = (t: string, v: number): Pieza[] => [[0, t], [27, E(v), 'der']];
  const der = (t: string, v: number): Pieza[] => [[35, t], [62, E(v), 'der']];
  L.push(linea(...izq('Efectivo', ba.efectivo), ...der('Ventas', er.ventas)));
  L.push(linea(...der('Costo Merc. Vend.', er.costoMercaderiaVendida)));
  L.push(linea(...izq('Stock', ba.stock), sepDer));
  L.push(linea(...der('Margen Bruto', er.margenBruto)));
  L.push(linea(...izq('Planta', ba.planta), ...der('Recursos Humanos', er.recursosHumanos)));
  L.push(linea(sepIzq, ...der('Marketing', er.marketing)));
  L.push(linea(...izq('Total Activo', ba.totalActivo), ...der('Mantenimiento', er.mantenimiento)));
  L.push(linea(sepIzq, ...der('Capacitación', er.capacitacion)));
  L.push(linea(...izq('Prestamos', ba.prestamos), ...der('I & D', er.investigacion)));
  L.push(linea(...der('Indemnizaciones', er.indemnizaciones)));
  L.push(linea(...izq('Ut. Acumuladas', ba.utilidadesAcumuladas), ...der('Mantenimiento Stock', er.mantenimientoStock)));
  L.push(linea(...der('Intereses', er.intereses)));
  L.push(linea(...izq('Capital', ba.capital), ...der('Penalidad', er.penalidad)));
  L.push(linea(sepDer));
  L.push(linea(sepIzq, ...der('Util. ante Imp.', er.utilidadAntesImpuestos)));
  L.push(linea(...izq('Pasivo+Patrimonio', ba.pasivoMasPatrimonio), ...der('Impuestos', er.impuestos)));
  L.push(linea(sepDer));
  L.push(linea(...der('Util. del Período', er.utilidad)));
  L.push(SEPARADOR_COMPANIA);

  L.push(linea([19, 'INFORME PRIVADO DE LA EMPRESA']));
  L.push(linea([19, '------- ------- -- -- -------']));
  L.push(linea([2, 'Reporte de Producción'], [34, 'Reporte de Marketing en Unid.']));
  L.push(linea([2, '------- -- ----------'], [34, '------- -- --------- -- -----']));
  const mkt = (t: string, v: number): Pieza[] => [[35, t], [63, E(v), 'der']];
  L.push(linea([0, 'Cap. de la Planta'], [27, E(p.capacidad), 'der'], ...mkt('Ordenes Recibidas', m.ordenesRecibidas)));
  L.push(linea([0, 'Producción'], [27, E(p.produccion), 'der'], ...mkt('Ventas realizadas', m.ventasRealizadas)));
  L.push(linea([0, 'Nivel Utilizado'], ...porcentaje(27, p.nivel), ...mkt('Ordenes no realiz.', m.ordenesNoRealizadas)));
  L.push(linea([0, 'Prod. Costo/Unid.'], [27, fmtDecimal(p.costoUnitario), 'der'], ...mkt('Stock en Unidades', m.stockUnidades)));
  L.push(linea([0, 'Empleados'], [27, E(p.empleados), 'der']));
  L.push(SEPARADOR_COMPANIA);

  L.push(linea([22, 'REPORTE DE CREDITOS']));
  L.push(linea([22, '------- -- --------']));
  L.push(linea([4, `Banco ${b1}`], [45, `Banco ${b2}`]));
  const credito = (t: string, v1: string, v2: string, conUsd: boolean): string =>
    linea(
      [0, t],
      ...(conUsd ? ([[19, 'u$s']] as Pieza[]) : []),
      [29, v1, 'der'],
      [37, t],
      ...(conUsd ? ([[57, 'u$s']] as Pieza[]) : []),
      [67, v2, 'der'],
    );
  L.push(credito('Máximo Crédito', E(c[0].maximoCredito), E(c[1].maximoCredito), true));
  L.push(credito('Tasa de Interés', fmtDecimal(c[0].tasaAnual), fmtDecimal(c[1].tasaAnual), false));
  L.push(credito('Préstamos Tomados', E(c[0].prestamosTomados), E(c[1].prestamosTomados), true));
  L.push(credito('Prést. Adicional', E(c[0].prestamoAdicional), E(c[1].prestamoAdicional), true));
  L.push(linea([37, 'Giro en Descub.'], [57, 'u$s'], [67, E(r.creditos.giroTotal), 'der']));
  L.push(SEPARADOR_COMPANIA);

  L.push(linea([0, 'VALORES DEL PROXIMO PERIODO']));
  L.push(linea([0, '------- --- ------- -------']));
  L.push(linea([0, 'Capac. Acumulada'], [19, 'u$s'], [29, E(r.proximo.capacitacionAcumulada), 'der']));
  L.push(linea([0, 'Planta'], [19, 'u$s'], [29, E(r.proximo.planta), 'der']));
  L.push(linea([0, 'Cap. de Prod (100%)'], [29, E(r.proximo.capacidad), 'der']));
  L.push(linea([0, 'I&D Acumulado'], [19, 'u$s'], [29, E(r.proximo.idAcumulado), 'der']));
  if (r.quebrada) {
    L.push('');
    L.push(linea([12, '*** EMPRESA EN QUIEBRA: EL GIRO EN DESCUBIERTO SUPERO EL LIMITE ***']));
  }
  return L.join('\n');
}

export function textoReporteIndustrial(ind: ReporteIndustrial, nombresBancos: [string, string]): string {
  const E = fmtEntero;
  const u = ind.unidades;
  const dol = ind.dolares;
  const pr = ind.productividad;
  const eco = ind.economia;
  const L: string[] = [];
  const izq = (t: string, v: string, extra?: Pieza): Pieza[] => [[0, t], ...(extra ? [extra] : []), [42, v, 'der']];
  const der = (t: string, v: string, unidad?: string, sufijo = ''): Pieza[] => [
    [57, t],
    ...(unidad ? ([[unidad === '%' ? 79 : 77, unidad]] as Pieza[]) : []),
    [91, v, 'der'],
    ...(sufijo ? ([[91, sufijo]] as Pieza[]) : []),
  ];

  L.push(linea([12, `Informe Industrial de la Zona ${ind.zona} para el Período ${ind.periodo}`]));
  L.push('');
  L.push(linea([6, 'UNIDADES'], [61, 'DOLARES']));
  L.push(linea([6, '--------'], [61, '-------']));
  L.push(linea(...izq('Capacidad Total', E(u.capacidadTotal)), ...der('Ingreso por vtas', E(dol.ingresoPorVentas), 'u$s')));
  L.push(linea(...izq('Total Producido', E(u.totalProducido)), ...der('Precio Promedio', E(dol.precioPromedio), 'u$s')));
  L.push(linea(...izq('Total Ord. Recibidas', E(u.totalOrdenesRecibidas)), ...der('Costo Prod. Prom.', fmtDecimal(dol.costoProduccionPromedio), 'u$s')));
  L.push(linea(...izq('Total Vendido', E(u.totalVendido))));
  L.push(linea(...izq('Stock Total', E(u.stockTotal))));
  L.push('');
  L.push(linea([6, 'PRODUCTIVIDAD'], [61, 'ECONOMIA']));
  L.push(linea([6, '-------------'], [61, '--------']));
  L.push(linea(...izq('Cant. Empleados', E(pr.empleados)), [57, `Banco ${nombresBancos[0]}`]));
  L.push(linea(...izq('Ventas/Empleado', E(pr.ventasPorEmpleado), [20, 'u$s']), ...der('*Préstamo Límite', E(eco.bancos[0].maximoCredito), 'u$s')));
  L.push(linea(...izq('Capac. Prom. Utiliz.', E(pr.capacidadUtilizada), [22, '%']), ...der('*Tasa Prima', fmtDecimal(eco.bancos[0].tasaAnual))));
  L.push(linea([57, `Banco ${nombresBancos[1]}`]));
  L.push(linea(...izq('Inv. y des. acum.', E(pr.idAcumuladoPromedio), [20, 'u$s']), ...der('*Préstamo Límite', E(eco.bancos[1].maximoCredito), 'u$s')));
  L.push(linea(...der('*Tasa Prima', fmtDecimal(eco.bancos[1].tasaAnual))));
  L.push(linea(...der('Limite Giro Desc.', E(eco.limiteGiro), 'u$s')));
  L.push('');
  L.push(linea(...der('Tasa de Impuesto', E(eco.tasaImpuesto), '%')));
  L.push(linea(...der('Tasa de Mantenimiento', E(eco.tasaMantenimiento), '%')));
  L.push(linea(...der('Mantenim. de Stock', E(eco.costoStockUnidad), 'u$s', ' c/u')));
  L.push('');
  L.push(SEPARADOR_INDUSTRIAL);
  L.push(linea([30, 'INFORME DE COMPETICION']));
  L.push(linea([30, '------- -- -----------']));
  L.push(
    linea(
      [0, 'Nombre'],
      [26, 'Ventas', 'der'],
      [37, 'Precio', 'der'],
      [50, 'UnidVend', 'der'],
      [63, 'UtilPeri', 'der'],
      [77, 'UtilAcum', 'der'],
      [89, '%Mercado', 'der'],
      [90, 'Pos.'],
    ),
  );
  L.push(
    linea(
      [0, '-'.repeat(15)],
      [27, '-'.repeat(8), 'der'],
      [38, '-'.repeat(8), 'der'],
      [50, '-'.repeat(8), 'der'],
      [63, '-'.repeat(9), 'der'],
      [77, '-'.repeat(9), 'der'],
      [89, '-'.repeat(9), 'der'],
      [90, '-'.repeat(4)],
    ),
  );
  for (const f of ind.competicion) {
    L.push(
      linea(
        [0, f.nombre],
        [27, E(f.ventas), 'der'],
        [38, E(f.precio), 'der'],
        [50, E(f.unidadesVendidas), 'der'],
        [63, E(f.utilidadPeriodo), 'der'],
        [77, E(f.utilidadAcumulada), 'der'],
        [88, E(f.porcentajeMercado), 'der'],
        [92, f.quebrada ? 'Q' : f.posicion === null ? '-' : String(f.posicion)],
      ),
    );
  }
  return L.join('\n');
}
