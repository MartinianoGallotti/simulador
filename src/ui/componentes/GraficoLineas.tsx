import { useEffect, useRef, useState } from 'react';

/** Paleta categórica validada (orden fijo: el color sigue a la empresa, nunca al puesto). */
export const COLORES_SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
/** Para las series que no entran en la paleta (zonas de más de 8 empresas). */
export const COLOR_RESTO = '#a3acb8';

export interface Serie {
  nombre: string;
  valores: (number | null)[];
  color: string;
}

interface Props {
  titulo: string;
  subtitulo?: string;
  etiquetasX: string[];
  series: Serie[];
  formato: (v: number) => string;
  /** Incluir el 0 en el eje (montos que pueden ser negativos o arrancan en 0). */
  conCero?: boolean;
  /** Marcas del eje solo en números enteros (precios, unidades). */
  ejeEntero?: boolean;
  alto?: number;
}

function ticksLindos(min: number, max: number, cantidad = 5, entero = false): number[] {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const paso0 = (max - min) / cantidad;
  const mag = Math.pow(10, Math.floor(Math.log10(paso0)));
  let paso = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((p) => p >= paso0) ?? 10 * mag;
  // Con valores enteros (precios, unidades) el paso nunca es menor que 1 ni con decimales.
  if (entero) paso = Math.max(1, Math.ceil(paso));
  const desde = Math.floor(min / paso) * paso;
  const hasta = Math.ceil(max / paso) * paso;
  const ticks: number[] = [];
  for (let v = desde; v <= hasta + paso / 2; v += paso) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

function useAncho<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [ancho, setAncho] = useState(300);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setAncho(el.clientWidth || 300);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, ancho];
}

/** Gráfico de líneas con cruz que sigue al puntero, tooltip con todas las series, leyenda y vista de tabla. */
export function GraficoLineas({ titulo, subtitulo, etiquetasX, series, formato, conCero = false, ejeEntero = false, alto = 240 }: Props) {
  const [contenedor, ancho] = useAncho<HTMLDivElement>();
  const [indice, setIndice] = useState<number | null>(null);
  const [tabla, setTabla] = useState(false);

  const todos = series.flatMap((s) => s.valores.filter((v): v is number => v !== null));
  const minDato = Math.min(...todos, ...(conCero ? [0] : []));
  const maxDato = Math.max(...todos, ...(conCero ? [0] : []));
  const ticks = todos.length ? ticksLindos(minDato, maxDato, 5, ejeEntero) : [0, 1];

  const etiquetasDirectas = series.length <= 4 && ancho > 420;
  // El margen izquierdo se ajusta al texto más largo del eje (11px ≈ 6,5px por carácter).
  const largoEje = Math.max(...ticks.map((t) => formato(t).length));
  const m = { izq: Math.max(36, Math.round(largoEje * 6.6) + 14), der: etiquetasDirectas ? 96 : 16, arr: 12, aba: 28 };
  const w = Math.max(200, ancho);
  const anchoPlot = w - m.izq - m.der;
  const altoPlot = alto - m.arr - m.aba;
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const n = etiquetasX.length;
  const x = (i: number) => m.izq + (n <= 1 ? anchoPlot / 2 : (i * anchoPlot) / (n - 1));
  const y = (v: number) => m.arr + altoPlot - ((v - yMin) / (yMax - yMin || 1)) * altoPlot;

  const camino = (valores: (number | null)[]) => {
    let d = '';
    let dibujando = false;
    valores.forEach((v, i) => {
      if (v === null) {
        dibujando = false;
        return;
      }
      d += `${dibujando ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      dibujando = true;
    });
    return d;
  };

  // Etiquetas al final de cada línea, separadas para que no se pisen.
  const finales = series
    .map((s) => {
      let i = s.valores.length - 1;
      while (i >= 0 && s.valores[i] === null) i--;
      return { s, i, yv: i >= 0 ? y(s.valores[i] as number) : 0 };
    })
    .filter((f) => f.i >= 0)
    .sort((a, b) => a.yv - b.yv);
  for (let k = 1; k < finales.length; k++) {
    if (finales[k].yv - finales[k - 1].yv < 14) finales[k].yv = finales[k - 1].yv + 14;
  }

  const alMover = (e: React.PointerEvent<SVGRectElement>) => {
    const caja = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const px = e.clientX - caja.left;
    const i = n <= 1 ? 0 : Math.round(((px - m.izq) / anchoPlot) * (n - 1));
    setIndice(Math.max(0, Math.min(n - 1, i)));
  };

  return (
    <figure className="tarjeta grafico" style={{ margin: '0 0 16px' }}>
      <div className="grafico-cabecera">
        <div>
          <h3 style={{ marginBottom: 2 }}>{titulo}</h3>
          {subtitulo && <p className="nota" style={{ margin: 0 }}>{subtitulo}</p>}
        </div>
        <button type="button" className="boton boton-chico" onClick={() => setTabla(!tabla)}>
          {tabla ? 'Ver gráfico' : 'Ver tabla'}
        </button>
      </div>
      {series.length >= 2 && (
        <div className="leyenda">
          {series.map((s) => (
            <span key={s.nombre} className="leyenda-item">
              <span className="leyenda-linea" style={{ background: s.color }} />
              {s.nombre}
            </span>
          ))}
        </div>
      )}
      <div ref={contenedor} className="grafico-lienzo">
      {tabla ? (
        <div className="tabla-envoltorio">
          <table className="tabla">
            <thead>
              <tr>
                <th />
                {etiquetasX.map((e) => (
                  <th key={e} className="num">
                    {e}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {series.map((s) => (
                <tr key={s.nombre}>
                  <td>{s.nombre}</td>
                  {s.valores.map((v, i) => (
                    <td key={i} className="num">
                      {v === null ? '—' : formato(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <svg width={w} height={alto} role="img" aria-label={titulo}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={m.izq} x2={m.izq + anchoPlot} y1={y(t)} y2={y(t)} className={t === 0 ? 'eje-base' : 'grilla-linea'} />
                <text x={m.izq - 8} y={y(t)} className="eje-texto" textAnchor="end" dominantBaseline="middle">
                  {formato(t)}
                </text>
              </g>
            ))}
            {etiquetasX.map((e, i) => (
              <text key={e} x={x(i)} y={alto - 8} className="eje-texto" textAnchor="middle">
                {e}
              </text>
            ))}
            {indice !== null && <line x1={x(indice)} x2={x(indice)} y1={m.arr} y2={m.arr + altoPlot} className="cruz" />}
            {series.map((s) => (
              <g key={s.nombre}>
                <path d={camino(s.valores)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                {s.valores.map((v, i) =>
                  v === null ? null : (
                    <circle key={i} cx={x(i)} cy={y(v)} r={indice === i ? 5 : 4} fill={s.color} stroke="#fff" strokeWidth={2} />
                  ),
                )}
              </g>
            ))}
            {etiquetasDirectas &&
              finales.map((f) => (
                <text key={f.s.nombre} x={x(f.i) + 10} y={f.yv} className="etiqueta-directa" dominantBaseline="middle">
                  {f.s.nombre}
                </text>
              ))}
            <rect
              x={m.izq - 10}
              y={m.arr}
              width={anchoPlot + 20}
              height={altoPlot}
              fill="transparent"
              onPointerMove={alMover}
              onPointerDown={alMover}
              onPointerLeave={() => setIndice(null)}
            />
          </svg>
          {indice !== null && (
            <div
              className="tooltip"
              style={{ left: Math.min(Math.max(x(indice) + 12, 0), w - 190), top: m.arr }}
              role="status"
            >
              <div className="tooltip-titulo">{etiquetasX[indice]}</div>
              {series.map((s) => (
                <div key={s.nombre} className="tooltip-fila">
                  <span className="leyenda-linea" style={{ background: s.color }} />
                  <b>{s.valores[indice] === null ? '—' : formato(s.valores[indice] as number)}</b>
                  <span className="nota">{s.nombre}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      </div>
    </figure>
  );
}
