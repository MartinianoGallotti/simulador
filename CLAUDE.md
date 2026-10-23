# Simulador de práctica — Certamen "Formando Emprendedores"

Este archivo es la especificación del proyecto. Leelo entero antes de tocar código y volvé a él ante cualquier duda.

## Qué estamos construyendo

Una **web** para que un equipo de estudiantes secundarios (Marti y sus compañeros) **practique para el certamen Formando Emprendedores**, que van a jugar en una instancia final. El certamen es una simulación de negocios: cada equipo dirige una empresa virtual dentro de una "zona" (mercado) con otras empresas. En cada **período** (= 4 meses, un cuatrimestre) reciben tres informes, completan la **Hoja de Trabajo** y entregan **10 decisiones**. El software procesa todas las decisiones de la zona y devuelve informes nuevos. **Gana la empresa con mayor utilidad acumulada al final del último período.**

Los simulacros oficiales que tienen son viejos y no funcionan bien. Este simulador tiene que:
1. **Reproducir lo más fielmente posible** las reglas, los cálculos y el formato de los informes del certamen real.
2. Ponerlos a competir contra **empresas bot** creíbles.
3. **Enseñar**: avisar de los errores típicos y explicar por qué pasó lo que pasó.

El usuario es Marti. Habla español rioplatense y la interfaz va en español rioplatense (vos, tenés…). La moneda se muestra como `U$S` y los montos van **sin decimales**, salvo los costos unitarios, que tienen 2 decimales.

## Material de referencia

- `referencia/planilla_costos.json` y `.csv`: **planilla de costos completa reconstruida** (ver más abajo). Es la fuente de verdad del costo unitario.
- `referencia/reporte_compania_periodo0.jpg`, `reporte_industrial_periodo0.jpg` y `comentario_economico_1.jpg`: informes reales del certamen. Copiá su **formato** (texto monoespaciado, secciones, títulos).
- `referencia/captura_planilla_video.png`: la planilla original (primera página).
- `referencia/transcripcion_video_capacitacion.txt`: transcripción del video oficial de capacitación (versión 2014). Tiene explicaciones y ejemplos numéricos.
- `../Lectura obligatoria.docx` y `../Lectura complementaria.docx`: manual actual del certamen (versión 2026). Si algo del video y del manual no coincide, **manda el manual**.
- Los PDF de `../` están vacíos (0 bytes). Ignoralos.

## Reglas del juego (confirmadas por el material)

### Estructura
- Zona de N empresas (en el certamen son 4; configurable de 3 a 12). Nombre de la empresa: hasta 10 caracteres, sin símbolos.
- Cantidad de períodos configurable: **5 por defecto** (manual 2026); el video dice 6. Se permite hasta 7 (Marti jugó una instancia a 7 períodos).
- Se arranca con el **Reporte del Período 0**, igual para todos. Sus "decisiones tomadas" son arbitrarias, puestas por los organizadores.
- Cada período el jugador recibe:
  - el **Comentario Económico N°t**: noticia del mercado más los límites de las decisiones del período t;
  - el **Reporte de la Compañía** del período t−1, que es privado;
  - el **Reporte Industrial** de la zona del período t−1, que es público.

### Las 10 decisiones (cupón)
Precio · Marketing · Investigación y Desarrollo · Capacitación · Ampliación de Planta · Pedido de Préstamo Banco 1 · Pedido de Préstamo Banco 2 · Devolución Banco 1 · Devolución Banco 2 · Nivel de Producción (0/25/50/75/100%).

- Los bancos se llaman **Nación/Provincia** en Argentina y **República/Santander** en Uruguay. Los nombres son configurables.
- Todas las decisiones son **enteras**.
- Si una decisión queda **fuera de los límites del comentario**, se corrige **al límite más cercano**. Ejemplo: con límites de precio 80–100, un 76 pasa a 80 y un 103 pasa a 100.
- **Capacitación**: se redondea **hacia abajo** al múltiplo de 2.000 (7.999 → 6.000). Tiene un máximo **acumulado** de 20.000: lo que se invierta por encima se paga igual, pero no baja el costo (es pérdida pura).
- **I&D**: tiene límite por período pero no tiene máximo acumulado.
- **Ampliación**: tiene límite por período y puede ser cualquier entero. Si la planta resultante no es múltiplo de 5.000, el costo se **interpola** en la planilla.
- **No se puede pedir y devolver al mismo banco en el mismo período.** Sí se puede pedir a uno y devolver al otro. La UI lo impide y explica por qué.

### Producción y costos
- **Capacidad al 100% = 2% del valor de la planta.** Con planta 80.000 la capacidad es 1.600.
- **Producción = capacidad × nivel.** Ejemplos: 1.300 al 75% da 975; 1.600 al 75% da 1.200.
- **Costo unitario = planilla(valor de planta, capacitación acumulada, nivel).** Se usan los "Valores del próximo período" del reporte anterior. Lo que se invierte en capacitación y ampliación en el período t **recién cuenta en t+1**.
- **Costo total bruto de producción = producción × costo unitario.**
- **Empleados = producción / 20** (1.200 unidades → 60 empleados).
  - **Recursos Humanos** es un *ingreso* de U$S 100 por cada empleado contratado (si sube la producción).
  - **Indemnizaciones** es un gasto por cada empleado despedido (si baja la producción). ⚠️ El valor por empleado no se conoce: dejalo configurable, con 200 por defecto.
- **Mantenimiento = tasa de mantenimiento × valor de la planta al inicio del período** (antes de la ampliación). Es obligatorio. Ejemplos: 10% de 80.000 = 8.000; 13% de 65.000 = 8.450.
- **Mantenimiento de stock = costo por unidad (del reporte industrial) × unidades en stock al cierre.**

### Planilla de costos (ya reconstruida, NO la recalcules)
Usá `referencia/planilla_costos.json`, que tiene la forma `costo[planta][capacitación] = [c25, c50, c75, c100]`.
- Plantas de 25.000 a 300.000, de a 5.000. Capacitación de 0 a 20.000, de a 2.000.
- **Interpolación lineal** para plantas intermedias. Por debajo de 25.000 o por encima de 300.000 se usa el valor del extremo.
- Reglas con las que se reconstruyó (sirven para la sección educativa):
  - el nivel del 50% vale c75 × (1,20 + 0,0004 × (planta − 25.000)/1.000);
  - el del 25% vale c50 + 15;
  - el del 100% vale c75 × (1,07 + 0,0004 × (planta − 25.000)/1.000);
  - cada escalón de 2.000 de capacitación ahorra un 26% menos que el escalón anterior (factor 0,74).
  - **El 75% es siempre el nivel más barato.**
- El campo `fuente_planta` indica de dónde sale cada fila:
  - `video`: dato original nítido;
  - `documento_borroso`: leído de una imagen, con error de ±0,05;
  - `extrapolado`: fuera de la tabla original.

  Las columnas de 6.000 a 20.000 están reconstruidas por regla. Mostralo en el visor de la planilla con una marca discreta.

### Bancos y dinero
- Cada banco tiene **Máximo Crédito** y **Tasa anual**. **Interés del período = préstamos tomados al inicio del período × tasa anual / 3.**
  - Ejemplos: 55.000 × 27%/3 + 65.000 × 36%/3 = 12.750; 70.000 × 18%/3 + 50.000 × 30%/3 = 9.200.
  - Lo que se pide en el período t empieza a generar intereses en t+1. ⚠️ Esto es un supuesto coherente con el material (en la hoja de trabajo "se copia el interés del período anterior"). Dejalo aislado en una función para poder cambiarlo.
- **Margen de crédito disponible = Máximo Crédito − Préstamos Tomados.**
- Si el **pedido supera el margen**, el excedente se otorga igual, pero como **Giro en Descubierto**.
- Si el **giro supera el límite** (Reporte Industrial; 10.000 en el material de 2026), la empresa **QUIEBRA** y queda descalificada. Ese límite es configurable.
- **Chequeo de fondos** (lo que hace el software real):
  - disponible = efectivo inicial + pedidos de préstamo;
  - gastos del período = costo total bruto de producción + mantenimiento + intereses + marketing + I&D + capacitación + ampliación + devoluciones;
  - si los gastos superan lo disponible, el faltante se cubre con un **Préstamo Adicional** forzoso y se cobra una **Penalidad de U$S 500**. El préstamo adicional se asigna al banco con margen y menor tasa; si no alcanza, va a giro.
  - El préstamo adicional se suma a Préstamos Tomados.
- El **Fondo Fijo** no es una decisión. Es un colchón que el equipo reserva en la hoja de trabajo para cubrir sus propios errores (mínimo 50 en el manual 2026, 100 en el video; configurable). La plata que no se gasta queda como efectivo.
- Las ventas, el ingreso por RRHH, las indemnizaciones, el mantenimiento de stock y los impuestos se cobran o pagan **al cierre**. Si el efectivo de cierre da negativo, se cubre con otro préstamo adicional. La penalidad se cobra **una sola vez por período**.

### Mercado y ventas
- **Órdenes recibidas** = demanda de la empresa (modelo propio, ver abajo).
- **Oferta = producción + stock inicial.**
- **Ventas = mínimo(órdenes, oferta).**
- **Órdenes no realizadas** = órdenes − ventas. **Se pierden**: no pasan al período siguiente ni a la competencia.
- **Stock final = oferta − ventas.** Se valoriza a costo unitario. El costo de mercadería vendida sale primero del stock viejo (FIFO, supuesto).
- **% de Mercado** = unidades vendidas de la empresa / total de unidades vendidas en la zona.

### Estado de resultados (este orden exacto)
Ventas, Costo Merc. Vend., **Margen Bruto**, + Recursos Humanos, − Marketing, − Mantenimiento, − Capacitación, − I&D, − Indemnizaciones, − Mantenimiento Stock, − Intereses, − Penalidad, **Util. ante Imp.**, Impuestos (tasa × utilidad si es positiva; sin quebrantos acumulados, supuesto), **Util. del Período**.

### Balance
- **Activo** = Efectivo + Stock (valorizado) + Planta (valor después de la ampliación).
- **Pasivo + Patrimonio** = Préstamos (suma de los bancos) + Utilidades Acumuladas + Capital (80.000 fijo).
- **El balance tiene que cerrar siempre.** Agregá un test que lo verifique en cada período.

### Valores del próximo período
Capacitación acumulada, valor de la planta, capacidad de producción al 100% e I&D acumulado.

## Caso de prueba 1: Reporte del Período 0 del manual 2026 (tiene que dar exacto)

Estado al inicio del período 0:
- planta 80.000, capacitación acumulada 0, I&D acumulado 0, stock 0, empleados 0;
- efectivo 120.000;
- Banco Nación: máximo 90.000, tasa 27%, tomados 55.000;
- Banco Provincia: máximo 75.000, tasa 36%, tomados 65.000;
- impuesto 35%, mantenimiento 10%, mantenimiento de stock 10 por unidad, límite de giro 10.000;
- 4 empresas idénticas.

Decisiones (iguales para las 4): precio 90, marketing 8.500, nivel 75%, capacitación 4.000, I&D 1.000, ampliación 10.000, sin pedidos ni devoluciones. Órdenes recibidas: **1.346 por empresa** (forzalas en el test, porque son el dato de calibración).

Resultado esperado (±2 por redondeo; el software real usa el costo unitario con más decimales, porque 1.200 × 59,97 da 71.964 y el reporte muestra 71.962):

| Concepto | Valor |
|---|---|
| Capacidad de la planta | 1.600 |
| Producción | 1.200 |
| Costo por unidad | 59,97 |
| Empleados | 60 |
| Ventas | 1.200 u y 108.000 |
| Órdenes no realizadas | 146 |
| Costo Merc. Vend. | 71.962 |
| Margen bruto | 36.038 |
| Recursos Humanos | 6.000 |
| Mantenimiento | 8.000 |
| Intereses | 12.750 |
| Util. ante Imp. | 7.787 |
| Impuestos | 2.726 |
| Util. del Período | 5.061 |
| Efectivo | 115.061 |
| Planta | 90.000 |
| Total Activo | 205.061 |
| Préstamos | 120.000 |
| Capital | 80.000 |
| Próximo período | capacitación 4.000 · planta 90.000 · capacidad 1.800 · I&D 1.000 |
| Industrial | capacidad total 6.400 · producido 4.800 · órdenes 5.384 · precio promedio 90 · 25% de mercado cada una |

## Caso de prueba 2: Hoja de trabajo del video (período 1, versión 2014)

Datos: efectivo 122.182, fondo fijo 1.000, planta 65.000, capacitación acumulada 2.000, capacidad 1.300, mantenimiento 13%, intereses 9.200, Nación (90.000 máximo, 70.000 tomados, 18%), Provincia (80.000 máximo, 50.000 tomados, 30%).

**Jugando al 100%:**
- costo unitario 65,74; costo total 85.462;
- marketing 8.500, I&D 5.000, capacitación 10.000, ampliación 10.000;
- necesidad de dinero **136.612**; fondos a utilizar **121.182**;
- hay que pedir **15.430** a Nación (es la tasa más baja).

**Jugando al 75%:**
- producción 975; costo unitario 60,54; costo total 59.027 (se redondea hacia arriba);
- necesidad **110.177**; sobran **11.005**, que conviene devolver a Provincia (es la tasa más alta).

Márgenes disponibles: 20.000 en Nación y 30.000 en Provincia.

## Límites del Período 1 (Comentario Económico N°1 del manual 2026, escenario "HOLTEC")

- marketing de 0 a 10.000;
- precio de 86 a 94;
- ampliación hasta 15.000;
- I&D hasta 10.000;
- capacitación hasta 20.000 acumulado, en múltiplos de 2.000.

La noticia: llegan los **hologramas HOLTEC**, un dispositivo nuevo para smartphones; el mercado va a crecer y se premia a los gerentes que se animan a invertir. Esto es el escenario por defecto. Los comentarios de los períodos 2 a 5 los inventás vos, en el mismo estilo.

## Modelo de demanda (es lo único que NO conocemos; diseñalo calibrable)

La fórmula real del software es secreta. Diseñá un modelo con estas propiedades y dejá **todos los parámetros en un archivo de configuración**:

1. **Mercado total del período** = mercado base × crecimiento del escenario × respuesta suave al precio y marketing *promedio* de la zona (elasticidad agregada baja, alrededor de 1).
2. **Reparto entre empresas** según el atractivo relativo de cada una frente al promedio de la zona:
   - **Precio con elasticidad MUY alta.** Objetivos con las demás empresas iguales: bajar 1 peso da +5–7% de órdenes, y estar 3 pesos arriba del promedio da −20% o más.
   - **Marketing con rendimientos decrecientes.** Objetivo: +8% de marketing da cerca de +5% de órdenes.
   - **I&D acumulado** comparado con el promedio de la zona, empieza a contar desde el período siguiente a la inversión. Su peso depende del escenario: en algunos el público valora la calidad y en otros no.
3. **Calibración:** con 4 empresas iguales a precio 90, marketing 8.500 e I&D 1.000, cada una recibe 1.346 órdenes (período 0). En el video, con precio 92 y marketing 7.858 iguales, cada una recibía 1.234 (otro escenario).
4. **Ruido aleatorio pequeño** (±2%) con semilla, que se puede activar o desactivar.
5. Los eventos del comentario modifican los parámetros: recesión, boom, inflación (sube el precio de referencia), cambio de tasas, de máximo de crédito, de mantenimiento o de impuesto, y competidores externos.

Escribí tests que verifiquen los objetivos de elasticidad. Documentá el modelo en `docs/modelo-demanda.md` para poder recalibrarlo cuando Marti consiga más datos reales.

## Empresas bot

Cada bot usa la **misma hoja de trabajo** que el jugador. Salvo el bot "novato", **nunca** se penaliza por falta de fondos. Cada bot tiene una personalidad:
- **Racional**: estima su demanda con los resultados anteriores e iguala oferta con demanda, como enseña el video.
- **Agresivo**: precio bajo y ampliación al máximo.
- **Calidad**: mucho I&D y precio alto.
- **Conservador**: poca inversión y devuelve préstamos.
- **Imitador**: copia al líder del período anterior.
- **Novato**: se equivoca a veces (usa datos del reporte de producción, pide de más al banco).

Hay tres niveles de dificultad. Los bots leen los "tags" del comentario (recesión, calidad, boom) y ajustan su estrategia.

## Funcionalidades

**Modo entrenamiento** (con ayudas):
- **Hoja de Trabajo interactiva** con los mismos casilleros que la oficial: márgenes de crédito, cuadro de cuentas, fondos a utilizar, costo total bruto, mantenimiento, intereses, necesidad de dinero. Se autocompleta y marca en rojo los errores.
- **Avisos de errores frecuentes**:
  - pedido mayor que el margen (va a giro y puede llevar a la quiebra);
  - confundir "pedido" con "tomados";
  - usar datos del Reporte de Producción en vez de los Valores del Próximo Período;
  - capacitación que no es múltiplo de 2.000 o que pasa los 20.000 acumulados;
  - pedir y devolver al mismo banco;
  - necesidad de dinero mayor que los fondos (penalidad);
  - mucha plata ociosa en el fondo fijo;
  - mantenimiento o intereses mal copiados.
- **Visor de la planilla** que resalta la celda que corresponde e interpola.
- **"¿Qué pasó?"** después de cada período: explicación en lenguaje simple de por qué tuviste esa demanda (precio, marketing e I&D frente al promedio), dónde ganaste o perdiste plata, y si sobró stock o se perdieron ventas.
- **Simulador "¿y si…?"**: probás decisiones contra lo que hizo la competencia en el período anterior, sin avanzar la partida.

**Modo examen**: sin ayudas, con la hoja de trabajo manual (como en el certamen) y un **temporizador por período**. El primer período dura alrededor de 30 minutos y los siguientes bajan.

**Informes en dos vistas**:
- "Formato certamen": texto monoespaciado idéntico a los reales, imprimible;
- "Vista moderna": tablas y gráficos.

**Otros**:
- Gráficos de evolución.
- Ranking final por utilidad acumulada.
- Deshacer o reintentar un período (en práctica).
- Guardar partidas en el navegador, exportar e importar en JSON.
- **Configuración** de todas las reglas variables: períodos, fondo fijo mínimo, tasas, máximos de crédito, límite de giro, impuesto, mantenimiento, indemnización, nombres de bancos.
- **Modo moderador**: varios equipos humanos cargan sus decisiones en el mismo dispositivo por turnos, ocultas entre sí, más bots opcionales. Sirve para que el grupo practique entre ellos.

## Stack y arquitectura

- **Vite + React + TypeScript**, con tests en **Vitest**. Sale una web estática para publicar gratis en cualquier lado. Diseño responsive: tiene que andar bien en el celular.
- El **motor** va en `src/engine/` en **TypeScript puro**, sin React, determinista con semilla. Toda la lógica del juego vive ahí:
  - `planillaCostos.ts`: lookup e interpolación;
  - `decisiones.ts`: validación y corrección a límites;
  - `hojaDeTrabajo.ts`;
  - `banco.ts`;
  - `empresa.ts`;
  - `mercado.ts`: demanda y reparto;
  - `periodo.ts`: `procesarPeriodo(zona, decisiones, escenario) → nuevos reportes`;
  - `reportes.ts`: arma el Reporte de la Compañía, el Industrial y el texto en formato certamen;
  - `bots/`;
  - `escenarios/`: comentarios y límites por período, en JSON;
  - `config.ts`.
- La UI en `src/ui/` solo consume el motor.
- Persistencia en `localStorage`, con la lectura y escritura dentro de try/catch.
- Todos los supuestos van marcados con `// SUPUESTO:` en el código y listados en `docs/supuestos.md`. Cuando Marti consiga datos nuevos, se cambian ahí.

## Forma de trabajar con Marti

- Trabajá **por fases** y **frená al final de cada una**: mostrá qué hiciste y esperá su OK. Marti prefiere el ida y vuelta a recibir todo de golpe.
- Ante una duda de reglas que el material no resuelve, **no inventes en silencio**: elegí un supuesto razonable, marcalo y avisale.
- Explicá en español simple. Marti sabe algo de programación (hizo un curso de C#), pero no es experto en web.
