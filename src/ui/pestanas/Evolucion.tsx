import { type Partida } from '../../engine';
import { COLOR_RESTO, COLORES_SERIES, GraficoLineas, type Serie } from '../componentes/GraficoLineas';
import { costo, num, plata } from '../formato';

/** Gráficos de evolución período a período. */
export function PestanaEvolucion({ partida }: { partida: Partida }) {
  const h = partida.historial;
  if (h.length < 2) {
    return <div className="aviso aviso-info">Los gráficos aparecen después de jugar el primer período.</div>;
  }
  const etiquetas = h.map((x) => `P${x.numero}`);
  const j = partida.indiceJugador;
  const yo = h.map((x) => x.resultado.empresas[j]);
  // El jugador siempre usa el primer color; los bots, los siguientes en orden fijo.
  // Con más de 8 empresas no se repiten colores: las que no entran en la paleta van en gris.
  const colorDe = (i: number) => {
    if (i === j) return COLORES_SERIES[0];
    const k = 1 + (i < j ? i : i - 1);
    return k < COLORES_SERIES.length ? COLORES_SERIES[k] : COLOR_RESTO;
  };

  const utilidades: Serie[] = partida.nombres.map((nombre, i) => ({
    nombre: i === j ? `${nombre} (vos)` : nombre,
    color: colorDe(i),
    valores: h.map((x) => x.resultado.empresas[i]?.balance.utilidadesAcumuladas ?? null),
  }));

  return (
    <>
      <GraficoLineas
        titulo="Utilidad acumulada"
        subtitulo="Gana la empresa con más utilidad acumulada al final del último período."
        etiquetasX={etiquetas}
        series={utilidades}
        formato={plata}
        conCero
      />
      <div className="grilla">
        <GraficoLineas
          titulo="Precio"
          subtitulo="Tu precio frente al promedio de la zona."
          etiquetasX={etiquetas}
          series={[
            { nombre: 'Tu precio', color: COLORES_SERIES[0], valores: yo.map((r) => r?.decisiones.precio ?? null) },
            { nombre: 'Promedio zona', color: COLORES_SERIES[1], valores: h.map((x) => x.resultado.industrial.dolares.precioPromedio) },
          ]}
          formato={(v) => (Number.isInteger(v) ? num(v) : v.toFixed(1).replace('.', ','))}
          ejeEntero
          alto={220}
        />
        <GraficoLineas
          titulo="Demanda y producción"
          subtitulo="Si las órdenes superan a las ventas, perdiste clientes. Si la producción supera a las ventas, sobró stock."
          etiquetasX={etiquetas}
          series={[
            { nombre: 'Órdenes', color: COLORES_SERIES[0], valores: yo.map((r) => r?.marketing.ordenesRecibidas ?? null) },
            { nombre: 'Producción', color: COLORES_SERIES[1], valores: yo.map((r) => r?.produccion.produccion ?? null) },
            { nombre: 'Ventas', color: COLORES_SERIES[2], valores: yo.map((r) => r?.marketing.ventasRealizadas ?? null) },
          ]}
          formato={(v) => num(v)}
          conCero
          ejeEntero
          alto={220}
        />
        <GraficoLineas
          titulo="Efectivo y préstamos"
          etiquetasX={etiquetas}
          series={[
            { nombre: 'Efectivo', color: COLORES_SERIES[0], valores: yo.map((r) => r?.balance.efectivo ?? null) },
            { nombre: 'Préstamos', color: COLORES_SERIES[1], valores: yo.map((r) => r?.balance.prestamos ?? null) },
          ]}
          formato={plata}
          conCero
          alto={220}
        />
        <GraficoLineas
          titulo="Costo por unidad"
          subtitulo="Baja con la capacitación y la planta; sube si no jugás al 75%."
          etiquetasX={etiquetas}
          series={[{ nombre: 'Costo por unidad', color: COLORES_SERIES[0], valores: yo.map((r) => (r && r.produccion.produccion > 0 ? r.produccion.costoUnitario : null)) }]}
          formato={(v) => costo(v)}
          alto={220}
        />
      </div>
    </>
  );
}
