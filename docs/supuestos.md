# Supuestos del simulador

Esto es todo lo que el material (manual 2026, video 2014 e informes reales) **no confirma**.
En el código cada uno está marcado con `// SUPUESTO:`. Cuando consigamos datos nuevos, se cambia acá y en el archivo indicado.

Estados posibles:
- **Confirmado por Marti**: Marti lo validó con material propio.
- **Aprobado**: propuesta mía que Marti aceptó.
- **Supuesto**: decisión mía, pendiente de confirmar.

## Bancos e intereses

| # | Supuesto | Estado | Dónde |
|---|---|---|---|
| 1 | Lo que se pide en el período t empieza a cobrar intereses en t+1. Interés = deuda al inicio del período × tasa anual / 3. Hay un interruptor (`modoIntereses: 'mismo_periodo'`) por si aparece evidencia en contra. | Confirmado por Marti | `config.ts`, `banco.ts` |
| 2 | El préstamo adicional va primero al banco de menor tasa con margen, después al otro, y lo que no entra va a giro en descubierto. | Aprobado | `banco.ts` |
| 3 | Si el adicional no entra en ningún banco, el excedente se anota como giro del banco de mayor tasa. | Supuesto | `banco.ts` |
| 4 | El giro en descubierto cuenta dentro de "Préstamos" del balance (si no, el balance no cierra) y paga intereses a la tasa del banco donde se generó. En el reporte se muestra un solo "Giro en Descub.", que es la suma. Lo busqué en el material publicado de Omega Simulaciones (lectura obligatoria en PDF) y no dice nada más. | Supuesto | `banco.ts`, `empresa.ts` |
| 5 | Las devoluciones cancelan primero el giro de ese banco y después los préstamos tomados. | Aprobado | `banco.ts` |
| 6 | El préstamo adicional no paga intereses en el período en que se otorga (empieza en t+1, como cualquier préstamo). | Supuesto | `banco.ts` |
| 7 | "Prést. Adicional" de cada banco muestra solo lo que entró dentro del margen; lo que pasó a giro se ve en "Giro en Descub.". | Supuesto | `empresa.ts` |
| 8 | En el reporte del período 0 los préstamos iniciales (55.000 y 65.000) figuran como "Ped. de Prest.". Se muestran así, pero la empresa ya arranca con esa deuda y no se procesan como pedidos. | Supuesto | `escenarios/holtec.json` |

## Decisiones

| # | Supuesto | Estado | Dónde |
|---|---|---|---|
| 9 | Si se pide y se devuelve al mismo banco, vale el pedido y la devolución se anula. La interfaz no lo va a dejar hacer. | Supuesto | `decisiones.ts` |
| 10 | No se puede devolver más de lo que se le debe a ese banco: se corrige a la deuda. | Aprobado | `decisiones.ts` |
| 11 | Un número con decimales se toma por su parte entera. | Supuesto | `decisiones.ts` |
| 12 | Un nivel de producción inválido se lleva al válido más cercano (0/25/50/75/100). | Supuesto | `decisiones.ts` |
| 13 | La capacitación que pasa los 20.000 acumulados se paga igual y no baja el costo (pérdida pura). No se corrige al límite. | Confirmado por Marti | `decisiones.ts`, `planillaCostos.ts` |

## Producción y costos

| # | Supuesto | Estado | Dónde |
|---|---|---|---|
| 14 | Capacidad y producción con decimales se redondean hacia abajo (pasa si la planta no es múltiplo de 50). | Aprobado | `produccion.ts` |
| 15 | Empleados con decimales (975 / 20 = 48,75) se redondean al entero más cercano. | Aprobado | `produccion.ts` |
| 16 | Indemnización: U$S 200 por empleado despedido (el material no lo dice). Configurable. | Supuesto | `config.ts` |
| 17 | Costo de mercadería vendida: primero sale el stock viejo (FIFO). El stock que queda se valoriza a su costo de fabricación. | Supuesto | `empresa.ts` |
| 18 | En la hoja de trabajo los gastos se redondean hacia arriba. El video lo hace con el costo total; acá también con mantenimiento e intereses. | Supuesto | `hojaDeTrabajo.ts` |

## Resultados y reportes

| # | Supuesto | Estado | Dónde |
|---|---|---|---|
| 19 | Impuestos = tasa × utilidad si es positiva. No hay quebrantos acumulados. | Supuesto | `empresa.ts` |
| 20 | El motor guarda los decimales y redondea solo al mostrar. El software real usa un costo unitario con más decimales que la planilla impresa, por eso el Caso 1 puede diferir en ±2 (CMV 71.964 contra 71.962). | Supuesto | `reportes.ts` |
| 21 | "Inv. y des. acum." del industrial = promedio del I&D acumulado de la zona al **inicio** del período (en el período 0 da 0, como en el informe real). | Aprobado | `reportes.ts` |
| 22 | "Precio Promedio" = promedio simple de los precios de la zona. | Supuesto | `reportes.ts` |
| 23 | "Costo Prod. Prom." = promedio ponderado por las unidades producidas. | Aprobado | `reportes.ts` |
| 24 | "Pos." = puesto por utilidad acumulada; si empata con otra empresa se muestra "-". | Aprobado | `reportes.ts` |
| 25 | Las empresas del Informe de Competición se listan en orden alfabético. | Supuesto | `reportes.ts` |
| 26 | Una empresa quebrada queda fuera del mercado y no juega más. En la tabla de competición aparece con "Q" y en el ranking va al final, descalificada. Si quiebra el jugador, la partida termina. | Supuesto | `periodo.ts`, `reportes.ts`, `partida.ts` |
| 27 | En el período 0 el título del reporte dice "IGUALES" y no muestra el número de período, como el informe real. | Supuesto | `reportes.ts` |

## Demanda

| # | Supuesto | Estado | Dónde |
|---|---|---|---|
| 28 | Todo el modelo de demanda es propio (la fórmula real es secreta). Parámetros en `parametrosDemanda.json`. Se calibra en la Fase 3 y se documenta en `docs/modelo-demanda.md`. | Supuesto | `mercado.ts` |

## Escenarios y bots (inventados, Fase 3)

| # | Supuesto | Estado | Dónde |
|---|---|---|---|
| 29 | Del escenario HOLTEC solo el período 1 es real (manual 2026). Los comentarios 2 a 6, el crecimiento del mercado de cada período y los cambios de tasas, impuesto y mantenimiento son inventados. Los escenarios URBAN (recesión) y SONAR (calidad) son inventados enteros. Los tres arrancan con el mismo período 0 del manual. | Supuesto | `escenarios/*.json` |
| 30 | El "crecimiento" de cada período es el tamaño del mercado comparado con el período 0 (no es acumulado). Ejemplo: HOLTEC va de 1,08 en el período 1 a 1,36 en el 5. | Supuesto | `escenarios/*.json`, `mercado.ts` |
| 31 | En la hoja de trabajo el efectivo se copia redondeado, como figura en el reporte. El fondo fijo (mínimo 50) cubre la diferencia de centavos. | Supuesto | `hojaDeTrabajo.ts` |
| 32 | Los bots juegan solo con la información que tiene un equipo: su reporte, el industrial y los límites y "tags" del comentario (boom, recesión, crisis, calidad, inflación…). No ven el crecimiento real del mercado. | Decisión de diseño | `bots/comun.ts` |
| 33 | Si un comentario baja el máximo crédito por debajo de lo que la empresa ya debe, la deuda no pasa a giro: simplemente el margen queda en 0. | Supuesto | `banco.ts` |

## Entrenamiento y examen (Fase 4)

| # | Supuesto | Estado | Dónde |
|---|---|---|---|
| 34 | Modo examen: 30 minutos el primer período y después 25, 20, 15, 15 y 15 (el video dice "unos 30 minutos y después va disminuyendo"). Configurable. | Supuesto | `partida.ts` |
| 35 | Modo examen: si se termina el tiempo, se entrega el cupón como esté en ese momento. El tiempo sigue corriendo aunque se cierre la página. | Supuesto | `ui/pantallas/Juego.tsx` |
| 36 | "¿Y si…?" supone que la competencia repite lo que hizo el período anterior y que el mercado es del mismo tamaño que el período anterior. No usa el crecimiento real del período, que es información oculta. | Decisión de diseño | `entrenamiento/ysi.ts` |
| 37 | El manual dice copiar los intereses del estado de resultados anterior. Eso solo da bien si el período pasado no cambiaron los préstamos. Con la regla confirmada (los pedidos cobran desde el período siguiente), si cambiaron, el interés real es otro: el modo entrenamiento lo avisa. | Consecuencia de #1 | `entrenamiento/avisos.ts` |
| 38 | La ampliación en el último período no baja la utilidad (queda como planta en el activo), pero tampoco sirve. La capacitación y el I&D del último período sí se restan de la utilidad. | Consecuencia de las reglas | `entrenamiento/avisos.ts` |

## Modo moderador y configuración (Fase 5)

| # | Supuesto | Estado | Dónde |
|---|---|---|---|
| 39 | Modo moderador en examen: el tiempo es uno solo para todo el período. Si se termina, los equipos que no entregaron repiten las decisiones del período anterior (sin pedidos ni devoluciones). | Supuesto | `ui/pantallas/Moderador.tsx` |
| 40 | Si un equipo quiebra, los demás siguen jugando. La partida termina cuando se juegan todos los períodos o cuando quiebran todos los equipos humanos. | Supuesto | `partida.ts` |
| 41 | La configuración cambia la economía inicial de todos los escenarios; los cambios que anuncia cada comentario se aplican encima. Solo afecta a las partidas nuevas. | Decisión de diseño | `escenarios/index.ts`, `ui/almacen.ts` |
| 42 | Los cupones entregados en el modo moderador quedan guardados en el navegador hasta que se procesa el período. La pantalla no los muestra, pero alguien que sepa usar las herramientas del navegador podría verlos: es una práctica, no un certamen oficial. | Decisión de diseño | `partida.ts` |

## Valores elegidos donde el video y el manual no coinciden (manda el manual)

- Períodos: 5 (el video dice 6).
- Fondo fijo mínimo: 50 (el video dice 100).
- Límite de giro: 10.000 (en el Reporte Industrial 2026).
- Bancos: NACION / PROVINCIA (elegido por Marti; configurable).
- En el formato certamen la moneda va como `u$s`, igual que los informes reales. En la vista moderna va como `U$S`.

## Cosas raras del material, para tener en cuenta

- El manual dice que el nombre de la empresa tiene hasta 10 caracteres, pero en el informe real aparece "NACIONAL2020" (12). El simulador valida 10 (configurable).
