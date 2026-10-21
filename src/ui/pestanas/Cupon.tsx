import { NIVELES, type ConfigReglas, type Correccion, type DatosPeriodo, type Decisiones, type EstadoEmpresa } from '../../engine';
import { CampoNumero } from '../componentes/CampoNumero';
import { num } from '../formato';

interface Props {
  datos: DatosPeriodo;
  reglas: ConfigReglas;
  estado: EstadoEmpresa;
  decisiones: Decisiones;
  onDecisiones: (d: Decisiones) => void;
  correcciones: Correccion[];
  /** En el modo examen no se avisa nada antes de entregar. */
  ayuda: boolean;
}

export function PestanaCupon({ datos, reglas, estado, decisiones: d, onDecisiones, correcciones: todas, ayuda }: Props) {
  const correcciones = ayuda ? todas : [];
  const l = datos.limites;
  const [b1, b2] = reglas.nombresBancos;
  const cambiar = (cambios: Partial<Decisiones>) => onDecisiones({ ...d, ...cambios });
  const par = (campo: 'pedidos' | 'devoluciones', i: 0 | 1, v: number) => {
    const nuevo: [number, number] = [...d[campo]];
    nuevo[i] = v;
    cambiar({ [campo]: nuevo });
  };
  const corregido = (campo: Correccion['campo']) => correcciones.some((c) => c.campo === campo);
  const mismoBanco = (i: 0 | 1) => d.pedidos[i] > 0 && d.devoluciones[i] > 0;

  const campos: { id: string; nombre: string; ayuda: string; valor: number; onCambio: (v: number) => void; error: boolean }[] = [
    { id: 'precio', nombre: 'Precio', ayuda: `De ${num(l.precioMin)} a ${num(l.precioMax)}`, valor: d.precio, onCambio: (v) => cambiar({ precio: v }), error: corregido('precio') },
    { id: 'marketing', nombre: 'Marketing', ayuda: `De ${num(l.marketingMin)} a ${num(l.marketingMax)}`, valor: d.marketing, onCambio: (v) => cambiar({ marketing: v }), error: corregido('marketing') },
    { id: 'id', nombre: 'Invest. y Desarrollo', ayuda: `Hasta ${num(l.investigacionMax)}`, valor: d.investigacion, onCambio: (v) => cambiar({ investigacion: v }), error: corregido('investigacion') },
    {
      id: 'cap',
      nombre: 'Capacitación',
      ayuda: `Múltiplo de ${num(reglas.capacitacionMultiplo)} · acumulada ${num(estado.capacitacionAcumulada)} de ${num(reglas.capacitacionMaxAcumulada)}`,
      valor: d.capacitacion,
      onCambio: (v) => cambiar({ capacitacion: v }),
      error: corregido('capacitacion'),
    },
    { id: 'amp', nombre: 'Ampliación en Planta', ayuda: `Hasta ${num(l.ampliacionMax)}`, valor: d.ampliacion, onCambio: (v) => cambiar({ ampliacion: v }), error: corregido('ampliacion') },
    { id: 'p1', nombre: `Ped. de Prést. Bco. ${b1}`, ayuda: 'Lo que pedís ahora, no lo que ya debés', valor: d.pedidos[0], onCambio: (v) => par('pedidos', 0, v), error: mismoBanco(0) },
    { id: 'p2', nombre: `Ped. de Prést. Bco. ${b2}`, ayuda: 'Lo que pedís ahora, no lo que ya debés', valor: d.pedidos[1], onCambio: (v) => par('pedidos', 1, v), error: mismoBanco(1) },
    { id: 'd1', nombre: `Dev. de Prést. Bco. ${b1}`, ayuda: 'No se puede si le pedís al mismo banco', valor: d.devoluciones[0], onCambio: (v) => par('devoluciones', 0, v), error: mismoBanco(0) || corregido('devolucion1') },
    { id: 'd2', nombre: `Dev. de Prést. Bco. ${b2}`, ayuda: 'No se puede si le pedís al mismo banco', valor: d.devoluciones[1], onCambio: (v) => par('devoluciones', 1, v), error: mismoBanco(1) || corregido('devolucion2') },
  ];

  return (
    <div className="grilla">
      <div className="tarjeta">
        <h3>Cuadro de decisiones · período {datos.numero}</h3>
        {campos.map((c) => (
          <div className="hoja-fila" key={c.id}>
            <label className="concepto" htmlFor={`cupon-${c.id}`}>
              {c.nombre}
              <span className="detalle">{c.ayuda}</span>
            </label>
            <div className="valor">
              <CampoNumero id={`cupon-${c.id}`} valor={c.valor} onCambio={c.onCambio} error={c.error} />
            </div>
          </div>
        ))}
        <div className="hoja-fila">
          <span className="concepto">Nivel de producción</span>
          <span />
        </div>
        <div className="opciones" role="group" aria-label="Nivel de producción">
          {NIVELES.map((n) => (
            <button key={n} type="button" className="opcion" aria-pressed={d.nivel === n} onClick={() => cambiar({ nivel: n })}>
              {n}%
            </button>
          ))}
        </div>
      </div>
      {ayuda && (
      <div>
        <div className="tarjeta">
          <h3>Antes de entregar</h3>
          {correcciones.length === 0 ? (
            <div className="aviso aviso-ok">Todas las decisiones están dentro de los límites del comentario.</div>
          ) : (
            <div className="aviso aviso-alerta">
              <b>El moderador va a corregir:</b>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {correcciones.map((c, i) => (
                  <li key={i}>
                    {c.motivo} ({num(c.original)} → {num(c.corregido)})
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="nota">
            Las decisiones son las mismas que cargaste en la hoja de trabajo: si cambiás algo acá, cambia allá. Revisá que
            los montos sean los que querés, como harías con el cupón de papel.
          </p>
        </div>
      </div>
      )}
    </div>
  );
}
