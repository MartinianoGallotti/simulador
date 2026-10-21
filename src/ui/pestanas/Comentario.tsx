import { useState } from 'react';
import { comentarioDelPeriodo, partidaTerminada, periodoActual, type Partida } from '../../engine';
import { num } from '../formato';

export function PestanaComentario({ partida }: { partida: Partida }) {
  const ultimo = partidaTerminada(partida) ? partida.config.cantidadPeriodos : periodoActual(partida);
  const [numero, setNumero] = useState(ultimo);
  const c = comentarioDelPeriodo(partida, numero);
  const l = c.limites;
  const capMax = partida.config.reglas.capacitacionMaxAcumulada;
  const capMultiplo = partida.config.reglas.capacitacionMultiplo;
  const eco = c.cambiosEconomia;

  return (
    <>
      {ultimo > 1 && (
        <div className="barra-vista">
          <label className="opciones" style={{ alignItems: 'center' }}>
            <span className="etiqueta">Comentario N°</span>
            <select value={numero} onChange={(e) => setNumero(Number(e.target.value))} style={{ width: 'auto' }}>
              {Array.from({ length: ultimo }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                  {n === ultimo && !partidaTerminada(partida) ? ' (actual)' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <article className="diario">
        <div className="diario-cabecera">
          {c.ronda ? `${c.ronda} - ` : ''}COMENTARIO ECONÓMICO NRO {numero}
        </div>
        <div className="diario-cuerpo">
          <div>
            {c.volanta && <div className="diario-volanta">{c.volanta}</div>}
            <h2 className="diario-titulo">{c.titulo}</h2>
            {c.copete && <p className="diario-copete">• {c.copete}</p>}
            <div className="diario-texto">
              {c.noticia.map((parrafo, i) => (
                <p key={i}>{parrafo}</p>
              ))}
            </div>
          </div>
          <aside className="diario-limites" aria-label="Límite de las decisiones">
            <h3>Límite de las decisiones para el Período N° {numero}</h3>
            <dl>
              <dt>Marketing</dt>
              <dd>
                La máxima inversión en marketing <b>por período</b> es de U$S {num(l.marketingMax)}, la mínima es de U$S{' '}
                {num(l.marketingMin)}.
              </dd>
              <dt>Precio</dt>
              <dd>
                <i>Mínimo:</i> U$S {num(l.precioMin)}. <i>Máximo:</i> U$S {num(l.precioMax)}.
              </dd>
              <dt>Ampliación de Planta</dt>
              <dd>
                La máxima inversión en planta <b>para este período es de U$S {num(l.ampliacionMax)}</b>. Si invertís más, se
                corrige al máximo.
              </dd>
              <dt>Investigación y Desarrollo</dt>
              <dd>
                La máxima inversión en I&amp;D <b>para este período será de U$S {num(l.investigacionMax)}</b>.
              </dd>
              <dt>Capacitación</dt>
              <dd>
                Límite máximo U$S {num(capMax)} <b>(ACUMULADO)</b>. La inversión debe ser múltiplo de U$S {num(capMultiplo)}.
                {l.capacitacionMaxPeriodo !== undefined && ` Máximo por período: U$S ${num(l.capacitacionMaxPeriodo)}.`}
              </dd>
              {eco && (
                <>
                  <dt>Cambios en la economía</dt>
                  <dd>
                    {eco.tasaImpuesto !== undefined && <div>Tasa de impuesto: {eco.tasaImpuesto}%.</div>}
                    {eco.tasaMantenimiento !== undefined && <div>Tasa de mantenimiento: {eco.tasaMantenimiento}%.</div>}
                    {eco.costoStockUnidad !== undefined && <div>Mantenimiento de stock: U$S {eco.costoStockUnidad} por unidad.</div>}
                    {eco.limiteGiro !== undefined && <div>Límite de giro en descubierto: U$S {num(eco.limiteGiro)}.</div>}
                    {eco.bancos?.map((b, i) => {
                      const cambios = [
                        b.tasaAnual !== undefined && `tasa ${b.tasaAnual}% anual`,
                        b.maximoCredito !== undefined && `máximo crédito U$S ${num(b.maximoCredito)}`,
                      ].filter(Boolean);
                      return cambios.length > 0 ? (
                        <div key={i}>
                          Banco {partida.config.reglas.nombresBancos[i]}: {cambios.join(' · ')}.
                        </div>
                      ) : null;
                    })}
                  </dd>
                </>
              )}
            </dl>
          </aside>
        </div>
      </article>
    </>
  );
}
