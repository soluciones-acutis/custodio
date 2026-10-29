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

`verificar` corre las mismas cuatro revisiones que el CI (`.github/workflows/ci.yml`)
en cada PR:

| Script | Qué revisa |
|---|---|
| `npm run typecheck` | Tipos con TypeScript en modo `strict` (`tsc --noEmit`). |
| `npm run lint` | ESLint (`typescript-eslint` con reglas que usan tipos) y formato con Prettier. |
| `npm test` | Pruebas con Vitest. |
| `npm run arquitectura` | Reglas de dependencia de la arquitectura (ADR-002) con `dependency-cruiser`. |

`npm run formatear` corrige lo que ESLint y Prettier pueden arreglar solos.

## Para evaluadores Duoc UC

Este repositorio es el proyecto de práctica profesional de **Vicente Saud Lagos**
(Ingeniería en Informática, Duoc UC sede Puente Alto), supervisado por
Matías Peralta (Soluciones Tecnológicas Acutis SpA).

- **Hoja de ruta:** 9 entregas semanales, una por semana, como Pull Requests.
- **Seguimiento:** los martes se presenta el diseño de la semana (`docs/diseno/`);
  los viernes se entrega el avance en un Pull Request revisado en GitHub.
- **Decisiones de arquitectura:** en `docs/adr/`.

## Licencia

[Apache License 2.0](LICENSE) © 2026 Soluciones Tecnológicas Acutis SpA.
