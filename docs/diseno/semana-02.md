# Semana 02 — Diseño del lenguaje: especificación v0.1

- **Fecha:** 23 de octubre de 2026
- **Rama:** `semana02/especificacion-dsl`
- **Entrega:** PR #16 «Especificación v0.1»
- **Estado:** Revisado en el PR #16 el 29 de octubre de 2026. Los ajustes de la revisión están en la sección 13.

## 1. Resumen

El diseño del DSL v1 se aprobó como dirección. Este documento cierra lo que la revisión dejó pendiente y define el alcance del PR #16.

- **Decisión central:** las personas escriben el `.historia.md`. El JSON del v1 pasa a ser el **AST**, la estructura que produce el analizador.
- **Cómo se encuentran los elementos:** la coincidencia de texto, las varias coincidencias, qué es una sección y el ámbito anidado quedan definidos en la especificación, no en cada adaptador, para que la suite de contrato pueda probar que el motor no importa.
- **Secretos:** los declara el ambiente, y el lenguaje prohíbe usarlos donde podrían terminar impresos.
- **Datos de prueba:** la limpieza corre por escenario, `${PREFIJO}` es único por escenario e intento, y queda espacio en el diseño para frases nativas.
- **El PR #16** entrega la especificación v0.1, la gramática, el JSON Schema y los tipos del AST, el vocabulario con las firmas de todas las frases, las 12 historias válidas, 19 casos inválidos y el archivo de ambiente.

## 2. Punto de partida

La revisión del diseño v1 se **aprobó como dirección**:

- Se queda: un paso como **localizador + acción**; `ver` y `noVer` separados; las frases de negocio nombradas explícitamente; los parámetros `{x}` al compilar y las variables `${X}` al ejecutar; y nada de esperas por tiempo.
- Se pidió cerrar: la semántica de localización, los secretos, el TOTP, las capturas de las frases, la limpieza y los datos de prueba.
- Para el PR #16: un JSON Schema del AST, semver desde `0.1.0`, la tabla completa de códigos y el paso normalizado en el AST.

Cada requisito tiene su issue (DSL-01 a DSL-12). El PR #16 los referencia con `Refs`, porque aquí se especifican y se implementan desde la S3.

## 3. Decisión central: el markdown es la fuente, el JSON es el AST

Esta decisión es la que se tomó desde el principio, y la revisión la confirmó. **DSL-01 no cambia y no hace falta un ADR.**

| Capa | Qué es | Quién la escribe o la produce | Cuándo |
|---|---|---|---|
| `.historia.md` | La fuente: se lee tal cual en GitHub. | Las personas. | Desde ya. |
| **AST** | La estructura de la historia, con la posición de cada elemento en el archivo. Se serializa en JSON y su forma la define un JSON Schema. | El analizador (`src/lenguaje/`). | Se especifica ahora; se implementa en la S3. |
| Plan de ejecución | Frases expandidas, variables listas para resolver y localizadores normalizados. | El compilador. | S4. |

### 3.1 El paso en el AST

En el AST cada paso queda **normalizado**, con claves fijas, para que el validador no dependa del orden de las claves:

```json
{
  "fase": "y",
  "accion": "presionar",
  "objetivo": { "por": "boton", "texto": "Revocar" },
  "ambito": { "por": "fila", "texto": "${PREFIJO}revocar@ejemplo.test" },
  "valor": null,
  "origen": { "linea": 37, "columna": 3 }
}
```

Es la alternativa B que el diseño v1 descartó para la fuente. Aquí sí sirve: nadie escribe el AST a mano, y lo que importa es que sea regular y fácil de validar. Los cinco JSON del v1 se convierten en ejemplos del AST.

`origen` guarda la línea y la columna de cada paso, que es lo que pide DSL-12 para los errores. Con JSON como fuente eso no habría sido posible, porque `JSON.parse` no entrega posiciones.

### 3.2 Del markdown al AST: frases base

La especificación v0.1 tiene que definir la forma exacta de cada frase base en markdown. Esta es la propuesta, tomada de cómo ya están escritas las historias:

| Frase en el `.historia.md` | Acción | Objetivo |
|---|---|---|
| ``navego a `https://…` `` | `navegar` | `url` |
| `navego a "Mi parroquia > El equipo"` | `navegar` | `menu` |
| `completo el campo "Correo" con "…"` | `completar` | `campo` |
| `selecciono "Catequista" en el campo "Rol"` | `seleccionar` | `campo` |
| `marco la casilla "…"` / `desmarco la casilla "…"` | `marcar` / `desmarcar` | `casilla` |
| `presiono el botón "…"` / `presiono el enlace "…"` | `presionar` | `boton` / `enlace` |
| `espero el texto "…"` | `esperar` | `texto` |
| `veo el texto "…"`, `veo el botón "…"`, `veo el campo "…"`, `veo el título "…"` | `ver` | según la palabra |
| `no veo …` | `noVer` | igual que `veo` |
| `veo que la dirección contiene "/admin"` | `ver` | `url` |
| `capturo el valor del campo "…" como "nombre"` | `capturar` | `campo` |
| `completo el campo "…" con el código generado con el secreto "${TOTP_x}"` | `completar` | `campo`, con el generador `totp` |
| `completo el campo "…" con la fecha de hoy` | `completar` | `campo`, con el generador de fecha |

Ámbito, al final de la frase:

| Sufijo | Ámbito |
|---|---|
| `en la fila de "…"` | `fila` |
| `en "Invitaciones sin aceptar"` | `seccion` |
| `en el aviso de confirmación` / `en el aviso "…"` | `dialogo` |
| `en la fila de "…" en "…"` | anidado (sección 4.4) |

Toda frase que no calce con una frase base se busca en los vocabularios importados.

**Consecuencia para el §9.6 del diseño v1.** En markdown, una frase base y una de negocio se escriben igual: las dos son oraciones. La distinción explícita (`"accion": "frase"`) se conserva **en el AST**, que es donde la usa el compilador. El error de una oración que no calza con nada pasa a ser uno solo (`CUS-E006`), con sugerencias tomadas de las frases base y de los vocabularios.

**Segundo factor.** La historia HU-SUITE-001 dice «ingreso el código de segundo factor generado con el secreto…» sin nombrar el campo. Propongo que la frase base sea genérica, `completo el campo "…" con el código generado con el secreto "…"`, y que la versión sin campo sea una **frase del vocabulario `acutis-suite`**, porque el nombre del campo («Código de seis dígitos») es de la Suite y no del lenguaje.

## 4. Cómo se encuentran los elementos

Todo lo de esta sección va en la especificación y no en el adaptador. Si cada motor lo decide a su manera, dos motores darán resultados distintos para la misma historia.

### 4.1 Coincidencia de texto

**Decisión:** una regla única para todos los localizadores.

- **Por defecto:** basta con que el elemento *contenga* el texto, sin distinguir mayúsculas y sin contar espacios repetidos.
- **Las tildes sí cuentan.** «Si, revocar» y «Sí, revocar» son textos distintos. Que la Suite esté bien escrita también es algo que se verifica.
- **Exacto:** con `exactamente` (`veo exactamente el texto "Activa"`, `"exacto": true` en el AST) el texto tiene que coincidir completo, con mayúsculas.

**Por qué:** es casi lo que hace Playwright por defecto, así que el adaptador principal no inventa nada, y otro motor lo replica normalizando el texto. Que el modo por defecto sea "contiene" no es riesgoso gracias a la regla siguiente.

**Descartado:** coincidencia exacta por defecto, porque obliga a copiar textos largos completos y se rompe con cualquier cambio menor de redacción. También se descartó ignorar las tildes, porque esconde errores de escritura de la interfaz.

### 4.2 Varias coincidencias

**Decisión:**

| Acción | Si el objetivo coincide con varios elementos |
|---|---|
| `presionar`, `completar`, `seleccionar`, `marcar`, `desmarcar`, `capturar` | **Fallo del paso**, con un mensaje que dice cuántos encontró y sugiere usar un ámbito. |
| `ver`, `esperar` | Pasa si al menos uno es visible. |
| `noVer` | Pasa si ninguno es visible. |

**Descartado:** tomar el primero, como hace `.first()` en Playwright. Esconde un localizador mal elegido y hace que la historia pase por el elemento equivocado. Para desambiguar están el ámbito (`en`) y `exactamente`.

### 4.3 Qué es una `seccion`

**Decisión:** una sección se encuentra **por su título**. Es el encabezado (`h1`–`h6` o rol *heading*) con ese texto, más todo lo que sigue hasta el próximo encabezado del mismo nivel o superior. Como alternativa, también vale una región con ese nombre accesible (rol *region*, *group* o *form* con `aria-label` o `aria-labelledby`).

**Qué tiene que cumplir la página:** que la sección tenga un encabezado real. Un texto en negrita no cuenta.

**Por qué:** calza con cómo está hecha la Suite («Invitaciones sin aceptar» es probablemente un título seguido de una tabla) sin pedirle cambios.

**Nuevo localizador `dialogo`:** un cuadro de diálogo (rol *dialog*) por su título. La HU-SUITE-012 dice «presiono "Aprobar" en el aviso de confirmación», y sin `dialogo` no hay forma limpia de escribirlo.

### 4.4 Ámbito anidado

**Decisión:** el ámbito **se puede anidar**, sin límite de profundidad, y se lee de adentro hacia afuera:

```json
"ambito": { "por": "fila", "texto": "x", "ambito": { "por": "seccion", "texto": "Invitaciones sin aceptar" } }
```

En markdown: `en la fila de "x" en "Invitaciones sin aceptar"`.

**Por qué:** sin anidar, una tabla que aparece dos veces en la misma página no se puede desambiguar.

### 4.5 Objetivos que acepta cada acción

**Decisión:** la especificación tiene una tabla cerrada, que es la que usa `CUS-E007`:

| Acción | Objetivos válidos |
|---|---|
| `navegar` | `url`, `menu` |
| `completar`, `seleccionar` | `campo`, `rol` |
| `marcar`, `desmarcar` | `casilla`, `opcion`, `rol` |
| `presionar`, `capturar` | cualquier localizador |
| `esperar`, `ver`, `noVer` | cualquier localizador, `url` |

- `ver` con `url` significa siempre **«la URL contiene»**.
- `capturar` guarda el **valor escrito** si el objetivo es un `campo`, y el **texto visible** en cualquier otro caso.
- `menu` presiona en orden cada elemento de la ruta: un enlace, una opción de menú o un botón con ese nombre.
- `mensaje` (`veo el mensaje "…"`, que usan HU-SUITE-004 y 012) es **sinónimo de `texto`** en v0.1. Ver la pregunta 4.

## 5. Ejecución y datos de prueba

### 5.1 `noVer` necesita un ancla

**Problema:** `noVer` pasa al instante si la página todavía no terminó de responder.

**Decisión:** advertencia `CUS-W003` cuando, entre la última acción que cambia la página (`navegar`, `presionar` o una frase) y el `noVer`, no hay ningún `ver` ni `esperar`. Las historias actuales ya lo hacen bien. La advertencia protege las que vienen.

**Descartado:** que `noVer` espere el plazo completo antes de pasar. Haría lentísimas historias como la HU-SUITE-002, donde casi todos los pasos son `noVer`.

### 5.2 Limpieza por escenario

**Decisión:** la limpieza corre **al terminar cada escenario**, como dice DSL-10, y además:

- corre **aunque fallen los antecedentes**: el *finally* envuelve antecedentes más escenario;
- tiene que ser **idempotente**: no falla si no encuentra nada que borrar, porque el escenario pudo fallar antes de crear sus datos.

**Por qué:** en la HU-SUITE-005, los escenarios 2 y 3 crean de nuevo a `${PREFIJO}Tomás Pérez`. Con la limpieza al final de la historia quedarían dos fichas con el mismo nombre, y la `fila` se volvería ambigua (4.2).

### 5.3 `${PREFIJO}` único

**Decisión:** el ejecutor genera un `${PREFIJO}` **único por escenario y por intento** con `GeneradorDeIds`. Es corto y solo lleva letras, números y guiones (por ejemplo `cus7f3a-`), porque termina dentro de correos y nombres. El ambiente no lo define.

**Por qué por intento:** si un escenario falla y su limpieza también falla, el reintento (SRV-09) no tropieza con los restos del intento anterior. Si fuera único solo por ejecución, dos trabajadores en paralelo ya no chocarían, pero los reintentos sí.

**Valores que la aplicación exige únicos**, como el número de partida `999` de la HU-SUITE-005: un generador `{ "unico": "numero" }`. En markdown: `con un número único`.

### 5.4 Espacio para frases nativas

Una partida cerrada y un certificado emitido no se pueden borrar por pantalla, y preparar datos por la interfaz es lento y frágil.

**Decisión:** la firma de una frase puede declarar `implementacion: nativa`. En ese caso la frase no tiene pasos: la implementa un puerto de datos de prueba (API o siembra) en `ejecuciones`. La historia no cambia: sigue diciendo «DADO que existe la partida de bautismo de…».

**No se construye ahora.** Se deja el campo en la firma y en el JSON Schema. Va en el issue con la etiqueta `futuro`.

## 6. Variables, secretos y frases

### 6.1 Cómo se reconoce un secreto

**Decisión:** tres capas.

1. **El ambiente declara qué nombres son secretos.** Son solo nombres, nunca valores, en un archivo versionado, así el validador lo sabe sin conectarse a nada.
2. **Regla estática (`CUS-E013`):** un secreto solo puede aparecer en el valor de `completar` o dentro del generador `totp`. Usarlo en un localizador, en `ver`, en `capturar` o en una URL es error, porque terminaría en el plan, en los registros o en el informe.
3. **Al ejecutar**, los valores de los secretos se ocultan en todo lo que se guarda o se registra (SRV-06).

`USUARIO_*` es una **variable de ambiente, no un secreto**: es el correo de una cuenta de prueba, que igual aparece en pantalla, y las historias lo usan como nombre de botón (HU-SUITE-001) y de fila (HU-SUITE-003). Los secretos son `CLAVE_*` y `TOTP_*`.

**Descartado:** una marca en la sintaxis, como `${secreto:CLAVE_secretaria}`. Si ocultar depende de que el autor escriba la marca, basta un olvido para que el secreto se filtre. Con la declaración en el ambiente, el autor no tiene cómo olvidarlo.

### 6.2 Nombres de variable armados con parámetros

**Decisión:** en `${USUARIO_{rol}}`, el parámetro se sustituye **sobre el AST**, no sobre el texto crudo, y el nombre tiene que quedar completo al compilar (`CUS-E014`). Para que se pueda verificar, el valor de un parámetro que arma un nombre de variable solo puede tener letras, números y `_`. Un parámetro con `${…}` o con una captura es error.

### 6.3 Capturas que salen de una frase

**Decisión:** la firma de la frase declara lo que produce: `produce: ["{guardarLinkComo}"]`.

- Es obligatorio en las frases sin pasos, porque no hay de dónde deducirlo.
- En las que tienen pasos, el validador comprueba que `produce` coincida con sus `capturar`, para que la declaración no quede desactualizada.

Con esto, `CUS-E011` revisa `${linkInvitacion}` antes de ejecutar.

### 6.4 TOTP: espera de ventana

**Decisión:** es parte de la semántica del generador `totp` (DSL-09), no una espera del lenguaje. Si quedan menos de N segundos de la ventana (5 por defecto, configurable en el ambiente), o si ese código ya se usó con el mismo secreto, el generador espera a la ventana siguiente. La espera es acotada (a lo más 30 s) y usa el puerto `Reloj`, así que se prueba con un reloj fijo.

**Lo que no resuelve:** dos trabajadores con la misma cuenta al mismo tiempo. Eso necesita cuentas de prueba por trabajador o un bloqueo por cuenta en la cola. Se decide en la S6.

### 6.5 Frase sin pasos

**Decisión:**

- **Al validar:** es válida, con la advertencia `CUS-W004` («la historia no se puede ejecutar todavía»).
- **Al ejecutar:** el escenario no corre y se informa con un estado propio, **`incompleto`**.
- **En CI:** una historia crítica `incompleto` cuenta como falla, para que nunca quede un verde que no probó nada.

**Descartado:** el estado `pendiente`, porque ya es un estado de la cola en SRV-04 y se confundirían. También `omitida`, que esconde el hueco, y tratarla como error, que impediría escribir la historia antes de conocer sus pantallas.

## 7. Versión y gramática

- **Versión:** semver sin la `v`, partiendo en **`0.1.0`**. Aplica a la especificación, al campo `dsl:` de las historias, al vocabulario y al JSON Schema. Hoy las historias dicen `dsl: v1.0`: se actualizan en el PR #16, y `v1.0` pasa a ser uno de los casos inválidos (`CUS-E015`).
- **Gramática:** **EBNF del `.historia.md`** en `docs/dsl/` (DSL-11) y **JSON Schema del AST**. Ver la pregunta 1.

## 8. Diagnósticos: tabla provisoria de códigos

Ahora que la fuente es el markdown, los códigos se ordenan por etapa. Esta tabla reemplaza la del diseño v1, que estaba pensada para JSON.

| Código | Problema | Requisito |
|---|---|---|
| `CUS-E001` | Falta el frontmatter o su YAML es inválido. | DSL-01 |
| `CUS-E002` | Falta un campo obligatorio del frontmatter. | DSL-01 |
| `CUS-E003` | `id` con formato inválido o repetido. | DSL-02 |
| `CUS-E004` | Falta la narrativa o una de sus partes. | DSL-03 |
| `CUS-E005` | Escenario mal formado: sin pasos, empieza con `Y` o `ENTONCES`, o con la fase en minúscula. | DSL-04 |
| `CUS-E006` | Frase desconocida: no calza con ninguna frase base ni del vocabulario. Incluye sugerencia. | DSL-05, DSL-07 |
| `CUS-E007` | Objetivo que la acción no acepta (`completo el botón…`). | DSL-05 |
| `CUS-E008` | Falta un valor obligatorio (`completo el campo "Correo"` sin `con`). | DSL-05 |
| `CUS-E009` | El vocabulario importado no existe. | DSL-07 |
| `CUS-E010` | A una frase de negocio le faltan o le sobran parámetros. | DSL-07 |
| `CUS-E011` | Variable no definida, o captura usada antes de hacerse. | DSL-08 |
| `CUS-E012` | Referencia circular entre frases. | DSL-07 |
| `CUS-E013` | Secreto en un lugar no permitido. | DSL-08 |
| `CUS-E014` | Nombre de variable incompleto o inválido después de sustituir parámetros. | DSL-07, DSL-08 |
| `CUS-E015` | Versión `dsl:` mal escrita o no soportada. | DSL-11 |
| `CUS-E016` | Dos escenarios con el mismo nombre. | DSL-04 |
| `CUS-W001` | Localizador de escape (`css`, `idDePrueba`): deuda de accesibilidad. | DSL-06 |
| `CUS-W002` | Escenario sin ninguna verificación. | DSL-04 |
| `CUS-W003` | `noVer` sin ancla. | DSL-05 |
| `CUS-W004` | Usa una frase sin pasos: no se puede ejecutar todavía. | DSL-07 |

Que un objetivo sea ambiguo (4.2) no es un código `CUS`: solo se sabe al ejecutar, así que se informa como fallo del paso.

### 8.1 Los casos inválidos

Al menos uno por cada código de error. Son 19, más que los 15 que pide el PR #16 (el 18 y el 19 llegaron con la revisión, sección 13):

| # | Caso | Error esperado |
|---|---|---|
| 01 | Historia sin frontmatter. | `CUS-E001` |
| 02 | Frontmatter sin `criticidad`. | `CUS-E002` |
| 03 | `id: HU-001`. | `CUS-E003` |
| 04 | Narrativa sin `**Para**`. | `CUS-E004` |
| 05 | Escenario que empieza con `- Y …`. | `CUS-E005` |
| 06 | `presiona el botón "Entrar"` (con sugerencia «presiono»). | `CUS-E006` |
| 07 | `completo el botón "Entrar" con "x"`. | `CUS-E007` |
| 08 | `completo el campo "Correo"`. | `CUS-E008` |
| 09 | `vocabularios: [acutis-suit]`. | `CUS-E009` |
| 10 | `inicio sesión como "secretaria"` sin parroquia. | `CUS-E010` |
| 11 | `navego a "${linkInvitacion}"` antes de capturarlo. | `CUS-E011` |
| 12 | Vocabulario de prueba donde dos frases se llaman entre sí. | `CUS-E012` |
| 13 | `veo el texto "${CLAVE_secretaria}"`. | `CUS-E013` |
| 14 | `inicio sesión como "secretaria parroquial"`, con espacio, dentro de `${USUARIO_{rol}}`. | `CUS-E014` |
| 15 | `dsl: v1.0`. | `CUS-E015` |
| 16 | Dos escenarios con el mismo nombre. | `CUS-E016` |
| 17 | Un escenario sin pasos (lo pide el issue de DSL-04). | `CUS-E005` |
| 18 | `${PARROQUA}`, una variable que el ambiente no declara. | `CUS-E011` |
| 19 | Una frase que está en los dos vocabularios que importa la historia. | `CUS-E017` |

## 9. Inventario de frases de negocio

Las 12 historias de `historias/` tienen 261 pasos. Además de las frases base usan **43 frases de negocio**, que quedaron en [`vocabularios/acutis-suite.vocabulario.md`](../../vocabularios/acutis-suite.vocabulario.md) con su firma completa (parámetros, `produce` e implementación):

| Implementación | Frases | Ejemplos |
|---|---:|---|
| Con pasos | 13 | «inicio sesión como…», «visito el sitio de la parroquia…», «existe la partida de bautismo de…», «la secretaría ve la inscripción de…» |
| `pendiente` | 23 | Las del asistente de inscripción, los firmantes de la colecta, el libro de caja, el verificador de certificados |
| `nativa` | 7 | La limpieza única «elimino todo lo creado con prefijo…», «reabro el mes…», y preparaciones como «existe la colecta presentada…» |

**Criterio.** Una frase tiene pasos solo cuando salen de etiquetas que ya aparecen en las historias, sin inventar pantallas. Es `nativa` cuando por pantalla es imposible (borrar una partida cerrada, reabrir un mes que la contadora no puede reabrir) o cuando prepararla por pantalla mezclaría lo que el escenario no prueba. Las demás son `pendiente`, con un motivo que dice qué falta averiguar.

**Composición.** «inicio sesión como…» usa «ingreso el código de segundo factor…», que a su vez usa la frase base con el generador TOTP (§3.2). «existe la inscripción preinscrita…» usa tres frases del asistente de inscripción.

`ELIMINAR` y `REABRIR` en mayúsculas no eran fases del lenguaje: las limpiezas pasaron a ser frases normales («elimino las invitaciones con prefijo…», «reabro el mes… si quedó cerrado»).

## 10. Alcance del PR #16

### 10.1 Entregables

| Entregable | Ubicación | Requisitos |
|---|---|---|
| Especificación v0.1 (frases base en markdown, semántica de las secciones 4 a 6, versión) | `docs/dsl/especificacion.md` | DSL-01 a DSL-11 |
| Gramática EBNF del `.historia.md` | `docs/dsl/gramatica.ebnf` | DSL-11 |
| JSON Schema del AST, versión `0.1.0` | `docs/dsl/ast.schema.json` | DSL-11 |
| Tipos del AST en TypeScript | `src/lenguaje/` | DSL-11 |
| Tabla de códigos y casos inválidos | `docs/dsl/especificacion.md`, `test/lenguaje/casos/` | DSL-12 |
| Vocabulario `acutis-suite` con las firmas de todas las frases (`parametros`, `produce`, `implementacion`) | `vocabularios/acutis-suite.vocabulario.md` | DSL-07 |
| Las 12 historias del inventario en v0.1 (`dsl: 0.1.0`) | `historias/` | DSL-01 |
| Este documento de diseño | `docs/diseno/semana-02.md` | — |

### 10.2 Lista de tareas

**Historias**
- [X] Subir las historias de usuario 007 a 012 en `historias/`.
- [x] Actualizar las 12 historias a `dsl: 0.1.0` y a las frases base de la sección 3.2. Las limpiezas pasan a ser frases normales, en vez de `ELIMINAR`.
- [x] Completar el inventario de frases (sección 9) con las historias 007 a 012.

**Especificación**
- [x] Escribir `docs/dsl/especificacion.md` v0.1 a partir de `especificacion-dsl-v1.md`, ajustada a «markdown como fuente».
- [x] Incluir la semántica de las secciones 4, 5 y 6 y la tabla de códigos de la sección 8.
- [x] Escribir la gramática EBNF (`docs/dsl/gramatica.ebnf`), partiendo del anexo A del documento técnico.

**AST**
- [x] Tipos del AST en `src/lenguaje/`: `Historia`, `Escenario`, `Paso` normalizado, `Localizador`, `Ambito`, `Valor` y `Origen`. Solo tipos, sin E/S: tiene que pasar la regla 6.
- [x] `docs/dsl/ast.schema.json` versión `0.1.0`, con el campo `implementacion` en las firmas de frases (sección 5.4).
- [x] Convertir los cinco JSON del v1 al AST normalizado y usarlos como ejemplos. Se generaron desde los `.historia.md` v0.1, con línea y columna reales, en `docs/dsl/ejemplos/`.
- [x] Prueba que valide los ejemplos de AST contra el JSON Schema (`test/lenguaje/ast.test.ts`), con `ajv` como dependencia de desarrollo.

**Vocabulario y casos**
- [x] `vocabularios/acutis-suite.vocabulario.md` con las firmas de todas las frases y sus pasos cuando se conocen.
- [x] Los 19 casos inválidos de la sección 8.1 en `test/lenguaje/casos/invalidos/`, cada uno con su código esperado.
- [x] Las 12 historias como casos válidos: se referencian desde `historias/`, sin duplicarlas (`test/lenguaje/casos.test.ts`).

**Revisión del diseño v1**
- [x] Correcciones de redacción del diseño v1 (en `dsl_v1/`, fuera del repositorio): §8.1 y §9.1. La frase «la reunión de la semana pasada» del §4 no está en la versión actual del documento, y el índice ya no incluye el título.

**Cierre**
- [x] `npm run verificar` en verde.
- [x] Descripción del PR con la plantilla, `Refs #n` a los issues DSL-01 a DSL-12 y las casillas de especificación marcadas en cada issue.

### 10.3 Fuera del PR #16

- **HU-SUITE-002, acceso directo a la URL de un módulo:** S3, tiene su propio issue.
- **Frases nativas:** solo se deja el espacio en el diseño (sección 5.4); el puerto se construye más adelante.
- **Analizador, validador y CLI `custodio validar`:** S3 (ADR-003).

## 11. Ajustes al escribir la especificación

Al escribir la especificación y pasar las 12 historias por un analizador de prueba aparecieron estos ajustes:

| Ajuste | Por qué |
|---|---|
| Campo `vocabularios: [acutis-suite]` en el frontmatter de las 12 historias. | Una historia tiene que decir qué vocabulario importa para que `CUS-E009` se pueda revisar. |
| `fila` también es el elemento de una lista (rol *listitem*), no solo la fila de una tabla. | La HU-SUITE-011 verifica un texto «en la petición», que en el muro de Orar es un elemento de lista. |
| HU-SUITE-012: `en el curso "…"` pasó a `en "…"` (sección por su título), y «la solicitud ya no está en…» pasó a `no veo el texto "…" en "Solicitudes por revisar"`. | Así se escriben con frases base y no hacen falta dos frases de negocio más. |
| HU-SUITE-011: `en la petición "…"` pasó a `en la fila de "…"`. | Mismo motivo. |
| HU-SUITE-004 y HU-SUITE-007: el `no veo` pasó antes de la frase de verificación que lo seguía. | El analizador encontró `CUS-W003`: la frase («el libro de caja muestra…», «la asistencia… quedó como presente») puede cambiar de página, y el `no veo` habría revisado la página equivocada. |
| HU-SUITE-005: el número de partida `999` pasó a `un número único`. | Un número fijo choca entre ejecuciones (§5.3). |
| Formas en markdown para los escapes y el rol: `el elemento con id de prueba "…"`, ``el elemento con selector `…` ``, `el elemento con rol "…" y nombre "…"`. | La tabla de §3.2 no las tenía. |
| `CUS-E010` se reconoce porque la oración **empieza** como una frase del vocabulario pero no tiene sus parámetros. | Sin esa regla, una frase a la que le falta un parámetro se informaría como frase desconocida (`CUS-E006`). |
| `CUS-E005` («no puede empezar con Y o ENTONCES») mira la primera línea del escenario, aunque no se haya entendido. | Si un primer paso inválido se descartara, el segundo pasaría a ser «el primero» y aparecería un error encadenado. |

### 11.1 Cómo se comprobó

- Un analizador de prueba, que no está en `main` y no es el de la S3, leyó las 12 historias con las frases base de §3.2, el vocabulario y el ambiente: **0 errores** en las 12. Las únicas advertencias son `CUS-W004` y `CUS-W005`, de las historias que usan frases sin pasos. El analizador está en la rama [`experimentos/analizador-s2`](https://github.com/soluciones-acutis/custodio/tree/experimentos/analizador-s2), como punto de partida para la S3.
- El mismo analizador corrió los 19 casos inválidos: **cada uno informa exactamente su error**, y ningún otro.
- Generó el AST de cinco historias y del vocabulario (`docs/dsl/ejemplos/`), y esos AST cumplen el JSON Schema (`test/lenguaje/ast.test.ts`).

## 12. Criterios de aceptación de la semana

Del documento técnico, para la S2:

- [x] La especificación permite escribir **todas** las historias del inventario.
- [x] Cubre **DSL-01 a DSL-11** en papel.
- [x] Hay **≥ 12 historias** como casos válidos y **≥ 15 casos inválidos** con su error esperado.
- [x] La especificación y la gramática están en `docs/dsl/`, y el modelo del AST tipado está en `src/lenguaje/`.

Y la definición de terminado de cada PR: CI verde, pruebas para lo nuevo, sin secretos ni datos personales, documentación al día, descripción con evidencia y requisitos marcados en sus issues.

## 13. Ajustes de la revisión del PR #16

La revisión del 29 de octubre pidió cuatro cambios antes de fusionar, y seis arreglos menores. Cada uno quedó en la especificación.

### 13.1 Limpieza nativa

**Problema:** según el §10.3, una historia que usa una frase sin pasos no se ejecuta. Diez historias terminaban en una limpieza `nativa`, así que todas quedaban `incompleto`, incluso la HU-SUITE-003, cuyos escenarios tienen todos sus pasos.

**Decisión:**

- **Una sola frase nativa de limpieza:** «elimino todo lo creado con prefijo "{prefijo}"». Como `${PREFIJO}` es único por escenario y todo dato de prueba lo lleva, basta una operación del puerto de datos de prueba que la Suite tiene que ofrecer. Reemplaza las 11 frases «elimino … con prefijo», y el vocabulario pasa de 53 a 43 frases.
- **Una limpieza sin pasos depende del ambiente** (especificación §11.3, advertencia nueva `CUS-W005`). En un ambiente `desechable: sí`, el escenario se ejecuta y la limpieza se informa como `limpieza_pendiente`. En uno `desechable: no`, el escenario no se ejecuta y queda `incompleto`.

**Descartado:** escribir la regla de hoy explícitamente para la limpieza. Seguiría bloqueando historias completas hasta que exista el puerto, que no depende de nosotros.

**Efecto:** la HU-SUITE-003 ya se puede ejecutar en `suite-pruebas`. Las otras nueve siguen `incompleto` por frases `pendiente` en sus escenarios, que es lo correcto mientras no se conozcan esas pantallas.

### 13.2 El archivo de ambiente

**Problema:** el caso 13 (`CUS-E013`) necesitaba saber qué nombres son secretos, y «variable no definida» (`CUS-E011`) qué variables existen. Las dos cosas las declara el ambiente, pero su archivo no existía, así que el caso 13 solo se podía detectar adivinando por el prefijo `CLAVE_`.

**Decisión:** el formato queda definido ahora (especificación §9.5). Es un `ambientes/<nombre>.ambiente.md` con frontmatter (`ambiente`, `dsl`, `producto`, `desechable`) y dos listas de nombres, `## Variables` y `## Secretos`, nunca valores. Un nombre puede terminar en `*` (`CLAVE_*`), y `CUS-E011` y `CUS-E013` se revisan después de sustituir los parámetros de cada frase, así que `${CLAVE_{rol}}` se reconoce como secreto.

- El ambiente de la Suite es [`ambientes/suite-pruebas.ambiente.md`](../../ambientes/suite-pruebas.ambiente.md).
- Caso nuevo 18: una variable que el ambiente no declara. Cierra la casilla de DSL-08 que había quedado para la S4.
- Una prueba comprueba que el ambiente declara cada variable en mayúsculas que usan las historias y el vocabulario.

**Por qué markdown y no YAML o JSON:** es el mismo formato que las historias y los vocabularios, se lee en GitHub y lo lee el mismo analizador.

### 13.3 La gramática

| Problema | Decisión |
|---|---|
| No aceptaba las líneas en blanco después del frontmatter, de la narrativa ni entre los antecedentes y el primer escenario. | `{ linea_en_blanco }` entre los bloques y después de cada título. |
| `cadena` no tenía cómo escribir una comilla. | `\"` es una comilla y `\\` una barra invertida (especificación §6.4). |
| `exactamente` valía con `elemento` pero no con `elemento_de_campo`. | Vale con cualquier elemento salvo los escapes, también campos y casillas: `completo exactamente el campo "Nombre" con "…"`. Sirve para separar «Nombre» de «Nombre del apoderado» sin un ámbito. |

### 13.4 Arreglos menores

| Arreglo | Dónde |
|---|---|
| `fila` y `seccion` salieron de los objetivos: en el markdown solo son ámbitos. | `ast.ts`, `ast.schema.json` |
| `la fecha de hoy` usa el formato que pide el campo, y lo resuelve el adaptador; `la fecha de hoy en formato "AAAA-MM-DD"` lo fija. En el AST, `formato: null` cuando lo resuelve el adaptador. | Especificación §6.3 |
| La narrativa va con una línea en blanco entre `**Como**`, `**Quiero**` y `**Para**`, para que GitHub no la junte en un párrafo. La gramática acepta las dos formas, y el formateador escribe la canónica. | Las 12 historias, los casos, §4 |
| El analizador de prueba quedó en la rama `experimentos/analizador-s2`, sin entrar a `main`. | Sección 11.1 |
| Los ejemplos de AST se regeneraron con las líneas nuevas. Que sean la salida esperada del analizador real queda para la S3. | `docs/dsl/ejemplos/` |
| Este documento decía «PR #2»; el PR es el #16. | Todo el documento |

### 13.5 Las preguntas del §15 de la especificación

| Pregunta | Respuesta |
|---|---|
| ¿`historias/` en la raíz o en `docs/historias/`? | En la raíz, junto a `vocabularios/` y `ambientes/`, como dice el documento técnico: son la entrada del producto. |
| ¿`incompleto` como estado en SRV-04? | Sí, pero como **resultado** del escenario y de la ejecución (`aprobada`, `fallida`, `incompleto`, `limpieza_fallida`, `limpieza_pendiente`), no como estado de la cola (`pendiente`, `en_curso`, `terminada`). Especificación §11.5. |
| ¿Una oración que calza con frases de dos vocabularios? | Es error, `CUS-E017`, por la misma razón que no existe «el primero» (§4.2). Caso nuevo 19. |
