# Prompt para pegar en Claude Code
(Abrí Claude Code dentro de la carpeta `simulador` y pegá todo lo que está debajo de la línea.)

---

Vamos a construir una web para practicar el certamen **Formando Emprendedores**: un simulador de negocios donde mi equipo dirige una empresa virtual y compite contra otras empresas a lo largo de varios períodos. Estamos en la instancia final y los simulacros oficiales que tenemos no andan, así que este simulador tiene que ser **fiel al certamen real** y además **enseñarnos** a no cometer errores.

**Antes de escribir código:**
1. Leé completo `CLAUDE.md`. Ahí está la especificación: reglas confirmadas, fórmulas, dos casos de prueba con números exactos, el modelo de demanda a calibrar, los bots, las funcionalidades y el stack.
2. Mirá los archivos de `referencia/`, sobre todo las imágenes de los informes reales, porque el formato de nuestros informes tiene que ser igual. Mirá también `../Lectura obligatoria.docx` y `../Lectura complementaria.docx`.
3. Contestame con: (a) un resumen corto de cómo entendiste el juego, (b) el plan de fases con lo que vas a entregar en cada una, (c) las dudas o contradicciones que encuentres en el material y qué supuesto proponés para cada una. **Después esperá mi OK.**

**Fases (frená y mostrame al terminar cada una):**

- **Fase 1. Motor y tests.**
  - `src/engine/` en TypeScript puro.
  - La planilla de costos se carga desde `referencia/planilla_costos.json` (no la recalcules) e interpola.
  - Validación de decisiones, hoja de trabajo, bancos y procesamiento completo de un período.
  - Tests en Vitest que reproduzcan **exactamente** los Casos de Prueba 1 y 2 de `CLAUDE.md`, más el balance cerrando siempre y los ejemplos de corrección a límites.
  - No pases a la Fase 2 con tests en rojo.
- **Fase 2. Juego para un jugador.**
  - Crear partida (nombre de empresa, cantidad de bots, dificultad, escenario, períodos).
  - Pantalla del período con pestañas: Comentario Económico, Reporte de la Compañía, Reporte Industrial, Hoja de Trabajo interactiva, Cupón de Decisiones y Planilla de Costos.
  - Botón "Simular período" y ranking final.
  - Informes en "formato certamen" (monoespaciado, idéntico a las imágenes) y "vista moderna".
  - Por ahora los bots pueden ser simples.
- **Fase 3. Mercado y bots.**
  - Modelo de demanda calibrable, con tests de los objetivos de elasticidad de `CLAUDE.md`, documentado en `docs/modelo-demanda.md`.
  - Las 6 personalidades de bot y los 3 niveles de dificultad.
  - Escenario "HOLTEC" completo para 5 períodos, más al menos 2 escenarios distintos (por ejemplo, uno con recesión y uno donde el público valora la calidad), con comentarios económicos escritos en el estilo del original.
- **Fase 4. Entrenamiento.**
  - Avisos de errores frecuentes en la hoja de trabajo.
  - Pantalla "¿Qué pasó?" después de cada período.
  - Simulador "¿y si…?".
  - Modo examen con temporizador.
  - Gráficos de evolución, deshacer período, guardar, exportar e importar.
- **Fase 5. Modo moderador y publicación.**
  - Modo moderador: varios equipos humanos en un mismo dispositivo, con las decisiones ocultas entre sí.
  - Pantalla de configuración de reglas.
  - Pulido para celular.
  - Publicar la web para abrirla con un link desde cualquier dispositivo. Antes, preguntame dónde la publicamos y guiame paso a paso.

**Reglas para trabajar conmigo:**
- Hablame en español rioplatense, simple y concreto.
- Todo lo que el material no confirma lo marcás como `// SUPUESTO:` y lo anotás en `docs/supuestos.md`. No inventes reglas en silencio.
- Prioridad: **fidelidad al certamen real > que enseñe > que sea lindo.** Igual quiero que se vea prolijo y profesional.
- Más adelante voy a conseguir más material (más comentarios económicos, reportes de otros períodos). Dejá todo preparado para recalibrar sin reescribir.

Arrancá por el paso 1 y esperá mi OK.
