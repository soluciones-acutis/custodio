# ADR-002: Arquitectura hexagonal organizada por propósito

- **Fecha:** 2026-10-06

## Contexto

El objetivo central de Custodio es que una historia escrita en el DSL no sepa con qué herramienta se va a ejecutar. Hoy se ejecuta con Playwright, mañana quizás con otro, y en las pruebas unitarias con un motor simulado, sin cambiar una sola línea de la historia.

Necesitamos una arquitectura que resuelva dos cosas distintas:

1. **Hacia dónde apuntan las dependencias**, para que el núcleo no conozca a Playwright, Fastify ni PostgreSQL.
2. **Cómo se ve el repositorio**, para que alguien que lo abre por primera vez entienda de qué se trata el sistema sin leer código.

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
├─ informes/      ← JSON, JUnit y HTML
├─ compartido/    ← solo tipos base (Reloj, GeneradorDeIds, Resultado…)
└─ arranque/      ← http, cli y worker: donde se arma todo
```

Los módulos con lógica de negocio y dependencias externas (`historias`, `ejecuciones`, `ambientes`) se dividen por dentro en `dominio/`, `aplicacion/` e `infraestructura/`. El módulo `lenguaje` es la excepción: son funciones puras sin E/S, así que no necesita esa división y se mantiene plano y simple.

### Las seis reglas

Estas reglas vienen de la sección 8 del documento técnico. Las repito acá con una frase sobre por qué existe cada una, porque una regla que no se entiende termina saltándose:

| # | Regla | Por qué existe |
|---|---|---|
| 1 | `*/dominio` no importa infraestructura ni librerías de E/S (Fastify, `pg`, Playwright…). | El dominio es lo que más vale y lo que menos debería cambiar. Si depende de una librería, cambia cada vez que la librería cambia. |
| 2 | `*/aplicacion` depende solo de su dominio y de puertos que ella misma declara. | El caso de uso dice qué necesita ("un motor que sepa navegar"), no cómo se consigue. |
| 3 | `*/infraestructura` implementa puertos; ningún módulo importa la infraestructura de otro. | Evita que el adaptador de PostgreSQL de `historias` termine usándose a escondidas desde `ejecuciones`. |
| 4 | Un módulo usa a otro solo por su API pública (`index.ts`). | Cada módulo puede reorganizarse por dentro sin romper a los demás. |
| 5 | Solo `arranque/` conoce implementaciones concretas y las inyecta. | Hay un único lugar donde se decide "en este ambiente se usa Playwright". Es lo que hace posible SRV-08. |
| 6 | `lenguaje/` son funciones puras, sin E/S. | Así el mismo validador sirve para la CLI, el servicio web y, a futuro, una extensión de VS Code (DSL-18). |

Se verifican en CI con `dependency-cruiser` y la configuración concreta se arma junto con el CI

### El plan

El **plan de ejecución**. `lenguaje` lo produce y `ejecuciones` lo consume, y es lo único que comparten. El plan es JSON neutral.

Eso significa que `ejecuciones` depende de los *tipos* del plan que exporta `lenguaje`, pero nunca del analizador ni del validador. Y en la otra dirección, `lenguaje` no tiene idea de que existen motores. Si mañana cambia cómo se escribe una frase en el DSL, el plan puede quedar igual y el motor ni se entera; si cambia el motor, el lenguaje tampoco.

### Puertos definidos desde el núcleo

Los puertos se escriben en el idioma de quien los necesita, no en el de la herramienta que los implementa. `MotorDeNavegador` habla de `navegar`, `completar` y `presionar` con un `Localizador` propio (por rol, etiqueta o texto), no de `page.getByRole()`. Si una interfaz empieza a parecerse a la API de Playwright, es una señal de que el diseño se está torciendo.

Los puertos iniciales son los de la sección 8.1 del documento técnico: `MotorDeNavegador`, `RepositorioDeHistorias`, `ColaDeEjecuciones`, `AlmacenDeEvidencias`, `BovedaDeSecretos`, `Reloj` y `GeneradorDeIds`.

### Cómo sabremos que funcionó

**agregar un tercer motor tiene que requerir solo una carpeta nueva en `ejecuciones/infraestructura/motores/`, pasar la suite de contrato y registrarlo en `arranque/`.** Si para lograrlo hay que tocar el lenguaje, el dominio o las historias, la arquitectura falló.