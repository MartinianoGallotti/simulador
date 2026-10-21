import { useState, type ReactNode } from 'react';
import { ESCENARIOS, type ConfigReglas, type Economia } from '../../engine';
import { configPorDefecto, guardarConfig, leerConfig, type ConfigGuardada } from '../almacen';
import { CampoNumero } from '../componentes/CampoNumero';

interface Props {
  onVolver: () => void;
}

/** Economía inicial de los escenarios (los tres de fábrica arrancan igual que el manual 2026). */
const ECONOMIA_BASE: Economia = ESCENARIOS[0].economiaInicial;

function Fila({ etiqueta, ayuda, children, id }: { etiqueta: string; ayuda?: string; children: ReactNode; id?: string }) {
  return (
    <div className="hoja-fila">
      <label className="concepto" htmlFor={id}>
        {etiqueta}
        {ayuda && <span className="detalle">{ayuda}</span>}
      </label>
      <div className="valor">{children}</div>
    </div>
  );
}

export function Configuracion({ onVolver }: Props) {
  const [c, setC] = useState<ConfigGuardada>(() => leerConfig());
  const [guardado, setGuardado] = useState<string | null>(null);
  const r = c.reglas;
  const eco: Economia = {
    ...ECONOMIA_BASE,
    ...r.economia,
    bancos: [
      { ...ECONOMIA_BASE.bancos[0], ...r.economia?.bancos?.[0] },
      { ...ECONOMIA_BASE.bancos[1], ...r.economia?.bancos?.[1] },
    ],
  } as Economia;

  const reglas = (cambios: Partial<ConfigReglas>) => {
    setC({ ...c, reglas: { ...r, ...cambios } });
    setGuardado(null);
  };
  const economia = (cambios: Partial<Economia>) => reglas({ economia: { ...eco, ...cambios } });
  const banco = (i: 0 | 1, cambios: Partial<Economia['bancos'][0]>) => {
    const bancos: Economia['bancos'] = [{ ...eco.bancos[0] }, { ...eco.bancos[1] }];
    bancos[i] = { ...bancos[i], ...cambios };
    economia({ bancos });
  };

  const nombresValidos = r.nombresBancos.every((n) => /^[A-Za-zÁÉÍÓÚÑáéíóúñ ]{1,15}$/.test(n.trim()));

  return (
    <>
      <header className="encabezado">
        <div className="contenedor">
          <div className="marca">
            Configuración
            <small>Reglas variables del certamen</small>
          </div>
          <button type="button" className="boton boton-claro boton-chico" onClick={onVolver}>
            Volver
          </button>
        </div>
      </header>
      <main className="contenedor" style={{ maxWidth: 760 }}>
        <div className="aviso aviso-info">
          Los cambios se aplican a las <b>partidas nuevas</b>. Las que ya empezaste siguen con las reglas con las que se
          crearon. Los valores de fábrica son los del manual 2026.
        </div>

        <section className="tarjeta">
          <h3>Reglas del certamen</h3>
          <Fila etiqueta="Períodos por partida" ayuda="El manual 2026 dice 5; el video de 2014, 6." id="cfg-periodos">
            <CampoNumero id="cfg-periodos" valor={r.cantidadPeriodos} onCambio={(v) => reglas({ cantidadPeriodos: Math.min(6, Math.max(1, v)) })} />
          </Fila>
          <Fila etiqueta="Fondo fijo mínimo" ayuda="Manual 2026: 50. Video: 100." id="cfg-ff">
            <CampoNumero id="cfg-ff" valor={r.fondoFijoMinimo} onCambio={(v) => reglas({ fondoFijoMinimo: v })} />
          </Fila>
          <Fila etiqueta="Indemnización por empleado despedido" ayuda="El material no lo dice: 200 es un supuesto." id="cfg-ind">
            <CampoNumero id="cfg-ind" valor={r.indemnizacionPorDespedido} onCambio={(v) => reglas({ indemnizacionPorDespedido: v })} />
          </Fila>
          <Fila etiqueta="Recursos Humanos por empleado contratado" id="cfg-rrhh">
            <CampoNumero id="cfg-rrhh" valor={r.ingresoPorContratado} onCambio={(v) => reglas({ ingresoPorContratado: v })} />
          </Fila>
          <Fila etiqueta="Penalidad por falta de fondos" id="cfg-pen">
            <CampoNumero id="cfg-pen" valor={r.penalidad} onCambio={(v) => reglas({ penalidad: v })} />
          </Fila>
          <Fila etiqueta="Capacitación máxima acumulada" id="cfg-capmax">
            <CampoNumero id="cfg-capmax" valor={r.capacitacionMaxAcumulada} onCambio={(v) => reglas({ capacitacionMaxAcumulada: v })} />
          </Fila>
          <Fila etiqueta="Largo máximo del nombre de la empresa" id="cfg-nombre">
            <CampoNumero id="cfg-nombre" valor={r.nombreMaxCaracteres} onCambio={(v) => reglas({ nombreMaxCaracteres: Math.min(20, Math.max(3, v)) })} />
          </Fila>
          <div className="campo" style={{ marginTop: 12 }}>
            <label htmlFor="cfg-intereses">¿Cuándo empiezan a cobrar intereses los préstamos?</label>
            <select
              id="cfg-intereses"
              value={r.modoIntereses}
              onChange={(e) => reglas({ modoIntereses: e.target.value as ConfigReglas['modoIntereses'] })}
            >
              <option value="periodo_siguiente">En el período siguiente al pedido (confirmado)</option>
              <option value="mismo_periodo">En el mismo período en que se piden</option>
            </select>
          </div>
        </section>

        <section className="tarjeta">
          <h3>Bancos</h3>
          <p className="nota">En Argentina se llaman Nación y Provincia; en Uruguay, República y Santander.</p>
          {[0, 1].map((i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div className="campo">
                <label htmlFor={`cfg-banco${i}`}>Banco {i + 1}</label>
                <input
                  id={`cfg-banco${i}`}
                  type="text"
                  maxLength={15}
                  value={r.nombresBancos[i]}
                  onChange={(e) => {
                    const nombres: [string, string] = [...r.nombresBancos];
                    nombres[i] = e.target.value.toUpperCase();
                    reglas({ nombresBancos: nombres });
                  }}
                />
              </div>
              <Fila etiqueta="Máximo crédito" id={`cfg-max${i}`}>
                <CampoNumero id={`cfg-max${i}`} valor={eco.bancos[i].maximoCredito} onCambio={(v) => banco(i as 0 | 1, { maximoCredito: v })} />
              </Fila>
              <Fila etiqueta="Tasa anual (%)" id={`cfg-tasa${i}`}>
                <CampoNumero id={`cfg-tasa${i}`} valor={eco.bancos[i].tasaAnual} onCambio={(v) => banco(i as 0 | 1, { tasaAnual: v })} />
              </Fila>
            </div>
          ))}
          {!nombresValidos && <div className="aviso aviso-error">Los nombres de los bancos van con letras (hasta 15).</div>}
        </section>

        <section className="tarjeta">
          <h3>Economía al empezar</h3>
          <p className="nota">Los comentarios económicos de cada escenario pueden cambiar estos valores durante la partida.</p>
          <Fila etiqueta="Límite de giro en descubierto" ayuda="Si el giro lo supera, la empresa quiebra." id="cfg-giro">
            <CampoNumero id="cfg-giro" valor={eco.limiteGiro} onCambio={(v) => economia({ limiteGiro: v })} />
          </Fila>
          <Fila etiqueta="Tasa de impuesto (%)" id="cfg-imp">
            <CampoNumero id="cfg-imp" valor={eco.tasaImpuesto} onCambio={(v) => economia({ tasaImpuesto: v })} />
          </Fila>
          <Fila etiqueta="Tasa de mantenimiento de planta (%)" id="cfg-mant">
            <CampoNumero id="cfg-mant" valor={eco.tasaMantenimiento} onCambio={(v) => economia({ tasaMantenimiento: v })} />
          </Fila>
          <Fila etiqueta="Mantenimiento de stock (por unidad)" id="cfg-stock">
            <CampoNumero id="cfg-stock" valor={eco.costoStockUnidad} onCambio={(v) => economia({ costoStockUnidad: v })} />
          </Fila>
        </section>

        <section className="tarjeta">
          <h3>Modo examen: minutos por período</h3>
          <div className="opciones" style={{ flexWrap: 'wrap' }}>
            {c.minutosPorPeriodo.map((m, i) => (
              <label key={i} className="campo" style={{ width: 90 }}>
                <span className="etiqueta">Período {i + 1}</span>
                <CampoNumero
                  id={`cfg-min${i}`}
                  valor={m}
                  onCambio={(v) => {
                    const lista = [...c.minutosPorPeriodo];
                    lista[i] = Math.max(1, Math.min(120, v));
                    setC({ ...c, minutosPorPeriodo: lista });
                    setGuardado(null);
                  }}
                />
              </label>
            ))}
          </div>
        </section>

        {guardado && <div className="aviso aviso-ok" role="status">{guardado}</div>}
        <div className="modal-acciones" style={{ marginBottom: 24 }}>
          <button
            type="button"
            className="boton"
            onClick={() => {
              guardarConfig(null);
              setC(configPorDefecto());
              setGuardado('Volví a los valores del manual 2026.');
            }}
          >
            Restaurar valores del manual
          </button>
          <button
            type="button"
            className="boton boton-primario"
            disabled={!nombresValidos}
            onClick={() => {
              const limpia = { ...c, reglas: { ...r, nombresBancos: r.nombresBancos.map((n) => n.trim()) as [string, string] } };
              setGuardado(guardarConfig(limpia) ? 'Configuración guardada. Se usa en las partidas nuevas.' : 'El navegador no dejó guardar la configuración.');
            }}
          >
            Guardar
          </button>
        </div>
      </main>
    </>
  );
}
