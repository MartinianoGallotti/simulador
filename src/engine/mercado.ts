// SUPUESTO: todo este archivo. La fórmula real del certamen es secreta.
// Modelo de demanda: es un modelo
// propio, calibrable, con todos los parámetros en parametrosDemanda.json.
// En la Fase 3 se calibra contra los objetivos de elasticidad de CLAUDE.md.

import { entre, type Rng } from './azar';
import parametrosPorDefecto from './parametrosDemanda.json';

export interface ParametrosDemanda {
  /** Órdenes de cada empresa cuando todas juegan igual a precio y marketing de referencia. */
  ordenesBasePorEmpresa: number;
  precioReferencia: number;
  marketingReferencia: number;
  /** Respuesta del mercado TOTAL al precio promedio (baja, ~1). */
  elasticidadPrecioMercado: number;
  /** Respuesta del mercado TOTAL al marketing promedio. */
  elasticidadMarketingMercado: number;
  /** Cuánto pesa cada peso de diferencia con el precio promedio en el reparto. */
  sensibilidadPrecio: number;
  /** Castigo extra por estar por ENCIMA del promedio (crece con el cuadrado de la diferencia). */
  sensibilidadPrecioCuadratica: number;
  /** Rendimientos decrecientes del marketing relativo. */
  exponenteMarketing: number;
  /** Suaviza el marketing relativo cuando alguien pone casi 0. */
  colchonMarketing: number;
  /** Peso del I&D acumulado relativo (el escenario lo puede cambiar). */
  pesoID: number;
  /** Suaviza el I&D relativo cuando todos tienen poco. */
  suavizadoID: number;
  /** Amplitud del ruido aleatorio (0,02 = ±2%). */
  ruido: number;
}

export const PARAMETROS_DEMANDA: ParametrosDemanda = parametrosPorDefecto;

/** Lo que el escenario cambia en cada período (lo cuenta el comentario económico). */
export interface ContextoDemanda {
  /** Multiplicador del mercado: 1 = normal, 1,15 = boom, 0,85 = recesión. */
  crecimiento: number;
  /** Si está, reemplaza al pesoID por defecto (público que valora más o menos la calidad). */
  pesoID?: number;
  /** Inflación: corre el precio de referencia. */
  precioReferencia?: number;
  /** Parte del mercado que se llevan competidores de afuera (0,1 = 10%). */
  competidoresExternos?: number;
  /** Activa el ruido aleatorio. */
  conRuido?: boolean;
}

export const CONTEXTO_NEUTRO: ContextoDemanda = { crecimiento: 1 };

export interface EntradaMercado {
  precio: number;
  marketing: number;
  /** I&D acumulado al INICIO del período (lo de este período cuenta desde el siguiente). */
  idAcumulado: number;
}

export interface ResultadoMercado {
  ordenes: number[];
  mercadoTotal: number;
  precioPromedio: number;
  marketingPromedio: number;
  idPromedio: number;
  /** Atractivo de cada empresa frente al promedio (sirve para explicar "¿Qué pasó?"). */
  atractivo: number[];
}

function promedio(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length;
}

export interface DescomposicionDemanda {
  /** Lo que le tocaría si todas fueran iguales: mercado total / cantidad de empresas. */
  parteJusta: number;
  /** Órdenes sin el ruido aleatorio. */
  ordenesSinRuido: number;
  /** Multiplicador de cada factor frente a una empresa "promedio" (1 = igual al promedio). */
  factorPrecio: number;
  factorMarketing: number;
  factorID: number;
  mercadoTotal: number;
  precioPromedio: number;
  marketingPromedio: number;
  idPromedio: number;
}

/**
 * Explica las órdenes de una empresa: cuánto le tocaba si todas fueran iguales y cuánto
 * sumó o restó su precio, su marketing y su I&D frente al promedio de la zona.
 */
export function descomponerDemanda(
  empresas: EntradaMercado[],
  indice: number,
  contexto: ContextoDemanda = CONTEXTO_NEUTRO,
  p: ParametrosDemanda = PARAMETROS_DEMANDA,
): DescomposicionDemanda {
  const r = calcularOrdenes(empresas, { ...contexto, conRuido: false }, p);
  const e = empresas[indice];
  const dif = e.precio - r.precioPromedio;
  const pesoID = contexto.pesoID ?? p.pesoID;
  const factorPrecio = Math.exp(-p.sensibilidadPrecio * dif - p.sensibilidadPrecioCuadratica * Math.max(dif, 0) ** 2);
  const factorMarketing = Math.pow((e.marketing + p.colchonMarketing) / (r.marketingPromedio + p.colchonMarketing), p.exponenteMarketing);
  const factorID = Math.pow((e.idAcumulado + p.suavizadoID) / (r.idPromedio + p.suavizadoID), pesoID);
  return {
    parteJusta: r.mercadoTotal / empresas.length,
    ordenesSinRuido: r.ordenes[indice],
    factorPrecio,
    factorMarketing,
    factorID,
    mercadoTotal: r.mercadoTotal,
    precioPromedio: r.precioPromedio,
    marketingPromedio: r.marketingPromedio,
    idPromedio: r.idPromedio,
  };
}

export function calcularOrdenes(
  empresas: EntradaMercado[],
  contexto: ContextoDemanda = CONTEXTO_NEUTRO,
  p: ParametrosDemanda = PARAMETROS_DEMANDA,
  rng?: Rng,
): ResultadoMercado {
  const n = empresas.length;
  const precioPromedio = promedio(empresas.map((e) => e.precio));
  const marketingPromedio = promedio(empresas.map((e) => e.marketing));
  const idPromedio = promedio(empresas.map((e) => e.idAcumulado));
  if (n === 0) return { ordenes: [], mercadoTotal: 0, precioPromedio, marketingPromedio, idPromedio, atractivo: [] };

  // 1. Tamaño del mercado: respuesta suave al precio y al marketing promedio de la zona.
  const precioRef = contexto.precioReferencia ?? p.precioReferencia;
  const factorPrecio = Math.pow(Math.max(precioPromedio, 1) / precioRef, -p.elasticidadPrecioMercado);
  const factorMarketing = Math.pow(
    (marketingPromedio + p.colchonMarketing) / (p.marketingReferencia + p.colchonMarketing),
    p.elasticidadMarketingMercado,
  );
  const mercadoTotal =
    n *
    p.ordenesBasePorEmpresa *
    contexto.crecimiento *
    factorPrecio *
    factorMarketing *
    (1 - (contexto.competidoresExternos ?? 0));

  // 2. Reparto según el atractivo relativo de cada empresa.
  const pesoID = contexto.pesoID ?? p.pesoID;
  const atractivo = empresas.map((e) => {
    const dif = e.precio - precioPromedio;
    const precio = Math.exp(-p.sensibilidadPrecio * dif - p.sensibilidadPrecioCuadratica * Math.max(dif, 0) ** 2);
    const marketing = Math.pow(
      (e.marketing + p.colchonMarketing) / (marketingPromedio + p.colchonMarketing),
      p.exponenteMarketing,
    );
    const calidad = Math.pow((e.idAcumulado + p.suavizadoID) / (idPromedio + p.suavizadoID), pesoID);
    return precio * marketing * calidad;
  });
  const suma = atractivo.reduce((s, a) => s + a, 0);
  const ordenes = atractivo.map((a) => {
    const ruido = contexto.conRuido && rng ? 1 + entre(rng, -p.ruido, p.ruido) : 1;
    return Math.max(0, Math.round((mercadoTotal * a * ruido) / suma));
  });
  return { ordenes, mercadoTotal, precioPromedio, marketingPromedio, idPromedio, atractivo };
}
