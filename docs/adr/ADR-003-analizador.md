# ADR-003: Analizador del DSL escrito a mano

- **Estado:** Aceptado
- **Fecha:** 2026-11-11

## Contexto

El analizador lee los `.historia.md` y los `.vocabulario.md` y produce el AST de [`ast.schema.json`](../dsl/ast.schema.json), con los diagnósticos de la [especificación](../dsl/especificacion.md) (§13). El documento técnico (sección 9) deja la decisión abierta: descenso recursivo escrito a mano, que recomienda por la calidad de los mensajes, o un generador (Ohm, Chevrotain, Peggy) justificado.

El diseño completo está en [`docs/diseno/semana-03.md`](../diseno/semana-03.md), aprobado el 11 de noviembre.

### Lo que sabemos

- **El formato es por líneas.** Cada construcción del DSL ocupa una línea completa: el frontmatter, los títulos `##`, la narrativa y cada paso. La estructura de un archivo es una secuencia de líneas, no un árbol de expresiones.
- **Los mensajes son el producto.** DSL-12 pide código, línea, columna, mensaje en español y sugerencia, y que el validador informe todos los errores y no solo el primero.
- **`lenguaje/` no puede importar librerías externas.** La regla 6 de [ADR-002](ADR-002-arquitectura.md) se verifica con `r6-lenguaje-sin-es`, y `LIBRERIAS_PURAS` está vacía en [`.dependency-cruiser.cjs`](../../.dependency-cruiser.cjs).
- **El lenguaje es chico:** 8 frases base, 4 secciones, 3 tipos de archivo y un frontmatter de 8 campos.

## Decisión

**Descenso recursivo escrito a mano, en TypeScript, sin dependencias**, en tres niveles:

1. **Líneas:** cada línea se clasifica sola (`delimitador`, `titulo`, `narrativa`, `paso`, `declaracion`, `blanco`, `texto`). Este nivel nunca falla.
2. **Estructura:** una función por regla de la gramática EBNF recorre las líneas y arma el frontmatter y las secciones.
3. **Frases:** cada paso se parte en tokens (palabras, cadenas y código) y se reconoce como frase base o como frase de negocio de un vocabulario importado.

El frontmatter se lee con un **subconjunto de YAML escrito a mano**, el que define la gramática: `clave: valor` y listas `[a, b]`. Lo que se salga de él es `CUS-E001`.

### Alternativas consideradas

| Alternativa | Por qué no |
|---|---|
| **Chevrotain** | Piensa en tokens, no en líneas, y el texto libre en español de las frases se tokeniza mal. Obliga a abrir `LIBRERIAS_PURAS`. |
| **Ohm** | La gramática quedaría parecida a la EBNF, pero los errores son «Expected …» sin control fino, y su manejo implícito de espacios y saltos de línea pelea con un formato por líneas. |
| **Peggy** | Agrega un paso de generación del analizador, y sus errores también habría que reescribirlos. Mismo problema de dependencias. |
| **remark o micromark, más un analizador propio para las frases** | CommonMark normaliza justo lo que el DSL distingue (junta `**Como**`, `**Quiero**` y `**Para**` en un párrafo y trata las listas con reglas propias), y es una dependencia grande dentro de un módulo puro. |
| **Expresiones regulares por frase**, como el analizador de prueba de la semana 2 | No dan columnas precisas ni distinguen «casi calza» de «no calza», que es lo que necesitan `CUS-E007`, `CUS-E008` y las sugerencias. |

## Consecuencias

**Lo bueno**

- Cada punto de falla sabe qué intentaba leer, así que los mensajes dicen qué falta y dónde: «A «completo» le falta el valor: completo el campo "…" con "…"».
- La recuperación de errores es simple: cada línea y cada paso se analizan solos, y cada sección termina en el próximo título `##`. Un error no arrastra al resto del archivo.
- `lenguaje/` sigue sin dependencias, así que la misma función sirve para la CLI, el workflow de GitHub Actions y, a futuro, un editor (DSL-18).

**Lo que hay que tener presente**

- El analizador es código propio que mantener, y la gramática EBNF puede desincronizarse de él. Lo cuidan las pruebas por regla, los 20 casos inválidos y los ejemplos del AST como salida esperada.
- El frontmatter no es YAML completo: algo que YAML aceptaría, como un valor en varias líneas, aquí es `CUS-E001`. Es a propósito, para que el formato sea predecible.
- **La CLI corre como TypeScript sin compilar.** Node 24 quita los tipos al ejecutar, y `erasableSyntaxOnly` en `tsconfig.json` asegura que no haya sintaxis que no sepa quitar. Funciona mientras Custodio se ejecute desde su propio repositorio: Node no quita los tipos de los archivos dentro de `node_modules`. Si algún día se distribuye como paquete de npm, va a hacer falta compilar.
- **En npm existe un paquete ajeno llamado `custodio`.** Fuera del repositorio, `npx custodio` lo descargaría. Por eso CI usa `npm run validar` y el README, `npx --no-install custodio`.
- Si el analizador se vuelve inmanejable, la decisión se revisa con un ADR nuevo. La API pública de `lenguaje` (`analizar`) no cambia.
