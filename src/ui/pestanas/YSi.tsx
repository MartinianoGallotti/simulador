import { useMemo } from 'react';
import { barridoDePrecios, NIVELES, simularYSi, type DatosPeriodo, type Decisiones, type Partida } from '../../engine';
import { CampoNumero } from '../componentes/CampoNumero';
import { claseSigno, num, plata } from '../formato';
import { Kpi } from './ReporteCompania';

interface Props {
  partida: Partida;
  datos: DatosPeriodo;
  decisiones: Decisiones;
  onDecisiones: (d: Decisiones) => void;
}

export function PestanaYSi({ partida, datos, decisiones: d, onDecisiones }: Props) {
  const clave = JSON.stringify(d);
  const prueba = useMemo(() => simularYSi(partida, d), [partida, clave]);
  const barrido = useMemo(() => barridoDePrecios(partida, d), [partida, clave]);
  const r = prueba.resultado;
  const mejor = barrido.reduce((a, b) => (b.utilidad > a.utilidad ? b : a), barrido[0]);
  const cambiar = (c: Partial<Decisiones>) => onDecisiones({ ...d, ...c });
  const lim = datos.limites;

  return (
    <>
      <div className="aviso aviso-info">
        Probá decisiones sin avanzar la partida. La prueba supone que <b>la competencia repite lo que hizo el período pasado</b>{' '}
        y que <b>el mercado es del mismo tamaño que el período pasado</b>. Lo que cambies acá también cambia en tu cupón.
      </div>
      <div className="grilla">
        <div className="tarjeta">
          <h3>Tus decisiones</h3>
          <div className="hoja-fila">
            <label className="concepto" htmlFor="ysi-precio">
              Precio
              <span className="detalle">
                De {num(lim.precioMin)} a {num(lim.precioMax)}
              </span>
            </label>
            <div className="valor">
              <CampoNumero id="ysi-precio" valor={d.precio} onCambio={(v) => cambiar({ precio: v })} />
            </div>
          </div>
          <div className="hoja-fila">
            <label className="concepto" htmlFor="ysi-mkt">
              Marketing
              <span className="detalle">
                De {num(lim.marketingMin)} a {num(lim.marketingMax)}
              </span>
            </label>
            <div className="valor">
              <CampoNumero id="ysi-mkt" valor={d.marketing} onCambio={(v) => cambiar({ marketing: v })} />
            </div>
          </div>
          <div className="hoja-fila">
            <span className="concepto">Nivel de producción</span>
            <span />
          </div>
          <div className="opciones">
            {NIVELES.map((n) => (
              <button key={n} type="button" className="opcion" aria-pressed={d.nivel === n} onClick={() => cambiar({ nivel: n })}>
                {n}%
              </button>
            ))}
          </div>
          <p className="nota" style={{ marginTop: 10 }}>
            El resto (inversiones y préstamos) sale de tu hoja de trabajo. Precio promedio supuesto de la zona:{' '}
            {prueba.precioPromedioZona.toFixed(1).replace('.', ',')}.
          </p>
        </div>
        <div className="tarjeta">
          <h3>Lo que pasaría</h3>
          <div className="kpis">
            <Kpi titulo="Órdenes" valor={num(r.marketing.ordenesRecibidas)} />
            <Kpi titulo="Producción + stock" valor={num(r.marketing.oferta)} />
            <Kpi titulo="Ventas" valor={num(r.marketing.ventasRealizadas)} />
            <Kpi titulo="Ventas perdidas" valor={num(r.marketing.ordenesNoRealizadas)} />
            <Kpi titulo="Stock que sobra" valor={num(r.marketing.stockUnidades)} />
            <Kpi titulo="Utilidad del período" valor={plata(r.resultados.utilidad)} />
          </div>
          {r.resultados.penalidad > 0 && (
            <div className="aviso aviso-error">Con estas decisiones te quedás sin fondos: préstamo adicional y penalidad.</div>
          )}
          {r.quebrada && <div className="aviso aviso-error">Con estas decisiones la empresa quiebra.</div>}
        </div>
      </div>
      <div className="tarjeta">
        <h3>¿Y si cambio solo el precio?</h3>
        <div className="tabla-envoltorio">
          <table className="tabla">
            <thead>
              <tr>
                <th className="num">Precio</th>
                <th className="num">Órdenes</th>
                <th className="num">Ventas</th>
                <th className="num">Perdidas</th>
                <th className="num">Stock</th>
                <th className="num">Utilidad</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {barrido.map((f) => (
                <tr key={f.precio} className={f.precio === d.precio ? 'destacada' : ''}>
                  <td className="num">
                    {f.precio}
                    {f === mejor ? ' ★' : ''}
                  </td>
                  <td className="num">{num(f.ordenes)}</td>
                  <td className="num">{num(f.ventas)}</td>
                  <td className="num">{num(f.perdidas)}</td>
                  <td className="num">{num(f.stock)}</td>
                  <td className={`num ${claseSigno(f.utilidad)}`}>
                    {plata(f.utilidad)}
                    {f.penalidad > 0 ? ' (penalidad)' : ''}
                  </td>
                  <td>
                    {f.precio !== d.precio && (
                      <button type="button" className="boton boton-chico" onClick={() => cambiar({ precio: f.precio })}>
                        Usar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="nota" style={{ marginTop: 8 }}>
          ★ es el precio que más utilidad deja con lo demás fijo. Ojo: la competencia no va a repetir exactamente lo del
          período pasado, y el mercado puede crecer o achicarse según el comentario.
        </p>
      </div>
    </>
  );
}
