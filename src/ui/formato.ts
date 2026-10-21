// Formatos para la vista moderna (la vista certamen usa los de engine/reportes.ts).

const enteros = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const dosDecimales = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 115061 → "115.061" */
export function num(x: number): string {
  return enteros.format(Math.round(x) || 0);
}

/** 115061 → "U$S 115.061" */
export function plata(x: number): string {
  const r = Math.round(x) || 0;
  return r < 0 ? `− U$S ${enteros.format(-r)}` : `U$S ${enteros.format(r)}`;
}

/** 59.97 → "59,97" */
export function costo(x: number): string {
  return dosDecimales.format(x);
}

/** 25 → "25%" */
export function pct(x: number, decimales = 0): string {
  return `${x.toFixed(decimales).replace('.', ',')}%`;
}

export function claseSigno(x: number): string {
  return x > 0.5 ? 'positivo' : x < -0.5 ? 'negativo' : '';
}
