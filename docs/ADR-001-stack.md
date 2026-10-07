# ADR-001: Stack tecnológico de Custodio

- **Fecha:** 2026-10-06

## Contexto

Custodio no es un proyecto que vaya a vivir solo durante la práctica. Si todo sale bien, en diciembre pasa a manos del equipo de Acutis y se convierte en la forma estándar de documentar y verificar las historias críticas de los productos.

La Suite Digital Acutis ya tiene un stack definido (TypeScript, Node, PostgreSQL, Playwright para E2E, despliegue en Dokploy con imágenes en GHCR), y el documento técnico de la práctica (sección 9) parte de ahí. Este ADR deja por escrito ese stack, explica por qué tiene sentido para Custodio.

Hay dos decisiones que quedan **fuera** de este ADR a propósito, porque tienen su propia semana y su propio documento:

- Cómo se construye el analizador del DSL (a mano o con generador) → ADR-003, semana 3.
- Cuál es el segundo motor de navegador real (WebDriver BiDi o Puppeteer) → ADR-004, semana 7.

## Decisión

| Ámbito | Elección | Por qué |
|---|---|---|
| Lenguaje | TypeScript en modo `strict` | El AST, el plan y los puertos son justamente el tipo de cosa donde los tipos te salvan. Además es lo que usa la Suite. |
| Runtime | Node.js 24 LTS | LTS activo durante toda la vida esperable del proyecto. |
| Módulos | ESM nativo | Es el estándar actual de Node y evita pelearse con interoperabilidad más adelante. |
| Gestor de paquetes | npm (con `package-lock.json`) | Viene con Node, no agrega una herramienta más y es lo que asume la plantilla de PR (`npm ci && npm test`). |
| Servicio HTTP | Fastify | Validación por esquemas incorporada, OpenAPI generado desde esos mismos esquemas y logs JSON estructurados con pino desde el día uno. |
| Persistencia | PostgreSQL | Guarda historias, versiones, ejecuciones **y la cola**. |
| Cola | Tabla en PostgreSQL con `FOR UPDATE SKIP LOCKED` | Sin broker adicional (SRV-05). Una pieza menos que operar. |
| Motor principal | Playwright | Es el que conoce el equipo y el más maduro para Chromium. Vive detrás del puerto `MotorDeNavegador`, así que no "contamina" el resto. |
| Pruebas | Vitest + Testcontainers | Vitest es rápido y se lleva bien con TypeScript y ESM; Testcontainers nos da un PostgreSQL real en las pruebas de integración en vez de un mock que miente. |
| Calidad | ESLint (`typescript-eslint`) + Prettier, `dependency-cruiser`, `tsc --noEmit` | Lint con reglas que entienden tipos, formato sin discusiones y las reglas de arquitectura verificadas por máquina (ver ADR-002). |
| Seguridad del repo | Dependabot, escaneo de secretos con protección de push | El repositorio es público (sección 10 del documento técnico). |
| Entrega | GitHub Actions, imagen Docker en GHCR, `docker compose` para desarrollo | Mismo camino que ya usa Acutis para desplegar en Dokploy. |

### Algunas decisiones con más detalle

**¿Por qué la cola vive en PostgreSQL y no en Redis o similar?**
Porque el volumen de Custodio es chico: estamos hablando de decenas o cientos de ejecuciones al día, no de miles por segundo. Con `SKIP LOCKED` varios trabajadores pueden tomar trabajos sin pisarse, y como la cola está en la misma base que los resultados, encolar y registrar pueden ir en la misma transacción. Agregar un broker sería una pieza más que levantar, monitorear y respaldar a cambio de una capacidad que no vamos a usar. Si algún día hace falta, la cola está detrás del puerto `ColaDeEjecuciones` y se puede cambiar sin tocar el núcleo.

**¿ESLint + Prettier?**
El documento se inclina por ESLint + Prettier principalmente porque `typescript-eslint` tiene reglas que usan la información de tipos (por ejemplo, detectar promesas que nadie espera, algo muy fácil de cometer en un proyecto lleno de llamadas asíncronas al navegador).

**¿Por qué Playwright como principal si justamente queremos independencia de herramienta?**
La independencia no significa no usar Playwright, significa que solo un adaptador sepa que existe. Playwright sigue siendo la mejor opción para la primera historia verde: es lo que conoce el equipo, tiene buena localización por rol accesible (que calza con DSL-06) y buenas trazas para depurar.

## Consecuencias

**Lo bueno**

- El equipo de Acutis puede leer, ejecutar y modificar Custodio sin aprender herramientas nuevas.
- Operación simple: un servicio, un trabajador y un PostgreSQL. Nada más que monitorear.
- Las pruebas de integración corren contra un PostgreSQL de verdad, así que lo que pasa en CI se parece a lo que pasa en producción.
- Todo el stack corre con `docker compose up` (RNF-08).

**Lo que hay que tener presente**

- Testcontainers necesita Docker disponible tanto en CI como en la máquina de quien desarrolle. En los runners de GitHub viene incluido; localmente hay que tenerlo instalado.
- La cola en PostgreSQL tiene un techo de rendimiento. Para el volumen esperado está muy lejos, pero vale dejarlo escrito por si el uso de Custodio crece más de lo previsto con más productos.
- TypeScript `strict` hace que los primeros PR sean un poco más lentos de escribir. Es un costo que se paga una vez y se recupera cuando el AST y el plan empiecen a cambiar.