/**
 * `custodio validar` (diseño de la semana 3, §8): rutas, vocabularios, salida
 * legible y `--json`, y códigos de salida. Casi todas las pruebas usan un
 * sistema de archivos en memoria; una sola lanza el proceso real.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import {
  SALIDA,
  validar,
  type Consola,
  type SistemaDeArchivos,
} from '../../src/arranque/cli/validar.ts';

const RAIZ = join(import.meta.dirname, '..', '..');

const VOCABULARIO =
  '---\nvocabulario: v\ndsl: 0.1.0\nproducto: x\n---\n\n## Frase: entro\n- navego a `https://x`\n';
const historia = (id: string, paso = '- CUANDO entro'): string =>
  `---\ndsl: 0.1.0\nid: ${id}\nproducto: x\ntitulo: t\nactor: a\ncriticidad: media\nvocabularios: [v]\n---\n\n## Historia\n**Como** a\n\n**Quiero** b\n\n**Para** c\n\n## Escenario: e\n${paso}\n`;

/** Un sistema de archivos en memoria: las carpetas salen de las rutas de los archivos. */
function enMemoria(archivos: Readonly<Record<string, string>>): SistemaDeArchivos {
  const carpetas = new Set(['.']);
  for (const ruta of Object.keys(archivos)) {
    const partes = ruta.split('/');
    for (let i = 1; i < partes.length; i++) carpetas.add(partes.slice(0, i).join('/'));
  }
  return {
    tipo: (ruta) => (ruta in archivos ? 'archivo' : carpetas.has(ruta) ? 'carpeta' : null),
    listar: (carpeta) => {
      const prefijo = carpeta === '.' ? '' : `${carpeta}/`;
      const nombres = [...Object.keys(archivos), ...carpetas]
        .filter(
          (r) => r.startsWith(prefijo) && r !== carpeta && !r.slice(prefijo.length).includes('/'),
        )
        .map((r) => r.slice(prefijo.length));
      return [...new Set(nombres)].filter((n) => n !== '' && n !== '.');
    },
    leer: (ruta) => archivos[ruta] ?? '',
  };
}

function correr(
  argumentos: readonly string[],
  archivos: Readonly<Record<string, string>>,
  colores = false,
) {
  let salida = '';
  let errores = '';
  const consola: Consola = {
    escribir: (t) => (salida += t),
    error: (t) => (errores += t),
    colores,
  };
  const codigo = validar(argumentos, enMemoria(archivos), consola);
  return { codigo, salida, errores };
}

const PROYECTO = {
  'vocabularios/v.vocabulario.md': VOCABULARIO,
  'historias/a.historia.md': historia('HU-X-001'),
  'historias/sub/b.historia.md': historia('HU-X-002'),
  'node_modules/p/c.historia.md': 'no se lee',
  'README.md': '# no se lee',
};

describe('custodio validar', () => {
  it('sin errores sale con 0 y dice cuántos archivos revisó', () => {
    const r = correr(['historias/'], PROYECTO);
    expect(r.codigo).toBe(SALIDA.sinErrores);
    expect(r.salida).toBe('0 errores y 0 advertencias en 3 archivos.\n');
    expect(r.errores).toBe('');
  });

  it('por defecto recorre la carpeta actual, sin entrar a node_modules', () => {
    expect(correr([], PROYECTO).salida).toBe('0 errores y 0 advertencias en 3 archivos.\n');
  });

  it('con errores sale con 1 y muestra la línea con una marca bajo la columna', () => {
    const r = correr(['historias/a.historia.md'], {
      ...PROYECTO,
      'historias/a.historia.md': historia('HU-X-001', '- CUANDO presiona el botón "Entrar"'),
    });
    expect(r.codigo).toBe(SALIDA.conErrores);
    expect(r.salida).toBe(
      [
        'historias/a.historia.md:19:10  error  CUS-E006',
        '  Frase desconocida: «presiona el botón "Entrar"».',
        '    19 │ - CUANDO presiona el botón "Entrar"',
        '       │          ^',
        '  ¿Quisiste decir «presiono el botón "Entrar"»?',
        '',
        '1 error y 0 advertencias en 2 archivos.',
        '',
      ].join('\n'),
    );
  });

  it('las advertencias no cambian el código de salida, y usa colores si puede', () => {
    const r = correr(
      ['historias/a.historia.md'],
      { ...PROYECTO, 'historias/a.historia.md': `${historia('HU-X-001')}\n## Limpiza\n` },
      true,
    );
    expect(r.codigo).toBe(SALIDA.sinErrores);
    expect(r.salida).toContain('\u001b[33madvertencia\u001b[0m  CUS-W006');
    expect(r.salida).toContain('0 errores y 1 advertencia en 2 archivos.');
  });

  it('--vocabularios cambia la carpeta de los vocabularios', () => {
    const archivos = {
      'h.historia.md': historia('HU-X-001'),
      'otros/v.vocabulario.md': VOCABULARIO,
    };
    expect(correr(['h.historia.md'], archivos).codigo).toBe(SALIDA.conErrores);
    expect(correr(['h.historia.md', '--vocabularios', 'otros'], archivos).codigo).toBe(
      SALIDA.sinErrores,
    );
  });

  it.each([
    [['no-existe'], 'La ruta «no-existe» no existe.'],
    [['README.md'], '«README.md» no es un .historia.md ni un .vocabulario.md.'],
    [['--vocabularios', 'nada'], 'La carpeta de vocabularios «nada» no existe.'],
    [['--otra'], "Unknown option '--otra'"],
  ])('uso inválido %j: sale con 2 y explica el uso', (argumentos, mensaje) => {
    const r = correr(argumentos, PROYECTO);
    expect(r.codigo).toBe(SALIDA.usoInvalido);
    expect(r.errores).toContain(mensaje);
    expect(r.errores).toContain('Uso: custodio validar');
    expect(r.salida).toBe('');
  });

  describe('--json', () => {
    const ajv = new Ajv2020({ allErrors: true, strictTypes: true });
    const validarSalida = ajv.compile(
      JSON.parse(
        readFileSync(join(RAIZ, 'docs', 'dsl', 'diagnosticos.schema.json'), 'utf8'),
      ) as object,
    );

    it('cumple su Schema, con y sin diagnósticos', () => {
      for (const archivos of [
        PROYECTO,
        { ...PROYECTO, 'historias/a.historia.md': historia('HU-X-002') },
      ]) {
        const json: unknown = JSON.parse(correr(['--json'], archivos).salida);
        expect(validarSalida(json), ajv.errorsText(validarSalida.errors)).toBe(true);
      }
    });

    it('cuenta archivos, errores y advertencias', () => {
      const archivos = { ...PROYECTO, 'historias/a.historia.md': historia('HU-X-002') };
      expect(JSON.parse(correr(['--json'], archivos).salida)).toMatchObject({
        formato: 'custodio-diagnosticos/0.1.0',
        archivos: 3,
        errores: 1,
        advertencias: 0,
        diagnosticos: [
          { codigo: 'CUS-E003', archivo: 'historias/sub/b.historia.md', linea: 3, columna: 5 },
        ],
      });
    });
  });
});

describe('el proceso real', () => {
  const custodio = (...argumentos: string[]) =>
    spawnSync(process.execPath, [join('src', 'arranque', 'cli', 'custodio.ts'), ...argumentos], {
      cwd: RAIZ,
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1' },
    });

  it('valida las historias del repositorio, sin escribir nada en la salida de errores', () => {
    // Si Node volviera a escribir un ExperimentalWarning al quitar los tipos, esta prueba lo diría.
    const proceso = custodio('validar', 'historias', '--json');
    expect(proceso.stderr).toBe('');
    expect(proceso.status).toBe(SALIDA.sinErrores);
    expect(JSON.parse(proceso.stdout)).toMatchObject({ archivos: 13, errores: 0, advertencias: 0 });
  });

  it('sin comando, o con uno desconocido, sale con 2; con ayuda, con 0', () => {
    expect(custodio().status).toBe(SALIDA.usoInvalido);
    expect(custodio('compilar').stderr).toContain('Comando desconocido: «compilar».');
    expect(custodio('ayuda').status).toBe(SALIDA.sinErrores);
  });
});
