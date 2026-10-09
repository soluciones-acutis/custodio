// @ts-check
/**
 * Reglas de arquitectura de Custodio
 *
 * Cada regla de la sección 8 se escribe como una o más reglas prohibidas cuyo
 * nombre empieza con su número (`r1-…` a `r6-…`), para que un error en CI se
 * pueda rastrear directo a la regla que se rompió. Al final van algunas reglas
 * de limpieza general.
 */

/**
 * Librerías externas que el núcleo (dominio, aplicación, lenguaje y compartido)
 * puede importar. Por defecto ninguna: el núcleo no conoce Node ni npm.
 *
 * Solo entran librerías puras, sin E/S
 *
 * @type {string[]}
 */
const LIBRERIAS_PURAS = [];

/**
 * Restricción `to` que acepta solo los destinos indicados y las librerías puras.
 * Cualquier otra cosa (npm, módulos de Node, paquetes sin resolver) es violación.
 *
 * @param {string[]} permitidos expresiones regulares de rutas permitidas
 */
const soloPuedeImportar = (...permitidos) => ({
  pathNot: [...permitidos, ...LIBRERIAS_PURAS.map((nombre) => `(^|node_modules/)${nombre}(/|$)`)],
});

const DENTRO_DE_SRC = '^src/';
const ARRANQUE = '^src/arranque/';
const DOMINIO = '^src/[^/]+/dominio/';
const APLICACION = '^src/[^/]+/aplicacion/';
const INFRAESTRUCTURA = '^src/[^/]+/infraestructura/';
const API_PUBLICA = '^src/[^/]+/index\\.ts$';

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // Dominio puro
    {
      name: 'r1-dominio-sin-capas-externas',
      comment:
        'Regla 1 (dominio puro): */dominio no importa infraestructura ni la capa de aplicación; ' +
        'las dependencias apuntan hacia el dominio, nunca desde él.',
      severity: 'error',
      from: { path: DOMINIO },
      to: { path: [INFRAESTRUCTURA, APLICACION] },
    },
    {
      name: 'r1-dominio-sin-librerias-de-es',
      comment:
        'Regla 1 (dominio puro): */dominio no importa librerías externas ni módulos de Node ' +
        '(Fastify, pg, Playwright, node:fs…). Si se necesita una librería pura, se agrega a ' +
        'LIBRERIAS_PURAS en .dependency-cruiser.cjs.',
      severity: 'error',
      from: { path: DOMINIO },
      to: soloPuedeImportar(DENTRO_DE_SRC),
    },

    // Aplicación orquesta
    {
      name: 'r2-aplicacion-sin-infraestructura',
      comment:
        'Regla 2 (aplicación orquesta): */aplicacion depende de su dominio y de los puertos que ' +
        'ella misma declara, nunca de una implementación en infraestructura.',
      severity: 'error',
      from: { path: APLICACION },
      to: { path: INFRAESTRUCTURA },
    },
    {
      name: 'r2-aplicacion-sin-librerias-de-es',
      comment:
        'Regla 2 (aplicación orquesta): */aplicacion no importa librerías externas ni módulos de ' +
        'Node; lo que necesite del mundo lo pide a través de un puerto.',
      severity: 'error',
      from: { path: APLICACION },
      to: soloPuedeImportar(DENTRO_DE_SRC),
    },

    // Infraestructura implementa
    {
      name: 'r3-infraestructura-ajena',
      comment:
        'Regla 3 (infraestructura implementa): ningún módulo importa la infraestructura de otro ' +
        'módulo. Solo arranque/ conecta adaptadores de distintos módulos.',
      severity: 'error',
      // dominio y aplicación ya quedan cubiertos por las reglas 1 y 2.
      from: { path: '^src/([^/]+)/', pathNot: [ARRANQUE, DOMINIO, APLICACION] },
      to: { path: INFRAESTRUCTURA, pathNot: '^src/$1/infraestructura/' },
    },

    // Módulos por su puerta
    {
      name: 'r4-modulos-por-su-puerta',
      comment:
        'Regla 4 (módulos por su puerta): un módulo usa a otro solo a través de su API pública, ' +
        'src/<modulo>/index.ts.',
      severity: 'error',
      from: { path: '^src/([^/]+)/', pathNot: ARRANQUE },
      // Los cruces hacia infraestructura y arranque ya los informan las reglas 1, 2, 3 y 5.
      to: { path: DENTRO_DE_SRC, pathNot: ['^src/$1/', API_PUBLICA, INFRAESTRUCTURA, ARRANQUE] },
    },
    {
      name: 'r4-arranque-por-la-puerta',
      comment:
        'Regla 4 (módulos por su puerta): arranque/ usa los casos de uso a través de la API ' +
        'pública de cada módulo; solo entra directo a infraestructura para armar adaptadores.',
      severity: 'error',
      from: { path: ARRANQUE },
      to: { path: [DOMINIO, APLICACION] },
    },

    // Una sola raíz de composición
    {
      name: 'r5-nadie-importa-arranque',
      comment:
        'Regla 5 (una sola raíz de composición): arranque/ arma el sistema; ningún otro módulo ' +
        'puede depender de él.',
      severity: 'error',
      from: { path: DENTRO_DE_SRC, pathNot: ARRANQUE },
      to: { path: ARRANQUE },
    },
    {
      name: 'r5-api-publica-sin-implementaciones',
      comment:
        'Regla 5 (una sola raíz de composición): la API pública de un módulo (index.ts) y sus ' +
        'archivos sueltos no exponen implementaciones concretas; solo arranque/ las conoce y ' +
        'las inyecta.',
      severity: 'error',
      from: { path: '^src/([^/]+)/', pathNot: [ARRANQUE, DOMINIO, APLICACION, INFRAESTRUCTURA] },
      to: { path: '^src/$1/infraestructura/' },
    },

    // Lenguaje sin E/S
    {
      name: 'r6-lenguaje-sin-es',
      comment:
        'Regla 6 (lenguaje sin E/S): lenguaje/ son funciones puras; no importa librerías externas ' +
        'ni módulos de Node, para poder reutilizarse desde CLI, servicio o un editor.',
      severity: 'error',
      from: { path: '^src/lenguaje/' },
      to: soloPuedeImportar(DENTRO_DE_SRC),
    },
    {
      name: 'r6-lenguaje-independiente',
      comment:
        'Regla 6 (lenguaje sin E/S): lenguaje/ no conoce a los demás módulos (ni motores, ni ' +
        'historias, ni ejecuciones); solo puede usar compartido/.',
      severity: 'error',
      from: { path: '^src/lenguaje/' },
      to: { path: DENTRO_DE_SRC, pathNot: '^src/(lenguaje|compartido)/' },
    },

    // Limpieza general
    {
      name: 'compartido-solo-tipos-base',
      comment:
        'compartido/ contiene solo tipos base (Reloj, GeneradorDeIds…): no depende de ningún ' +
        'otro módulo ni de librerías externas (ADR-002).',
      severity: 'error',
      from: { path: '^src/compartido/' },
      to: soloPuedeImportar('^src/compartido/'),
    },
    {
      name: 'sin-ciclos',
      comment: 'Las dependencias circulares impiden razonar sobre las capas y los módulos.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'sin-importaciones-sin-resolver',
      comment: 'La importación apunta a un archivo o paquete que no existe o no está instalado.',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: 'sin-dependencias-de-desarrollo',
      comment:
        'El código de src/ no puede depender de paquetes que solo están en devDependencies ' +
        '(vitest, eslint…): no estarán en la imagen de producción.',
      severity: 'error',
      from: { path: DENTRO_DE_SRC },
      to: { dependencyTypes: ['npm-dev'] },
    },
    {
      name: 'sin-paquetes-fuera-de-package-json',
      comment:
        'El paquete se importa pero no está declarado en package.json; funciona por casualidad ' +
        '(dependencia transitiva) y se rompe en cualquier actualización.',
      severity: 'error',
      from: {},
      to: { dependencyTypes: ['npm-no-pkg', 'npm-unknown'] },
    },
  ],

  options: {
    doNotFollow: { path: 'node_modules' },
    // Las pruebas pueden importar vitest y armar dobles de prueba; las reglas aplican al código de producción.
    exclude: { path: '\\.test\\.ts$' },
    // Cuenta también las importaciones de solo tipos: un `import type` desde playwright en el dominio sigue siendo una violación.
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
