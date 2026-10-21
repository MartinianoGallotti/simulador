// Préstamos, intereses, giro en descubierto y préstamo adicional.

import type { BancoEconomia, ModoIntereses } from './config';
import { deudaTotal, type DeudaBanco } from './tipos';

export type Par<T> = [T, T];

/** Margen de crédito disponible = Máximo Crédito − Préstamos Tomados. */
export function margenDisponible(banco: BancoEconomia, deuda: DeudaBanco): number {
  return Math.max(0, banco.maximoCredito - deuda.tomados);
}

/** Interés de un período (cuatrimestre) por una deuda: deuda × tasa anual / 3. */
export function interesDeuda(deuda: number, tasaAnual: number): number {
  return (deuda * tasaAnual) / 100 / 3;
}

// SUPUESTO (confirmado por Marti con material de Omega Simulaciones): lo pedido en t cobra
// intereses desde t+1. Queda aislado acá y se puede cambiar con `modoIntereses`.
/**
 * Intereses del período.
 * - 'periodo_siguiente' (por defecto): se cobran sobre la deuda al INICIO del período,
 *   así que lo que se pide en t empieza a pagar intereses en t+1.
 * - 'mismo_periodo': se cobran sobre la deuda después de los pedidos y devoluciones de t.
 * El préstamo adicional nunca paga intereses en el período en que se otorga.
 */
// SUPUESTO: el giro en descubierto paga intereses a la tasa del banco en el que se generó.
export function calcularIntereses(
  modo: ModoIntereses,
  bancos: Par<BancoEconomia>,
  deudaInicio: Par<DeudaBanco>,
  deudaDespuesDeMovimientos: Par<DeudaBanco>,
): { porBanco: Par<number>; total: number } {
  const base = modo === 'periodo_siguiente' ? deudaInicio : deudaDespuesDeMovimientos;
  const porBanco: Par<number> = [
    interesDeuda(deudaTotal(base[0]), bancos[0].tasaAnual),
    interesDeuda(deudaTotal(base[1]), bancos[1].tasaAnual),
  ];
  return { porBanco, total: porBanco[0] + porBanco[1] };
}

/** Devolver: primero se cancela el giro de ese banco y después los préstamos tomados. */
export function aplicarDevolucion(deuda: DeudaBanco, monto: number): DeudaBanco {
  const aGiro = Math.min(monto, deuda.giro);
  const aTomados = Math.min(monto - aGiro, deuda.tomados);
  return { tomados: deuda.tomados - aTomados, giro: deuda.giro - aGiro };
}

/** Pedir: hasta el margen va a préstamos tomados; el excedente se otorga igual, como giro en descubierto. */
export function aplicarPedido(
  banco: BancoEconomia,
  deuda: DeudaBanco,
  monto: number,
): { deuda: DeudaBanco; aTomados: number; aGiro: number } {
  const aTomados = Math.min(monto, margenDisponible(banco, deuda));
  const aGiro = monto - aTomados;
  return { deuda: { tomados: deuda.tomados + aTomados, giro: deuda.giro + aGiro }, aTomados, aGiro };
}

/** Bancos ordenados de menor a mayor tasa (si empatan, primero el Banco 1). */
export function ordenPorTasa(bancos: Par<BancoEconomia>): Par<0 | 1> {
  return bancos[1].tasaAnual < bancos[0].tasaAnual ? [1, 0] : [0, 1];
}

/**
 * Préstamo adicional forzoso: cubre el faltante con el banco de menor tasa que tenga
 * margen, después con el otro, y lo que no entra va a giro en descubierto.
 */
// SUPUESTO: si no alcanza el margen de ningún banco, el resto va a giro del banco de mayor tasa.
export function asignarPrestamoAdicional(
  bancos: Par<BancoEconomia>,
  deudas: Par<DeudaBanco>,
  monto: number,
): { deudas: Par<DeudaBanco>; adicionalPorBanco: Par<number>; aGiro: number } {
  const nuevas: Par<DeudaBanco> = [{ ...deudas[0] }, { ...deudas[1] }];
  const adicionalPorBanco: Par<number> = [0, 0];
  let resto = monto;
  const orden = ordenPorTasa(bancos);
  for (const i of orden) {
    const parte = Math.min(resto, margenDisponible(bancos[i], nuevas[i]));
    nuevas[i].tomados += parte;
    adicionalPorBanco[i] += parte;
    resto -= parte;
  }
  const masCaro = orden[1];
  nuevas[masCaro].giro += resto;
  return { deudas: nuevas, adicionalPorBanco, aGiro: resto };
}
