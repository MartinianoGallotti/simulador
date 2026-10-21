// procesarPeriodo(zona, decisiones, datos del período) → nuevos reportes.

import { crearRng } from './azar';
import { LIMITES_LIBRES, type ConfigReglas, type Economia, type Limites } from './config';
import { corregirDecisiones } from './decisiones';
import { procesarEmpresa, type ResultadoEmpresa } from './empresa';
import { economiaDelPeriodo, periodoOProvisorio, type Escenario } from './escenarios';
import { calcularOrdenes, PARAMETROS_DEMANDA, type ContextoDemanda, type ParametrosDemanda } from './mercado';
import { armarReporteIndustrial, type ReporteIndustrial } from './reportes';
import type { Decisiones, EstadoEmpresa } from './tipos';

export interface Zona {
  numero: number;
  empresas: EstadoEmpresa[];
}

export interface DatosPeriodo {
  numero: number;
  limites: Limites;
  economia: Economia;
  demanda: ContextoDemanda;
}

export interface OpcionesPeriodo {
  /** Para tests y calibración: órdenes fijas por empresa (mismo orden que zona.empresas). */
  ordenesForzadas?: number[];
  semilla?: number;
  parametrosDemanda?: ParametrosDemanda;
}

export interface ResultadoPeriodo {
  periodo: number;
  /** Uno por empresa, en el mismo orden que la zona. `null` si la empresa ya estaba quebrada. */
  empresas: (ResultadoEmpresa | null)[];
  industrial: ReporteIndustrial;
  zona: Zona;
}

/** Arma la zona al inicio del período 0: todas las empresas iguales. */
export function crearZona(escenario: Escenario, nombres: string[], reglas: ConfigReglas, numero = 1): Zona {
  const ini = escenario.estadoInicial;
  return {
    numero,
    empresas: nombres.map((nombre) => ({
      nombre,
      efectivo: ini.efectivo,
      planta: ini.planta,
      capacitacionAcumulada: ini.capacitacionAcumulada,
      idAcumulado: ini.idAcumulado,
      stock: [],
      empleados: ini.empleados,
      deudas: [
        { tomados: ini.prestamosTomados[0], giro: 0 },
        { tomados: ini.prestamosTomados[1], giro: 0 },
      ],
      utilidadAcumulada: 0,
      capital: reglas.capital,
      quebrada: false,
    })),
  };
}

/** Datos del período `numero` según el escenario (el 0 usa las decisiones de los organizadores). */
export function datosDelPeriodo(escenario: Escenario, numero: number, reglas?: Pick<ConfigReglas, 'economia'>): DatosPeriodo {
  const economia = economiaDelPeriodo(escenario, numero, reglas?.economia);
  if (numero === 0) {
    return { numero, limites: LIMITES_LIBRES, economia, demanda: { crecimiento: 1, ...escenario.periodo0.demanda } };
  }
  const p = periodoOProvisorio(escenario, numero);
  return { numero, limites: p.limites, economia, demanda: { crecimiento: 1, ...p.demanda } };
}

export function procesarPeriodo(
  zona: Zona,
  decisiones: Decisiones[],
  datos: DatosPeriodo,
  reglas: ConfigReglas,
  opciones: OpcionesPeriodo = {},
): ResultadoPeriodo {
  if (decisiones.length !== zona.empresas.length) {
    throw new Error('Tiene que haber una decisión por empresa.');
  }
  // SUPUESTO: una empresa quebrada queda fuera del mercado (no recibe órdenes ni juega más).
  const activas = zona.empresas.map((e, i) => ({ e, i })).filter(({ e }) => !e.quebrada);

  const corregidas = zona.empresas.map((e, i) =>
    corregirDecisiones(decisiones[i], datos.limites, e.deudas, reglas),
  );

  const mercado = calcularOrdenes(
    activas.map(({ e, i }) => ({
      precio: corregidas[i].decisiones.precio,
      marketing: corregidas[i].decisiones.marketing,
      idAcumulado: e.idAcumulado,
    })),
    datos.demanda,
    opciones.parametrosDemanda ?? PARAMETROS_DEMANDA,
    crearRng(opciones.semilla ?? 1),
  );
  const ordenes = new Map<number, number>();
  activas.forEach(({ i }, k) => ordenes.set(i, opciones.ordenesForzadas?.[i] ?? mercado.ordenes[k]));

  const resultados = zona.empresas.map((e, i) =>
    e.quebrada
      ? null
      : procesarEmpresa(e, corregidas[i].decisiones, corregidas[i].correcciones, ordenes.get(i) ?? 0, datos.economia, reglas),
  );

  const nuevaZona: Zona = {
    numero: zona.numero,
    empresas: zona.empresas.map((e, i) => resultados[i]?.estadoFinal ?? e),
  };

  return {
    periodo: datos.numero,
    empresas: resultados,
    industrial: armarReporteIndustrial(zona, resultados, datos),
    zona: nuevaZona,
  };
}
