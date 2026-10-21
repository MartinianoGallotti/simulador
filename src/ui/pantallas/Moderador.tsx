import { useEffect, useState } from 'react';
import {
  decisionesSugeridas,
  deshacerPeriodo,
  equiposDe,
  jugarPeriodoEquipos,
  minutosDelPeriodo,
  modoDe,
  PERSONALIDADES,
  partidaTerminada,
  periodoActual,
  personalidadDe,
  quebrada,
  ranking,
  vistaDeEquipo,
  type Decisiones,
  type Partida,
} from '../../engine';
import { exportarPartida } from '../almacen';
import { Modal } from '../componentes/Modal';
import { claseSigno, plata } from '../formato';
import { Juego } from './Juego';

interface Props {
  partida: Partida;
  onCambio: (p: Partida | null) => void;
  onSalir: () => void;
}

function formatoReloj(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Modo moderador: varios equipos juegan por turnos en el mismo dispositivo.
 * Entre turno y turno se muestra una "tapa" que no deja ver nada de los demás equipos.
 */
export function Moderador({ partida, onCambio, onSalir }: Props) {
  const [turno, setTurno] = useState<number | null>(null);
  const [verEquipo, setVerEquipo] = useState<number | null>(null);
  const [menu, setMenu] = useState(false);
  const terminada = partidaTerminada(partida);
  const numero = periodoActual(partida);
  const examen = modoDe(partida) === 'examen';
  const equipos = equiposDe(partida);
  const activos = equipos.filter((i) => !quebrada(partida, i));
  const pendientes = partida.pendientes ?? {};
  const faltan = activos.filter((i) => !pendientes[i]);

  // Temporizador del modo examen: es uno solo para todo el período.
  const [ahora, setAhora] = useState(Date.now());
  useEffect(() => {
    if (!examen || terminada) return;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [examen, terminada]);
  const restante = examen && !terminada ? (partida.inicioPeriodo ?? ahora) + minutosDelPeriodo(partida, numero) * 60_000 - ahora : null;
  useEffect(() => {
    // Se terminó el tiempo: los equipos que no entregaron repiten las decisiones del período anterior.
    if (restante !== null && restante <= 0 && faltan.length > 0 && turno === null) {
      const completos: Record<number, Decisiones> = { ...pendientes };
      for (const i of faltan) completos[i] = decisionesSugeridas(vistaDeEquipo(partida, i));
      onCambio({ ...partida, pendientes: completos });
    }
  }, [restante, faltan, turno, pendientes, partida, onCambio]);

  if (turno !== null) {
    return (
      <Juego
        key={`${turno}-${numero}`}
        partida={vistaDeEquipo(partida, turno)}
        onCambio={() => {}}
        onSalir={() => setTurno(null)}
        decisionesIniciales={pendientes[turno]}
        equipo={{
          onEntregar: (d) => {
            onCambio({ ...partida, pendientes: { ...pendientes, [turno]: d } });
            setTurno(null);
            window.scrollTo({ top: 0 });
          },
          onVolver: () => setTurno(null),
        }}
      />
    );
  }

  if (verEquipo !== null) {
    return (
      <Juego
        partida={vistaDeEquipo(partida, verEquipo)}
        onCambio={() => {}}
        onSalir={() => setVerEquipo(null)}
        equipo={{ onEntregar: () => {}, onVolver: () => setVerEquipo(null) }}
      />
    );
  }

  const procesar = () => {
    onCambio({ ...jugarPeriodoEquipos(partida, pendientes), inicioPeriodo: Date.now() });
    window.scrollTo({ top: 0 });
  };
  const siguiente = faltan[0];
  const tabla = ranking(partida);

  return (
    <>
      <header className="encabezado">
        <div className="contenedor">
          <div className="marca">
            Modo moderador
            <small>
              {terminada ? 'Partida terminada' : `Período ${numero} de ${partida.config.cantidadPeriodos}`}
              {examen ? ' · Examen' : ' · Entrenamiento'}
            </small>
          </div>
          <div className="encabezado-datos">
            {restante !== null && <span className={`reloj${restante < 5 * 60_000 ? ' urgente' : ''}`}>Tiempo: {formatoReloj(restante)}</span>}
            <button type="button" className="boton boton-claro boton-chico" onClick={() => setMenu(true)}>
              Menú
            </button>
          </div>
        </div>
      </header>

      <main className="contenedor">
        {!terminada && (
          <>
            {siguiente !== undefined ? (
              <section className="tarjeta tapa">
                <p className="nota">Pasale el dispositivo al equipo. Los demás, no miren la pantalla.</p>
                <h1>Le toca a {partida.nombres[siguiente]}</h1>
                <button type="button" className="boton boton-primario boton-grande" onClick={() => setTurno(siguiente)}>
                  Somos {partida.nombres[siguiente]}: ver nuestros informes
                </button>
              </section>
            ) : (
              <section className="tarjeta tapa">
                <h1>Todos los equipos entregaron</h1>
                <p className="nota">
                  {restante !== null && restante <= 0
                    ? 'Se terminó el tiempo. Los equipos que no llegaron a entregar repiten las decisiones del período anterior.'
                    : 'El moderador procesa el período y cada equipo ve sus resultados en su próximo turno.'}
                </p>
                <button type="button" className="boton boton-primario boton-grande" onClick={procesar}>
                  Procesar el período {numero}
                </button>
              </section>
            )}

            <section className="tarjeta">
              <h3>Cupones del período {numero}</h3>
              <table className="tabla">
                <tbody>
                  {equipos.map((i) => {
                    const q = quebrada(partida, i);
                    const listo = !!pendientes[i];
                    return (
                      <tr key={i}>
                        <td>
                          <b>{partida.nombres[i]}</b>
                        </td>
                        <td className={q ? 'negativo' : listo ? 'positivo' : 'nota'}>{q ? 'Quebró' : listo ? 'Entregó' : 'Falta entregar'}</td>
                        <td className="num">
                          {!q && (
                            <button type="button" className="boton boton-chico" onClick={() => setTurno(i)}>
                              {listo ? 'Cambiar cupón' : 'Jugar turno'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="nota" style={{ marginTop: 8 }}>
                Los cupones quedan ocultos: nadie ve lo que entregaron los demás hasta que se procesa el período.
              </p>
            </section>
          </>
        )}

        <section className="tarjeta">
          <h3>{terminada ? 'Ranking final' : `Ranking después del período ${numero - 1}`}</h3>
          <div className="tabla-envoltorio">
            <table className="tabla">
              <thead>
                <tr>
                  <th className="num">Puesto</th>
                  <th>Empresa</th>
                  <th className="num">Utilidad acumulada</th>
                  {terminada && <th>Quién jugó</th>}
                  {terminada && <th />}
                </tr>
              </thead>
              <tbody>
                {tabla.map((f, k) => (
                  <tr key={f.nombre} className={f.esHumano ? 'destacada' : ''}>
                    <td className="num">{f.quebrada ? '—' : `${k + 1}°`}</td>
                    <td>
                      {f.nombre}
                      {f.quebrada ? ' · quebró' : ''}
                    </td>
                    <td className={`num ${claseSigno(f.utilidadAcumulada)}`}>{plata(f.utilidadAcumulada)}</td>
                    {terminada && (
                      <td className="nota">
                        {f.esHumano ? 'Equipo' : `Bot ${PERSONALIDADES[personalidadDe(partida, partida.nombres.indexOf(f.nombre))].nombre.toLowerCase()}`}
                      </td>
                    )}
                    {terminada && (
                      <td>
                        {f.esHumano && (
                          <button type="button" className="boton boton-chico" onClick={() => setVerEquipo(partida.nombres.indexOf(f.nombre))}>
                            Ver informes
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!terminada && <p className="nota">Esto es público: es lo mismo que muestra el Informe de Competición.</p>}
        </section>
      </main>

      {menu && (
        <Modal
          titulo="Menú del moderador"
          onCerrar={() => setMenu(false)}
          acciones={
            <button type="button" className="boton" onClick={() => setMenu(false)}>
              Cerrar
            </button>
          }
        >
          <p className="nota">La partida se guarda sola en este navegador.</p>
          <div className="menu-lista">
            {!examen && partida.historial.length > 1 && (
              <button
                type="button"
                className="boton"
                onClick={() => {
                  const anterior = deshacerPeriodo(partida);
                  delete anterior.pendientes;
                  onCambio({ ...anterior, inicioPeriodo: Date.now() });
                  setMenu(false);
                }}
              >
                Deshacer el período {partida.historial.length - 1} (todos vuelven a entregar)
              </button>
            )}
            <button type="button" className="boton" onClick={() => exportarPartida(partida)}>
              Exportar la partida (archivo JSON)
            </button>
            <button type="button" className="boton" onClick={onSalir}>
              Ir al inicio
            </button>
            <button
              type="button"
              className="boton"
              style={{ color: 'var(--rojo)' }}
              onClick={() => {
                if (window.confirm('¿Seguro que querés borrar esta partida? No se puede recuperar.')) {
                  onCambio(null);
                  onSalir();
                }
              }}
            >
              Abandonar y borrar la partida
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
