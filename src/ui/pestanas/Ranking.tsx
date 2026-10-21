import { jugadorQuebrado, PERSONALIDADES, personalidadDe, ranking, ultimoPeriodo, type Partida } from '../../engine';
import { claseSigno, num, plata } from '../formato';

export function PestanaRanking({ partida, onNueva }: { partida: Partida; onNueva: () => void }) {
  const tabla = ranking(partida);
  const puesto = tabla.findIndex((f) => f.esJugador) + 1;
  const ganador = tabla[0];
  const quebro = jugadorQuebrado(partida);
  return (
    <>
      <div className={`aviso ${quebro ? 'aviso-error' : puesto === 1 ? 'aviso-ok' : 'aviso-info'} podio`}>
        {quebro ? (
          <>
            <b>Tu empresa quebró en el período {partida.historial.length - 1}</b> y quedó descalificada: el giro en
            descubierto superó el límite de U$S {num(ultimoPeriodo(partida).resultado.industrial.economia.limiteGiro)}. Mirá
            en el Reporte de la Compañía de qué banco salió el giro. Pasa cuando la necesidad de dinero supera los fondos y
            los bancos ya no tienen margen, o cuando se pide más que el margen disponible.
          </>
        ) : puesto === 1 ? (
          <>
            <b>¡Ganaste!</b> Terminaste primero con {plata(ganador.utilidadAcumulada)} de utilidad acumulada.
          </>
        ) : (
          <>
            Terminaste <b>{puesto}°</b> de {tabla.length}. Ganó {ganador.nombre} con {plata(ganador.utilidadAcumulada)}.
          </>
        )}
      </div>
      <div className="tarjeta">
        <h3>Ranking final por utilidad acumulada</h3>
        <div className="tabla-envoltorio">
          <table className="tabla">
            <thead>
              <tr>
                <th className="num">Puesto</th>
                <th>Empresa</th>
                <th className="num">Utilidad acumulada</th>
                <th className="num">Último período</th>
                <th>Cómo jugó</th>
              </tr>
            </thead>
            <tbody>
              {tabla.map((f, i) => (
                <tr key={f.nombre} className={f.esJugador ? 'destacada' : ''}>
                  <td className="num">{f.quebrada ? '—' : `${i + 1}°`}</td>
                  <td>
                    {f.nombre}
                    {f.esJugador ? ' (vos)' : ''}
                    {f.quebrada ? ' · quebró (descalificada)' : ''}
                  </td>
                  <td className={`num ${claseSigno(f.utilidadAcumulada)}`}>{plata(f.utilidadAcumulada)}</td>
                  <td className={`num ${claseSigno(f.utilidadPeriodo)}`}>{plata(f.utilidadPeriodo)}</td>
                  <td className="nota">
                    {f.esJugador ? 'Vos' : <Estilo partida={partida} nombre={f.nombre} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="nota" style={{ marginTop: 10 }}>
          Ahora que terminó, podés ver qué estilo tenía cada bot. Revisá sus decisiones en el Reporte Industrial de cada
          período para entender por qué ganó quien ganó.
        </p>
        <button type="button" className="boton boton-primario" onClick={onNueva}>
          Jugar otra partida
        </button>
      </div>
    </>
  );
}

function Estilo({ partida, nombre }: { partida: Partida; nombre: string }) {
  const p = PERSONALIDADES[personalidadDe(partida, partida.nombres.indexOf(nombre))];
  return (
    <span title={p.descripcion}>
      <b>{p.nombre}</b>: {p.descripcion}
    </span>
  );
}
