# Custodio

**Servicio web de pruebas end-to-end con lenguaje propio para historias de usuario.**

Custodio permite escribir las historias de usuario críticas de los productos de
[Soluciones Tecnológicas Acutis](https://solucionesacutis.cl) en un lenguaje de
dominio específico (DSL) en español, legible por personas y ejecutable por
máquinas, independiente de la herramienta que controla el navegador.

> «Él te encomendó a sus ángeles para que te cuiden en todos tus caminos» (Sal 91,11)

## Estado

🚧 En construcción. El desarrollo comienza el **5 de octubre de 2026** y la
versión 1.0.0 está planificada para el **4 de diciembre de 2026**.

## Principios

- **Documentar antes que probar:** cada historia tiene su narrativa
  (Como / Quiero / Para) y sus escenarios DADO / CUANDO / ENTONCES.
- **Independencia de la herramienta:** las historias se compilan a un plan
  neutral; Playwright u otro motor son adaptadores intercambiables.
- **Arquitectura hexagonal organizada por propósito** (*screaming architecture*).

## Desarrollo

Requiere Node.js 24 (ver `.nvmrc`).

```bash
npm ci
npm run verificar
```

`verificar` corre las mismas cinco revisiones que el CI (`.github/workflows/ci.yml`)
en cada PR:

| Script | Qué revisa |
|---|---|
| `npm run typecheck` | Tipos con TypeScript en modo `strict` (`tsc --noEmit`). |
| `npm run lint` | ESLint (`typescript-eslint` con reglas que usan tipos) y formato con Prettier. |
| `npm test` | Pruebas con Vitest, con cobertura de al menos 85 % de líneas en `src/lenguaje/`. |
| `npm run arquitectura` | Reglas de dependencia de la arquitectura (ADR-002) con `dependency-cruiser`. |
| `npm run validar -- historias/` | Las historias del repositorio cumplen la especificación del DSL. |

`npm run formatear` corrige lo que ESLint y Prettier pueden arreglar solos.

## Para evaluadores Duoc UC

Este repositorio es el proyecto de práctica profesional de **Vicente Saud Lagos**
(Ingeniería en Informática, Duoc UC sede Puente Alto), supervisado por
Matías Peralta (Soluciones Tecnológicas Acutis SpA).

- **Hoja de ruta:** desde el 11 de noviembre, el plan de cierre: tres iteraciones y una
  semana de cierre, con la versión v1.0.0 el 4 de diciembre.
- **Seguimiento:** el diseño de cada iteración está en `docs/diseno/` y se cierra en la
  reunión de los martes; el avance se entrega en Pull Requests pequeños, revisados en GitHub.
- **Decisiones de arquitectura:** en `docs/adr/`.
- **El lenguaje (DSL):** la especificación, la gramática y el JSON Schema del AST en
  `docs/dsl/`; las historias de la Suite en `historias/`, sus frases de negocio en
  `vocabularios/` y las variables y secretos que declara su ambiente de pruebas en `ambientes/`.

### Validar historias

```bash
npm run validar -- historias/
```

Revisa cada historia y cada vocabulario contra la especificación, e informa los errores con
su archivo, línea, columna y una sugerencia. Con `--json` la salida es para máquinas
(`docs/dsl/diagnosticos.schema.json`). Dentro del repositorio también sirve
`npx --no-install custodio validar historias/`: el `--no-install` evita que `npx` descargue
un paquete ajeno de npm que se llama igual.

## Licencia

[Apache License 2.0](LICENSE) © 2026 Soluciones Tecnológicas Acutis SpA.
