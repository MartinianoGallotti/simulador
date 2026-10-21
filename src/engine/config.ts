// Reglas variables del certamen. Todo lo que puede cambiar entre ediciones o
// que Marti quiera ajustar vive acá. La pantalla de configuración (Fase 5) edita
// un objeto de este tipo.

export type ModoIntereses =
  /** Lo que se pide en t empieza a cobrar intereses en t+1 (confirmado por Marti). */
  | 'periodo_siguiente'
  /** Lo que se pide en t ya cobra intereses en t (alternativa, por si aparece evidencia). */
  | 'mismo_periodo';

export interface ConfigReglas {
  cantidadPeriodos: number;
  /** Capital inicial, fijo en el balance. */
  capital: number;
  fondoFijoMinimo: number;
  /** Capacidad al 100% como fracción del valor de la planta (2%). */
  porcentajeCapacidad: number;
  unidadesPorEmpleado: number;
  /** Ingreso de Recursos Humanos por cada empleado contratado. */
  ingresoPorContratado: number;
  /** Gasto por cada empleado despedido. */
  indemnizacionPorDespedido: number;
  penalidad: number;
  capacitacionMultiplo: number;
  capacitacionMaxAcumulada: number;
  nombreMaxCaracteres: number;
  modoIntereses: ModoIntereses;
  nombresBancos: [string, string];
  /** Ajustes a la economía inicial del escenario (tasas, máximos, impuesto…), desde la pantalla de configuración. */
  economia?: CambiosEconomia;
}

export const REGLAS_POR_DEFECTO: ConfigReglas = {
  cantidadPeriodos: 5, // manual 2026 (el video de 2014 dice 6)
  capital: 80000,
  fondoFijoMinimo: 50, // manual 2026 (el video dice 100)
  porcentajeCapacidad: 0.02,
  unidadesPorEmpleado: 20,
  ingresoPorContratado: 100,
  // SUPUESTO: el material no dice cuánto cuesta despedir a un empleado.
  indemnizacionPorDespedido: 200,
  penalidad: 500,
  capacitacionMultiplo: 2000,
  capacitacionMaxAcumulada: 20000,
  nombreMaxCaracteres: 10,
  modoIntereses: 'periodo_siguiente',
  nombresBancos: ['NACION', 'PROVINCIA'],
};

export interface BancoEconomia {
  maximoCredito: number;
  /** Tasa anual en porcentaje (27 = 27%). */
  tasaAnual: number;
}

/** Datos de la economía que publica el Reporte Industrial y que el comentario puede cambiar. */
export interface Economia {
  bancos: [BancoEconomia, BancoEconomia];
  /** Porcentaje (35 = 35%). */
  tasaImpuesto: number;
  /** Porcentaje sobre el valor de la planta (10 = 10%). */
  tasaMantenimiento: number;
  /** U$S por unidad en stock al cierre. */
  costoStockUnidad: number;
  limiteGiro: number;
}

/** Límites de las decisiones que publica cada Comentario Económico. */
export interface Limites {
  precioMin: number;
  precioMax: number;
  marketingMin: number;
  marketingMax: number;
  investigacionMax: number;
  ampliacionMax: number;
  /** Algunos comentarios podrían limitar la capacitación por período; si no, solo vale el tope acumulado. */
  capacitacionMaxPeriodo?: number;
}

/** Límites amplios para el período 0, cuyas decisiones las ponen los organizadores. */
export const LIMITES_LIBRES: Limites = {
  precioMin: 0,
  precioMax: 1_000_000,
  marketingMin: 0,
  marketingMax: 1_000_000,
  investigacionMax: 1_000_000,
  ampliacionMax: 1_000_000,
};

/** Lo que un comentario económico puede cambiar. Se puede tocar un solo dato de un solo banco. */
export interface CambiosEconomia extends Partial<Omit<Economia, 'bancos'>> {
  bancos?: [Partial<BancoEconomia>, Partial<BancoEconomia>];
}

export function combinarEconomia(base: Economia, cambios?: CambiosEconomia): Economia {
  if (!cambios) return base;
  return {
    ...base,
    ...cambios,
    bancos: cambios.bancos
      ? [
          { ...base.bancos[0], ...cambios.bancos[0] },
          { ...base.bancos[1], ...cambios.bancos[1] },
        ]
      : base.bancos,
  };
}
