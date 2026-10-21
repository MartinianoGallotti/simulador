// Simulador "¿y si…?": prueba decisiones para el período actual sin avanzar la partida.
// Supone que la competencia repite lo que hizo el período anterior y que el mercado tiene
// el mismo tamaño que el período anterior (el crecimiento real del período es información oculta).

import type { ResultadoEmpresa } from '../empresa';
import { datosDePartida, periodoActual, ultimoPeriodo, type Partida } from '../partida';
import { procesarPeriodo } from '../periodo';
import type { Decisiones } from '../tipos';

export interface ResultadoYSi {
  resultado: ResultadoEmpresa;
  /** Precio promedio de la zona que supone la prueba. */
  precioPromedioZona: number;
}

export function simularYSi(p: Partida, decisiones: Decisiones): ResultadoYSi {
  const numero = periodoActual(p);
  const anterior = ultimoPeriodo(p);
  const datos = datosDePartida(p, numero);
  const demandaConocida = numero > 1 ? datosDePartida(p, numero - 1).demanda : { crecimiento: 1 };
  const supuestos = { ...datos, demanda: { ...demandaConocida, conRuido: false } };
  const todas = anterior.resultado.zona.empresas.map((_, i) =>
    i === p.indiceJugador ? decisiones : anterior.decisiones[i],
  );
  const res = procesarPeriodo(anterior.resultado.zona, todas, supuestos, p.config.reglas, { semilla: p.config.semilla });
  return {
    resultado: res.empresas[p.indiceJugador]!,
    precioPromedioZona: res.industrial.dolares.precioPromedio,
  };
}

export interface FilaBarrido {
  precio: number;
  ordenes: number;
  ventas: number;
  stock: number;
  perdidas: number;
  utilidad: number;
  penalidad: number;
}

/** Prueba todos los precios permitidos dejando fijas las demás decisiones. */
export function barridoDePrecios(p: Partida, decisiones: Decisiones): FilaBarrido[] {
  const lim = datosDePartida(p, periodoActual(p)).limites;
  const filas: FilaBarrido[] = [];
  for (let precio = lim.precioMin; precio <= lim.precioMax; precio++) {
    const { resultado: r } = simularYSi(p, { ...decisiones, precio });
    filas.push({
      precio,
      ordenes: r.marketing.ordenesRecibidas,
      ventas: r.marketing.ventasRealizadas,
      stock: r.marketing.stockUnidades,
      perdidas: r.marketing.ordenesNoRealizadas,
      utilidad: r.resultados.utilidad,
      penalidad: r.resultados.penalidad,
    });
  }
  return filas;
}
