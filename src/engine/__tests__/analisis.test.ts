import { REGLAS_POR_DEFECTO } from '../config';
import { crearPartida, jugarPeriodo, partidaTerminada, personalidadDe, ranking, estadoJugador, decisionesSugeridas, datosDePartida, periodoActual } from '../partida';
import { sugerirFinanciamiento } from '../hojaDeTrabajo';
// Análisis de los bots (no corre con npm test). Para correrlo:
//   ANALISIS=1 ESC=holtec npx vitest run analisis
it.skipIf(!process.env.ANALISIS)('análisis de bots', () => {
  const stats: Record<string, { n: number; util: number; pen: number; quiebra: number; perdidas: number; stock: number; dem: number }> = {};
  for (const dificultad of ['facil', 'normal', 'dificil'] as const) for (let semilla = 1; semilla <= 30; semilla++) {
    let p = crearPartida({ nombreEmpresa: 'YO', cantidadBots: 5, dificultad, escenarioId: process.env.ESC ?? 'holtec', cantidadPeriodos: 5, semilla, conRuido: true, reglas: REGLAS_POR_DEFECTO });
    while (!partidaTerminada(p)) {
      const d = { ...decisionesSugeridas(p), ampliacion: 0, capacitacion: 0, investigacion: 0 };
      const s = sugerirFinanciamiento({ estado: estadoJugador(p), economia: datosDePartida(p, periodoActual(p)).economia, decisiones: d, fondoFijo: 500, reglas: REGLAS_POR_DEFECTO });
      p = jugarPeriodo(p, { ...d, pedidos: s.pedidos, devoluciones: s.devoluciones });
    }
    const r = ranking(p);
    p.nombres.forEach((nombre, i) => {
      const k = `${dificultad}:${i === p.indiceJugador ? 'JUGADOR' : personalidadDe(p, i)}`;
      const st = (stats[k] ??= { n: 0, util: 0, pen: 0, quiebra: 0, perdidas: 0, stock: 0, dem: 0 });
      st.n++;
      st.util += r.find((f) => f.nombre === nombre)!.utilidadAcumulada;
      for (const h of p.historial.slice(1)) {
        const e = h.resultado.empresas[i];
        if (!e) continue;
        if (e.resultados.penalidad > 0) st.pen++;
        st.perdidas += e.marketing.ordenesNoRealizadas; st.stock += e.marketing.stockUnidades; st.dem += e.marketing.ordenesRecibidas;
      }
      if (r.find((f) => f.nombre === nombre)!.quebrada) st.quiebra++;
    });
  }
  console.log(Object.entries(stats).map(([k, s]) => `${k.padEnd(22)} util ${Math.round(s.util / s.n).toString().padStart(7)} pen/partida ${(s.pen / s.n).toFixed(2)} quiebras ${s.quiebra}/${s.n} perdidas ${(100 * s.perdidas / s.dem).toFixed(1)}% stock ${(100 * s.stock / s.dem).toFixed(1)}%`).join('\n'));
});
