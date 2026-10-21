// Partidas guardadas en el navegador, y exportar/importar en JSON.
// Si el navegador no deja guardar (modo privado, almacenamiento lleno), el juego sigue
// andando igual: solo no se guarda, y se avisa.

import { ESCENARIOS, MINUTOS_POR_PERIODO, REGLAS_POR_DEFECTO, type ConfigReglas, type Partida } from '../engine';

const CLAVE_PARTIDAS = 'formando-emprendedores:partidas:v1';
const CLAVE_ACTUAL = 'formando-emprendedores:actual:v1';
const CLAVE_VIEJA = 'formando-emprendedores:partida-actual:v1';

type Mapa = Record<string, Partida>;

export function nuevoId(): string {
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function leerMapa(): Mapa {
  try {
    const mapa: Mapa = JSON.parse(localStorage.getItem(CLAVE_PARTIDAS) ?? '{}');
    // Partida guardada con la versión anterior (una sola partida).
    const vieja = localStorage.getItem(CLAVE_VIEJA);
    if (vieja) {
      const p = JSON.parse(vieja) as Partida;
      if (esPartida(p)) {
        const id = p.id ?? nuevoId();
        mapa[id] = { ...p, id };
        localStorage.setItem(CLAVE_PARTIDAS, JSON.stringify(mapa));
        localStorage.setItem(CLAVE_ACTUAL, id);
      }
      localStorage.removeItem(CLAVE_VIEJA);
    }
    return mapa;
  } catch {
    return {};
  }
}

/** Guarda la partida. Devuelve false si el navegador no dejó guardar. */
export function guardarPartida(p: Partida): boolean {
  try {
    const mapa = leerMapa();
    const id = p.id ?? nuevoId();
    mapa[id] = { ...p, id, actualizada: Date.now() };
    localStorage.setItem(CLAVE_PARTIDAS, JSON.stringify(mapa));
    localStorage.setItem(CLAVE_ACTUAL, id);
    return true;
  } catch {
    return false;
  }
}

export function borrarPartida(id: string): void {
  try {
    const mapa = leerMapa();
    delete mapa[id];
    localStorage.setItem(CLAVE_PARTIDAS, JSON.stringify(mapa));
    if (localStorage.getItem(CLAVE_ACTUAL) === id) localStorage.removeItem(CLAVE_ACTUAL);
  } catch {
    // sin almacenamiento disponible
  }
}

/** Partidas guardadas, la más reciente primero. */
export function listarPartidas(): Partida[] {
  return Object.values(leerMapa()).sort((a, b) => (b.actualizada ?? 0) - (a.actualizada ?? 0));
}

export function leerActual(): Partida | null {
  try {
    const id = localStorage.getItem(CLAVE_ACTUAL);
    const mapa = leerMapa();
    return (id && mapa[id]) || null;
  } catch {
    return null;
  }
}

function esPartida(p: unknown): p is Partida {
  const x = p as Partida;
  return (
    !!x &&
    x.version === 1 &&
    Array.isArray(x.nombres) &&
    typeof x.indiceJugador === 'number' &&
    Array.isArray(x.historial) &&
    x.historial.length >= 1 &&
    x.historial.every((h) => h && Array.isArray(h.decisiones) && h.resultado && Array.isArray(h.resultado.empresas)) &&
    !!x.config &&
    ESCENARIOS.some((e) => e.id === x.config.escenarioId)
  );
}

function nombreArchivo(p: Partida): string {
  const nombre = p.nombres[p.indiceJugador].replace(/[^A-Za-z0-9]/g, '') || 'partida';
  const fecha = new Date().toISOString().slice(0, 10);
  return `simulador-${nombre}-${p.config.escenarioId}-${fecha}.json`;
}

/** Descarga la partida como archivo JSON. */
export function exportarPartida(p: Partida): void {
  const blob = new Blob([JSON.stringify(p, null, 1)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo(p);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Lee un archivo exportado. Si no es una partida válida, tira un error con un mensaje para mostrar. */
export async function importarPartida(archivo: File): Promise<Partida> {
  if (archivo.size > 20_000_000) throw new Error('El archivo es demasiado grande para ser una partida.');
  let datos: unknown;
  try {
    datos = JSON.parse(await archivo.text());
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }
  if (!esPartida(datos)) throw new Error('El archivo no es una partida del simulador (o es de una versión que no reconozco).');
  // Se importa como una partida nueva, para no pisar la original si ya está guardada.
  return { ...datos, id: nuevoId(), actualizada: Date.now() };
}

// ---------------------------------------------------------------------------
// Configuración de reglas (se aplica a las partidas nuevas)
// ---------------------------------------------------------------------------

const CLAVE_CONFIG = 'formando-emprendedores:config:v1';

export interface ConfigGuardada {
  reglas: ConfigReglas;
  minutosPorPeriodo: number[];
}

export function configPorDefecto(): ConfigGuardada {
  return { reglas: REGLAS_POR_DEFECTO, minutosPorPeriodo: [...MINUTOS_POR_PERIODO] };
}

export function leerConfig(): ConfigGuardada {
  try {
    const texto = localStorage.getItem(CLAVE_CONFIG);
    if (!texto) return configPorDefecto();
    const c = JSON.parse(texto) as Partial<ConfigGuardada>;
    return {
      reglas: { ...REGLAS_POR_DEFECTO, ...c.reglas },
      minutosPorPeriodo: Array.isArray(c.minutosPorPeriodo) ? c.minutosPorPeriodo : [...MINUTOS_POR_PERIODO],
    };
  } catch {
    return configPorDefecto();
  }
}

export function guardarConfig(c: ConfigGuardada | null): boolean {
  try {
    if (c) localStorage.setItem(CLAVE_CONFIG, JSON.stringify(c));
    else localStorage.removeItem(CLAVE_CONFIG);
    return true;
  } catch {
    return false;
  }
}
