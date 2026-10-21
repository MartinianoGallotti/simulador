import { useEffect, useState } from 'react';

interface Props {
  id: string;
  valor: number;
  onCambio: (valor: number) => void;
  error?: boolean;
  etiqueta?: string;
  min?: number;
}

/**
 * Campo para montos enteros. Acepta "8.500" o "8500" y no deja escribir decimales.
 * Mientras se escribe guarda el texto tal cual; al salir del campo muestra el número limpio.
 */
export function CampoNumero({ id, valor, onCambio, error, etiqueta, min = 0 }: Props) {
  const [texto, setTexto] = useState(String(valor));
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    if (!editando) setTexto(String(valor));
  }, [valor, editando]);

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      aria-label={etiqueta}
      className={`input-numero${error ? ' con-error' : ''}`}
      value={texto}
      onFocus={(e) => {
        setEditando(true);
        e.target.select();
      }}
      onBlur={() => {
        setEditando(false);
        setTexto(String(valor));
      }}
      onChange={(e) => {
        const limpio = e.target.value.replace(/[^\d-]/g, '');
        setTexto(e.target.value);
        const n = limpio === '' || limpio === '-' ? 0 : parseInt(limpio, 10);
        if (Number.isFinite(n)) onCambio(Math.max(min, n));
      }}
    />
  );
}
