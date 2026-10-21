import { useEffect, useRef, useState } from 'react';
import {
  CAPACITACIONES,
  CAPACITACIONES_ORIGINALES,
  columnaCapacitacion,
  detalleCosto,
  filaPlanilla,
  fuentePlanta,
  NIVELES_PLANILLA,
  PLANTAS,
  type EstadoEmpresa,
  type Nivel,
} from '../../engine';
import { CampoNumero } from '../componentes/CampoNumero';
import { costo, num } from '../formato';

interface Props {
  estado: EstadoEmpresa;
  nivel: Nivel;
}

const MARCAS = { video: '', documento_borroso: '≈', extrapolado: '*' } as const;

export function PestanaPlanilla({ estado, nivel: nivelInicial }: Props) {
  const [planta, setPlanta] = useState(estado.planta);
  const [capacitacion, setCapacitacion] = useState(estado.capacitacionAcumulada);
  const [nivel, setNivel] = useState<Nivel>(nivelInicial === 0 ? 75 : nivelInicial);
  const contenedor = useRef<HTMLDivElement>(null);
  const filaActiva = useRef<HTMLTableRowElement>(null);

  const det = detalleCosto(planta, capacitacion, nivel);
  const columna = columnaCapacitacion(capacitacion);
  const iNivel = NIVELES_PLANILLA.indexOf(nivel);
  const esTuyo = planta === estado.planta && capacitacion === estado.capacitacionAcumulada;

  useEffect(() => {
    const c = contenedor.current;
    const f = filaActiva.current;
    if (c && f) c.scrollTop = f.offsetTop - c.clientHeight / 2;
  }, [det.plantaInferior, columna]);

  return (
    <div className="grilla" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
      <div className="tarjeta">
        <h3>Buscar el costo unitario</h3>
        <p className="nota">
          Se usan los <b>Valores del Próximo Período</b> del último reporte.{' '}
          {esTuyo ? 'Estos son los de tu empresa.' : 'Estás probando otros valores.'}
        </p>
        <div className="campo">
          <label htmlFor="pl-planta">Valor de la planta</label>
          <CampoNumero id="pl-planta" valor={planta} onCambio={setPlanta} />
        </div>
        <div className="campo">
          <label htmlFor="pl-cap">Capacitación acumulada</label>
          <CampoNumero id="pl-cap" valor={capacitacion} onCambio={setCapacitacion} />
          {capacitacion !== columna && (
            <span className="ayuda">
              Se usa la columna {num(columna)} (múltiplo de 2.000 hacia abajo, con tope en 20.000).
            </span>
          )}
        </div>
        <div className="campo">
          <span className="etiqueta">Nivel de producción</span>
          <div className="opciones">
            {NIVELES_PLANILLA.map((n) => (
              <button key={n} type="button" className="opcion" aria-pressed={nivel === n} onClick={() => setNivel(n)}>
                {n}%
              </button>
            ))}
          </div>
        </div>
        <div className="aviso aviso-info">
          Costo unitario: <b>U$S {costo(det.costoUnitario)}</b>
          {det.interpolado && (
            <div style={{ marginTop: 6, fontSize: '0.88rem' }}>
              La planta {num(planta)} no está en la tabla: se <b>interpola</b> entre {num(det.plantaInferior)} (U$S{' '}
              {costo(det.costoInferior)}) y {num(det.plantaSuperior)} (U$S {costo(det.costoSuperior)}).
              <br />
              {costo(det.costoInferior)} + ({costo(det.costoSuperior)} − {costo(det.costoInferior)}) ×{' '}
              {costo(det.fraccion)} = {costo(det.costoUnitario)}
            </div>
          )}
          {det.fueraDeTabla && <div style={{ marginTop: 6 }}>La planta está fuera de la tabla: se usa la fila del extremo.</div>}
        </div>
        <p className="nota">
          El 75% siempre es el nivel más barato. Cada 2.000 de capacitación baja el costo, pero cada vez un poco menos.
        </p>
        <p className="nota">
          ≈ fila leída de una imagen borrosa (±0,05) · * fila fuera de la planilla original (extrapolada) · las columnas de
          6.000 en adelante están reconstruidas con la regla del 0,74.
        </p>
      </div>

      <div className="tarjeta">
        <h3>Planilla · capacitación {num(columna)}</h3>
        <div className="opciones" style={{ marginBottom: 10 }}>
          {CAPACITACIONES.map((c) => (
            <button
              key={c}
              type="button"
              className="opcion boton-chico"
              style={{ minWidth: 0 }}
              aria-pressed={columna === c}
              title={CAPACITACIONES_ORIGINALES.includes(c) ? 'Columna original' : 'Columna reconstruida por regla'}
              onClick={() => setCapacitacion(c)}
            >
              {c / 1000}k{CAPACITACIONES_ORIGINALES.includes(c) ? '' : '·'}
            </button>
          ))}
        </div>
        <div className="planilla-tabla" ref={contenedor}>
          <table>
            <thead>
              <tr>
                <th>Planta</th>
                {NIVELES_PLANILLA.map((n) => (
                  <th key={n}>{n}%</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PLANTAS.map((p) => {
                const fila = filaPlanilla(p, columna);
                const activa = p === det.plantaInferior || p === det.plantaSuperior;
                return (
                  <tr key={p} className={activa ? 'fila-activa' : ''} ref={p === det.plantaInferior ? filaActiva : undefined}>
                    <th scope="row">
                      {num(p)}
                      <span className="marca-fuente">{MARCAS[fuentePlanta(p)]}</span>
                    </th>
                    {fila.map((v, i) => (
                      <td key={i} className={`${i === 2 ? 'col-75' : ''}${activa && i === iNivel ? ' celda-activa' : ''}`}>
                        {costo(v)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
