/**
 * Prueba que cada regla de `.dependency-cruiser.cjs` se active de verdad.
 *
 * Con `src/` casi vacío, `npm run arquitectura` siempre sale en verde y no
 * demuestra nada. Aquí se arma, en una carpeta temporal, un `src/` mínimo que
 * respeta la arquitectura y, para cada regla, se le agrega un archivo que la
 * rompe. La prueba exige que dependency-cruiser informe exactamente esa regla.
 */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { cruise, type ICruiseOptions } from 'dependency-cruiser';
import extractDepcruiseOptions from 'dependency-cruiser/config-utl/extract-depcruise-options';
import { beforeAll, describe, expect, it } from 'vitest';

type Archivos = Record<string, string>;

// Un src/ que respeta las seis reglas y usa los caminos permitidos.
const ARQUITECTURA_LIMPIA: Archivos = {
  'src/compartido/index.ts': `export type Id = string;`,
  'src/lenguaje/index.ts': `
    import type { Id } from '../compartido/index.ts';
    export interface Plan { historia: Id }`,
  'src/ejecuciones/dominio/motor-de-navegador.ts': `
    import type { Plan } from '../../lenguaje/index.ts';
    export interface MotorDeNavegador { ejecutar(plan: Plan): Promise<void> }`,
  'src/ejecuciones/aplicacion/ejecutar-plan.ts': `
    import type { MotorDeNavegador } from '../dominio/motor-de-navegador.ts';
    import type { Plan } from '../../lenguaje/index.ts';
    export const ejecutarPlan = (motor: MotorDeNavegador, plan: Plan) => motor.ejecutar(plan);`,
  'src/ejecuciones/infraestructura/motores/simulado/motor-simulado.ts': `
    import type { MotorDeNavegador } from '../../../dominio/motor-de-navegador.ts';
    export const motorSimulado: MotorDeNavegador = { ejecutar: async () => {} };`,
  'src/ejecuciones/index.ts': `export { ejecutarPlan } from './aplicacion/ejecutar-plan.ts';`,
  'src/historias/dominio/historia.ts': `export interface Historia { id: string }`,
  'src/historias/aplicacion/registrar-historia.ts': `
    import type { Historia } from '../dominio/historia.ts';
    import { ejecutarPlan } from '../../ejecuciones/index.ts';
    export const registrar = (h: Historia) => [h, ejecutarPlan];`,
  'src/historias/infraestructura/postgres/repositorio.ts': `
    import { randomUUID } from 'node:crypto';
    import type { Historia } from '../../dominio/historia.ts';
    export const nueva = (): Historia => ({ id: randomUUID() });`,
  'src/historias/index.ts': `export { registrar } from './aplicacion/registrar-historia.ts';`,
  'src/arranque/cli/principal.ts': `
    import { ejecutarPlan } from '../../ejecuciones/index.ts';
    import { motorSimulado } from '../../ejecuciones/infraestructura/motores/simulado/motor-simulado.ts';
    import { nueva } from '../../historias/infraestructura/postgres/repositorio.ts';
    void ejecutarPlan(motorSimulado, { historia: nueva().id });`,
};

interface Caso {
  descripcion: string;
  archivos: Archivos;
  reglasEsperadas: string[];
}

const VIOLACIONES: Caso[] = [
  // Regla 1: dominio puro
  {
    descripcion: 'el dominio importa infraestructura',
    archivos: {
      'src/ejecuciones/dominio/malo.ts': `import '../infraestructura/motores/simulado/motor-simulado.ts';`,
    },
    reglasEsperadas: ['r1-dominio-sin-capas-externas'],
  },
  {
    descripcion: 'el dominio importa la capa de aplicación',
    archivos: { 'src/ejecuciones/dominio/malo.ts': `import '../aplicacion/ejecutar-plan.ts';` },
    reglasEsperadas: ['r1-dominio-sin-capas-externas'],
  },
  {
    descripcion: 'el dominio importa tipos de playwright (ejemplo de ci-semana-01)',
    archivos: { 'src/ejecuciones/dominio/malo.ts': `import type { Page } from 'playwright';` },
    // playwright no está instalado: además se informa como importación sin resolver.
    reglasEsperadas: ['r1-dominio-sin-librerias-de-es', 'sin-importaciones-sin-resolver'],
  },
  {
    descripcion: 'el dominio importa un módulo de Node',
    archivos: { 'src/historias/dominio/malo.ts': `import { readFile } from 'node:fs/promises';` },
    reglasEsperadas: ['r1-dominio-sin-librerias-de-es'],
  },
  // Regla 2: aplicación orquesta
  {
    descripcion: 'la aplicación importa la infraestructura de su módulo',
    archivos: {
      'src/ejecuciones/aplicacion/malo.ts': `import '../infraestructura/motores/simulado/motor-simulado.ts';`,
    },
    reglasEsperadas: ['r2-aplicacion-sin-infraestructura'],
  },
  {
    descripcion: 'la aplicación importa un módulo de Node',
    archivos: { 'src/historias/aplicacion/malo.ts': `import { createServer } from 'node:http';` },
    reglasEsperadas: ['r2-aplicacion-sin-librerias-de-es'],
  },
  // Regla 3: infraestructura implementa
  {
    descripcion: 'la infraestructura de un módulo importa la de otro',
    archivos: {
      'src/historias/infraestructura/postgres/malo.ts': `import '../../../ejecuciones/infraestructura/motores/simulado/motor-simulado.ts';`,
    },
    reglasEsperadas: ['r3-infraestructura-ajena'],
  },
  // Regla 4: módulos por su puerta
  {
    descripcion: 'un módulo entra a la aplicación de otro sin pasar por su index.ts',
    archivos: {
      'src/historias/aplicacion/malo.ts': `import '../../ejecuciones/aplicacion/ejecutar-plan.ts';`,
    },
    reglasEsperadas: ['r4-modulos-por-su-puerta'],
  },
  {
    descripcion: 'un dominio entra al dominio de otro módulo sin pasar por su index.ts',
    archivos: {
      'src/historias/dominio/malo.ts': `import '../../ejecuciones/dominio/motor-de-navegador.ts';`,
    },
    reglasEsperadas: ['r4-modulos-por-su-puerta'],
  },
  {
    descripcion: 'arranque usa un caso de uso sin pasar por el index.ts del módulo',
    archivos: {
      'src/arranque/http/malo.ts': `import '../../ejecuciones/aplicacion/ejecutar-plan.ts';`,
    },
    reglasEsperadas: ['r4-arranque-por-la-puerta'],
  },
  // Regla 5: una sola raíz de composición
  {
    descripcion: 'un módulo importa arranque',
    archivos: { 'src/ejecuciones/aplicacion/malo.ts': `import '../../arranque/cli/principal.ts';` },
    reglasEsperadas: ['r5-nadie-importa-arranque'],
  },
  {
    descripcion: 'la API pública de un módulo expone un motor concreto',
    archivos: {
      'src/ejecuciones/index.ts': `
        export { ejecutarPlan } from './aplicacion/ejecutar-plan.ts';
        export { motorSimulado } from './infraestructura/motores/simulado/motor-simulado.ts';`,
    },
    reglasEsperadas: ['r5-api-publica-sin-implementaciones'],
  },
  // Regla 6: lenguaje sin E/S
  {
    descripcion: 'el lenguaje lee archivos',
    archivos: { 'src/lenguaje/malo.ts': `import { readFileSync } from 'node:fs';` },
    reglasEsperadas: ['r6-lenguaje-sin-es'],
  },
  {
    descripcion: 'el lenguaje conoce el módulo de ejecuciones',
    archivos: { 'src/lenguaje/malo.ts': `import '../ejecuciones/index.ts';` },
    reglasEsperadas: ['r6-lenguaje-independiente'],
  },
  // Higiene general
  {
    descripcion: 'compartido depende de otro módulo',
    archivos: { 'src/compartido/malo.ts': `import '../lenguaje/index.ts';` },
    reglasEsperadas: ['compartido-solo-tipos-base'],
  },
  {
    descripcion: 'compartido importa un módulo de Node',
    archivos: { 'src/compartido/malo.ts': `import { randomUUID } from 'node:crypto';` },
    reglasEsperadas: ['compartido-solo-tipos-base'],
  },
  {
    descripcion: 'dos archivos se importan mutuamente',
    archivos: {
      'src/informes/a.ts': `import './b.ts';`,
      'src/informes/b.ts': `import './a.ts';`,
    },
    reglasEsperadas: ['sin-ciclos'],
  },
];

let opciones: ICruiseOptions;

beforeAll(async () => {
  const configuracion = join(import.meta.dirname, '..', '..', '.dependency-cruiser.cjs');
  opciones = await extractDepcruiseOptions(configuracion);
});

// Arma un src/ temporal con los archivos dados y devuelve las reglas violadas.
async function reglasVioladas(archivos: Archivos): Promise<string[]> {
  const raiz = await mkdtemp(join(tmpdir(), 'custodio-arquitectura-'));
  try {
    for (const [ruta, contenido] of Object.entries(archivos)) {
      await mkdir(dirname(join(raiz, ruta)), { recursive: true });
      await writeFile(join(raiz, ruta), contenido);
    }
    const { output } = await cruise(['src'], { ...opciones, baseDir: raiz });
    if (typeof output === 'string') throw new Error('dependency-cruiser devolvió texto');
    const nombres = output.summary.violations.map((violacion) => violacion.rule.name);
    return [...new Set(nombres)].sort();
  } finally {
    await rm(raiz, { recursive: true, force: true });
  }
}

describe('reglas de arquitectura (.dependency-cruiser.cjs)', () => {
  it('una arquitectura que respeta las reglas no tiene violaciones', async () => {
    expect(await reglasVioladas(ARQUITECTURA_LIMPIA)).toEqual([]);
  });

  it('los archivos de prueba quedan fuera de las reglas', async () => {
    const conPrueba = {
      ...ARQUITECTURA_LIMPIA,
      'src/historias/dominio/historia.test.ts': `import { it } from 'vitest'; it('x', () => {});`,
    };
    expect(await reglasVioladas(conPrueba)).toEqual([]);
  });

  it.each(VIOLACIONES)('falla cuando $descripcion', async ({ archivos, reglasEsperadas }) => {
    const violadas = await reglasVioladas({ ...ARQUITECTURA_LIMPIA, ...archivos });
    expect(violadas).toEqual([...reglasEsperadas].sort());
  });
});
