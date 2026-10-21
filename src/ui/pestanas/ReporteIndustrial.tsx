import { useState } from 'react';
import { textoReporteIndustrial, type Partida, type ReporteIndustrial } from '../../engine';
import { SelectorVista, VistaCertamen, type Vista } from '../componentes/VistaCertamen';
import { claseSigno, costo, num, pct, plata } from '../formato';
import { Kpi, SelectorPeriodo } from './ReporteCompania';

interface Props {
  partida: Partida;
  vista: Vista;
  onVista: (v: Vista) => void;
}

export function PestanaReporteIndustrial({ partida, vista, onVista }: Props) {
  const [numero, setNumero] = useState(partida.historial.length - 1);
  const ind = partida.historial[numero].resultado.industrial;
  const nombres = partida.config.reglas.nombresBancos;
  return (
    <>
      <SelectorVista vista={vista} onCambio={onVista} extra={<SelectorPeriodo partida={partida} valor={numero} onCambio={setNumero} />} />
      {vista === 'certamen' ? (
        <VistaCertamen texto={textoReporteIndustrial(ind, nombres)} />
      ) : (
        <IndustrialModerno ind={ind} nombres={nombres} jugador={partida.nombres[partida.indiceJugador]} />
      )}
    </>
  );
}

function IndustrialModerno({ ind, nombres, jugador }: { ind: ReporteIndustrial; nombres: [string, string]; jugador: string }) {
  const u = ind.unidades;
  const eco = ind.economia;
  return (
    <>
      <div className="tarjeta">
        <h3>Competencia en la zona {ind.zona} · período {ind.periodo}</h3>
        <div className="tabla-envoltorio">
          <table className="tabla">
            <thead>
              <tr>
                <th>Empresa</th>
                <th className="num">Ventas</th>
                <th className="num">Precio</th>
                <th className="num">Unid. vendidas</th>
                <th className="num">Util. período</th>
                <th className="num">Util. acumulada</th>
                <th>% mercado</th>
                <th className="num">Puesto</th>
              </tr>
            </thead>
            <tbody>
              {ind.competicion.map((f) => (
                <tr key={f.nombre} className={f.nombre === jugador ? 'destacada' : ''}>
                  <td>{f.nombre}</td>
                  <td className="num">{plata(f.ventas)}</td>
                  <td className="num">{num(f.precio)}</td>
                  <td className="num">{num(f.unidadesVendidas)}</td>
                  <td className={`num ${claseSigno(f.utilidadPeriodo)}`}>{plata(f.utilidadPeriodo)}</td>
                  <td className={`num ${claseSigno(f.utilidadAcumulada)}`}>{plata(f.utilidadAcumulada)}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div className="barra-mercado" style={{ flex: 1 }}>
                        <span style={{ width: `${Math.min(100, f.porcentajeMercado)}%` }} />
                      </div>
                      <span className="num">{pct(f.porcentajeMercado)}</span>
                    </div>
                  </td>
                  <td className="num">{f.quebrada ? 'Quebró' : (f.posicion ?? '-')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="grilla">
        <div className="tarjeta">
          <h3>Unidades y dólares</h3>
          <div className="kpis">
            <Kpi titulo="Capacidad total" valor={num(u.capacidadTotal)} />
            <Kpi titulo="Total producido" valor={num(u.totalProducido)} />
            <Kpi titulo="Órdenes recibidas" valor={num(u.totalOrdenesRecibidas)} />
            <Kpi titulo="Total vendido" valor={num(u.totalVendido)} />
            <Kpi titulo="Stock total" valor={num(u.stockTotal)} />
            <Kpi titulo="Ingreso por ventas" valor={plata(ind.dolares.ingresoPorVentas)} />
            <Kpi titulo="Precio promedio" valor={plata(ind.dolares.precioPromedio)} />
            <Kpi titulo="Costo prod. promedio" valor={`U$S ${costo(ind.dolares.costoProduccionPromedio)}`} />
          </div>
        </div>
        <div className="tarjeta">
          <h3>Productividad</h3>
          <div className="kpis">
            <Kpi titulo="Empleados" valor={num(ind.productividad.empleados)} />
            <Kpi titulo="Ventas por empleado" valor={plata(ind.productividad.ventasPorEmpleado)} />
            <Kpi titulo="Capacidad utilizada" valor={pct(ind.productividad.capacidadUtilizada)} />
            <Kpi titulo="I&D acumulado (prom.)" valor={plata(ind.productividad.idAcumuladoPromedio)} />
          </div>
        </div>
        <div className="tarjeta">
          <h3>Economía</h3>
          <table className="tabla">
            <tbody>
              {eco.bancos.map((b, i) => (
                <tr key={i}>
                  <td>Banco {nombres[i]}</td>
                  <td className="num">
                    {plata(b.maximoCredito)} · {b.tasaAnual.toFixed(2).replace('.', ',')}%
                  </td>
                </tr>
              ))}
              <tr>
                <td>Límite de giro en descubierto</td>
                <td className="num">{plata(eco.limiteGiro)}</td>
              </tr>
              <tr>
                <td>Tasa de impuesto</td>
                <td className="num">{pct(eco.tasaImpuesto)}</td>
              </tr>
              <tr>
                <td>Tasa de mantenimiento</td>
                <td className="num">{pct(eco.tasaMantenimiento)}</td>
              </tr>
              <tr>
                <td>Mantenimiento de stock</td>
                <td className="num">U$S {num(eco.costoStockUnidad)} por unidad</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
