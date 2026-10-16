# ADR-002: Arquitectura hexagonal organizada por propósito

- **Estado:** Propuesto
- **Fecha:** 2026-10-06

## Contexto

El objetivo central de Custodio es que una historia escrita en el DSL no sepa con qué herramienta se va a ejecutar. Hoy se ejecuta con Playwright, mañana quizás con otro, y en las pruebas unitarias con un motor simulado, sin cambiar una sola línea de la historia.

Necesitamos una arquitectura que resuelva dos cosas distintas:

1. **Hacia dónde apuntan las dependencias**, para que el núcleo no conozca a Playwright, Fastify ni PostgreSQL.
2. **Cómo se ve el repositorio**, para que alguien que lo abre por primera vez entienda de qué se trata el sistema sin leer código.

### Lo que sabemos

- **La independencia de la herramienta es obligatoria y se va a medir.** OE3 y RNF-02 piden que la misma suite de contrato apruebe con al menos dos adaptadores de motor (Playwright y el simulado; la meta es un segundo motor real).
- **Las seis reglas de dependencia de la sección 8 son obligatorias** y tienen que verificarse en CI (RNF-01).
- **Los puertos mínimos ya están definidos** en la sección 8.1 del documento técnico.
- **El antecedente interno falló justo en esto.** UserStory Monitor ligaba cada verbo del lenguaje a una llamada de Playwright y se organizaba por capas técnicas. Custodio recoge sus lecciones, pero no su estructura.
- **El sistema tiene que quedar mantenible por el equipo de Acutis** después de diciembre: nombres en español y una estructura que se entienda sin explicación.

### Lo que todavía no sabemos

| Pregunta | Cuándo se decide |
|---|---|
| La forma final de cada puerto: qué métodos, qué errores y qué tipos exactos. Hoy solo está la responsabilidad de cada uno. | `MotorDeNavegador`, `AlmacenDeEvidencias`, `BovedaDeSecretos`, `Reloj` y `GeneradorDeIds` en la S5; `ColaDeEjecuciones` y `RepositorioDeHistorias` en la S6. |
| Qué puertos faltan. Los resultados por paso (SRV-06), los ambientes (SRV-01) y los tokens de API (SRV-11) se tienen que guardar en algún lado, y la sección 8.1 no tiene puerto para eso. | S6, con el modelo de datos. |
| Si la cola y el registro de resultados son un solo puerto o dos. Comparten base y transacción (ADR-001), pero son responsabilidades distintas. | S6. |
| Si `ambientes` necesita las tres capas o queda como un módulo chico. | S6, cuando tenga código. |
| Cómo se guardan y publican los informes: si basta con devolver el texto o se guardan como evidencia. | S7, con el formato de informes. |
| Si la inyección de dependencias a mano en `arranque/` sigue siendo cómoda cuando haya tres entradas y siete o más puertos. | Se revisa en la S6. |

Este ADR decide la **forma** de la arquitectura. Lo que está en la tabla se completa en el ADR o en el diseño de la semana que corresponda, sin cambiar las reglas de aquí.

## Decisión

Usamos **arquitectura hexagonal** para lo primero y **screaming architecture** para lo segundo. Son ideas que se complementan bien: la hexagonal define las reglas, la organización por propósito define dónde vive cada cosa.

### Cómo se ve el repositorio

Al abrir `src/` tiene que "gritar" historias, lenguaje y ejecuciones, no detalles técnicos:

```
src/
├─ lenguaje/      ← el DSL: texto → AST → validación → plan
├─ historias/     ← registrar y versionar historias
├─ ejecuciones/   ← correr planes y guardar resultados
├─ ambientes/     ← productos, ambientes, variables y secretos
├─ informes/      ← convertir resultados en JSON, JUnit y HTML
├─ compartido/    ← solo tipos base (Reloj, GeneradorDeIds, Resultado…)
└─ arranque/      ← http, cli y trabajador: donde se arma todo
```

Cada módulo tiene una estructura según lo que hace:

| Módulo | Qué contiene | Estructura | Por qué |
|---|---|---|---|
| `lenguaje` | Analizador, validador, formateador y compilador del DSL; el AST y los tipos del plan. | Plano | Son funciones puras sin E/S (regla 6). No tiene puertos ni adaptadores, así que las capas solo agregarían carpetas. |
| `historias` | Registro de historias y su historial de versiones (SRV-02). | `dominio/`, `aplicacion/`, `infraestructura/postgres/` | Tiene reglas de negocio y necesita persistencia. |
| `ejecuciones` | Ejecutor del plan, estados de una ejecución, cola, evidencias y limpieza (SRV-04 a SRV-09). | `dominio/`, `aplicacion/`, `infraestructura/motores/{playwright,alternativo,simulado}/` | Es el centro del hexágono: aquí viven los motores. |
| `ambientes` | Productos, ambientes, variables y referencias a secretos (SRV-01). | `dominio/`, `aplicacion/`, `infraestructura/` | Necesita persistencia y la bóveda de secretos. |
| `informes` | Ver abajo. | Plano | Ver abajo. |
| `compartido` | Tipos base que usan varios módulos. | Plano | Ver «Dominios aislados y `compartido`». |
| `arranque` | Las entradas `http/`, `cli/` y `trabajador/`, y el armado de dependencias. | Una carpeta por entrada | Es la raíz de composición (regla 5). |

#### Qué es `informes`

`informes` **convierte el resultado de una ejecución en documentos para tres públicos distintos** (SRV-07):

- **JSON**, para la API y para otras herramientas.
- **JUnit XML**, para que GitHub Actions muestre el resultado en el PR (SRV-13).
- **HTML**, para personas no técnicas: la narrativa de la historia (Como / Quiero / Para), cada paso con su estado y las capturas de los fallos.

No ejecuta nada, no guarda nada y no decide nada sobre el resultado. Recibe los resultados ya calculados y devuelve texto. Por eso es **plano, como `lenguaje`**: funciones del tipo `resultado → texto`, sin puertos propios. Los datos los obtiene por la API pública de `ejecuciones` (y de `historias` para la narrativa), nunca de sus capas internas (regla 4). Quien lo usa decide qué hacer con el texto: la CLI lo escribe en un archivo, la API lo devuelve en la respuesta.

**Lo que no sabemos de `informes`:** si el HTML necesitará una librería de plantillas (que entraría por `LIBRERIAS_PURAS`) y si los informes se guardan como evidencia. Se decide en la S7. Hoy `informes` no tiene una regla propia en `dependency-cruiser`, porque no hay código. Si se confirma que es puro, la regla se agrega cuando llegue su primer código.

### Las reglas

Estas reglas vienen de la sección 8 del documento técnico, más una propia de este ADR (la 7). Las repito acá con una frase sobre por qué existe cada una, porque una regla que no se entiende termina saltándose:

| # | Regla | Por qué existe |
|---|---|---|
| 1 | `*/dominio` no importa infraestructura ni librerías de E/S (Fastify, `pg`, Playwright…). | El dominio es lo que más vale y lo que menos debería cambiar. Si depende de una librería, cambia cada vez que la librería cambia. |
| 2 | `*/aplicacion` depende solo de su dominio y de puertos que ella misma declara. | El caso de uso dice qué necesita ("un motor que sepa navegar"), no cómo se consigue. |
| 3 | `*/infraestructura` implementa puertos; ningún módulo importa la infraestructura de otro. | Evita que el adaptador de PostgreSQL de `historias` termine usándose a escondidas desde `ejecuciones`. |
| 4 | Un módulo usa a otro solo por su API pública (`index.ts`). | Cada módulo puede reorganizarse por dentro sin romper a los demás. |
| 5 | Solo `arranque/` conoce implementaciones concretas y las inyecta. | Hay un único lugar donde se decide "en este ambiente se usa Playwright". Es lo que hace posible SRV-08. |
| 6 | `lenguaje/` son funciones puras, sin E/S. | Así el mismo validador sirve para la CLI, el servicio web y, a futuro, una extensión de VS Code (DSL-18). |
| 7 | **Los dominios no se tocan entre sí:** el dominio de un módulo no importa nada de otro módulo, ni siquiera su `index.ts`. Solo su propio dominio y `compartido/index.ts`. | La regla 4 deja que un dominio use la API pública de otro, y eso basta para que dos dominios queden acoplados. Ver la sección siguiente. |

Las siete se verifican en CI con [`dependency-cruiser`](https://github.com/sverweij/dependency-cruiser):

- **Configuración:** [`.dependency-cruiser.cjs`](../../.dependency-cruiser.cjs). Cada regla tiene nombre propio (`r1-…` a `r7-…`), así un error en CI apunta directo a la regla rota. Se suman cinco reglas de limpieza: `compartido` solo con tipos base, sin ciclos, sin importaciones sin resolver, sin dependencias de desarrollo en `src/` y sin paquetes que no estén en `package.json`.
- **Pruebas de las reglas:** [`test/arquitectura/reglas.test.ts`](../../test/arquitectura/reglas.test.ts) comprueba que cada regla se active con una violación de ejemplo, para que la configuración no pueda quedar desactivada sin que se note.
- **Workflow:** [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml), job «Arquitectura».

Cambiar o agregar una regla es una decisión de arquitectura: se propone en un ADR y el PR agrega su caso en las pruebas.

### Dominios aislados y `compartido`

**Dónde colaboran los módulos.** En la **capa de aplicación**, y siempre por la API pública del otro módulo. Por ejemplo, `ejecuciones/aplicacion` puede pedirle a `historias` (por su `index.ts`) la historia que tiene que ejecutar. `ejecuciones/dominio` no sabe que `historias` existe.

**Qué hacer cuando dos dominios necesitan "lo mismo".** Es la pregunta que más va a aparecer, y la respuesta casi nunca es importar. En este orden:

1. **Referenciar por identidad, no por objeto.** Una `Ejecucion` guarda el `id` de la historia (`HU-SUITE-012`) y el hash de la versión que corrió, no un objeto `Historia`. Si `historias` cambia su modelo, las ejecuciones pasadas no se rompen. Además es justo lo que pide DSL-02: el id es la clave estable para trazar resultados en el tiempo.
2. **Preguntarse si de verdad es el mismo concepto.** Para `historias`, una historia es texto fuente con versiones; para `ejecuciones`, es «lo que se corrió y con qué resultado». Se llaman igual, pero cambian por razones distintas. Cada dominio tiene su propio modelo y la capa de aplicación traduce entre ellos.
3. **Si es un tipo de valor pequeño, se acepta duplicarlo.** Preferimos duplicar un tipo de tres campos a acoplar dos dominios. La duplicación se ve y se puede corregir; el acoplamiento se esconde y crece.
4. **Solo si es un tipo base de verdad, va a `compartido/`** (criterios abajo).

**Qué puede ir en `compartido/`.** Algo entra solo si cumple **las tres** condiciones:

- lo usan dos o más módulos;
- no tiene reglas de negocio de ninguno de ellos;
- es estable: no debería cambiar cuando cambia un módulo.

| Sí va en `compartido/` | No va en `compartido/` (y dónde va) |
|---|---|
| Los puertos `Reloj` y `GeneradorDeIds` | `Historia`, `Version` → `historias` |
| `Resultado<T, E>` para devolver éxito o error sin excepciones | `Ejecucion`, `EstadoDeEjecucion`, `ResultadoDePaso` → `ejecuciones` |
| Tipos de identificador (`IdDeHistoria`, `IdDeEjecucion`) | `Ambiente`, `ReferenciaDeSecreto` → `ambientes` |
| | `Localizador`, `Plan`, `Instruccion` → `lenguaje` (son parte del plan) |

**Reglas de `compartido/`**, verificadas en CI:

- No depende de ningún otro módulo ni de librerías externas, incluidos los módulos de Node (`compartido-solo-tipos-base`).
- Contiene tipos, interfaces y, como mucho, funciones triviales sin E/S. No contiene implementaciones de sus puertos: el reloj del sistema y el generador real de ids se arman en `arranque/`, y los de prueba viven en `test/`.
- Se usa solo por su `index.ts` (reglas 4 y 7).

Si algo "se usa en dos lados" pero tiene reglas de negocio, le pertenece a uno de los dos módulos y el otro lo consume por su `index.ts`, desde la capa de aplicación.

### El plan

El **plan de ejecución** es el único contrato entre `lenguaje` y `ejecuciones`. `lenguaje` lo produce, `ejecuciones` lo consume, y el plan es JSON neutral.

Eso significa que `ejecuciones` depende de los *tipos* del plan que exporta `lenguaje/index.ts`, pero nunca del analizador ni del validador. Esa dependencia está en la **capa de aplicación** (el caso de uso `EjecutarPlan` y el puerto `MotorDeNavegador`), no en el dominio (regla 7). En la otra dirección, `lenguaje` no tiene idea de que existen motores. Si mañana cambia cómo se escribe una frase en el DSL, el plan puede quedar igual y el motor ni se entera; si cambia el motor, el lenguaje tampoco.

### Puertos

Un **puerto** es una interfaz que el núcleo define según lo que necesita. Un **adaptador** es la implementación concreta que traduce ese puerto a una tecnología. Hay dos tipos.

#### Puertos de entrada: los casos de uso

Son lo que un módulo ofrece hacia afuera: sus casos de uso, exportados en su `index.ts` (por ejemplo `ValidarHistoria`, `RegistrarHistoria`, `EjecutarPlan`). Los **adaptadores de entrada** son las tres entradas de `arranque/` (la API HTTP con Fastify, la CLI `custodio` y el trabajador de la cola) y GitHub Actions, que usa la CLI o la API. Todos llaman a los mismos casos de uso, así que no hay lógica duplicada entre ellos (SRV-12).

#### Puertos de salida: lo que el núcleo necesita del mundo

Son las interfaces de la sección 8.1 del documento técnico. Cada una la **declara la capa de aplicación del módulo que la necesita**, en `src/<modulo>/aplicacion/puertos/`. `Reloj` y `GeneradorDeIds` son la excepción: los usan varios módulos y viven en `compartido/`.

| Puerto | Declarado en | Lo que el núcleo necesita | Adaptadores previstos | Semana |
|---|---|---|---|---|
| `MotorDeNavegador` | `ejecuciones/aplicacion/puertos/` | Abrir una sesión aislada de Chromium y ejecutar las instrucciones del plan: navegar, completar, presionar, esperar, verificar, capturar pantalla y cerrar. | Playwright; motor alternativo (ADR-004); motor simulado para pruebas. | S5 (alternativo en S7) |
| `AlmacenDeEvidencias` | `ejecuciones/aplicacion/puertos/` | Guardar capturas y trazas y devolver una referencia estable. | Disco local; S3 a futuro; en memoria para pruebas. | S5 |
| `ColaDeEjecuciones` | `ejecuciones/aplicacion/puertos/` | Encolar, tomar con arriendo, renovar el latido, cerrar y recuperar las ejecuciones huérfanas. | PostgreSQL con `FOR UPDATE SKIP LOCKED` (ADR-001); en memoria para pruebas. | S6 |
| `RepositorioDeHistorias` | `historias/aplicacion/puertos/` | Guardar y recuperar historias y sus versiones. | PostgreSQL; en memoria para pruebas. | S6 |
| `BovedaDeSecretos` | `ambientes/aplicacion/puertos/` | Resolver una referencia de secreto a su valor, solo al momento de ejecutar. | Variables de entorno; un gestor de secretos a futuro. | S5 |
| `Reloj` | `compartido/` | Saber la hora de forma testeable: plazos, latido de la cola y códigos TOTP. | Reloj del sistema; reloj fijo para pruebas. | S5 |
| `GeneradorDeIds` | `compartido/` | Generar identificadores de forma testeable. | `crypto.randomUUID`; secuencia predecible para pruebas. | S5 |

Puertos probables que todavía no se definen (ver «Lo que todavía no sabemos»): un repositorio de ejecuciones y sus resultados por paso (SRV-06), uno de ambientes (SRV-01), uno de tokens de API (SRV-11) y un `Notificador` (SRV-18, PODRÍA).

#### Reglas de los puertos

- **Se escriben en el idioma de quien los necesita**, no en el de la herramienta que los implementa. `MotorDeNavegador` habla de `navegar`, `completar` y `presionar` con un `Localizador` propio (por rol, etiqueta o texto), no de `page.getByRole()`. Si una interfaz empieza a parecerse a la API de Playwright, es señal de que el diseño se está torciendo.
- **Ninguna firma de un puerto menciona un tipo de una librería.** Ni `Page`, ni `PoolClient`, ni `FastifyRequest`. Esto lo garantizan las reglas 1 y 2, porque un puerto que importara esos tipos violaría `r2-aplicacion-sin-librerias-de-es`.
- **Cada puerto tiene un adaptador de prueba**, en memoria o simulado, para que el núcleo se pruebe sin navegador ni base de datos.
- **Los puertos con más de un adaptador real tienen una suite de contrato** en `test/contrato/` que corre idéntica contra cada adaptador. `MotorDeNavegador` es el primero (RNF-02).
- **El adaptador vive en `infraestructura/` del mismo módulo** que declara el puerto, y solo `arranque/` lo conecta (reglas 3 y 5).

### Alternativas consideradas

- **Capas técnicas** (`controllers/`, `services/`, `models/`): es como estaba organizado UserStory Monitor. Al abrir el repositorio no dice de qué trata el sistema, y la herramienta termina filtrándose a todas las capas. Descartada.
- **Hexagonal con capas globales** (`src/dominio/`, `src/aplicacion/`, `src/infraestructura/` para todo el sistema): respeta la dirección de las dependencias, pero mezcla en una misma carpeta el dominio de historias, ejecuciones y ambientes, y no deja ver los límites entre módulos. Descartada.
- **Organización por propósito sin reglas automáticas**: más simple, pero las reglas dependerían de la buena voluntad y de la revisión manual. RNF-01 lo descarta explícitamente.

## Consecuencias

**Lo bueno**

- El núcleo se puede probar completo con el motor simulado y repositorios en memoria, sin navegador ni base de datos. Las pruebas unitarias van a ser rápidas y deterministas.
- La independencia de la herramienta deja de ser una intención y pasa a ser algo comprobable: la misma suite de contrato corre contra cada adaptador (RNF-02).
- Cambiar una tecnología es cambiar un adaptador: otro motor, otra cola u otro almacén de evidencias se agregan en `infraestructura/` y se registran en `arranque/`, sin tocar el núcleo.
- La CLI, el API y el trabajador son solo adaptadores de entrada distintos sobre los mismos casos de uso (SRV-12). No hay lógica duplicada entre ellos.
- Como los dominios no se tocan entre sí, un cambio en el modelo de un módulo no se propaga a los demás, y un módulo se puede entender leyendo solo su carpeta.
- Alguien nuevo en el equipo puede orientarse leyendo los nombres de las carpetas.

**Lo que cuesta**

- Hay más archivos e interfaces de las que tendría una versión "rápida". Para un caso de uso simple puede sentirse como ceremonia; es el precio de que los casos complejos se mantengan ordenados.
- Cada puerto se paga dos o tres veces: la interfaz, el adaptador real y el de prueba, más la suite de contrato cuando hay más de un adaptador real. Por eso solo se crea un puerto cuando el núcleo de verdad necesita algo del mundo exterior.
- Aislar los dominios obliga a **traducir entre modelos** en la capa de aplicación y, a veces, a **duplicar tipos pequeños**. Es una duplicación consciente: se prefiere a que dos dominios cambien juntos.
- La inyección de dependencias se hace a mano en `arranque/`, sin contenedor. Es más explícito y fácil de seguir, pero ese archivo va a crecer y hay que mantenerlo ordenado.
- `compartido/` corre el riesgo de convertirse en el cajón de los cachureos. Los criterios de arriba y la regla `compartido-solo-tipos-base` existen para evitarlo.
- Las reglas de `dependency-cruiser` van a molestar al principio. Eso es bueno: cada vez que una regla se queje, o el código está en el lugar equivocado o la regla necesita una conversación el martes.

### Cómo sabremos que funcionó

**Agregar un tercer motor tiene que requerir solo una carpeta nueva en `ejecuciones/infraestructura/motores/`, pasar la suite de contrato y registrarlo en `arranque/`.** Si para lograrlo hay que tocar el lenguaje, el dominio o las historias, la arquitectura falló.
