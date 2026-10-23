# Semana 02 — Diseño del lenguaje: especificación v0.1

- **Fecha:** 23 de octubre de 2026
- **Rama:** `semana02/especificacion-dsl`
- **Entrega:** PR #2 «Especificación v0.1»
- **Estado:** Para la reunión de diseño

## 1. Resumen

El diseño del DSL v1 se aprobó como dirección. Este documento cierra lo que la revisión dejó pendiente y define el alcance del PR #2.

- **Decisión central:** las personas escriben el `.historia.md`. El JSON del v1 pasa a ser el **AST**, la estructura que produce el analizador.
- **Cómo se encuentran los elementos:** la coincidencia de texto, las varias coincidencias, qué es una sección y el ámbito anidado quedan definidos en la especificación, no en cada adaptador, para que la suite de contrato pueda probar que el motor no importa.
- **Secretos:** los declara el ambiente, y el lenguaje prohíbe usarlos donde podrían terminar impresos.
- **Datos de prueba:** la limpieza corre por escenario, `${PREFIJO}` es único por escenario e intento, y queda espacio en el diseño para frases nativas.
- **El PR #2** entrega la especificación v0.1, la gramática, el JSON Schema y los tipos del AST, el vocabulario con las firmas de todas las frases, las 12 historias válidas y 16 casos inválidos.

## 2. Punto de partida

La revisión del diseño v1 se **aprobó como dirección**:

- Se queda: un paso como **localizador + acción**; `ver` y `noVer` separados; las frases de negocio nombradas explícitamente; los parámetros `{x}` al compilar y las variables `${X}` al ejecutar; y nada de esperas por tiempo.
- Se pidió cerrar: la semántica de localización, los secretos, el TOTP, las capturas de las frases, la limpieza y los datos de prueba.
- Para el PR #2: un JSON Schema del AST, semver desde `0.1.0`, la tabla completa de códigos y el paso normalizado en el AST.

Cada requisito tiene su issue (DSL-01 a DSL-12). El PR #2 los referencia con `Refs`, porque aquí se especifican y se implementan desde la S3.

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
  "origen": { "linea": 34, "columna": 3 }
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

- **Versión:** semver sin la `v`, partiendo en **`0.1.0`**. Aplica a la especificación, al campo `dsl:` de las historias, al vocabulario y al JSON Schema. Hoy las historias dicen `dsl: v1.0`: se actualizan en el PR #2, y `v1.0` pasa a ser uno de los casos inválidos (`CUS-E015`).
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

Uno por cada código de error. Son 16, más que los 15 que pide el PR #2:

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

## 9. Inventario de frases de negocio

Estas son las frases que usan hoy las seis historias de `docs/historias/` y que no son frases base. Salen de un análisis de los pasos de cada historia (138 pasos en total).

| Frase (firma) | Historias | Propuesta |
|---|---|---|
| `inicio sesión como "{rol}" en la parroquia "{parroquia}"` | 001–006 | Con pasos. |
| `ingreso el código de segundo factor generado con el secreto "{secreto}"` | 001 | Con pasos (sección 3.2). |
| `visito el sitio de la parroquia "{parroquia}"` | 004 | Con pasos. |
| `existe una invitación sin aceptar para "{correo}" con rol "{rol}" y guardo su link como "{guardarLinkComo}"` | 003 | Con pasos; `produce: ["{guardarLinkComo}"]`. |
| `ELIMINAR las invitaciones con prefijo "{prefijo}"` | 003 | Candidata a nativa. |
| `una persona pidió una misa desde el sitio a nombre de "{nombre}"` | 004 | Candidata a nativa. |
| `la secretaría ve la petición de misa de "{nombre}"` | 004 | Con pasos. |
| `el libro de caja muestra un ingreso de "{monto}" por la misa de "{nombre}"` | 004 | Con pasos. |
| `ELIMINAR las peticiones de misa con prefijo "{prefijo}"` | 004 | Candidata a nativa. |
| `ELIMINAR las misas del libro de intenciones con prefijo "{prefijo}" y sus ingresos en el libro de caja` | 004 | Candidata a nativa. |
| `existe la partida de bautismo de "{persona}"` | 005 | Candidata a nativa. |
| `abro la ficha de "{persona}"` | 005 | Sin pasos todavía. |
| `abro la partida de bautismo de "{persona}"` | 005 | Con pasos. |
| `el libro de "{libro}" muestra la partida de "{persona}"` | 005 | Con pasos. |
| `el verificador del sitio de la parroquia "{parroquia}" acepta el código "{codigo}" con el apellido "{apellido}"` | 005 | Sin pasos todavía. |
| `ELIMINAR los certificados, partidas y fichas con prefijo "{prefijo}"` | 005 | Nativa: una partida cerrada no se borra por pantalla. |
| `elijo el curso "{curso}" en el asistente de inscripción` | 006 | Sin pasos todavía. |
| `inscribo a "{persona}" con una ficha nueva` | 006 | Sin pasos todavía. |
| `agrego como apoderada a "{persona}"` | 006 | Sin pasos todavía. |
| `existe la inscripción preinscrita de "{persona}" con apoderada "{apoderado}" en el curso "{curso}"` | 006 | Con pasos (compuesta) o nativa. |
| `"{persona}" aparece en el pase de lista del curso "{curso}"` | 006 | Sin pasos todavía. |
| `"{persona}" no aparece en el pase de lista del curso "{curso}"` | 006 | Sin pasos todavía. |
| `ELIMINAR las inscripciones, consentimientos y fichas con prefijo "{prefijo}"` | 006 | Candidata a nativa. |

Con las HU-SUITE-007 a 012 aparecerán más frases. Hay que completar este inventario cuando vuelvan al repositorio (sección 10).

La palabra `ELIMINAR` en mayúsculas no es una fase del lenguaje. En v0.1 las limpiezas se escriben como frases normales («elimino las invitaciones con prefijo…»), y las historias se ajustan.

## 10. Alcance del PR #2

### 10.1 Entregables

| Entregable | Ubicación | Requisitos |
|---|---|---|
| Especificación v0.1 (frases base en markdown, semántica de las secciones 4 a 6, versión) | `docs/dsl/especificacion.md` | DSL-01 a DSL-11 |
| Gramática EBNF del `.historia.md` | `docs/dsl/gramatica.ebnf` | DSL-11 |
| JSON Schema del AST, versión `0.1.0` | `docs/dsl/ast.schema.json` | DSL-11 |
| Tipos del AST en TypeScript | `src/lenguaje/` | DSL-11 |
| Tabla de códigos y casos inválidos | `docs/dsl/especificacion.md`, `test/lenguaje/casos/` | DSL-12 |
| Vocabulario `acutis-suite` con las firmas de todas las frases (`parametros`, `produce`, `implementacion`) | `vocabularios/acutis-suite.vocabulario.md` | DSL-07 |
| Las 12 historias del inventario en v0.1 (`dsl: 0.1.0`) | `docs/historias/` | DSL-01 |
| Este documento de diseño | `docs/diseno/semana-02.md` | — |

### 10.2 Lista de tareas

**Historias**
- [ ] Subir las historias de usuario 007 a 012 en `docs/historias/`.
- [ ] Actualizar las 12 historias a `dsl: 0.1.0` y a las frases base de la sección 3.2. Las limpiezas pasan a ser frases normales, en vez de `ELIMINAR`.
- [ ] Completar el inventario de frases (sección 9) con las historias 007 a 012.

**Especificación**
- [ ] Escribir `docs/dsl/especificacion.md` v0.1 a partir de `especificacion-dsl-v1.md`, ajustada a «markdown como fuente».
- [ ] Incluir la semántica de las secciones 4, 5 y 6 y la tabla de códigos de la sección 8.
- [ ] Escribir la gramática EBNF (`docs/dsl/gramatica.ebnf`), partiendo del anexo A del documento técnico.

**AST**
- [ ] Tipos del AST en `src/lenguaje/`: `Historia`, `Escenario`, `Paso` normalizado, `Localizador`, `Ambito`, `Valor` y `Origen`. Solo tipos, sin E/S: tiene que pasar la regla 6.
- [ ] `docs/dsl/ast.schema.json` versión `0.1.0`, con el campo `implementacion` en las firmas de frases (sección 5.4).
- [ ] Convertir los cinco JSON del v1 al AST normalizado y usarlos como ejemplos.
- [ ] Prueba que valide los ejemplos de AST contra el JSON Schema. Necesita un validador de JSON Schema como dependencia de desarrollo; si no se agrega, se deja para la S3.

**Vocabulario y casos**
- [ ] `vocabularios/acutis-suite.vocabulario.md` con las firmas de todas las frases y sus pasos cuando se conocen.
- [ ] Los 16 casos inválidos de la sección 8.1 en `test/lenguaje/casos/invalidos/`, cada uno con su código esperado.
- [ ] Las 12 historias como casos válidos en `test/lenguaje/casos/validos/`, o referenciadas desde `docs/historias/`.

**Revisión del diseño v1**
- [ ] Responder la revisión. Aclarar que existía el vocabulario con 6 frases definidas y 10 pendientes, y el validador de prueba, que no llegaron con el Word.
- [ ] Correcciones de redacción del diseño v1:
  - §8.1, la frase cortada;
  - §9.1, el último párrafo;
  - §4, citar la decisión y su fecha en vez de «la reunión de la semana pasada»;
  - el índice, que incluye el título.

**Cierre**
- [ ] `npm run verificar` en verde.
- [ ] Descripción del PR con la plantilla, `Refs #n` a los issues DSL-01 a DSL-12 y las casillas de especificación marcadas en cada issue.

### 10.3 Fuera del PR #2

- **HU-SUITE-002, acceso directo a la URL de un módulo:** S3, tiene su propio issue.
- **Frases nativas:** solo se deja el espacio en el diseño (sección 5.4); el puerto se construye más adelante.
- **Analizador, validador y CLI `custodio validar`:** S3 (ADR-003).

## 11. Criterios de aceptación de la semana

Del documento técnico, para la S2:

- [ ] La especificación permite escribir **todas** las historias del inventario.
- [ ] Cubre **DSL-01 a DSL-11** en papel.
- [ ] Hay **≥ 12 historias** como casos válidos y **≥ 15 casos inválidos** con su error esperado.
- [ ] La especificación y la gramática están en `docs/dsl/`, y el modelo del AST tipado está en `src/lenguaje/`.

Y la definición de terminado de cada PR: CI verde, pruebas para lo nuevo, sin secretos ni datos personales, documentación al día, descripción con evidencia y requisitos marcados en sus issues.