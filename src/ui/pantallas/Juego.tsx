import { useEffect, useRef, useState } from 'react';
import {
  calcularHojaDeTrabajo,
  corregirDecisiones,
  datosDePartida,
  decisionesSugeridas,
  deshacerPeriodo,
  estadoJugador,
  jugadorQuebrado,
  jugarPeriodo,
  minutosDelPeriodo,
  modoDe,
  partidaTerminada,
  periodoActual,
  ranking,
  resultadoJugador,
  revisarHoja,
  type Decisiones,
  type HojaManual,
  type Partida,
} from '../../engine';
import { exportarPartida } from '../almacen';
import { Modal } from '../componentes/Modal';
import type { Vista } from '../componentes/VistaCertamen';
import { num, plata } from '../formato';
import { PestanaComentario } from '../pestanas/Comentario';
import { PestanaCupon } from '../pestanas/Cupon';
import { PestanaEvolucion } from '../pestanas/Evolucion';
import { PestanaHoja } from '../pestanas/HojaDeTrabajo';
import { PestanaPlanilla } from '../pestanas/Planilla';
import { PestanaQuePaso } from '../pestanas/QuePaso';
import { PestanaRanking } from '../pestanas/Ranking';
import { PestanaReporteCompania } from '../pestanas/ReporteCompania';
import { PestanaReporteIndustrial } from '../pestanas/ReporteIndustrial';
import { PestanaYSi } from '../pestanas/YSi';

type Pestana = 'ranking' | 'quepaso' | 'comentario' | 'compania' | 'industrial' | 'hoja' | 'cupon' | 'planilla' | 'ysi' | 'evolucion';

const NOMBRES: Record<Pestana, string> = {
  ranking: 'Ranking final',
  quepaso: '¿Qué pasó?',
  comentario: 'Comentario Económico',
  compania: 'Reporte de la Compañía',
  industrial: 'Reporte Industrial',
  hoja: 'Hoja de Trabajo',
  cupon: 'Cupón de Decisiones',
  planilla: 'Planilla de Costos',
  ysi: '¿Y si…?',
  evolucion: 'Evolución',
};

const PESTANAS_FIN: Pestana[] = ['ranking', 'quepaso', 'evolucion', 'compania', 'industrial', 'comentario', 'planilla'];
const PESTANAS_ENTRENAMIENTO: Pestana[] = ['comentario', 'compania', 'industrial', 'hoja', 'cupon', 'planilla', 'quepaso', 'ysi', 'evolucion'];
const PESTANAS_EXAMEN: Pestana[] = ['comentario', 'compania', 'industrial', 'hoja', 'cupon', 'planilla'];

/** Turno de un equipo en el modo moderador: el cupón se guarda oculto en vez de procesar el período. */
export interface TurnoEquipo {
  onEntregar: (d: Decisiones, porTiempo?: boolean) => void;
  onVolver: () => void;
}

interface Props {
  partida: Partida;
  onCambio: (p: Partida | null) => void;
  onSalir: () => void;
  /** Si está, la pantalla es el turno de un equipo dentro del modo moderador. */
  equipo?: TurnoEquipo;
  /** Cupón con el que arranca (por ejemplo, el que el equipo ya había entregado). */
  decisionesIniciales?: Decisiones;
}

interface Novedad {
  periodo: number;
  utilidad: number;
  penalizada: boolean;
  quebrada: boolean;
  porTiempo: boolean;
}

function BarraPestanas({
  lista,
  activa,
  onCambio,
  marcas = {},
}: {
  lista: Pestana[];
  activa: Pestana;
  onCambio: (p: Pestana) => void;
  marcas?: Partial<Record<Pestana, number>>;
}) {
  useEffect(() => {
    document.querySelector('.pestana[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activa]);
  return (
    <nav className="pestanas no-imprimir" aria-label="Secciones">
      <div className="pestanas-lista" role="tablist">
        {lista.map((p) => (
          <button key={p} type="button" role="tab" className="pestana" aria-selected={activa === p} onClick={() => onCambio(p)}>
            {NOMBRES[p]}
            {marcas[p] ? <span className="marca-errores"> {marcas[p]}</span> : null}
          </button>
        ))}
      </div>
    </nav>
  );
}

export function Juego({ partida, onCambio, onSalir, equipo, decisionesIniciales }: Props) {
  const terminada = partidaTerminada(partida);
  const examen = modoDe(partida) === 'examen';
  const [pestana, setPestana] = useState<Pestana>(terminada ? 'ranking' : 'comentario');
  const [vista, setVista] = useState<Vista>('certamen');
  const [novedad, setNovedad] = useState<Novedad | null>(null);
  const [menu, setMenu] = useState(false);
  /** Al deshacer, el cupón arranca con las decisiones que se habían entregado. */
  const [decisionesAlDeshacer, setDecisionesAlDeshacer] = useState<Decisiones | null>(decisionesIniciales ?? null);

  const nombre = partida.nombres[partida.indiceJugador];
  const tabla = ranking(partida);
  const utilAcum = tabla.find((f) => f.esJugador)?.utilidadAcumulada ?? 0;
  const enCarrera = tabla.filter((f) => !f.quebrada);
  const quebro = jugadorQuebrado(partida);
  // Mismo criterio que el informe: se compara en pesos enteros y los empates comparten puesto.
  const puesto = 1 + enCarrera.filter((f) => Math.round(f.utilidadAcumulada) > Math.round(utilAcum)).length;
  const empatado = enCarrera.filter((f) => Math.round(f.utilidadAcumulada) === Math.round(utilAcum)).length > 1;

  const alSimular = (d: Decisiones, porTiempo = false) => {
    if (equipo) {
      equipo.onEntregar(d, porTiempo);
      return;
    }
    const numero = periodoActual(partida);
    const nueva: Partida = { ...jugarPeriodo(partida, d), inicioPeriodo: Date.now() };
    const r = resultadoJugador(nueva, numero);
    setNovedad({
      periodo: numero,
      utilidad: r?.resultados.utilidad ?? 0,
      penalizada: (r?.resultados.penalidad ?? 0) > 0,
      quebrada: r?.quebrada ?? false,
      porTiempo,
    });
    setDecisionesAlDeshacer(null);
    setPestana(partidaTerminada(nueva) ? 'ranking' : examen ? 'compania' : 'quepaso');
    onCambio(nueva);
    window.scrollTo({ top: 0 });
  };

  const deshacer = () => {
    const ultimo = partida.historial[partida.historial.length - 1];
    setDecisionesAlDeshacer(ultimo.decisiones[partida.indiceJugador]);
    onCambio({ ...deshacerPeriodo(partida), inicioPeriodo: Date.now() });
    setNovedad(null);
    setPestana('cupon');
    setMenu(false);
  };

  return (
    <>
      <header className="encabezado">
        <div className="contenedor">
          <div className="marca">
            {nombre}
            <small>
              {equipo && !terminada ? 'Turno del equipo · ' : ''}
              {terminada ? 'Partida terminada' : `Período ${periodoActual(partida)} de ${partida.config.cantidadPeriodos}`}
              {examen ? ' · Modo examen' : ''}
            </small>
          </div>
          <div className="encabezado-datos">
            <span>
              Utilidad acumulada <b>{plata(utilAcum)}</b>
            </span>
            <span>
              {quebro ? (
                <b>Descalificada (quebró)</b>
              ) : (
                <>
                  Puesto <b>{puesto}°</b> de {tabla.length}
                  {empatado ? ' (empatados)' : ''}
                </>
              )}
            </span>
            {equipo ? (
              <button type="button" className="boton boton-claro boton-chico" onClick={equipo.onVolver}>
                {terminada ? 'Volver' : 'Salir sin entregar'}
              </button>
            ) : (
              <button type="button" className="boton boton-claro boton-chico" onClick={() => setMenu(true)}>
                Menú
              </button>
            )}
          </div>
        </div>
      </header>

      {terminada ? (
        <>
          <BarraPestanas lista={PESTANAS_FIN} activa={PESTANAS_FIN.includes(pestana) ? pestana : 'ranking'} onCambio={setPestana} />
          <main className="contenedor">
            {novedad && pestana === 'ranking' && (
              <p className="nota">
                Período {novedad.periodo}: utilidad {plata(novedad.utilidad)}
                {novedad.penalizada ? ', con penalidad' : ''}.{novedad.porTiempo ? ' Se terminó el tiempo y se entregó el cupón como estaba.' : ''}
              </p>
            )}
            {pestana === 'ranking' && <PestanaRanking partida={partida} onNueva={() => (equipo ? equipo.onVolver() : setMenu(true))} />}
            {pestana === 'quepaso' && <PestanaQuePaso partida={partida} />}
            {pestana === 'evolucion' && <PestanaEvolucion partida={partida} />}
            {pestana === 'compania' && <PestanaReporteCompania partida={partida} vista={vista} onVista={setVista} />}
            {pestana === 'industrial' && <PestanaReporteIndustrial partida={partida} vista={vista} onVista={setVista} />}
            {pestana === 'comentario' && <PestanaComentario partida={partida} />}
            {pestana === 'planilla' && <PestanaPlanilla estado={estadoJugador(partida)} nivel={75} />}
          </main>
        </>
      ) : (
        <PeriodoEnJuego
          key={periodoActual(partida)}
          partida={partida}
          pestana={pestana}
          onPestana={setPestana}
          vista={vista}
          onVista={setVista}
          novedad={novedad}
          onCerrarNovedad={() => setNovedad(null)}
          onSimular={alSimular}
          decisionesIniciales={decisionesAlDeshacer}
          etiquetaEntregar={equipo ? 'Entregar cupón' : undefined}
        />
      )}

      {menu && (
        <Modal
          titulo="Menú"
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
              <button type="button" className="boton" onClick={deshacer}>
                Deshacer el período {partida.historial.length - 1} y volver a jugarlo
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

interface PeriodoProps {
  partida: Partida;
  pestana: Pestana;
  onPestana: (p: Pestana) => void;
  vista: Vista;
  onVista: (v: Vista) => void;
  novedad: Novedad | null;
  onCerrarNovedad: () => void;
  onSimular: (d: Decisiones, porTiempo?: boolean) => void;
  decisionesIniciales: Decisiones | null;
  etiquetaEntregar?: string;
}

function formatoReloj(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Lo que dura un período: decisiones, fondo fijo y hoja manual se reinician al pasar de período. */
function PeriodoEnJuego(props: PeriodoProps) {
  const { partida, pestana, onPestana, vista, onVista, novedad, onCerrarNovedad, onSimular, decisionesIniciales, etiquetaEntregar } = props;
  const reglas = partida.config.reglas;
  const numero = periodoActual(partida);
  const examen = modoDe(partida) === 'examen';
  const [decisiones, setDecisiones] = useState<Decisiones>(() => decisionesIniciales ?? decisionesSugeridas(partida));
  const [fondoFijo, setFondoFijo] = useState(reglas.fondoFijoMinimo);
  const [modoHoja, setModoHoja] = useState<'auto' | 'manual'>('auto');
  const [manual, setManual] = useState<HojaManual>({});
  const [confirmando, setConfirmando] = useState(false);

  const lista = examen ? PESTANAS_EXAMEN : PESTANAS_ENTRENAMIENTO;
  const activa = lista.includes(pestana) ? pestana : 'comentario';
  const estado = estadoJugador(partida);
  const datos = datosDePartida(partida, numero);
  const entradaHoja = { estado, economia: datos.economia, decisiones, fondoFijo, reglas };
  const hoja = calcularHojaDeTrabajo(entradaHoja);
  const avisos = examen
    ? []
    : revisarHoja(entradaHoja, {
        anterior: resultadoJugador(partida, numero - 1),
        limites: datos.limites,
        periodosRestantes: partida.config.cantidadPeriodos - numero + 1,
        manual: modoHoja === 'manual' ? manual : undefined,
      });
  const errores = avisos.filter((a) => a.nivel === 'error').length;
  const correcciones = corregirDecisiones(decisiones, datos.limites, estado.deudas, reglas).correcciones;

  // Temporizador del modo examen: cuando llega a 0 se entrega el cupón como esté.
  const [ahora, setAhora] = useState(Date.now());
  const finPeriodo = examen ? (partida.inicioPeriodo ?? Date.now()) + minutosDelPeriodo(partida, numero) * 60_000 : null;
  const restante = finPeriodo === null ? null : finPeriodo - ahora;
  const decisionesRef = useRef(decisiones);
  decisionesRef.current = decisiones;
  const entregado = useRef(false);
  useEffect(() => {
    if (!examen) return;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [examen]);
  useEffect(() => {
    if (restante !== null && restante <= 0 && !entregado.current) {
      entregado.current = true;
      onSimular(decisionesRef.current, true);
    }
  }, [restante, onSimular]);

  return (
    <>
      <BarraPestanas lista={lista} activa={activa} onCambio={onPestana} marcas={examen ? {} : { hoja: errores }} />
      <main className="contenedor">
        {novedad && (
          <div className={`aviso ${novedad.quebrada || novedad.penalizada ? 'aviso-error' : 'aviso-ok'}`} role="status">
            {novedad.porTiempo && <b>Se terminó el tiempo: se entregó el cupón como estaba. </b>}
            <b>Período {novedad.periodo} procesado.</b> Utilidad del período: {plata(novedad.utilidad)}.
            {novedad.penalizada && ' Te cobraron la penalidad por gastar más de lo que tenías.'}
            {novedad.quebrada && ' Tu giro en descubierto superó el límite: la empresa quebró.'}{' '}
            {examen ? 'Mirá tu nuevo Reporte de la Compañía.' : 'Acá abajo te explico qué pasó.'}{' '}
            <button type="button" className="boton boton-chico" onClick={onCerrarNovedad}>
              Cerrar
            </button>
          </div>
        )}
        {activa === 'comentario' && <PestanaComentario partida={partida} />}
        {activa === 'compania' && <PestanaReporteCompania partida={partida} vista={vista} onVista={onVista} />}
        {activa === 'industrial' && <PestanaReporteIndustrial partida={partida} vista={vista} onVista={onVista} />}
        {activa === 'hoja' && (
          <PestanaHoja
            estado={estado}
            datos={datos}
            reglas={reglas}
            decisiones={decisiones}
            onDecisiones={setDecisiones}
            fondoFijo={fondoFijo}
            onFondoFijo={setFondoFijo}
            hoja={hoja}
            modo={examen ? 'examen' : modoHoja}
            onModo={setModoHoja}
            manual={manual}
            onManual={setManual}
            avisos={avisos}
          />
        )}
        {activa === 'cupon' && (
          <PestanaCupon
            datos={datos}
            reglas={reglas}
            estado={estado}
            decisiones={decisiones}
            onDecisiones={setDecisiones}
            correcciones={correcciones}
            ayuda={!examen}
          />
        )}
        {activa === 'planilla' && <PestanaPlanilla estado={estado} nivel={decisiones.nivel} />}
        {activa === 'quepaso' && <PestanaQuePaso partida={partida} />}
        {activa === 'ysi' && <PestanaYSi partida={partida} datos={datos} decisiones={decisiones} onDecisiones={setDecisiones} />}
        {activa === 'evolucion' && <PestanaEvolucion partida={partida} />}
      </main>

      <div className="barra-simular no-imprimir">
        <div className="contenedor">
          {restante !== null ? (
            <span className={`reloj${restante < 5 * 60_000 ? ' urgente' : ''}`}>Tiempo: {formatoReloj(restante)}</span>
          ) : modoHoja === 'manual' ? (
            <span className={errores > 0 ? 'negativo' : 'nota'}>
              {errores > 0 ? `${errores} ${errores === 1 ? 'error' : 'errores'} en la hoja de trabajo` : 'Hoja de trabajo sin errores'}
            </span>
          ) : (
            <span className={hoja.diferencia < 0 ? 'negativo' : 'nota'}>
              {hoja.diferencia < 0
                ? `Te faltan U$S ${num(-hoja.diferencia)}: vas a tener penalidad.`
                : `Fondos a utilizar − necesidad de dinero: U$S ${num(hoja.diferencia)}`}
            </span>
          )}
          <div className="opciones">
            <span className="atajos opciones">
              {activa !== 'hoja' && (
                <button type="button" className="boton" onClick={() => onPestana('hoja')}>
                  Hoja de trabajo
                </button>
              )}
              {activa !== 'cupon' && (
                <button type="button" className="boton" onClick={() => onPestana('cupon')}>
                  Cupón
                </button>
              )}
            </span>
            <button type="button" className="boton boton-primario" onClick={() => setConfirmando(true)}>
              {etiquetaEntregar ?? (examen ? 'Entregar cupón' : `Simular período ${numero}`)}
            </button>
          </div>
        </div>
      </div>

      {confirmando && (
        <Modal
          titulo={`¿Entregás el cupón del período ${numero}?`}
          onCerrar={() => setConfirmando(false)}
          acciones={
            <>
              <button type="button" className="boton" onClick={() => setConfirmando(false)}>
                Revisar
              </button>
              <button
                type="button"
                className="boton boton-primario"
                onClick={() => {
                  setConfirmando(false);
                  entregado.current = true;
                  onSimular(decisiones);
                }}
              >
                {etiquetaEntregar ? 'Entregar' : 'Entregar y simular'}
              </button>
            </>
          }
        >
          <ResumenCupon decisiones={decisiones} nombresBancos={reglas.nombresBancos} />
          {!examen && correcciones.length > 0 && (
            <div className="aviso aviso-alerta">
              <b>El moderador va a corregir:</b>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {correcciones.map((c, i) => (
                  <li key={i}>{c.motivo}</li>
                ))}
              </ul>
            </div>
          )}
          {!examen && hoja.diferencia < 0 && (
            <div className="aviso aviso-error">
              Tu necesidad de dinero supera los fondos a utilizar en U$S {num(-hoja.diferencia)}. El simulador te va a dar un
              préstamo adicional y cobrar U$S {num(reglas.penalidad)} de penalidad.
            </div>
          )}
          {!examen && errores > 0 && (
            <div className="aviso aviso-error">
              Tu hoja de trabajo tiene {errores} {errores === 1 ? 'error' : 'errores'}. Revisalos en la pestaña Hoja de Trabajo.
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

function ResumenCupon({ decisiones: d, nombresBancos }: { decisiones: Decisiones; nombresBancos: [string, string] }) {
  const filas: [string, string][] = [
    ['Precio', plata(d.precio)],
    ['Marketing', plata(d.marketing)],
    ['Invest. y Desarrollo', plata(d.investigacion)],
    ['Capacitación', plata(d.capacitacion)],
    ['Ampliación en Planta', plata(d.ampliacion)],
    [`Ped. Préstamo ${nombresBancos[0]}`, plata(d.pedidos[0])],
    [`Ped. Préstamo ${nombresBancos[1]}`, plata(d.pedidos[1])],
    [`Dev. Préstamo ${nombresBancos[0]}`, plata(d.devoluciones[0])],
    [`Dev. Préstamo ${nombresBancos[1]}`, plata(d.devoluciones[1])],
    ['Nivel de Producción', `${d.nivel}%`],
  ];
  return (
    <table className="tabla">
      <tbody>
        {filas.map(([k, v]) => (
          <tr key={k}>
            <td>{k}</td>
            <td className="num">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
