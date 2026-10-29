# ADR-001: Stack tecnológico de Custodio

- **Estado:** Propuesto
- **Fecha:** 2026-10-06

## Contexto

Custodio no es un proyecto que vaya a vivir solo durante la práctica. Si todo sale bien, en diciembre pasa a manos del equipo de Acutis y se convierte en la forma estándar de documentar y verificar las historias críticas de los productos.

La Suite Digital Acutis ya tiene un stack definido (TypeScript, Node, PostgreSQL, Playwright para E2E, despliegue en Dokploy con imágenes en GHCR), y el documento técnico de la práctica (sección 9) parte de ahí. Este ADR deja por escrito ese stack, explica por qué tiene sentido para Custodio.

Hay dos decisiones que quedan **fuera** de este ADR a propósito, porque tienen su propia semana y su propio documento:

- Cómo se construye el analizador del DSL (a mano o con generador) → ADR-003, semana 3.
- Cuál es el segundo motor de navegador real (WebDriver BiDi o Puppeteer) → ADR-004, semana 7.

### Lo que sabemos

- **El stack de la Suite** es TypeScript, Node, PostgreSQL y Playwright, con despliegue en Dokploy e imágenes en GHCR. Es lo que el equipo ya conoce y lo que va a mantener Custodio después de diciembre.
- **El documento técnico fija varias piezas** (sección 9): TypeScript `strict` sobre Node.js 24 LTS, Fastify, PostgreSQL con la cola en la misma base, Vitest con Testcontainers, GitHub Actions y Docker.
- **El repositorio es público** (sección 10), así que el escaneo de secretos y Dependabot no son opcionales.
- **Las historias van a ser muy asíncronas**: casi cada paso es una llamada al navegador. Una promesa sin esperar es un error fácil de cometer y difícil de encontrar.

### Lo que suponemos

Estos supuestos sostienen parte de la decisión. Si alguno resulta falso, se revisa la decisión que depende de él:

| Supuesto | Decisión que depende de él | Cómo lo vamos a comprobar |
|---|---|---|
| El volumen es de decenas o cientos de ejecuciones al día, no de miles por segundo. | La cola en PostgreSQL, sin broker. | Con el uso real a partir de la S8; la cola está detrás de `ColaDeEjecuciones`, así que cambiarla no toca el núcleo. |
| Quien desarrolle tiene Docker disponible. | Testcontainers para las pruebas de integración. | En la S6, cuando lleguen esas pruebas. En los runners de GitHub viene incluido. |
| La Suite usa ESLint + Prettier y no Biome. | Las herramientas de calidad. | Confirmarlo con el equipo (ver «ESLint + Prettier o Biome»). |

### Lo que todavía no sabemos

| Pregunta | Cuándo se decide |
|---|---|
| Cómo se construye el analizador del DSL. | ADR-003, S3. |
| Cuál es el segundo motor real. | ADR-004, S7. |
| Cómo se despliega en Dokploy: variables, réplicas del trabajador, almacenamiento de evidencias. | S8, junto con el Dockerfile y la imagen en GHCR. |
| Si el ambiente de pruebas de la Suite estará listo para la S8. | Acutis lo compromete antes del 20 de noviembre; si no, las historias reales corren contra una instancia local en Docker (sección 14). |

## Decisión

| Ámbito | Elección | Por qué |
|---|---|---|
| Lenguaje | TypeScript en modo `strict` | El AST, el plan y los puertos son justamente el tipo de cosa donde los tipos te salvan. Además es lo que usa la Suite. |
| Runtime | Node.js 24 LTS | LTS con soporte hasta 2028. |
| Módulos | ESM nativo | Es el estándar actual de Node y evita pelearse con interoperabilidad más adelante. |
| Gestor de paquetes | npm (con `package-lock.json`) | Viene con Node, no agrega una herramienta más y es lo que asume la plantilla de PR (`npm ci && npm test`). |
| Servicio HTTP | Fastify | Validación por esquemas incorporada, OpenAPI generado desde esos mismos esquemas y logs JSON estructurados con pino desde el día uno. |
| Persistencia | PostgreSQL | Guarda historias, versiones, ejecuciones **y la cola**. |
| Cola | Tabla en PostgreSQL con `FOR UPDATE SKIP LOCKED` | Sin broker adicional (SRV-05). Una pieza menos que operar. |
| Motor principal | Playwright | Es el que conoce el equipo y el más maduro para Chromium. Vive detrás del puerto `MotorDeNavegador`, así que no "contamina" el resto. |
| Pruebas | Vitest + Testcontainers | Vitest es rápido y se lleva bien con TypeScript y ESM; Testcontainers nos da un PostgreSQL real en las pruebas de integración en vez de un mock que miente. |
| Calidad | ESLint (`typescript-eslint`) + Prettier, [`dependency-cruiser`](../../.dependency-cruiser.cjs), `tsc --noEmit` | Lint con reglas que entienden tipos, formato sin discusiones y las reglas de arquitectura verificadas por máquina (ver [ADR-002](ADR-002-arquitectura.md)). Las cuatro revisiones corren en [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml). |
| Seguridad del repo | Dependabot, escaneo de secretos con protección de push | El repositorio es público (sección 10 del documento técnico). |
| Entrega | GitHub Actions, imagen Docker en GHCR, `docker compose` para desarrollo | Mismo camino que ya usa Acutis para desplegar en Dokploy. |

### Algunas decisiones con más detalle

**¿Por qué la cola vive en PostgreSQL y no en Redis o similar?**
Porque el volumen de Custodio es chico: estamos hablando de decenas o cientos de ejecuciones al día, no de miles por segundo. Con `SKIP LOCKED` varios trabajadores pueden tomar trabajos sin pisarse, y como la cola está en la misma base que los resultados, encolar y registrar pueden ir en la misma transacción. Agregar un broker sería una pieza más que levantar, monitorear y respaldar a cambio de una capacidad que no vamos a usar. Si algún día hace falta, la cola está detrás del puerto `ColaDeEjecuciones` y se puede cambiar sin tocar el núcleo.

**¿ESLint + Prettier o Biome?**
El documento deja las dos puertas abiertas. Me inclino por ESLint + Prettier principalmente porque `typescript-eslint` tiene reglas que usan la información de tipos (por ejemplo, detectar promesas que nadie espera, algo muy fácil de cometer en un proyecto lleno de llamadas asíncronas al navegador). Biome es bastante más rápido y es una sola herramienta, pero hoy su cobertura de ese tipo de reglas es menor. <br>
**Punto a confirmar:** si la Suite ya usa Biome, conviene alinearse con ella antes que con mi preferencia.

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