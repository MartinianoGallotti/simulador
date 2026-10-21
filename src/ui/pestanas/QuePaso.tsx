import { useState } from 'react';
import { explicarPeriodo, type Partida, type PuntoExplicacion } from '../../engine';
import { num } from '../formato';

const CLASE = { bien: 'aviso-ok', mal: 'aviso-error', neutro: 'aviso-info' } as const;

function Puntos({ puntos }: { puntos: PuntoExplicacion[] }) {
  return (
    <>
      {puntos.map((p, i) => (
        <div key={i} className={`aviso ${CLASE[p.tono]}`}>
          <b>{p.titulo}.</b> {p.detalle}
        </div>
      ))}
    </>
  );
}

/** Barra horizontal de un factor de la demanda: a la derecha suma, a la izquierda resta. */
function BarraFactor({ nombre, factor }: { nombre: string; factor: number }) {
  const cambio = (factor - 1) * 100;
  const ancho = Math.min(50, Math.abs(cambio) * 1.5);
  return (
    <div className="factor">
      <span className="factor-nombre">{nombre}</span>
      <div className="factor-barra" aria-hidden="true">
        <span
          className={cambio >= 0 ? 'factor-mas' : 'factor-menos'}
          style={cambio >= 0 ? { left: '50%', width: `${ancho}%` } : { right: '50%', width: `${ancho}%` }}
        />
      </div>
      <span className={`factor-valor ${cambio > 1 ? 'positivo' : cambio < -1 ? 'negativo' : ''}`}>
        {cambio >= 0 ? '+' : '−'}
        {Math.abs(Math.round(cambio))}%
      </span>
    </div>
  );
}

export function PestanaQuePaso({ partida }: { partida: Partida }) {
  const ultimo = partida.historial.length - 1;
  const [numero, setNumero] = useState(ultimo);
  if (ultimo < 1) {
    return <div className="aviso aviso-info">Todavía no jugaste ningún período. Después de simular, acá te explico qué pasó.</div>;
  }
  const e = explicarPeriodo(partida, numero);
  return (
    <>
      <div className="barra-vista">
        <label className="opciones" style={{ alignItems: 'center' }}>
          <span className="etiqueta">Período</span>
          <select value={numero} onChange={(ev) => setNumero(Number(ev.target.value))} style={{ width: 'auto' }}>
            {partida.historial.slice(1).map((h) => (
              <option key={h.numero} value={h.numero}>
                {h.numero}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!e ? (
        <div className="aviso aviso-error">Tu empresa ya había quebrado en este período.</div>
      ) : (
        <>
          <div className={`aviso ${CLASE[e.tono]} podio`}>{e.resumen}</div>
          <div className="grilla">
            <div className="tarjeta">
              <h3>¿Por qué recibiste {num(e.demanda.ordenesRecibidas)} órdenes?</h3>
              <div className="factores">
                <BarraFactor nombre="Precio" factor={e.demanda.factorPrecio} />
                <BarraFactor nombre="Marketing" factor={e.demanda.factorMarketing} />
                <BarraFactor nombre="I&D" factor={e.demanda.factorID} />
              </div>
              <p className="nota">Cuánto sumó o restó cada cosa frente a una empresa que juega igual que el promedio de la zona.</p>
              <Puntos puntos={e.porQueDemanda} />
            </div>
            <div>
              <div className="tarjeta">
                <h3>¿Sobró stock o perdiste ventas?</h3>
                <Puntos puntos={e.ofertaYDemanda} />
              </div>
              <div className="tarjeta">
                <h3>¿Dónde ganaste o perdiste plata?</h3>
                <Puntos puntos={e.plata} />
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
