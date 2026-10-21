import { useEffect, useState } from 'react';

interface Props {
  id: string;
  valor: number | null | undefined;
  onCambio: (valor: number | null) => void;
  decimales?: boolean;
  error?: boolean;
  etiqueta?: string;
}

/**
 * Casillero de la hoja que el equipo completa a mano. Puede quedar vacío.
 * Acepta "8.450" o "8450"; con decimales, "59,97" o "59.97".
 */
export function CampoManual({ id, valor, onCambio, decimales = false, error, etiqueta }: Props) {
  const mostrar = (v: number | null | undefined) =>
    v === null || v === undefined ? '' : decimales ? v.toFixed(2).replace('.', ',') : String(v);
  const [texto, setTexto] = useState(mostrar(valor));
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    if (!editando) setTexto(mostrar(valor));
  }, [valor, editando]);

  const interpretar = (t: string): number | null => {
    const limpio = t.trim();
    if (limpio === '') return null;
    if (decimales) {
      // Con decimales, el punto puede ser de miles ("1.234,5") o decimal ("59.97").
      const normal = limpio.includes(',') ? limpio.replace(/\./g, '').replace(',', '.') : limpio;
      const n = parseFloat(normal.replace(/[^\d.-]/g, ''));
      return Number.isFinite(n) ? n : null;
    }
    const n = parseInt(limpio.replace(/[^\d-]/g, ''), 10);
    return Number.isFinite(n) ? n : null;
  };

  return (
    <input
      id={id}
      type="text"
      inputMode={decimales ? 'decimal' : 'numeric'}
      autoComplete="off"
      aria-label={etiqueta}
      placeholder="—"
      className={`input-numero${error ? ' con-error' : ''}`}
      value={texto}
      onFocus={() => setEditando(true)}
      onBlur={() => {
        setEditando(false);
        setTexto(mostrar(valor));
      }}
      onChange={(e) => {
        setTexto(e.target.value);
        onCambio(interpretar(e.target.value));
      }}
    />
  );
}
