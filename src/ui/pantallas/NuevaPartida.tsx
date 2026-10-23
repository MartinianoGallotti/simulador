import { useState } from 'react';
import { crearPartida, ESCENARIOS, validarNombreEmpresa, type Dificultad, type ModoPartida, type Partida } from '../../engine';
import { leerConfig } from '../almacen';

interface Props {
  onCrear: (p: Partida) => void;
  onCancelar: () => void;
}

type Tipo = 'individual' | 'moderador';

const DIFICULTADES: { valor: Dificultad; nombre: string; detalle: string }[] = [
  { valor: 'facil', nombre: 'Fácil', detalle: 'Bots que se equivocan seguido: hay novatos y conservadores.' },
  { valor: 'normal', nombre: 'Normal', detalle: 'Una mezcla de estilos (racional, agresivo, calidad…) con algún novato.' },
  { valor: 'dificil', nombre: 'Difícil', detalle: 'Bots que hacen bien las cuentas y leen el comentario. Sin novatos.' },
];

/** Una zona tiene como máximo 12 empresas. */
const MAX_EMPRESAS = 12;

export function NuevaPartida({ onCrear, onCancelar }: Props) {
  const config = leerConfig();
  const reglas = config.reglas;
  const [tipo, setTipo] = useState<Tipo>('individual');
  const [nombres, setNombres] = useState<string[]>(['']);
  const [bots, setBots] = useState(3);
  const [dificultad, setDificultad] = useState<Dificultad>('normal');
  const [escenarioId, setEscenarioId] = useState(ESCENARIOS[0].id);
  const [periodos, setPeriodos] = useState(reglas.cantidadPeriodos);
  const [conRuido, setConRuido] = useState(true);
  const [modo, setModo] = useState<ModoPartida>('entrenamiento');
  const [tocado, setTocado] = useState(false);

  const equipos = tipo === 'individual' ? nombres.slice(0, 1) : nombres;
  const errores = equipos.map((n, i) => {
    const v = validarNombreEmpresa(n, reglas.nombreMaxCaracteres);
    if (!v.valido) return v.motivo;
    if (equipos.findIndex((m) => m.trim() === n.trim()) !== i) return 'Hay dos equipos con el mismo nombre.';
    return null;
  });
  const valido = errores.every((e) => e === null);
  const maxBots = MAX_EMPRESAS - equipos.length;
  const minBots = tipo === 'individual' ? 2 : 0;
  const botsUsados = Math.max(minBots, Math.min(bots, maxBots));
  const escenario = ESCENARIOS.find((e) => e.id === escenarioId)!;

  const cambiarTipo = (t: Tipo) => {
    setTipo(t);
    if (t === 'moderador' && nombres.length < 2) setNombres([...nombres, '']);
    if (t === 'moderador') setBots((b) => Math.min(b, 2));
  };

  const crear = () => {
    setTocado(true);
    if (!valido) return;
    const limpios = equipos.map((n) => n.trim());
    onCrear(
      crearPartida({
        modo,
        minutosPorPeriodo: config.minutosPorPeriodo,
        nombreEmpresa: limpios[0],
        ...(tipo === 'moderador' ? { equiposHumanos: limpios } : {}),
        cantidadBots: botsUsados,
        dificultad,
        escenarioId,
        cantidadPeriodos: periodos,
        semilla: Math.floor(Math.random() * 1_000_000_000),
        conRuido,
        reglas,
      }),
    );
  };

  return (
    <>
      <header className="encabezado">
        <div className="contenedor">
          <div className="marca">Nueva partida</div>
          <button type="button" className="boton boton-claro boton-chico" onClick={onCancelar}>
            Volver
          </button>
        </div>
      </header>
      <main className="contenedor" style={{ maxWidth: 640 }}>
        <form
          className="tarjeta"
          onSubmit={(e) => {
            e.preventDefault();
            crear();
          }}
        >
          <div className="campo">
            <span className="etiqueta">¿Quiénes juegan?</span>
            <div className="opciones" role="group" aria-label="Tipo de partida">
              <button type="button" className="opcion" aria-pressed={tipo === 'individual'} onClick={() => cambiarTipo('individual')}>
                Un equipo contra bots
              </button>
              <button type="button" className="opcion" aria-pressed={tipo === 'moderador'} onClick={() => cambiarTipo('moderador')}>
                Varios equipos (moderador)
              </button>
            </div>
            <span className="ayuda">
              {tipo === 'individual'
                ? 'Tu equipo contra empresas bot.'
                : 'Varios equipos en este mismo dispositivo, por turnos y sin ver las decisiones de los demás. Ideal para practicar entre ustedes.'}
            </span>
          </div>

          {equipos.map((n, i) => (
            <div key={i} className={`campo${tocado && errores[i] ? ' con-error' : ''}`}>
              <label htmlFor={i === 0 ? 'nombre' : `nombre-${i}`}>{tipo === 'individual' ? 'Nombre de tu empresa' : `Equipo ${i + 1}`}</label>
              <div className="opciones" style={{ flexWrap: 'nowrap' }}>
                <input
                  id={i === 0 ? 'nombre' : `nombre-${i}`}
                  type="text"
                  value={n}
                  maxLength={reglas.nombreMaxCaracteres}
                  autoComplete="off"
                  onChange={(e) => {
                    const lista = [...nombres];
                    lista[i] = e.target.value.toUpperCase();
                    setNombres(lista);
                  }}
                  onBlur={() => setTocado(true)}
                  placeholder={i === 0 ? 'Por ejemplo: OMEGA' : 'Nombre del equipo'}
                />
                {tipo === 'moderador' && equipos.length > 2 && (
                  <button
                    type="button"
                    className="boton boton-chico"
                    aria-label={`Quitar el equipo ${i + 1}`}
                    onClick={() => setNombres(nombres.filter((_, k) => k !== i))}
                  >
                    Quitar
                  </button>
                )}
              </div>
              {i === 0 && <span className="ayuda">Hasta {reglas.nombreMaxCaracteres} caracteres, sin símbolos (como en el certamen).</span>}
              {tocado && errores[i] && <span className="texto-error">{errores[i]}</span>}
            </div>
          ))}
          {tipo === 'moderador' && equipos.length < MAX_EMPRESAS && (
            <button type="button" className="boton boton-chico" style={{ marginBottom: 12 }} onClick={() => setNombres([...nombres, ''])}>
              Agregar equipo
            </button>
          )}

          <div className="campo">
            <span className="etiqueta">Modo</span>
            <div className="opciones" role="group" aria-label="Modo">
              <button type="button" className="opcion" aria-pressed={modo === 'entrenamiento'} onClick={() => setModo('entrenamiento')}>
                Entrenamiento
              </button>
              <button type="button" className="opcion" aria-pressed={modo === 'examen'} onClick={() => setModo('examen')}>
                Examen
              </button>
            </div>
            <span className="ayuda">
              {modo === 'entrenamiento'
                ? 'Con ayudas: la hoja te avisa de los errores, "¿Qué pasó?" después de cada período, simulador "¿y si…?" y podés deshacer.'
                : `Como en el certamen: hoja de trabajo a mano, sin avisos ni deshacer, y con tiempo (${config.minutosPorPeriodo[0]} minutos el primer período, después menos). Si se termina el tiempo, se entrega el cupón como esté.`}
            </span>
          </div>

          <div className="campo">
            <span className="etiqueta">Empresas bot en la zona</span>
            <div className="opciones" role="group" aria-label="Cantidad de bots">
              {Array.from({ length: maxBots - minBots + 1 }, (_, k) => minBots + k).map((n) => (
                <button key={n} type="button" className="opcion" aria-pressed={botsUsados === n} onClick={() => setBots(n)}>
                  {n}
                </button>
              ))}
            </div>
            <span className="ayuda">La zona queda de {equipos.length + botsUsados} empresas. En el certamen suelen ser 4.</span>
          </div>

          {botsUsados > 0 && (
            <div className="campo">
              <span className="etiqueta">Dificultad de los bots</span>
              <div className="opciones" role="group" aria-label="Dificultad">
                {DIFICULTADES.map((d) => (
                  <button key={d.valor} type="button" className="opcion" aria-pressed={dificultad === d.valor} onClick={() => setDificultad(d.valor)}>
                    {d.nombre}
                  </button>
                ))}
              </div>
              <span className="ayuda">{DIFICULTADES.find((d) => d.valor === dificultad)!.detalle}</span>
            </div>
          )}

          <div className="campo">
            <label htmlFor="escenario">Escenario</label>
            <select id="escenario" value={escenarioId} onChange={(e) => setEscenarioId(e.target.value)}>
              {ESCENARIOS.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
            <span className="ayuda">{escenario.descripcion}</span>
          </div>

          <div className="campo">
            <span className="etiqueta">Cantidad de períodos</span>
            <div className="opciones" role="group" aria-label="Cantidad de períodos">
              {[3, 4, 5, 6, 7].map((n) => (
                <button key={n} type="button" className="opcion" aria-pressed={periodos === n} onClick={() => setPeriodos(n)}>
                  {n}
                </button>
              ))}
            </div>
            <span className="ayuda">El manual 2026 habla de 5 períodos, pero hay instancias que se juegan a 7.</span>
          </div>

          <label className="campo" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={conRuido} onChange={(e) => setConRuido(e.target.checked)} />
            <span>Demanda con un poco de azar (±2%), como en la vida real</span>
          </label>

          <div className="modal-acciones">
            <button type="button" className="boton" onClick={onCancelar}>
              Cancelar
            </button>
            <button type="submit" className="boton boton-primario">
              Empezar
            </button>
          </div>
        </form>
      </main>
    </>
  );
}
