# Modelo de demanda

La fórmula con la que el software del certamen reparte las órdenes es **secreta**. Este documento explica el modelo propio que usa el simulador, qué datos reales respeta y cómo recalibrarlo cuando consigamos más informes.

- Código: `src/engine/mercado.ts`
- Parámetros: `src/engine/parametrosDemanda.json`
- Tests de los objetivos: `src/engine/__tests__/mercado.test.ts`

## Idea general

En cada período pasan dos cosas:

1. **Se calcula el tamaño del mercado**, es decir, cuántas órdenes hay en toda la zona.
2. **Se reparte el mercado** entre las empresas según qué tan atractiva es cada una **comparada con el promedio de la zona**.

Por eso lo que importa es tu precio, tu marketing y tu I&D **frente a los demás**, no los números sueltos. Es lo mismo que dice el video: "las decisiones de las demás empresas van a afectar a la demanda de la empresa de uno".

## 1. Tamaño del mercado

```
mercado = N × órdenesBase × crecimiento
          × (precioPromedio / precioReferencia) ^ (−elasticidadPrecioMercado)
          × ((marketingPromedio + colchón) / (marketingReferencia + colchón)) ^ elasticidadMarketingMercado
          × (1 − competidoresExternos)
```

- `N` es la cantidad de empresas de la zona. Con más empresas el mercado es más grande, así que cada una recibe lo mismo que en una zona de 4.
- `crecimiento` lo pone el escenario en cada período: 1 es normal, 1,20 es un boom de +20% y 0,85 es una recesión de −15%. **No es acumulado**: es el tamaño del mercado de ese período comparado con el del período 0.
- La respuesta al precio **promedio** es suave (elasticidad 1): si toda la zona sube el precio 1%, el mercado se achica alrededor de 1%.
- `precioReferencia` sirve para la **inflación**. Si el comentario anuncia un 10% de inflación, el escenario sube la referencia de 90 a 99, y cobrar 99 vende lo mismo que antes cobrar 90.
- `competidoresExternos` es la parte del mercado que se llevan empresas de afuera de la zona (importados, por ejemplo).

## 2. Reparto entre empresas

Cada empresa tiene un "atractivo" y se lleva una parte del mercado proporcional a él:

```
dif     = precio − precioPromedio
atractivo = exp(−sensibilidadPrecio × dif − sensibilidadPrecioCuadrática × max(dif, 0)²)
          × ((marketing + colchón) / (marketingPromedio + colchón)) ^ exponenteMarketing
          × ((I&D acumulado + suavizado) / (I&D promedio + suavizado)) ^ pesoID
órdenes = mercado × atractivo / suma de los atractivos
```

- **Precio.** Cada peso de diferencia con el promedio pesa mucho. El término cuadrático hace que estar **por encima** del promedio castigue más de lo que premia estar por debajo: si cobrás caro, el cliente se va a la competencia.
- **Marketing.** El exponente es menor que 1, así que hay rendimientos decrecientes: duplicar el marketing no duplica las ventas. El colchón (500) evita que una empresa con marketing 0 reciba exactamente 0 órdenes.
- **I&D.** Se usa el I&D acumulado **al inicio del período**, así que lo que se invierte en t cuenta desde t+1, como dice el video. El peso cambia según el escenario (`pesoID`): con 0 el público no valora la calidad, con 0,3 la valora un poco (valor por defecto) y con 0,8 o más la valora mucho.

Al final se suma un **ruido** de ±2% con semilla, que se puede apagar al crear la partida.

## Objetivos que cumple (y que verifican los tests)

| Objetivo (CLAUDE.md) | Resultado del modelo |
|---|---|
| 4 empresas iguales a 90 / 8.500 / I&D 1.000 → 1.346 órdenes cada una | 1.346 exacto |
| Bajar 1 peso con las demás iguales → +5% a +7% | +5,9% |
| Estar 3 pesos arriba del promedio → −20% o más | −25% |
| +8% de marketing → cerca de +5% | +5,1% |
| Elasticidad agregada al precio ~1 | 1 |
| Marketing con rendimientos decrecientes | sí |
| I&D con peso según el escenario | sí (`pesoID`) |

## Parámetros actuales

| Parámetro | Valor | Qué controla |
|---|---|---|
| `ordenesBasePorEmpresa` | 1346 | Órdenes de cada empresa con todos iguales al precio y marketing de referencia |
| `precioReferencia` | 90 | Precio del período 0 |
| `marketingReferencia` | 8500 | Marketing del período 0 |
| `elasticidadPrecioMercado` | 1,0 | Cuánto se achica el mercado si sube el precio promedio |
| `elasticidadMarketingMercado` | 0,1 | Cuánto crece el mercado si sube el marketing promedio |
| `sensibilidadPrecio` | 0,0725 | Peso de cada peso de diferencia con el promedio |
| `sensibilidadPrecioCuadratica` | 0,0075 | Castigo extra por estar por encima del promedio |
| `exponenteMarketing` | 0,875 | Rendimientos decrecientes del marketing |
| `colchonMarketing` | 500 | Suaviza el marketing muy bajo |
| `pesoID` | 0,3 | Peso del I&D (cada escenario lo puede cambiar) |
| `suavizadoID` | 5000 | Suaviza el I&D cuando todos tienen poco |
| `ruido` | 0,02 | ±2% |

## El dato del video (2014)

En el video, 4 empresas iguales a precio 92 y marketing 7.858 recibían 1.234 órdenes cada una. Era **otro escenario y otra edición**. Con este modelo, ese dato corresponde a un `ordenesBasePorEmpresa` de alrededor de 1.271 (con referencia 90 / 8.500). Si alguna vez queremos jugar "el escenario del video", alcanza con crear un escenario que cambie esa base. No hace falta tocar el resto.

## Cómo recalibrar con datos nuevos

Lo más útil que se puede conseguir es un **Reporte Industrial de un período 1 o posterior**, donde las empresas jugaron precios y marketing distintos. Con eso:

1. Cargá en un test las decisiones de cada empresa (precio y marketing salen del informe de competición; el I&D y el marketing de las demás no se ven, así que conviene tener los reportes de compañía de varios equipos).
2. Compará las órdenes que da el modelo con las que dice el informe (`Total Ord. Recibidas` y, si las tenés, las de cada empresa).
3. Ajustá en `parametrosDemanda.json`, en este orden:
   - `sensibilidadPrecio` y `sensibilidadPrecioCuadratica` si el reparto por precio no coincide;
   - `exponenteMarketing` si el marketing pesa más o menos de lo que debería;
   - el `crecimiento` de cada período en el escenario si el total de la zona no coincide.
4. Corré `npm test`. Si algún objetivo de la tabla deja de cumplirse y el dato real dice otra cosa, **manda el dato real**: se cambia el objetivo en `mercado.test.ts` y se anota en `docs/supuestos.md`.

Para buscar los parámetros se puede usar un script chico que pruebe combinaciones y se quede con la que menos se equivoca. Así se calibraron los valores actuales.

## Revisar que el juego siga equilibrado

Después de recalibrar conviene ver cómo les va a los bots. Este análisis juega 90 partidas por escenario y muestra, para cada personalidad y dificultad, la utilidad promedio, las penalidades, las quiebras y cuánto stock o ventas perdidas tuvo:

```bash
ANALISIS=1 ESC=holtec npx vitest run analisis
```

(`ESC` puede ser `holtec`, `recesion` o `calidad`). Señales de alarma: un bot que no es novato con penalidades o quiebras, o una personalidad con stock por encima del 30% en todos los escenarios.
