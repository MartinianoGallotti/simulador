interface Props {
  texto: string;
}

/** Informe en texto monoespaciado, igual que los del certamen. En el celular se desplaza de costado. */
export function VistaCertamen({ texto }: Props) {
  return (
    <div className="certamen">
      <pre>{texto}</pre>
    </div>
  );
}

export type Vista = 'certamen' | 'moderna';

interface SelectorProps {
  vista: Vista;
  onCambio: (v: Vista) => void;
  extra?: React.ReactNode;
}

export function SelectorVista({ vista, onCambio, extra }: SelectorProps) {
  return (
    <div className="barra-vista">
      <div className="opciones" role="group" aria-label="Vista del informe">
        <button type="button" className="opcion" aria-pressed={vista === 'certamen'} onClick={() => onCambio('certamen')}>
          Formato certamen
        </button>
        <button type="button" className="opcion" aria-pressed={vista === 'moderna'} onClick={() => onCambio('moderna')}>
          Vista moderna
        </button>
      </div>
      <div className="opciones">
        {extra}
        {vista === 'certamen' && (
          <button type="button" className="boton boton-chico" onClick={() => window.print()}>
            Imprimir
          </button>
        )}
      </div>
    </div>
  );
}
