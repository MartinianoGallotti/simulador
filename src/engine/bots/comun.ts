// Herramientas que comparten todos los bots. Los bots juegan con la misma información
// que un equipo humano: su Reporte de la Compañía, el Reporte Industrial y el Comentario
// Económico (límites y "tags" de la noticia). Nunca ven el crecimiento real del mercado.

import { entre, type Rng } from '../azar';
import type { ConfigReglas } from '../config';
import type { ResultadoEmpresa } from '../empresa';
import { calcularHojaDeTrabajo, sugerirFinanciamiento } from '../hojaDeTrabajo';
import type { DatosPeriodo } from '../periodo';
import { calcularProduccion, capacidadPlanta, empleadosNecesarios, produccionDelNivel } from '../produccion';
import type { ReporteIndustrial } from '../reportes';
import { unidadesEnStock, type Decisiones, type EstadoEmpresa, type Nivel } from '../tipos';

export type Dificultad = 'facil' | 'normal' | 'dificil';

export interface ContextoBot {
  indice: number;
  nombre: string;
  /** Estado al inicio del período (Balance + Valores del Próximo Período). */
  estado: EstadoEmpresa;
  /** Su propio resultado del período anterior. */
  anterior: ResultadoEmpresa | null;
  industrial: ReporteIndustrial | null;
  /** Límites y economía del comentario. `datos.demanda` NO se usa: es información oculta. */
  datos: DatosPeriodo;
  /** Lo que "lee" el bot en la noticia del comentario. */
  tags: string[];
  /** Períodos que quedan contando el actual (1 = último período). */
  periodosRestantes: number;
  reglas: ConfigReglas;
  rng: Rng;
  dificultad: Dificultad;
}

export const PRECISION: Record<Dificultad, { ruidoPrecio: number; errorDemanda: number; probErrorNovato: number }> = {
  facil: { ruidoPrecio: 2, errorDemanda: 0.15, probErrorNovato: 0.35 },
  normal: { ruidoPrecio: 1, errorDemanda: 0.07, probErrorNovato: 0.25 },
  dificil: { ruidoPrecio: 0, errorDemanda: 0.03, probErrorNovato: 0.15 },
};

export const acotar = (x: number, min: number, max: number) => Math.max(min, Math.min(max, x));
export const redondear100 = (x: number) => Math.round(x / 100) * 100;

/** Cuánto espera que cambie el mercado según lo que dice el comentario. */
export function factorTags(tags: string[]): number {
  const efectos: Record<string, number> = {
    boom: 1.1,
    crecimiento: 1.05,
    recuperacion: 1.05,
    recesion: 0.9,
    crisis: 0.85,
    competencia_externa: 0.93,
  };
  return tags.reduce((f, t) => f * (efectos[t] ?? 1), 1);
}

export const hayTag = (ctx: ContextoBot, ...tags: string[]) => tags.some((t) => ctx.tags.includes(t));

/** Precio promedio que espera en la zona este período. */
export function precioPromedioEsperado(ctx: ContextoBot): number {
  const lim = ctx.datos.limites;
  const anterior = ctx.industrial?.dolares.precioPromedio ?? 90;
  const inflacion = hayTag(ctx, 'inflacion') ? 2 : 0;
  return acotar(anterior + inflacion, lim.precioMin, lim.precioMax);
}

/** Lo que el bot cree del efecto del precio relativo (parecido al modelo, pero es su intuición). */
function efectoPrecio(relativo: number): number {
  return Math.exp(-0.07 * relativo - 0.0075 * Math.max(relativo, 0) ** 2);
}

/**
 * Demanda que espera con un precio y un marketing dados: parte de las órdenes que recibió
 * el período anterior y las ajusta por el comentario y por cómo cambia su posición frente a la zona.
 */
export function estimarDemanda(ctx: ContextoBot, precio: number, marketing: number, ruido: number): number {
  const a = ctx.anterior;
  const capacidad = capacidadPlanta(ctx.estado.planta, ctx.reglas);
  const base = a ? a.marketing.ordenesRecibidas : capacidad * 0.75;
  const precioAnterior = a?.decisiones.precio ?? 90;
  const promedioAnterior = ctx.industrial?.dolares.precioPromedio ?? precioAnterior;
  const relAnterior = precioAnterior - promedioAnterior;
  const relNuevo = precio - precioPromedioEsperado(ctx);
  const mktAnterior = a?.decisiones.marketing ?? 8500;
  const efectoMkt = Math.pow((marketing + 500) / (mktAnterior + 500), 0.7);
  return base * factorTags(ctx.tags) * (1 + ruido) * (efectoPrecio(relNuevo) / efectoPrecio(relAnterior)) * efectoMkt;
}

export interface Plan {
  precio: number;
  marketing: number;
  nivel: Nivel;
  demandaEsperada: number;
}

/**
 * Busca la combinación de precio, marketing y nivel que más ganancia le deja
 * según su estimación: lo que enseña el video de igualar oferta con demanda, pero hecho con cuentas.
 */
export function mejorPlan(
  ctx: ContextoBot,
  opciones: { precios?: number[]; marketings?: number[]; niveles?: Nivel[] } = {},
): Plan {
  const lim = ctx.datos.limites;
  const ruido = entre(ctx.rng, -PRECISION[ctx.dificultad].errorDemanda, PRECISION[ctx.dificultad].errorDemanda);
  const precios = opciones.precios ?? Array.from({ length: lim.precioMax - lim.precioMin + 1 }, (_, i) => lim.precioMin + i);
  const mktBase = ctx.anterior?.decisiones.marketing ?? 8500;
  // Además de mover un poco el marketing del período pasado, siempre prueba valores razonables
  // del rango del comentario: si un período puso 0, tiene que poder volver a invertir.
  const marketings =
    opciones.marketings ??
    [
      ...new Set(
        [...[0.8, 0.9, 1, 1.1, 1.25].map((f) => mktBase * f), lim.marketingMax * 0.5, lim.marketingMax * 0.8].map((m) =>
          acotar(redondear100(m), lim.marketingMin, lim.marketingMax),
        ),
      ),
    ];
  const niveles = opciones.niveles ?? ([0, 25, 50, 75, 100] as Nivel[]);
  const stock = unidadesEnStock(ctx.estado.stock);
  const costoStock = ctx.datos.economia.costoStockUnidad;
  let mejor: Plan & { ganancia: number } = { precio: precios[0], marketing: marketings[0], nivel: 75, demandaEsperada: 0, ganancia: -Infinity };
  for (const nivel of niveles) {
    const prod = calcularProduccion(ctx.estado.planta, ctx.estado.capacitacionAcumulada, nivel, ctx.reglas);
    const empleados = empleadosNecesarios(prod.produccion, ctx.reglas);
    const despidos = Math.max(0, ctx.estado.empleados - empleados) * ctx.reglas.indemnizacionPorDespedido;
    const contrataciones = Math.max(0, empleados - ctx.estado.empleados) * ctx.reglas.ingresoPorContratado;
    const oferta = prod.produccion + stock;
    for (const precio of precios) {
      for (const marketing of marketings) {
        const demanda = estimarDemanda(ctx, precio, marketing, ruido);
        const ventas = Math.min(demanda, oferta);
        const sobrante = oferta - ventas;
        // Lo que sobra paga mantenimiento de stock y además inmoviliza plata (que hay que pedir prestada).
        const castigoSobrante = ctx.periodosRestantes > 1 ? costoStock + prod.costoUnitario * 0.3 : costoStock;
        // Cada unidad vendida se cuenta al costo de este nivel. Con nivel 0 se vende solo stock, que ya
        // está pagado (costo hundido): por eso "no producir" sale gratis y conviene para vaciar el depósito.
        // Valuar el stock a su costo histórico parece más correcto, pero en las pruebas los bots deciden peor.
        const ganancia =
          ventas * (precio - prod.costoUnitario) - marketing - sobrante * castigoSobrante - despidos + contrataciones;
        if (ganancia > mejor.ganancia) mejor = { precio, marketing, nivel, demandaEsperada: demanda, ganancia };
      }
    }
  }
  return mejor;
}

/** ¿Le conviene ampliar? Si espera vender más de lo que puede fabricar y quedan períodos para aprovecharlo. */
export function convieneAmpliar(ctx: ContextoBot, demandaEsperada: number): boolean {
  if (ctx.periodosRestantes < 2 || hayTag(ctx, 'recesion', 'crisis')) return false;
  const capacidad = capacidadPlanta(ctx.estado.planta, ctx.reglas);
  // Si en la zona sobra mercadería, ampliar es fabricar stock.
  const u = ctx.industrial?.unidades;
  if (u && u.totalVendido > 0 && u.stockTotal > u.totalVendido * 0.08) return false;
  if (unidadesEnStock(ctx.estado.stock) > capacidad * 0.1) return false;
  // Si el período pasado se quedó sin mercadería y perdió ventas, le falta planta.
  const a = ctx.anterior?.marketing;
  if (a && a.ordenesNoRealizadas > a.ordenesRecibidas * 0.05) return true;
  return demandaEsperada * factorTags(ctx.tags) > capacidad * 0.8;
}

/** Capacitación que todavía sirve: múltiplo de 2.000 y sin pasarse del tope acumulado. */
export function capacitacionUtil(ctx: ContextoBot, deseada: number): number {
  const lugar = Math.max(0, ctx.reglas.capacitacionMaxAcumulada - ctx.estado.capacitacionAcumulada);
  const c = Math.min(deseada, lugar, ctx.datos.limites.capacitacionMaxPeriodo ?? Infinity);
  return c - (c % ctx.reglas.capacitacionMultiplo);
}

/**
 * La hoja de trabajo no mira el cierre: ahí se paga el mantenimiento del stock.
 * Si las ventas esperadas no alcanzan para pagarlo, el bot guarda esa plata en el fondo fijo.
 */
export function reservaParaElCierre(ctx: ContextoBot, d: Decisiones, demandaEsperada: number, fondoFijo: number): number {
  const capacidad = capacidadPlanta(ctx.estado.planta, ctx.reglas);
  const ofertaPlan = produccionDelNivel(capacidad, d.nivel) + unidadesEnStock(ctx.estado.stock);
  const ventasPrudentes = Math.min(ofertaPlan, demandaEsperada * 0.7);
  const costoStock = (ofertaPlan - ventasPrudentes) * ctx.datos.economia.costoStockUnidad;
  return fondoFijo + Math.max(0, costoStock - ventasPrudentes * d.precio * 0.5);
}

/**
 * Cierra las cuentas con la hoja de trabajo: pide al banco más barato lo que falte y devuelve
 * al más caro lo que sobre. Si ni pidiendo todo el margen alcanza, recorta inversiones
 * (ampliación, capacitación, I&D, marketing hasta un piso) y después baja el nivel.
 */
export function cerrarCuentas(
  ctx: ContextoBot,
  d: Decisiones,
  opciones: { fondoFijo: number; demandaEsperada: number; devolverSobrante: boolean; marketingMinimo?: number },
): Decisiones {
  const lim = ctx.datos.limites;
  const piso = Math.max(lim.marketingMin, opciones.marketingMinimo ?? redondear100(d.marketing * 0.6));
  let actual = { ...d, pedidos: [0, 0] as [number, number], devoluciones: [0, 0] as [number, number] };
  for (let intento = 0; intento < 20; intento++) {
    const entrada = {
      estado: ctx.estado,
      economia: ctx.datos.economia,
      decisiones: actual,
      fondoFijo: reservaParaElCierre(ctx, actual, opciones.demandaEsperada, opciones.fondoFijo),
      reglas: ctx.reglas,
    };
    const fin = sugerirFinanciamiento(entrada);
    if (fin.faltanteSinCubrir <= 0) {
      const final = { ...actual, pedidos: fin.pedidos, devoluciones: opciones.devolverSobrante ? fin.devoluciones : ([0, 0] as [number, number]) };
      if (calcularHojaDeTrabajo({ ...entrada, decisiones: final }).diferencia >= 0) return final;
    }
    if (actual.ampliacion > 0) actual.ampliacion = Math.max(0, actual.ampliacion - 5000);
    else if (actual.capacitacion > 0) actual.capacitacion = Math.max(0, actual.capacitacion - ctx.reglas.capacitacionMultiplo);
    else if (actual.investigacion > 0) actual.investigacion = Math.max(0, actual.investigacion - 2000);
    else if (actual.marketing > piso) actual.marketing = Math.max(piso, actual.marketing - 1000);
    else if (actual.nivel > 25) actual.nivel = (actual.nivel - 25) as Nivel;
    else actual.marketing = Math.max(lim.marketingMin, actual.marketing - 1000);
  }
  return { ...actual, nivel: 0, ampliacion: 0, capacitacion: 0, investigacion: 0 };
}
