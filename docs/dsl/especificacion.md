# Especificación del DSL de Custodio — v0.1

- **Versión del lenguaje:** `0.1.0`
- **Estado:** Propuesta (PR #2)
- **Diseño y justificación de cada decisión:** [docs/diseno/semana-02.md](../diseno/semana-02.md)

| Documento | Para qué |
|---|---|
| [`gramatica.ebnf`](gramatica.ebnf) | Gramática formal del `.historia.md` y del `.vocabulario.md` (DSL-11). |
| [`ast.schema.json`](ast.schema.json) | JSON Schema del AST que produce el analizador (§12). |
| [`ejemplos/`](ejemplos/) | AST de cinco historias y del vocabulario, generados desde los `.historia.md`. |
| [`src/lenguaje/ast.ts`](../../src/lenguaje/ast.ts) | Los mismos tipos del AST en TypeScript. |
| [`vocabularios/acutis-suite.vocabulario.md`](../../vocabularios/acutis-suite.vocabulario.md) | Las frases de negocio de la Suite. |
| [`docs/historias/`](../historias/) | Las 12 historias del inventario: los casos válidos. |
| [`test/lenguaje/casos/invalidos/`](../../test/lenguaje/casos/invalidos/) | Los casos inválidos, con su error esperado (§13). |

Esta especificación es **normativa**: dice cómo se escribe una historia y qué significa. El **por qué** de cada decisión, con sus alternativas descartadas, está en el diseño de la semana 2.

## 1. Principios

1. **Documentar antes que probar.** Una historia es primero documentación legible tal cual en GitHub; después es una prueba.
2. **Las personas escriben markdown.** El `.historia.md` es la fuente. El analizador lo convierte en un **AST** (§12), y el compilador convierte el AST en un plan de ejecución (S4).
3. **Independiente de la herramienta.** Ninguna palabra del lenguaje nombra a Playwright ni a otra herramienta (DSL-05).
4. **Ubicar los elementos como una persona.** Por rol accesible, etiqueta o texto visible (DSL-06).
5. **Determinista.** Se espera por condiciones, nunca por tiempo (RNF-04).

## 2. Archivos

| Archivo | Contenido |
|---|---|
| `*.historia.md` | Una o más historias. Cada una empieza con su frontmatter. |
| `*.vocabulario.md` | Un vocabulario de frases de negocio (§10). |

Ambos van en markdown UTF-8 con fin de línea LF y se leen tal cual en GitHub (DSL-01).

## 3. Frontmatter

Cada historia empieza con un bloque YAML entre dos líneas `---`:

```yaml
---
dsl: 0.1.0
id: HU-SUITE-001
producto: suite-parroquial
titulo: La secretaría entra al panel con su contraseña y el código de su app de autenticación
actor: Secretaria parroquial
criticidad: alta
etiquetas: [acceso, segundo-factor, panel]
vocabularios: [acutis-suite]
---
```

| Campo | Obligatorio | Regla | Requisito |
|---|:-:|---|---|
| `dsl` | sí | Versión del lenguaje en semver, sin `v` (§14). | DSL-11 |
| `id` | sí | `HU-<PRODUCTO>-<NNN>`, único en el repositorio. No cambia aunque cambie el título o el archivo. | DSL-02 |
| `producto` | sí | Producto al que pertenece. | DSL-01 |
| `titulo` | sí | Título en lenguaje natural. | DSL-01 |
| `actor` | sí | Quién realiza la historia. | DSL-01 |
| `criticidad` | sí | `alta`, `media` o `baja`. | DSL-01, DSL-15 |
| `etiquetas` | no | Lista de etiquetas en minúsculas con guiones. | DSL-15 |
| `vocabularios` | no | Vocabularios de negocio que importa la historia (§10). | DSL-07 |

## 4. Secciones

Las secciones son títulos `##`. Este es su orden:

| Sección | Obligatoria | Contenido | Requisito |
|---|:-:|---|---|
| `## Historia` | sí | La narrativa: tres líneas que empiezan con `**Como**`, `**Quiero**` y `**Para**`, las tres obligatorias. | DSL-03 |
| `## Antecedentes` | no | Pasos que corren antes de cada escenario, sin fase. | DSL-16 |
| `## Escenario: <nombre>` | sí, al menos uno | Pasos con fase (§5). El nombre es único en la historia. | DSL-04 |
| `## Limpieza` | no | Pasos que corren al terminar cada escenario, sin fase (§11.3). | DSL-10 |

Cualquier otra sección `##`, y cualquier párrafo que no sea un paso, es una **nota**. No se ejecuta, y el formateador la conserva tal cual (DSL-13).

## 5. Fases y pasos

Un paso es un elemento de lista (`- `). Dentro de un escenario, cada paso empieza con su fase en mayúsculas:

| Fase | Uso | Regla |
|---|---|---|
| `DADO` | Preparar el estado inicial. | Puede iniciar un escenario. |
| `CUANDO` | La acción que se prueba. | Puede iniciar un escenario. |
| `ENTONCES` | Lo que se espera ver. | No puede iniciar un escenario. |
| `Y` | Continúa la fase del paso anterior. | No puede iniciar un escenario. |

- Después de la fase se puede escribir `que`: `DADO que inicio sesión…` es igual a `DADO inicio sesión…`.
- Las fases se pueden alternar: `CUANDO` → `ENTONCES` → `CUANDO` → `ENTONCES`.
- En `## Antecedentes`, `## Limpieza` y en las frases de un vocabulario, los pasos **no** llevan fase.

## 6. Frases base

Cada paso es una **frase**: una frase base del lenguaje o una frase de negocio de un vocabulario importado (§10). Primero se buscan las frases base.

| Frase | Acción en el AST |
|---|---|
| ``navego a `https://…` `` | `navegar` a una URL |
| `navego a "Mi parroquia > El equipo"` | `navegar` por un menú: se presiona cada elemento de la ruta, en orden |
| `completo el campo "…" con <valor>` | `completar` |
| `selecciono "…" en el campo "…"` | `seleccionar` |
| `marco la casilla "…"` · `desmarco la casilla "…"` | `marcar` · `desmarcar` |
| `presiono <elemento>` | `presionar` |
| `espero <elemento>` | `esperar` |
| `veo <elemento>` · `no veo <elemento>` | `ver` · `noVer` |
| `veo que la dirección contiene "…"` · `no veo que la dirección contiene "…"` | `ver` · `noVer` sobre la URL actual |
| `capturo el valor del campo "…" como "nombre"` | `capturar` |

Al final de cualquier frase que tenga un elemento se puede agregar un **ámbito** (§8.4).

### 6.1 Elementos

| En el markdown | Localizador del AST | Encuentra |
|---|---|---|
| `el botón "…"` | `boton` | Un botón por su nombre accesible. |
| `el enlace "…"` | `enlace` | Un enlace por su texto. |
| `el campo "…"` | `campo` | Un campo de formulario por su etiqueta. |
| `la casilla "…"` | `casilla` | Una casilla de verificación por su etiqueta. |
| `la opción "…"` | `opcion` | Una opción de radio por su etiqueta. |
| `el título "…"` | `titulo` | Un encabezado. |
| `el texto "…"` · `el mensaje "…"` | `texto` | Cualquier elemento que muestre ese texto. En v0.1, `mensaje` es sinónimo de `texto`. |
| `el elemento con rol "…" y nombre "…"` | `rol` | Cualquier otro rol accesible (por ejemplo `tab`). |
| `el elemento con id de prueba "…"` | `idDePrueba` | **Escape**: advertencia `CUS-W001`. |
| ``el elemento con selector `…` `` | `css` | **Escape**: advertencia `CUS-W001`. |

Con `exactamente` antes del elemento, el texto tiene que coincidir completo (§8.1): `veo exactamente el texto "Activa"`.

### 6.2 Valores

| En el markdown | Valor del AST |
|---|---|
| `"…"` | El texto tal cual, con sus variables (§9). |
| `el código generado con el secreto "${TOTP_…}"` | Generador TOTP (§11.4). |
| `la fecha de hoy` | La fecha del día, del puerto `Reloj`, en formato `DD-MM-AAAA`. |
| `un número único` | Un número que no se repite entre ejecuciones (§9.4). |

## 7. Objetivos que acepta cada acción

| Acción | Objetivos válidos | Valor |
|---|---|---|
| `navegar` | URL o menú | — |
| `completar` | `campo`, `rol` | obligatorio |
| `seleccionar` | `campo`, `rol` | obligatorio: la opción |
| `marcar`, `desmarcar` | `casilla`, `opcion`, `rol` | — |
| `presionar` | cualquier elemento | — |
| `esperar`, `ver`, `noVer` | cualquier elemento, o la URL | — |
| `capturar` | cualquier elemento | obligatorio: el nombre de la captura |

- Un objetivo que la acción no acepta es `CUS-E007`. Un valor obligatorio que falta es `CUS-E008`.
- `ver` y `noVer` sobre la URL significan **«la URL actual contiene»**.
- `capturar` guarda el **valor escrito** si el objetivo es un campo, y el **texto visible** en cualquier otro caso.

## 8. Cómo se encuentran los elementos

Estas reglas son parte del lenguaje y no de cada motor. Todos los adaptadores las cumplen, y la suite de contrato las prueba (RNF-02).

### 8.1 Coincidencia de texto

- **Por defecto**, el elemento **contiene** el texto, sin distinguir mayúsculas y sin contar los espacios repetidos.
- **Las tildes cuentan**: «Si» y «Sí» son textos distintos.
- **Con `exactamente`**, el texto tiene que coincidir completo, con mayúsculas (`"exacto": true` en el AST).

### 8.2 Varias coincidencias

| Acción | Si el objetivo coincide con varios elementos visibles |
|---|---|
| `presionar`, `completar`, `seleccionar`, `marcar`, `desmarcar`, `capturar` | El paso **falla**, con un mensaje que dice cuántos encontró y sugiere usar un ámbito. |
| `ver`, `esperar` | Pasa si al menos uno es visible. |
| `noVer` | Pasa si ninguno es visible. |

No existe «el primero». Para desambiguar se usa un ámbito (§8.4) o `exactamente`.

### 8.3 Fila, sección y diálogo

| En el markdown | Ámbito | Qué es |
|---|---|---|
| `en la fila de "…"` | `fila` | La fila de una tabla (rol *row*) o el elemento de una lista (rol *listitem*) que contiene el texto. |
| `en "…"` | `seccion` | El encabezado con ese texto más todo lo que sigue hasta el próximo encabezado del mismo nivel o superior. También vale una región con ese nombre accesible (rol *region*, *group* o *form*). La página tiene que tener un encabezado real: un texto en negrita no cuenta. |
| `en el aviso "…"` · `en el aviso de confirmación` | `dialogo` | Un cuadro de diálogo (rol *dialog*) por su título; sin título, el que esté abierto. |

### 8.4 Ámbito

El ámbito va al final de la frase y restringe dónde se busca el objetivo:

```markdown
- Y presiono el botón "Revocar" en la fila de "${PREFIJO}revocar@ejemplo.test"
- ENTONCES veo el texto "Catequista" en la fila de "${PREFIJO}catequista@ejemplo.test"
- Y presiono el botón "Aprobar" en el aviso de confirmación
```

**Se puede anidar**, sin límite, y se lee de adentro hacia afuera: `en la fila de "x" en "Invitaciones sin aceptar"` es la fila de x **dentro de** la sección «Invitaciones sin aceptar».

## 9. Valores y variables

### 9.1 Variables

Se escriben `${NOMBRE}`. Hay tres orígenes (DSL-08):

| Origen | Convención | Ejemplo | Se resuelve |
|---|---|---|---|
| **Ambiente** | `MAYÚSCULAS` | `${PARROQUIA}`, `${DOMINIO_PRUEBAS}`, `${USUARIO_secretaria}` | Al ejecutar, desde la configuración del ambiente (SRV-01). |
| **Secreto** | lo declara el ambiente | `${CLAVE_secretaria}`, `${TOTP_secretaria}` | Solo al ejecutar, desde la bóveda (§9.2). |
| **Captura** | `camelCase` | `${linkInvitacion}` | Al ejecutar, con lo que guardó un `capturar` anterior. |

- Una variable que el ambiente no define, o una captura usada antes de hacerse, es `CUS-E011`. Nunca se envía un `${…}` sin resolver a la aplicación.
- Una captura vale en su escenario. Las capturas de los antecedentes valen en todos los escenarios.

### 9.2 Secretos

1. **El ambiente declara qué nombres son secretos**, en un archivo versionado con los nombres y nunca los valores.
2. **Un secreto solo puede ir** en el valor de `completar` o dentro del código generado (TOTP), directamente o como argumento de una frase que lo use ahí. En cualquier otro lugar (un elemento, `ver`, `capturar`, una URL) es `CUS-E013`.
3. **Al ejecutar**, los valores de los secretos se ocultan en todo lo que se guarda o se registra (SRV-06).

`USUARIO_*` es una variable de ambiente y no un secreto: es el correo de una cuenta de prueba, que igual aparece en pantalla. Los secretos de la Suite son `CLAVE_*` y `TOTP_*`.

### 9.3 `${PREFIJO}`

El ejecutor genera un `${PREFIJO}` **único por escenario y por intento**: corto, con letras, números y guiones (por ejemplo `cus7f3a-`). El ambiente no lo define. Todo dato que crea una prueba lleva el prefijo, para que la limpieza lo encuentre (DSL-10).

### 9.4 `un número único`

Para los valores que la aplicación exige únicos, como el número de una partida, en vez de un número fijo que choca entre ejecuciones.

## 10. Frases de negocio y vocabularios

Una frase de negocio agrupa, bajo un nombre del negocio, pasos que se repiten en muchas historias (DSL-07). Se define en un **vocabulario**:

```markdown
---
vocabulario: acutis-suite
dsl: 0.1.0
producto: suite-parroquial
---

## Frase: inicio sesión como "{rol}" en la parroquia "{parroquia}"
- navego a `https://{parroquia}.${DOMINIO_PRUEBAS}/admin`
- completo el campo "Correo" con "${USUARIO_{rol}}"
- …

## Frase: existe una invitación sin aceptar para "{correo}" con rol "{rol}" y guardo su link como "{guardarLinkComo}"
> produce: {guardarLinkComo}
- …

## Frase: elimino las invitaciones con prefijo "{prefijo}"
> implementación: nativa — borrar varias invitaciones necesita repetir pasos.
```

### 10.1 Patrón y parámetros

- El **patrón** es el texto después de `## Frase:`. Sus parámetros se escriben `"{nombre}"`.
- Una historia usa la frase escribiendo el patrón con valores entre comillas en lugar de los parámetros.
- Los parámetros se reemplazan **al compilar**, sobre el AST y no sobre el texto crudo. Las variables `${…}` se resuelven **al ejecutar**.
- Se pueden combinar: `${USUARIO_{rol}}` con `rol = "secretaria"` queda `${USUARIO_secretaria}`. Un parámetro que arma un nombre de variable solo admite letras, números y `_`. Si no, es `CUS-E014`.
- Si a una frase le faltan o le sobran parámetros, es `CUS-E010`. Si no calza con ninguna frase, es `CUS-E006`, con sugerencias tomadas de las frases base y de los vocabularios.

### 10.2 Lo que declara una frase

Debajo del título, en líneas que empiezan con `>`:

| Declaración | Significado |
|---|---|
| `> produce: {param}, …` | Las capturas que la frase deja disponibles. Es obligatorio si la frase captura algo, o si no tiene pasos y lo hará. Si tiene pasos, tiene que coincidir con sus `capturar`. |
| `> implementación: pendiente — motivo` | Se conocen el nombre y los parámetros, pero no los pasos. |
| `> implementación: nativa — motivo` | La implementará un puerto de datos de prueba (API o siembra). |

Sin `implementación`, la frase tiene pasos y tiene que tener al menos uno.

### 10.3 Frases sin pasos

Una frase `pendiente`, o `nativa` mientras no exista su puerto, **es válida**. La historia que la usa, directa o indirectamente, recibe la advertencia `CUS-W004` y **no se ejecuta**: el escenario se informa como `incompleto` (§11.5).

### 10.4 Frases que usan frases

Los pasos de una frase pueden usar otras frases. Una frase que termina usándose a sí misma es `CUS-E012`.

## 11. Semántica de ejecución

Se especifica ahora y se implementa en la S5.

### 11.1 Esperas

Toda acción espera automáticamente a que su objetivo exista y esté listo, hasta un plazo que define el ambiente. No existe una espera por tiempo fijo.

### 11.2 `no veo` necesita un ancla

`no veo` pasa en cuanto el elemento no está, aunque la página no haya terminado de responder. Por eso, entre la última acción que cambia la página (`navegar`, `presionar` o una frase) y un `no veo` tiene que haber un `veo` o un `espero`. Si no, es la advertencia `CUS-W003`.

### 11.3 Limpieza

- Corre **al terminar cada escenario**, haya pasado o fallado, y aunque hayan fallado los antecedentes.
- Es **idempotente**: no falla si no encuentra nada que borrar.
- Sus fallos se informan aparte (`limpieza_fallida`) y no ocultan el resultado del escenario (DSL-10).

### 11.4 Segundo factor (TOTP)

El código se calcula desde el secreto en el momento de escribirlo (DSL-09). Si quedan menos de 5 segundos de la ventana (configurable en el ambiente), o si ese código ya se usó con el mismo secreto, el generador espera a la ventana siguiente: a lo más 30 segundos, con el puerto `Reloj`.

### 11.5 Escenario `incompleto`

Un escenario que usa una frase sin pasos no se ejecuta y se informa como `incompleto`. En CI, una historia crítica `incompleto` cuenta como falla.

## 12. AST

El analizador convierte cada archivo en un AST con la forma de [`ast.schema.json`](ast.schema.json) (versión `0.1.0`). Los mismos tipos están en [`src/lenguaje/ast.ts`](../../src/lenguaje/ast.ts).

Cada paso queda **normalizado**, siempre con las mismas claves:

```json
{
  "fase": "y",
  "accion": "presionar",
  "objetivo": { "por": "boton", "texto": "Revocar" },
  "ambito": { "por": "fila", "texto": "${PREFIJO}revocar@ejemplo.test", "ambito": null },
  "valor": null,
  "origen": { "linea": 34, "columna": 3 }
}
```

| Clave | Contenido |
|---|---|
| `fase` | `dado`, `cuando`, `entonces` o `y`; `null` en antecedentes, limpieza y vocabularios. |
| `accion` | Una de las acciones de §6, o `frase`. |
| `objetivo` | Un localizador (§6.1), `{ "por": "url" }`, `{ "por": "menu", "ruta": […] }` o, en una frase, `{ "por": "frase", "vocabulario", "nombre", "argumentos" }`. |
| `ambito` | El ámbito anidado, o `null`. |
| `valor` | `{ "tipo": "texto" \| "totp" \| "fecha" \| "unico" \| "captura", … }`, o `null`. |
| `origen` | Línea y columna en el archivo fuente, para los diagnósticos (DSL-12). |

El Schema exige lo de §7: por ejemplo, rechaza un `completar` con un `boton` como objetivo o sin `valor`. En [`ejemplos/`](ejemplos/) hay AST de las historias [HU-SUITE-001](ejemplos/HU-SUITE-001.ast.json), [002](ejemplos/HU-SUITE-002.ast.json), [003](ejemplos/HU-SUITE-003.ast.json), [005](ejemplos/HU-SUITE-005.ast.json) y [006](ejemplos/HU-SUITE-006.ast.json), y del [vocabulario](ejemplos/acutis-suite.vocabulario.ast.json).

## 13. Diagnósticos

El validador informa **todos** los problemas del archivo, no solo el primero. Cada diagnóstico trae su código estable, el archivo, la línea, la columna, un mensaje en español y, cuando puede, una sugerencia (DSL-12). Los errores (`CUS-E`) impiden ejecutar; las advertencias (`CUS-W`) no.

Tabla provisoria para v0.1:

| Código | Problema | Requisito |
|---|---|---|
| `CUS-E001` | Falta el frontmatter o su YAML es inválido. | DSL-01 |
| `CUS-E002` | Falta un campo obligatorio del frontmatter. | DSL-01 |
| `CUS-E003` | El `id` tiene un formato inválido o está repetido. | DSL-02 |
| `CUS-E004` | Falta la narrativa o una de sus partes. | DSL-03 |
| `CUS-E005` | Escenario mal formado: sin pasos, empieza con `Y` o `ENTONCES`, o la fase no está en mayúsculas. | DSL-04 |
| `CUS-E006` | Frase desconocida: no calza con ninguna frase base ni del vocabulario. | DSL-05, DSL-07 |
| `CUS-E007` | La acción no acepta ese objetivo. | DSL-05 |
| `CUS-E008` | Falta un valor obligatorio. | DSL-05 |
| `CUS-E009` | El vocabulario importado no existe. | DSL-07 |
| `CUS-E010` | A una frase de negocio le faltan o le sobran parámetros. | DSL-07 |
| `CUS-E011` | Variable no definida, captura usada antes de hacerse, o `produce` que no coincide con las capturas de la frase. | DSL-08 |
| `CUS-E012` | Referencia circular entre frases. | DSL-07 |
| `CUS-E013` | Secreto en un lugar no permitido. | DSL-08 |
| `CUS-E014` | Nombre de variable inválido después de sustituir parámetros. | DSL-07, DSL-08 |
| `CUS-E015` | Versión `dsl:` mal escrita o no soportada. | DSL-11 |
| `CUS-E016` | Dos escenarios con el mismo nombre. | DSL-04 |
| `CUS-W001` | Elemento ubicado con un escape (`id de prueba` o `selector`): deuda de accesibilidad. | DSL-06 |
| `CUS-W002` | Escenario sin ninguna verificación. | DSL-04 |
| `CUS-W003` | `no veo` sin ancla (§11.2). | DSL-05 |
| `CUS-W004` | La historia usa una frase sin pasos: no se puede ejecutar todavía. | DSL-07 |

Que un objetivo coincida con varios elementos (§8.2) no es un código `CUS`: se sabe al ejecutar y se informa como fallo del paso.

**Casos inválidos.** En [`test/lenguaje/casos/invalidos/`](../../test/lenguaje/casos/invalidos/) hay al menos un caso por cada código de error (17 casos: `CUS-E005` tiene dos, un escenario que empieza con `Y` y uno sin pasos). [`esperados.json`](../../test/lenguaje/casos/invalidos/esperados.json) dice qué error tiene que informar cada uno. La prueba `test/lenguaje/casos.test.ts` comprueba que cada código de esta tabla tenga su caso.

## 14. Versiones

- El lenguaje se versiona con **semver**, sin `v`: `MAYOR.MENOR.PARCHE`.
- Mientras la versión sea `0.x`, cualquier versión menor puede traer cambios incompatibles. Desde `1.0.0`, solo la versión mayor.
- El campo `dsl:` de cada historia y vocabulario dice con qué versión se escribió. Una versión mal escrita o que el validador no soporta es `CUS-E015`.
- La especificación, la gramática, el JSON Schema y el vocabulario `acutis-suite` comparten la versión `0.1.0`.

## 15. Lo que todavía no sabemos

| Pregunta | Cuándo se decide |
|---|---|
| ¿Dónde viven las historias: `historias/` en la raíz, como propone el documento técnico, o `docs/historias/`? | Reunión de diseño. |
| Si una oración calza con frases de dos vocabularios importados, ¿es un error de los vocabularios o gana uno? | S4, con la resolución de vocabularios. |
| ¿`mensaje` puede ser un localizador propio (rol *status* o *alert*), si la Suite marca así sus confirmaciones? | Al revisar la Suite. |
| ¿Cuentas de prueba por trabajador, o un bloqueo por cuenta? Afecta el TOTP en paralelo. | S6, con la cola. |
| ¿`incompleto` se agrega como estado de una ejecución en SRV-04? | Reunión de diseño. |
| Los escenarios con ejemplos (DSL-17). | Si sobra tiempo (PODRÍA). |

## 16. Cobertura de requisitos

| Requisito | Dónde |
|---|---|
| DSL-01 Formato | §2, §3 |
| DSL-02 Identidad | §3 (`id`) |
| DSL-03 Narrativa | §4 |
| DSL-04 Escenarios y fases | §4, §5 |
| DSL-05 Vocabulario base | §6, §7 |
| DSL-06 Localización semántica | §6.1, §8 |
| DSL-07 Vocabulario de negocio | §10 |
| DSL-08 Variables | §9 |
| DSL-09 Segundo factor | §6.2, §11.4 |
| DSL-10 Limpieza | §4, §9.3, §11.3 |
| DSL-11 Gramática y versión | [`gramatica.ebnf`](gramatica.ebnf), §14 |
| DSL-12 Diagnósticos | §13 |
| DSL-13 Formateador | §4 (notas). Las reglas de formato se definen en la S4. |
| DSL-14 Plan neutral | §12 (el AST); el plan se define en la S4. |
| DSL-15 Selección | §3 (`id`, `producto`, `criticidad`, `etiquetas`) |
| DSL-16 Antecedentes | §4 |
| DSL-17 Escenarios con ejemplos | §15 (pendiente) |
| DSL-18 Soporte de editor | El JSON Schema y la gramática son la base; se aborda si sobra tiempo. |
