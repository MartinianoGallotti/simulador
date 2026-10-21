import type { ReactNode } from 'react';
import {
  sugerirFinanciamiento,
  NIVELES,
  type Aviso,
  type CampoHoja,
  type ConfigReglas,
  type DatosPeriodo,
  type Decisiones,
  type EstadoEmpresa,
  type HojaDeTrabajo,
  type HojaManual,
} from '../../engine';
import { CampoManual } from '../componentes/CampoManual';
import { CampoNumero } from '../componentes/CampoNumero';
import { PanelAvisos } from '../componentes/PanelAvisos';
import { costo, num } from '../formato';

/** auto: se calcula sola · manual: la completás vos y se revisa · examen: la completás vos sin ayuda. */
export type ModoHoja = 'auto' | 'manual' | 'examen';

interface Props {
  estado: EstadoEmpresa;
  datos: DatosPeriodo;
  reglas: ConfigReglas;
  decisiones: Decisiones;
  onDecisiones: (d: Decisiones) => void;
  fondoFijo: number;
  onFondoFijo: (n: number) => void;
  hoja: HojaDeTrabajo;
  modo: ModoHoja;
  onModo?: (m: 'auto' | 'manual') => void;
  manual: HojaManual;
  onManual: (m: HojaManual) => void;
  avisos: Aviso[];
}

function Fila({
  signo,
  concepto,
  detalle,
  children,
  error,
  clase = '',
}: {
  signo?: string;
  concepto: ReactNode;
  detalle?: ReactNode;
  children: ReactNode;
  error?: string | false;
  clase?: string;
}) {
  return (
    <div className={`hoja-fila ${clase}${error ? ' error' : ''}`}>
      <div className="concepto">
        {signo !== undefined && <span className="signo">{signo}</span>}
        {concepto}
        {detalle && <span className="detalle">{detalle}</span>}
        {error && <span className="texto-error">{error}</span>}
      </div>
      <div className="valor">{children}</div>
    </div>
  );
}

export function PestanaHoja(props: Props) {
  const { estado, datos, reglas, decisiones: d, onDecisiones, fondoFijo, onFondoFijo, hoja, modo, onModo, manual, onManual, avisos } = props;
  const [b1, b2] = reglas.nombresBancos;
  const ayuda = modo !== 'examen';
  const cambiar = (cambios: Partial<Decisiones>) => onDecisiones({ ...d, ...cambios });
  const cambiarPar = (campo: 'pedidos' | 'devoluciones', i: 0 | 1, valor: number) => {
    const par: [number, number] = [...d[campo]];
    par[i] = valor;
    cambiar({ [campo]: par });
  };
  /** Primer aviso de un casillero (para marcarlo en rojo). */
  const errorDe = (campo: CampoHoja): string | false => {
    if (!ayuda) return false;
    const a = avisos.find((x) => x.campo === campo && x.nivel !== 'consejo');
    return a ? a.titulo : false;
  };

  /**
   * Casillero que se copia o se calcula: en automático lo muestra, a mano es un campo para completar.
   * (Es una función y no un componente para que el campo no pierda el foco al escribir.)
   */
  const calc = (campo: CampoHoja, valor: number, decimales = false) =>
    modo === 'auto' ? (
      <>{decimales ? costo(valor) : num(valor)}</>
    ) : (
      <CampoManual
        id={`hoja-${campo}`}
        valor={manual[campo]}
        decimales={decimales}
        error={!!errorDe(campo)}
        onCambio={(v) => onManual({ ...manual, [campo]: v })}
      />
    );

  const sugerir = () => {
    const s = sugerirFinanciamiento({ estado, economia: datos.economia, decisiones: d, fondoFijo, reglas });
    onDecisiones({ ...d, pedidos: s.pedidos, devoluciones: s.devoluciones });
  };

  // Diferencia según lo que se escribió (modo manual) o lo calculado (automático).
  const fondos = modo === 'auto' ? hoja.fondosAUtilizar : manual.fondosAUtilizar;
  const necesidad = modo === 'auto' ? hoja.necesidadDeDinero : manual.necesidadDeDinero;
  const diferencia = fondos !== null && fondos !== undefined && necesidad !== null && necesidad !== undefined ? fondos - necesidad : null;

  return (
    <>
      {modo === 'examen' ? (
        <div className="aviso aviso-info">
          <b>Modo examen:</b> completá la hoja como en el certamen. Nadie te avisa si te equivocás: lo vas a ver en el
          próximo reporte.
        </div>
      ) : (
        <div className="barra-vista">
          <div className="opciones" role="group" aria-label="Cómo completar la hoja">
            <button type="button" className="opcion" aria-pressed={modo === 'auto'} onClick={() => onModo?.('auto')}>
              Se completa sola
            </button>
            <button type="button" className="opcion" aria-pressed={modo === 'manual'} onClick={() => onModo?.('manual')}>
              La completo yo
            </button>
          </div>
          <span className="nota">
            {modo === 'auto'
              ? 'Lo gris sale de los informes. Lo blanco lo decidís vos (y se copia al cupón).'
              : 'Copiá y calculá cada casillero como en el certamen. Te marco en rojo lo que está mal.'}
          </span>
        </div>
      )}

      {ayuda && <PanelAvisos avisos={avisos} />}

      <div className="grilla">
        <div>
          {[0, 1].map((i) => (
            <div className="tarjeta" key={i}>
              <h3>Banco {i === 0 ? b1 : b2}</h3>
              <Fila concepto="Máximo crédito" detalle="Reporte de Créditos (o el comentario, si lo cambia)" error={errorDe(i === 0 ? 'maximo1' : 'maximo2')}>
                {calc(i === 0 ? 'maximo1' : 'maximo2', hoja.bancos[i].maximoCredito)}
              </Fila>
              <Fila signo="−" concepto="Préstamos tomados" detalle="Reporte de Créditos" error={errorDe(i === 0 ? 'tomados1' : 'tomados2')}>
                {calc(i === 0 ? 'tomados1' : 'tomados2', hoja.bancos[i].prestamosTomados)}
              </Fila>
              <Fila
                clase="resultado"
                concepto="Margen de crédito disponible"
                detalle="Lo máximo que podés pedir este período"
                error={errorDe(i === 0 ? 'margen1' : 'margen2')}
              >
                {calc(i === 0 ? 'margen1' : 'margen2', hoja.bancos[i].margenDisponible)}
              </Fila>
            </div>
          ))}
          <div className="tarjeta">
            <h3>Para calcular el costo</h3>
            <Fila concepto="Planta" detalle="Valores del Próximo Período" error={errorDe('planta')}>
              {calc('planta', hoja.planta)}
            </Fila>
            <Fila concepto="Capacitación acumulada" detalle="Valores del Próximo Período">
              {num(hoja.capacitacionAcumulada)}
            </Fila>
            <Fila concepto="Capacidad de producción (100%)" detalle="Valores del Próximo Período" error={errorDe('capacidad')}>
              {calc('capacidad', hoja.capacidad)}
            </Fila>
            <Fila concepto={`Producción al ${d.nivel}%`} detalle="Capacidad × nivel" error={errorDe('produccion')}>
              {calc('produccion', hoja.produccion)}
            </Fila>
            <Fila concepto="Costo unitario" detalle="Planilla de costos (pestaña Planilla)" error={errorDe('costoUnitario')}>
              {calc('costoUnitario', hoja.costoUnitario, true)}
            </Fila>
          </div>
        </div>

        <div className="tarjeta">
          <h3>Cuadro de cuentas</h3>
          <Fila concepto={`Ped. de préstamo ${b1}`} error={errorDe('pedido1')}>
            <CampoNumero id="hoja-ped1" valor={d.pedidos[0]} onCambio={(v) => cambiarPar('pedidos', 0, v)} error={!!errorDe('pedido1')} />
          </Fila>
          <Fila concepto={`Ped. de préstamo ${b2}`} error={errorDe('pedido2')}>
            <CampoNumero id="hoja-ped2" valor={d.pedidos[1]} onCambio={(v) => cambiarPar('pedidos', 1, v)} error={!!errorDe('pedido2')} />
          </Fila>
          <Fila signo="+" concepto="Efectivo" detalle="Balance del Reporte de la Compañía" error={errorDe('efectivo')}>
            {calc('efectivo', hoja.efectivo)}
          </Fila>
          <Fila signo="−" concepto="Fondo fijo" detalle={`Colchón para tus errores. Mínimo ${num(reglas.fondoFijoMinimo)}.`} error={errorDe('fondoFijo')}>
            <CampoNumero id="hoja-ff" valor={fondoFijo} onCambio={onFondoFijo} error={!!errorDe('fondoFijo')} />
          </Fila>
          <Fila clase="resultado" concepto="Fondos a utilizar" error={errorDe('fondosAUtilizar')}>
            {calc('fondosAUtilizar', hoja.fondosAUtilizar)}
          </Fila>

          <div style={{ height: 14 }} />
          <Fila
            concepto="Costo total bruto de producción"
            error={errorDe('costoTotalBruto')}
            detalle={
              <>
                {modo === 'auto' && `${num(hoja.produccion)} u × U$S ${costo(hoja.costoUnitario)} (redondeado hacia arriba). `}
                Nivel de producción:
                <span className="opciones" style={{ marginTop: 6 }}>
                  {NIVELES.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className="opcion boton-chico"
                      style={{ minWidth: 0 }}
                      aria-pressed={d.nivel === n}
                      onClick={() => cambiar({ nivel: n })}
                    >
                      {n}%
                    </button>
                  ))}
                </span>
              </>
            }
          >
            {calc('costoTotalBruto', hoja.costoTotalBruto)}
          </Fila>
          <Fila
            signo="+"
            concepto="Mantenimiento"
            detalle={modo === 'auto' ? `${datos.economia.tasaMantenimiento}% de la planta (${num(hoja.planta)})` : 'Tasa del Reporte Industrial × planta'}
            error={errorDe('mantenimiento')}
          >
            {calc('mantenimiento', hoja.mantenimiento)}
          </Fila>
          <Fila signo="+" concepto="Intereses" detalle="Préstamos tomados × tasa anual ÷ 3" error={errorDe('intereses')}>
            {calc('intereses', hoja.intereses)}
          </Fila>
          <Fila signo="+" concepto="Marketing" detalle={`Límite: ${num(datos.limites.marketingMin)} a ${num(datos.limites.marketingMax)}`}>
            <CampoNumero id="hoja-mkt" valor={d.marketing} onCambio={(v) => cambiar({ marketing: v })} />
          </Fila>
          <Fila signo="+" concepto="Investigación y desarrollo" detalle={`Máximo ${num(datos.limites.investigacionMax)} por período`}>
            <CampoNumero id="hoja-id" valor={d.investigacion} onCambio={(v) => cambiar({ investigacion: v })} />
          </Fila>
          <Fila
            signo="+"
            concepto="Capacitación"
            detalle={`Múltiplo de ${num(reglas.capacitacionMultiplo)}. Ya tenés ${num(estado.capacitacionAcumulada)} de ${num(reglas.capacitacionMaxAcumulada)}.`}
            error={errorDe('capacitacion')}
          >
            <CampoNumero id="hoja-cap" valor={d.capacitacion} onCambio={(v) => cambiar({ capacitacion: v })} error={!!errorDe('capacitacion')} />
          </Fila>
          <Fila signo="+" concepto="Ampliación de planta" detalle={`Máximo ${num(datos.limites.ampliacionMax)}. Conviene múltiplo de 5.000.`}>
            <CampoNumero id="hoja-amp" valor={d.ampliacion} onCambio={(v) => cambiar({ ampliacion: v })} />
          </Fila>
          <Fila signo="+" concepto={`Dev. de préstamo ${b1}`} error={errorDe('devolucion1')}>
            <CampoNumero id="hoja-dev1" valor={d.devoluciones[0]} onCambio={(v) => cambiarPar('devoluciones', 0, v)} error={!!errorDe('devolucion1')} />
          </Fila>
          <Fila signo="+" concepto={`Dev. de préstamo ${b2}`} error={errorDe('devolucion2')}>
            <CampoNumero id="hoja-dev2" valor={d.devoluciones[1]} onCambio={(v) => cambiarPar('devoluciones', 1, v)} error={!!errorDe('devolucion2')} />
          </Fila>
          <Fila clase="resultado" concepto="Necesidad de dinero" error={errorDe('necesidadDeDinero')}>
            {calc('necesidadDeDinero', hoja.necesidadDeDinero)}
          </Fila>

          {diferencia === null ? (
            <p className="nota">Completá fondos a utilizar y necesidad de dinero para compararlos.</p>
          ) : diferencia < 0 ? (
            <div className="aviso aviso-error">
              {modo === 'auto' ? 'Te faltan' : 'Según tu hoja, te faltan'} <b>U$S {num(-diferencia)}</b>. Si entregás así, el
              simulador te da un préstamo adicional y te cobra U$S {num(reglas.penalidad)} de penalidad.
            </div>
          ) : diferencia > 0 ? (
            <div className="aviso aviso-info">
              {modo === 'auto' ? 'Te sobran' : 'Según tu hoja, te sobran'} <b>U$S {num(diferencia)}</b> (más el fondo fijo).
              Podés invertirlos o devolverlos al banco de mayor tasa.
            </div>
          ) : (
            <div className="aviso aviso-ok">Fondos a utilizar = necesidad de dinero. Las cuentas cierran.</div>
          )}
          {modo === 'auto' && (
            <button type="button" className="boton" onClick={sugerir}>
              Calcular pedidos y devoluciones como enseña el video
            </button>
          )}
        </div>
      </div>
    </>
  );
}
