import { useEffect, type ReactNode } from 'react';

interface Props {
  titulo: string;
  children: ReactNode;
  acciones: ReactNode;
  onCerrar: () => void;
}

export function Modal({ titulo, children, acciones, onCerrar }: Props) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onCerrar]);

  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <h2>{titulo}</h2>
        {children}
        <div className="modal-acciones">{acciones}</div>
      </div>
    </div>
  );
}
