import type { Aviso } from '../../engine';

const ETIQUETA = { error: 'Error', alerta: 'Ojo', consejo: 'Consejo' } as const;
const CLASE = { error: 'aviso-error', alerta: 'aviso-alerta', consejo: 'aviso-info' } as const;
const ORDEN = { error: 0, alerta: 1, consejo: 2 } as const;

/** Lista de errores frecuentes detectados en la hoja (solo en modo entrenamiento). */
export function PanelAvisos({ avisos }: { avisos: Aviso[] }) {
  if (avisos.length === 0) {
    return <div className="aviso aviso-ok">No encontré errores frecuentes en tu hoja de trabajo.</div>;
  }
  return (
    <div className="lista-avisos" aria-live="polite">
      {[...avisos]
        .sort((a, b) => ORDEN[a.nivel] - ORDEN[b.nivel])
        .map((a) => (
          <div key={a.id} className={`aviso ${CLASE[a.nivel]}`}>
            <b>
              {ETIQUETA[a.nivel]}: {a.titulo}.
            </b>{' '}
            {a.detalle}
          </div>
        ))}
    </div>
  );
}
