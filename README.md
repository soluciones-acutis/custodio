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
