import { useState } from 'react';
import { contextoReporte, textoReporteCompania, type Decisiones, type Partida, type ResultadoEmpresa } from '../../engine';
import { SelectorVista, VistaCertamen, type Vista } from '../componentes/VistaCertamen';
import { claseSigno, costo, num, plata } from '../formato';

interface Props {
  partida: Partida;
  vista: Vista;
  onVista: (v: Vista) => void;
}

/** Selector del período del que se quiere ver el reporte (por defecto, el último jugado). */
export function SelectorPeriodo({ partida, valor, onCambio }: { partida: Partida; valor: number; onCambio: (n: number) => void }) {
  return (
    <label className="opciones" style={{ alignItems: 'center' }}>
      <span className="etiqueta">Período</span>
      <select value={valor} onChange={(e) => onCambio(Number(e.target.value))} style={{ width: 'auto' }}>
        {partida.historial.map((h) => (
          <option key={h.numero} value={h.numero}>
            {h.numero}
          </option>
        ))}
      </select>
    </label>
  );
}

export function PestanaReporteCompania({ partida, vista, onVista }: Props) {
  const ultimo = partida.historial.length - 1;
  const [numero, setNumero] = useState(ultimo);
  const r = partida.historial[numero].resultado.empresas[partida.indiceJugador];
  const ctx = contextoReporte(partida, numero);

  return (
    <>
      <SelectorVista vista={vista} onCambio={onVista} extra={<SelectorPeriodo partida={partida} valor={numero} onCambio={setNumero} />} />
      {numero === ultimo && ultimo > 0 && (
        <p className="nota no-imprimir">
          Este es el reporte del período {numero}, el que acabás de jugar. Para el período {numero + 1} usá los{' '}
          <b>Valores del Próximo Período</b>, no los del Reporte de Producción.
        </p>
      )}
      {!r ? (
        <div className="aviso aviso-error">Tu empresa quebró antes de este período.</div>
      ) : vista === 'certamen' ? (
        <VistaCertamen texto={textoReporteCompania(r, ctx)} />
      ) : (
        <CompaniaModerna r={r} decisiones={{ ...r.decisiones, ...ctx.decisionesMostradas }} nombresBancos={ctx.nombresBancos} />
      )}
    </>
  );
}

function Fila({ concepto, valor, clase }: { concepto: string; valor: string; clase?: string }) {
  return (
    <tr className={clase}>
      <td>{concepto}</td>
      <td className="num">{valor}</td>
    </tr>
  );
}

function CompaniaModerna({
  r,
  decisiones: d,
  nombresBancos: [b1, b2],
}: {
  r: ResultadoEmpresa;
  decisiones: Decisiones;
  nombresBancos: [string, string];
}) {
  const er = r.resultados;
  const ba = r.balance;
  return (
    <>
      {r.quebrada && <div className="aviso aviso-error">La empresa quebró: el giro en descubierto superó el límite.</div>}
      {r.correcciones.length > 0 && (
        <div className="aviso aviso-alerta">
          <b>Decisiones corregidas por el moderador:</b>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {r.correcciones.map((c, i) => (
              <li key={i}>{c.motivo}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="tarjeta" style={{ borderColor: 'var(--acento)' }}>
        <h3>Valores del próximo período</h3>
        <p className="nota">Estos son los que usás en la hoja de trabajo del período que viene.</p>
        <div className="kpis">
          <Kpi titulo="Capacitación acumulada" valor={plata(r.proximo.capacitacionAcumulada)} />
          <Kpi titulo="Planta" valor={plata(r.proximo.planta)} />
          <Kpi titulo="Capacidad de producción (100%)" valor={`${num(r.proximo.capacidad)} u`} />
          <Kpi titulo="I&D acumulado" valor={plata(r.proximo.idAcumulado)} />
        </div>
      </div>
      <div className="grilla">
        <div className="tarjeta">
          <h3>Estado de resultados</h3>
          <table className="tabla">
            <tbody>
              <Fila concepto="Ventas" valor={plata(er.ventas)} />
              <Fila concepto="Costo merc. vendida" valor={plata(-er.costoMercaderiaVendida)} />
              <Fila concepto="Margen bruto" valor={plata(er.margenBruto)} clase="total" />
              <Fila concepto="+ Recursos humanos" valor={plata(er.recursosHumanos)} />
              <Fila concepto="− Marketing" valor={plata(-er.marketing)} />
              <Fila concepto="− Mantenimiento" valor={plata(-er.mantenimiento)} />
              <Fila concepto="− Capacitación" valor={plata(-er.capacitacion)} />
              <Fila concepto="− I&D" valor={plata(-er.investigacion)} />
              <Fila concepto="− Indemnizaciones" valor={plata(-er.indemnizaciones)} />
              <Fila concepto="− Mantenimiento stock" valor={plata(-er.mantenimientoStock)} />
              <Fila concepto="− Intereses" valor={plata(-er.intereses)} />
              <Fila concepto="− Penalidad" valor={plata(-er.penalidad)} clase={er.penalidad > 0 ? 'negativo' : ''} />
              <Fila concepto="Utilidad antes de impuestos" valor={plata(er.utilidadAntesImpuestos)} clase="total" />
              <Fila concepto="− Impuestos" valor={plata(-er.impuestos)} />
              <tr className="total">
                <td>Utilidad del período</td>
                <td className={`num ${claseSigno(er.utilidad)}`}>{plata(er.utilidad)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="tarjeta">
          <h3>Balance</h3>
          <table className="tabla">
            <tbody>
              <Fila concepto="Efectivo" valor={plata(ba.efectivo)} />
              <Fila concepto="Stock" valor={plata(ba.stock)} />
              <Fila concepto="Planta" valor={plata(ba.planta)} />
              <Fila concepto="Total activo" valor={plata(ba.totalActivo)} clase="total" />
              <Fila concepto="Préstamos" valor={plata(ba.prestamos)} />
              <Fila concepto="Utilidades acumuladas" valor={plata(ba.utilidadesAcumuladas)} />
              <Fila concepto="Capital" valor={plata(ba.capital)} />
              <Fila concepto="Pasivo + patrimonio" valor={plata(ba.pasivoMasPatrimonio)} clase="total" />
            </tbody>
          </table>
          <h3 style={{ marginTop: 16 }}>Decisiones tomadas</h3>
          <table className="tabla">
            <tbody>
              <Fila concepto="Precio" valor={plata(d.precio)} />
              <Fila concepto="Marketing" valor={plata(d.marketing)} />
              <Fila concepto="Nivel de producción" valor={`${d.nivel}%`} />
              <Fila concepto="Capacitación" valor={plata(d.capacitacion)} />
              <Fila concepto="I&D" valor={plata(d.investigacion)} />
              <Fila concepto="Ampliación en planta" valor={plata(d.ampliacion)} />
              <Fila concepto={`Pedido / devolución ${b1}`} valor={`${plata(d.pedidos[0])} / ${plata(d.devoluciones[0])}`} />
              <Fila concepto={`Pedido / devolución ${b2}`} valor={`${plata(d.pedidos[1])} / ${plata(d.devoluciones[1])}`} />
            </tbody>
          </table>
        </div>
        <div className="tarjeta">
          <h3>Producción y marketing</h3>
          <p className="nota">Datos del período jugado. No los uses para calcular el período siguiente.</p>
          <table className="tabla">
            <tbody>
              <Fila concepto="Capacidad de la planta" valor={`${num(r.produccion.capacidad)} u`} />
              <Fila concepto={`Producción (al ${r.produccion.nivel}%)`} valor={`${num(r.produccion.produccion)} u`} />
              <Fila concepto="Costo por unidad" valor={`U$S ${costo(r.produccion.costoUnitario)}`} />
              <Fila concepto="Empleados" valor={num(r.produccion.empleados)} />
              <Fila concepto="Órdenes recibidas" valor={`${num(r.marketing.ordenesRecibidas)} u`} />
              <Fila concepto="Ventas realizadas" valor={`${num(r.marketing.ventasRealizadas)} u`} />
              <Fila
                concepto="Órdenes no realizadas (ventas perdidas)"
                valor={`${num(r.marketing.ordenesNoRealizadas)} u`}
                clase={r.marketing.ordenesNoRealizadas > 0 ? 'negativo' : ''}
              />
              <Fila concepto="Stock en unidades" valor={`${num(r.marketing.stockUnidades)} u`} />
            </tbody>
          </table>
        </div>
        <div className="tarjeta">
          <h3>Créditos</h3>
          <div className="tabla-envoltorio">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Banco</th>
                  <th className="num">Máximo</th>
                  <th className="num">Tasa anual</th>
                  <th className="num">Tomados</th>
                  <th className="num">Adicional</th>
                </tr>
              </thead>
              <tbody>
                {r.creditos.bancos.map((b, i) => (
                  <tr key={i}>
                    <td>{i === 0 ? b1 : b2}</td>
                    <td className="num">{plata(b.maximoCredito)}</td>
                    <td className="num">{b.tasaAnual.toFixed(2).replace('.', ',')}%</td>
                    <td className="num">{plata(b.prestamosTomados)}</td>
                    <td className={`num ${b.prestamoAdicional > 0 ? 'negativo' : ''}`}>{plata(b.prestamoAdicional)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={r.creditos.giroTotal > 0 ? 'negativo' : 'nota'} style={{ marginTop: 8 }}>
            Giro en descubierto: {plata(r.creditos.giroTotal)}
          </p>
        </div>
      </div>
    </>
  );
}

export function Kpi({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="kpi">
      <div className="kpi-titulo">{titulo}</div>
      <div className="kpi-valor">{valor}</div>
    </div>
  );
}
