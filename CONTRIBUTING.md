# Cómo contribuir a Custodio

Esta guía resume cómo se trabaja en el
repositorio: ramas, commits, Pull Requests, revisiones automáticas y las reglas
que hay que respetar por ser un repositorio público.

## Antes de empezar

- **Node.js 24** (ver `.nvmrc`) y **npm**.
- Instalar las dependencias exactas del `package-lock.json`:

```bash
npm install
```

- Leer los ADR en [`docs/adr/`](docs/adr/), sobre todo el
  [ADR-002](docs/adr/ADR-002-arquitectura.md), que define cómo se organiza el código.

## Flujo de trabajo

1. **Un issue por requisito.** Cada requisito del documento técnico (`DSL-xx`,
   `SRV-xx`, `RNF-xx`) es un issue con su semana. Las ideas que no son de la
   semana actual van a un issue con la plantilla *Idea para el futuro* (etiqueta
   `futuro`), no al PR en curso.
2. **Una rama por semana**, con el formato `semana-NN/tema`, por ejemplo
   `semana-03/analizador`. Si el trabajo es grande, son preferibles varios PR
   pequeños en la semana a uno enorme.
3. **Commits convencionales en español**:

   ```
   feat(lenguaje): recuperar errores tras paso inválido
   fix(ejecuciones): cerrar la sesión del motor aunque falle la limpieza
   docs: adr-003 sobre el analizador
   ```

   Tipos habituales: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`.
   El ámbito entre paréntesis es el módulo de `src/` afectado.
4. **Pull Request contra `main`** usando la plantilla
   ([`.github/pull_request_template.md`](.github/pull_request_template.md)), con
   evidencia (capturas, salida de consola o un video de 3 minutos o menos) y
   `Closes #n` para cada issue que cierra.
5. **Revisión y fusión.** `main` está protegida: solo entra código por PR
   aprobado por el supervisor y con el CI en verde. La fusión es por *squash*.

## Revisiones automáticas (CI)

Cada PR corre cuatro revisiones en GitHub Actions
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)). Antes de subir
cambios, córrelas en local:

```bash
npm run verificar
```

| Script                 | Qué revisa                                                                |
| ---------------------- | ------------------------------------------------------------------------- |
| `npm run typecheck`    | Tipos con TypeScript en modo `strict`.                                    |
| `npm run lint`         | ESLint con reglas que usan tipos, y formato con Prettier.                 |
| `npm test`             | Pruebas con Vitest.                                                       |
| `npm run arquitectura` | Reglas de dependencia de la arquitectura con `dependency-cruiser`.        |

`npm run formatear` corrige automáticamente lo que ESLint y Prettier pueden arreglar.

## Arquitectura

Custodio usa **arquitectura hexagonal organizada por propósito**. Al abrir
`src/` debe "gritar" el dominio (`lenguaje`, `historias`, `ejecuciones`…), no
detalles técnicos. Las seis reglas de la sección 8 del documento técnico se
verifican en CI y una violación rompe el build:

1. `*/dominio` no importa infraestructura ni librerías de E/S (Fastify, `pg`, Playwright, `node:fs`…).
2. `*/aplicacion` depende solo de su dominio y de los puertos que ella misma declara.
3. `*/infraestructura` implementa puertos; ningún módulo importa la infraestructura de otro.
4. Un módulo usa a otro solo por su API pública: `src/<modulo>/index.ts`.
5. Solo `src/arranque/` conoce implementaciones concretas y las inyecta.
6. `src/lenguaje/` son funciones puras, sin E/S.

Si `npm run arquitectura` falla, el mensaje dice qué regla se rompió (`r1-…` a
`r6-…`) y entre qué archivos. La explicación de cada regla está en
[`.dependency-cruiser.cjs`](.dependency-cruiser.cjs) y en el ADR-002.

**Librerías en el núcleo.** El dominio, la aplicación, `lenguaje` y `compartido`
no pueden importar paquetes externos. Si se necesita una librería pura, sin E/S
(por ejemplo un lector de YAML), se agrega a `LIBRERIAS_PURAS` en
`.dependency-cruiser.cjs` en un PR que explique por qué.

**Cambiar una regla** es una decisión de arquitectura: se propone en un ADR y el PR agrega su caso en
[`test/arquitectura/reglas.test.ts`](test/arquitectura/reglas.test.ts).

## Idioma

El lenguaje, los mensajes, la documentación y los nombres del dominio van en
**español**.

## Licencia

[licencia Apache 2.0](LICENSE) del proyecto, © Soluciones Tecnológicas Acutis SpA.