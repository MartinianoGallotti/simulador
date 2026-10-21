import { useRef, useState } from 'react';
import { buscarEscenario, equiposDe, modoDe, periodoActual, partidaTerminada, type Partida } from '../engine';
import { borrarPartida, exportarPartida, guardarPartida, importarPartida, leerActual, listarPartidas, nuevoId } from './almacen';
import { Configuracion } from './pantallas/Configuracion';
import { Juego } from './pantallas/Juego';
import { Moderador } from './pantallas/Moderador';
import { NuevaPartida } from './pantallas/NuevaPartida';

type Pantalla = 'inicio' | 'nueva' | 'juego' | 'config';

function estadoDe(p: Partida): string {
  if (partidaTerminada(p)) return 'Terminada';
  return `Período ${periodoActual(p)} de ${p.config.cantidadPeriodos}`;
}

export function App() {
  const [partida, setPartida] = useState<Partida | null>(() => leerActual());
  const [pantalla, setPantalla] = useState<Pantalla>('inicio');
  const [guardadas, setGuardadas] = useState<Partida[]>(() => listarPartidas());
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const archivo = useRef<HTMLInputElement>(null);

  const actualizar = (p: Partida | null) => {
    if (p) {
      if (!guardarPartida(p)) setMensaje({ tipo: 'error', texto: 'El navegador no dejó guardar la partida (¿modo privado o almacenamiento lleno?). Podés exportarla desde el menú.' });
    } else if (partida?.id) {
      borrarPartida(partida.id);
    }
    setPartida(p);
    setGuardadas(listarPartidas());
  };

  const abrir = (p: Partida) => {
    setPartida(p);
    guardarPartida(p);
    setGuardadas(listarPartidas());
    setPantalla('juego');
  };

  if (pantalla === 'config') return <Configuracion onVolver={() => setPantalla('inicio')} />;

  if (pantalla === 'nueva') {
    return (
      <NuevaPartida
        onCancelar={() => setPantalla('inicio')}
        onCrear={(p) => {
          actualizar({ ...p, id: nuevoId(), inicioPeriodo: Date.now() });
          setPantalla('juego');
        }}
      />
    );
  }

  const volverAlInicio = () => {
    setGuardadas(listarPartidas());
    setPantalla('inicio');
  };

  if (pantalla === 'juego' && partida && partida.equipos) {
    return <Moderador partida={partida} onCambio={actualizar} onSalir={volverAlInicio} />;
  }

  if (pantalla === 'juego' && partida) {
    return (
      <Juego
        partida={partida}
        onCambio={actualizar}
        onSalir={() => {
          setGuardadas(listarPartidas());
          setPantalla('inicio');
        }}
      />
    );
  }

  return (
    <>
      <header className="encabezado">
        <div className="contenedor">
          <div className="marca">
            Simulador Formando Emprendedores
            <small>Práctica para el certamen</small>
          </div>
          <button type="button" className="boton boton-claro boton-chico" onClick={() => setPantalla('config')}>
            Configuración
          </button>
        </div>
      </header>
      <main className="contenedor">
        <section className="portada">
          <h1>Practicá para el certamen</h1>
          <p>
            Dirigí tu empresa durante varios períodos contra empresas bot. Mismos informes, misma hoja de trabajo y mismas
            reglas que el certamen real.
          </p>
          <div className="portada-acciones">
            <button type="button" className="boton boton-primario boton-grande" onClick={() => setPantalla('nueva')}>
              Nueva partida
            </button>
            <button type="button" className="boton boton-grande" onClick={() => archivo.current?.click()}>
              Importar partida
            </button>
            <input
              ref={archivo}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                try {
                  const p = await importarPartida(f);
                  guardarPartida(p);
                  setGuardadas(listarPartidas());
                  setMensaje({ tipo: 'ok', texto: `Importé la partida de ${p.nombres[p.indiceJugador]}.` });
                } catch (err) {
                  setMensaje({ tipo: 'error', texto: (err as Error).message });
                }
              }}
            />
          </div>
        </section>

        {mensaje && (
          <div className={`aviso ${mensaje.tipo === 'ok' ? 'aviso-ok' : 'aviso-error'}`} role="status">
            {mensaje.texto}
          </div>
        )}

        {guardadas.length > 0 && (
          <section className="tarjeta">
            <h2>Mis partidas</h2>
            <div className="tabla-envoltorio">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>Escenario</th>
                    <th>Modo</th>
                    <th>Estado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {guardadas.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <b>{equiposDe(p).map((i) => p.nombres[i]).join(', ')}</b>
                        <div className="nota">{p.actualizada ? new Date(p.actualizada).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : ''}</div>
                      </td>
                      <td>{buscarEscenario(p.config.escenarioId).nombre.split(':')[0]}</td>
                      <td>
                        {modoDe(p) === 'examen' ? 'Examen' : 'Entrenamiento'}
                        {p.equipos ? <div className="nota">Moderador</div> : null}
                      </td>
                      <td>{estadoDe(p)}</td>
                      <td>
                        <div className="opciones" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                          <button type="button" className="boton boton-chico boton-primario" onClick={() => abrir(p)}>
                            {partidaTerminada(p) ? 'Ver' : 'Seguir'}
                          </button>
                          <button type="button" className="boton boton-chico" onClick={() => exportarPartida(p)}>
                            Exportar
                          </button>
                          <button
                            type="button"
                            className="boton boton-chico"
                            aria-label={`Borrar la partida de ${p.nombres[p.indiceJugador]}`}
                            onClick={() => {
                              if (!window.confirm('¿Borrar esta partida? No se puede recuperar.')) return;
                              borrarPartida(p.id!);
                              if (partida?.id === p.id) setPartida(null);
                              setGuardadas(listarPartidas());
                            }}
                          >
                            Borrar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="nota" style={{ marginTop: 8 }}>
              Las partidas se guardan en este navegador. Para pasarlas a otro dispositivo, exportalas e importalas allá.
            </p>
          </section>
        )}

        <section className="grilla">
          <div className="tarjeta">
            <h3>1. Leé los informes</h3>
            <p className="nota">
              Comentario Económico, Reporte de la Compañía e Informe Industrial, en el mismo formato que te dan en el certamen.
            </p>
          </div>
          <div className="tarjeta">
            <h3>2. Completá la hoja de trabajo</h3>
            <p className="nota">En entrenamiento te avisa de los errores típicos. En examen, como en el certamen: sin ayuda y con tiempo.</p>
          </div>
          <div className="tarjeta">
            <h3>3. Entregá el cupón</h3>
            <p className="nota">Después mirá "¿Qué pasó?" para entender tu resultado. Gana la mayor utilidad acumulada.</p>
          </div>
        </section>
      </main>
    </>
  );
}
