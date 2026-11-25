# Semana 04 — Iteración 2: del texto al plan, y núcleo de ejecución

- **Fecha:** Miércoles 25 de noviembre
- **Rama:** `semana04/plan-y-nucleo`
- **Entregas:** PR «Del texto al plan» y PR «Núcleo de ejecución»
- **Estado:** Revisado. Los ajustes de la revisión están incorporados en cada sección y resumidos en §6.

Esta nota cubre solo lo nuevo. Lo que ya está decidido sigue en la [especificación](../dsl/especificacion.md), el [ADR-002](../adr/ADR-002-arquitectura.md) y el [diseño de la semana 3](semana-03.md).

## 1. Validador semántico (PR «Del texto al plan»)

Es la etapa de **semántica** (especificación §13): lo que necesita seguir referencias. Recibe el resultado del analizador más la declaración del ambiente, y no vuelve a leer texto.

**Decisión: expandir antes de revisar.** Cada frase de negocio se expande sobre el AST, sustituyendo sus parámetros, y las reglas se revisan sobre los pasos ya expandidos. Así `${CLAVE_{rol}}` se revisa como `${CLAVE_secretaria}` (especificación §9.2), y los ciclos salen solos de la pila de expansión.

| Código | Cómo se detecta | Dónde se informa |
|---|---|---|
| `CUS-E012` | Al expandir, una frase que ya está en la pila de expansión. | En el patrón de la primera frase del ciclo, en el vocabulario. |
| `CUS-E014` | Al sustituir, un nombre de variable que no queda como `[A-Za-z0-9_]+`. | En la cadena del argumento, en la historia. |
| `CUS-E011` | Una variable en mayúsculas que el ambiente no declara; una captura usada antes de su `capturar` o del `produce` de una frase; o un `produce` que no coincide con los `capturar` de la frase. | En la cadena o el código que contiene la variable; el `produce`, en su línea del vocabulario. |
| `CUS-E013` | Un secreto fuera del valor de `completar` o del código TOTP. | Igual que `CUS-E011`. |
| `CUS-W002` a `CUS-W005` | El flujo de cada escenario, con los antecedentes delante. | Como en la especificación §11. |

**Las posiciones de los 5 casos que faltan**, para completar `esperados.json`: 11 en `20:19`, 12 en `casos-ciclo.vocabulario.md:11:11` (más el `CUS-E009` de la historia), 13 en `21:25`, 14 en `20:29` y 18 en `20:19`.

**La declaración del ambiente se lee en `lenguaje`**, como los otros dos tipos de archivo: es texto puro y su gramática ya está en la EBNF (sección 9). Si una historia no indica ambiente, se usa el único que haya en `ambientes/` (§9.5). El ADR-002 dice que el tipo `Ambiente` es de `ambientes`, así que se actualiza en este PR: **la declaración (nombres y secretos) es de `lenguaje`, y los valores, de `ambientes`**.

**Mejoras del analizador que entran en este PR** (de la revisión del PR #19):

- [#21](https://github.com/soluciones-acutis/custodio/issues/21): dos vocabularios con el mismo nombre se informan en el segundo archivo, como el `id` repetido.
- [#22](https://github.com/soluciones-acutis/custodio/issues/22): el `CUS-E006` sugiere importar el vocabulario donde sí está la frase.
- [#23](https://github.com/soluciones-acutis/custodio/issues/23): una advertencia para los pasos con fase que no están en ningún escenario.
- [#24](https://github.com/soluciones-acutis/custodio/issues/24): los detalles menores. Lo que no alcance queda con `Refs` para el PR siguiente.

## 2. El plan de ejecución (DSL-14)

El plan es el único contrato entre `lenguaje` y `ejecuciones` (ADR-002). **Decisiones:**

- **Un plan por historia**, con un bloque por escenario. Cada escenario trae sus instrucciones (antecedentes y pasos ya expandidos), su limpieza aparte y su estado de compilación:
  - `ejecutable`;
  - `incompleto`: una frase sin pasos en los antecedentes o en el escenario (`CUS-W004`), **o** en la limpieza con un ambiente `desechable: no` (`CUS-W005`, §11.3);
  - `limpieza_pendiente`: una frase sin pasos en la limpieza, con un ambiente desechable (`CUS-W005`).
- **Una instrucción por acción base**, sin frases: `navegar`, `completar`, `seleccionar`, `marcar`, `desmarcar`, `presionar`, `esperar`, `ver`, `noVer` y `capturar`, con el mismo `objetivo`, `ambito` y `valor` del AST.
- **`origen` con la cadena de expansión:** la línea del paso en la historia y, si vino de una frase, cada frase por la que pasó con su archivo, línea y columna en el vocabulario. Un fallo dice «línea 20, dentro de "inicio sesión como…" (`acutis-suite.vocabulario.md:25:3`)».
- **Las variables siguen como `${…}`**: se resuelven al ejecutar. El plan nunca tiene el valor de un secreto, así que se puede guardar, mostrar y adjuntar a un informe sin cuidado especial.
- **Versión propia:** `"plan": "0.1.0"`, con su JSON Schema en `docs/dsl/plan.schema.json`. Puede cambiar sin cambiar el AST. Tiene las mismas pruebas que el del AST: compilado en modo estricto, las constantes contra los enums, y planes de ejemplo validados contra el Schema.

**`custodio compilar`** escribe el plan en JSON. La **selección** (DSL-15: `--etiqueta`, `--producto`, `--criticidad`, `--id`) es una función pura de `lenguaje` sobre los AST, que comparten `compilar` y `ejecutar`.

**Descartado:** expandir `navegar` por menú en varios `presionar` al compilar. Cada elemento de la ruta puede ser un enlace, una opción de menú o un botón (§6), y eso solo se sabe en la página. Queda como una instrucción `navegar` con `ruta`, que resuelve el motor y prueba la suite de contrato.

## 3. Núcleo de ejecución (PR «Núcleo de ejecución»)

### 3.1 El caso de uso `EjecutarPlan`

Vive en `ejecuciones/aplicacion/` y recibe el plan y los puertos. **Antes de abrir el navegador**, revisa que la `FuenteDeValores` tenga cada variable que usa el plan (después de expandir se conocen todos los nombres); si falta una, corta con un error claro y no a la mitad de un escenario. Después, por cada escenario:

1. Genera `${PREFIJO}` con `GeneradorDeIds`, único por escenario (§9.3). Hoy no hay reintentos en el alcance, así que no hace falta «por intento».
2. Abre una sesión del motor y ejecuta antecedentes y pasos. Las variables y los valores calculados se resuelven justo antes de cada instrucción (§3.3).
3. **En un `finally`**, ejecuta la limpieza en la misma sesión y la cierra (DSL-10). **Corre aunque fallen los antecedentes** (§11.3).
4. En el primer paso que falla, guarda una captura en `AlmacenDeEvidencias` y deja los pasos siguientes como `omitido`. Si fallan los antecedentes, **todos** los pasos del escenario quedan `omitido`.

**El resultado tiene dos campos**, porque la limpieza no oculta el resultado del escenario (DSL-10):

| Campo | Valores |
|---|---|
| Escenario | `aprobada`, `fallida` o `incompleto` |
| Limpieza | `limpia`, `limpieza_fallida` o `limpieza_pendiente` |

Cada paso trae estado, duración, mensaje, origen y la referencia a su evidencia.

### 3.2 Puertos

| Puerto | Forma propuesta |
|---|---|
| `MotorDeNavegador` (`ejecuciones`) | `abrirSesion(opciones) → SesionDeNavegador`, con un método por instrucción del plan, `capturarPantalla()` y `cerrar()`. Habla el idioma del plan (ADR-002), con los localizadores del AST. |
| `AlmacenDeEvidencias` (`ejecuciones`) | `guardar(nombre, bytes) → referencia`. Adaptador en disco, en `evidencias/<ejecución>/`. |
| `FuenteDeValores` (`ejecuciones`) | `resolver(nombre) → valor`, y si es secreto. La declara `ejecuciones` (regla 2 del ADR-002): `EjecutarPlan` no sabe qué es un ambiente. |
| `GeneradorDeCodigos` (`ejecuciones`) | `codigo(semilla, instante) → seis dígitos`. El HMAC del TOTP necesita `node:crypto`, que la regla 2 no deja importar desde `aplicacion`, así que va detrás de este puerto, con su adaptador en `infraestructura`. |
| `ObservadorDeAvance` (`ejecuciones`) | Recibe cada paso a medida que termina, para que la CLI imprima el avance. |
| `BovedaDeSecretos` (`ambientes`) | `resolver(nombre) → valor`. Adaptador con variables de entorno. |
| `Reloj` y `GeneradorDeIds` (`compartido`) | Como en ADR-002. Se usan para los plazos, el prefijo, el TOTP, la fecha y el número único. |

**`arranque/` arma la `FuenteDeValores`** con la declaración del ambiente, las variables de entorno y `BovedaDeSecretos`. **Los valores salen de las variables de entorno del proceso**, con el mismo nombre que declara el archivo de ambiente: `PARROQUIA`, `CLAVE_secretaria`. Es lo que ofrece GitHub Actions con sus secretos, y no necesita el servicio web (SRV-01 queda fuera del alcance). Solo los nombres declarados como secretos pasan por `BovedaDeSecretos`.

En GitHub Actions, los secretos no distinguen mayúsculas y se guardan como `CLAVE_SECRETARIA`, así que el workflow tiene que mapear cada uno (`CLAVE_secretaria: ${{ secrets.CLAVE_SECRETARIA }}`). Queda documentado para el PR «Historias, informes y CI».

### 3.3 Valores calculados: TOTP, fecha y número único

Un `ResolvedorDeValores` en `ejecuciones/dominio`, sin E/S, recibe el `Reloj`, el `${PREFIJO}` y el `GeneradorDeCodigos`, y calcula los valores que no son texto (especificación §12):

| Valor | Cómo |
|---|---|
| TOTP (§11.4) | El código desde la semilla. Si quedan menos de 5 segundos de la ventana, o si ese código ya se usó con la misma semilla, espera a la ventana siguiente. Los códigos usados se guardan **por ejecución**, no por escenario: dos escenarios seguidos con la misma cuenta pueden caer en la misma ventana. |
| Fecha (§6.3) | La fecha del `Reloj`. Con `formato`, ya formateada; con `formato: null`, el motor la escribe en el formato que pide el campo. |
| Número único (§9.4) | Derivado de `GeneradorDeIds`, distinto en cada escenario. |

Se prueba con los vectores de prueba del RFC 6238 y con un `Reloj` fijo en el borde de la ventana.

### 3.4 Redacción de secretos (RNF-01)

Un `Redactor` se arma con los valores de los secretos de la ejecución y **con cada código TOTP que se genera**, que también es secreto mientras dura su ventana. Reemplaza cada uno por `••••`, empezando por los más largos, para que un secreto que contiene a otro no quede a medias.

Se aplica **en la salida del núcleo**: un decorador sobre cada puerto por donde sale algo (`ObservadorDeAvance`, `AlmacenDeEvidencias` y el resultado). Así cubre también los mensajes de error del motor, que pueden traer el valor escrito. Una prueba recorre todo lo que sale de una ejecución con secretos y busca cada valor, con un caso donde el paso **falla** con un secreto de por medio, porque es el camino que más fácil se escapa.

Las trazas de Playwright registran lo que se escribe en cada campo, contraseñas incluidas. Se deciden en «Primera historia verde»: desactivadas, o redactadas antes de guardarse.

### 3.5 Motor simulado y suite de contrato

- **Motor simulado:** una página en memoria descrita como un árbol de elementos (rol, nombre, texto, visible, valor) con reglas simples de lo que pasa al presionar. Implementa las reglas de §8 de la especificación: coincidencia de texto, varias coincidencias, ámbitos.
- **Suite de contrato** en `test/contrato/motor-de-navegador.ts`: una función que recibe una fábrica de motores y corre las mismas pruebas. En este PR, contra el simulado; en «Primera historia verde», también contra Playwright con páginas HTML locales.

**Esperas:** cada instrucción espera hasta un plazo (§11.1): **10 segundos por defecto, y `--plazo` en la CLI**.

## 4. La especificación cambia en el mismo PR

Para que el código y la especificación no se contradigan desde el primer día:

| Sección | Cambio |
|---|---|
| §9.1 y `suite-pruebas.ambiente.md` | Los valores salen de las variables de entorno, no del servidor (SRV-01). |
| §11.1 | El plazo es `--plazo`, con 10 s por defecto, no «el que define el ambiente». |
| §11.5 | El resultado del escenario y el de la limpieza son dos campos aparte (§3.1). |
| §9.3 | `${PREFIJO}` es único por escenario. |
| ADR-002 | La declaración del ambiente es de `lenguaje`; `ambientes` queda para los valores (§1). |

## 5. Riesgos

| Riesgo | Mitigación |
|---|---|
| El motor simulado se vuelve un navegador a medias. | Solo implementa lo que la suite de contrato prueba; nada de CSS ni de JavaScript de la página. |
| El PR «Del texto al plan» crece con las mejoras de los issues #21 a #24. | El validador semántico y el compilador van primero; si no alcanza, #24 y la selección (DSL-15) pasan al PR «Núcleo de ejecución». |

## 6. Revisión de la nota

Matías aprobó empezar las dos partes tal como estaban, con cinco puntos para cerrar antes de escribir el núcleo. Todos están incorporados:

| Punto | Dónde |
|---|---|
| 1. Faltaban los valores que no son texto (TOTP, fecha, número único). | §3.3, y `GeneradorDeCodigos` en §3.2 |
| 2. El `Redactor` en un solo lugar no alcanzaba. | §3.4 |
| 3. `BovedaDeSecretos` es de `ambientes`, pero la usaba `EjecutarPlan`. | `FuenteDeValores` en §3.2; ADR-002 en §1 y §4 |
| 4. Tres casos de la especificación sin cubrir. | `desechable: no` en §2, el `produce` en la tabla de §1, los antecedentes que fallan en §3.1 |
| 5. Actualizar la especificación en el mismo PR. | §4 |

De las sugerencias entraron todas: revisar las variables antes de abrir el navegador (§3.1), el `origen` con la posición dentro del vocabulario (§2), las pruebas del Schema del plan (§2) y «único por escenario» (§3.1). Los nombres de los secretos en GitHub Actions quedan documentados para el PR «Historias, informes y CI» (§3.2).
