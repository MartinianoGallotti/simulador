// Tipos compartidos por todo el motor.

export type Nivel = 0 | 25 | 50 | 75 | 100;
export const NIVELES: readonly Nivel[] = [0, 25, 50, 75, 100];

/** Las 10 decisiones del cupón. Índice 0 = Banco 1 (Nación), índice 1 = Banco 2 (Provincia). */
export interface Decisiones {
  precio: number;
  marketing: number;
  investigacion: number;
  capacitacion: number;
  ampliacion: number;
  pedidos: [number, number];
  devoluciones: [number, number];
  nivel: Nivel;
}

/** Deuda con un banco. El giro en descubierto es lo que se pidió por encima del máximo crédito. */
export interface DeudaBanco {
  tomados: number;
  giro: number;
}

/** Unidades en stock que se fabricaron al mismo costo (se venden primero las más viejas). */
export interface LoteStock {
  unidades: number;
  costoUnitario: number;
}

/**
 * Situación de una empresa al inicio de un período: lo que el equipo lee en el
 * Balance y en los Valores del Próximo Período del reporte anterior.
 */
export interface EstadoEmpresa {
  nombre: string;
  efectivo: number;
  /** Valor de la planta para este período (ya incluye la ampliación del período anterior). */
  planta: number;
  capacitacionAcumulada: number;
  idAcumulado: number;
  stock: LoteStock[];
  empleados: number;
  deudas: [DeudaBanco, DeudaBanco];
  utilidadAcumulada: number;
  capital: number;
  quebrada: boolean;
}

export function decisionesVacias(): Decisiones {
  return {
    precio: 0,
    marketing: 0,
    investigacion: 0,
    capacitacion: 0,
    ampliacion: 0,
    pedidos: [0, 0],
    devoluciones: [0, 0],
    nivel: 0,
  };
}

export function unidadesEnStock(stock: LoteStock[]): number {
  return stock.reduce((s, l) => s + l.unidades, 0);
}

export function valorStock(stock: LoteStock[]): number {
  return stock.reduce((s, l) => s + l.unidades * l.costoUnitario, 0);
}

export function deudaTotal(d: DeudaBanco): number {
  return d.tomados + d.giro;
}
