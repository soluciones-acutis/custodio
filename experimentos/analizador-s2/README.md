# Analizador de prueba de la semana 2

**No es el analizador de la S3 y no va a `main`.** Es el script con el que se comprobó, durante la semana 2, que la [especificación v0.1](../../docs/dsl/especificacion.md) permite escribir las 12 historias del inventario y que cada caso inválido informa su error y ningún otro. Queda en esta rama para que la evidencia del PR #16 se pueda reproducir y como punto de partida para la S3.

## Qué hace

- Lee los `.historia.md`, los `.vocabulario.md` y el `.ambiente.md`.
- Produce el AST normalizado de [`docs/dsl/ast.schema.json`](../../docs/dsl/ast.schema.json). Los ejemplos de `docs/dsl/ejemplos/` salieron de aquí.
- Informa los diagnósticos de la tabla de códigos (§13): `CUS-E001` a `CUS-E017` y `CUS-W002` a `CUS-W005`.

No cubre todo: por ejemplo, no revisa `CUS-W001` (escapes) ni la gramática al pie de la letra. Para eso está la S3.

## Uso

Con Python 3.10 o más nuevo, sin dependencias, desde la raíz del repositorio:

```bash
python experimentos/analizador-s2/verificar_casos.py .
```

Corre los 19 casos inválidos y las 12 historias. Tiene que terminar con `0 fallos`.

```bash
python experimentos/analizador-s2/prototipo_analizador.py --ambiente ambientes/suite-pruebas.ambiente.md --vocabulario vocabularios/acutis-suite.vocabulario.md historias/HU-SUITE-003.historia.md
```

Analiza historias sueltas. Con `--ast-salida CARPETA` escribe su AST en JSON, y con `--json` imprime los diagnósticos en JSON.
