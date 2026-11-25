/**
 * `custodio validar` (diseño de la semana 3, §8): rutas, vocabularios,
 * ambiente, salida legible y `--json`, y códigos de salida. Casi todas las
 * pruebas usan un sistema de archivos en memoria; las últimas lanzan el proceso real.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { SALIDA } from '../../src/arranque/cli/proyecto.ts';
import { validar } from '../../src/arranque/cli/validar.ts';
import {
  AMBIENTE,
  correr as correrComando,
  enMemoria,
  historia,
  PROYECTO,
  VOCABULARIO,
} from './memoria.ts';

const RAIZ = join(import.meta.dirname, '..', '..');
const correr = (
  argumentos: readonly string[],
  archivos: Readonly<Record<string, string>>,
  opciones?: Parameters<typeof correrComando>[3],
) => correrComando(validar, argumentos, archivos, opciones);

describe('custodio validar', () => {
  it('sin errores sale con 0 y dice cuántos archivos revisó, con el vocabulario y el ambiente', () => {
    const r = correr(['historias/'], PROYECTO);
    expect(r.codigo).toBe(SALIDA.sinErrores);
    expect(r.salida).toBe('0 errores y 0 advertencias en 4 archivos.\n');
    expect(r.errores).toBe('');
  });

  it('por defecto recorre la carpeta actual, sin entrar a node_modules', () => {
    expect(correr([], PROYECTO).salida).toBe('0 errores y 0 advertencias en 4 archivos.\n');
  });

  it('con errores sale con 1 y muestra la línea con una marca bajo la columna', () => {
    const r = correr(['historias/a.historia.md'], {
      ...PROYECTO,
      'historias/a.historia.md': historia('HU-X-001', '- CUANDO presiona el botón "Entrar"'),
    });
    expect(r.codigo).toBe(SALIDA.conErrores);
    expect(r.salida).toBe(
      [
        'historias/a.historia.md:20:10  error  CUS-E006',
        '  Frase desconocida: «presiona el botón "Entrar"».',
        '    20 │ - CUANDO presiona el botón "Entrar"',
        '       │          ^',
        '  ¿Quisiste decir «presiono el botón "Entrar"»?',
        '',
        '1 error y 0 advertencias en 3 archivos.',
        '',
      ].join('\n'),
    );
  });

  it('las advertencias no cambian el código de salida, y usa colores si puede', () => {
    const r = correr(
      ['historias/a.historia.md'],
      { ...PROYECTO, 'historias/a.historia.md': `${historia('HU-X-001')}\n## Limpiza\n` },
      { colores: true },
    );
    expect(r.codigo).toBe(SALIDA.sinErrores);
    expect(r.salida).toContain('\u001b[33madvertencia\u001b[0m  CUS-W006');
    expect(r.salida).toContain('0 errores y 1 advertencia en 3 archivos.');
  });

  it('revisa la semántica con el ambiente de ./ambientes', () => {
    const r = correr(['historias/a.historia.md'], {
      ...PROYECTO,
      'historias/a.historia.md': historia(
        'HU-X-001',
        '- CUANDO navego a `https://${OTRO}`\n- ENTONCES veo el texto "x"',
      ),
    });
    expect(r.codigo).toBe(SALIDA.conErrores);
    expect(r.salida).toContain('historias/a.historia.md:20:19  error  CUS-E011');
  });

  it('--vocabularios y --ambiente cambian dónde se buscan', () => {
    const archivos = {
      'h.historia.md': historia('HU-X-001'),
      'otros/v.vocabulario.md': VOCABULARIO,
      'config/x.ambiente.md': AMBIENTE,
    };
    expect(correr(['h.historia.md'], archivos).codigo).toBe(SALIDA.conErrores);
    const r = correr(
      ['h.historia.md', '--vocabularios', 'otros', '--ambiente', 'config/x.ambiente.md'],
      archivos,
    );
    expect(r.codigo).toBe(SALIDA.sinErrores);
    expect(r.salida).toBe('0 errores y 0 advertencias en 3 archivos.\n');
  });

  it('un .ambiente.md en las rutas es el ambiente', () => {
    const r = correr(['historias', 'ambientes/a.ambiente.md'], PROYECTO);
    expect(r.salida).toBe('0 errores y 0 advertencias en 4 archivos.\n');
  });

  it.each([
    [['no-existe'], {}, 'La ruta «no-existe» no existe.'],
    [
      ['README.md'],
      {},
      '«README.md» no es un .historia.md, un .vocabulario.md ni un .ambiente.md.',
    ],
    [['--vocabularios', 'nada'], {}, 'La carpeta «nada» no existe.'],
    [['--ambiente', 'nada.ambiente.md'], {}, 'El ambiente «nada.ambiente.md» no existe.'],
    [
      [],
      { 'ambientes/b.ambiente.md': AMBIENTE },
      'Hay varios ambientes (ambientes/a.ambiente.md, ambientes/b.ambiente.md): elige uno con --ambiente.',
    ],
    [['--otra'], {}, "Unknown option '--otra'"],
  ])('uso inválido %j: sale con 2 y explica el uso', (argumentos, extra, mensaje) => {
    const r = correr(argumentos, { ...PROYECTO, ...extra });
    expect(r.codigo).toBe(SALIDA.usoInvalido);
    expect(r.errores).toContain(mensaje);
    expect(r.errores).toContain('Uso: custodio validar');
    expect(r.salida).toBe('');
  });

  it('--help muestra el uso y sale con 0', () => {
    const r = correr(['--help'], PROYECTO);
    expect(r.codigo).toBe(SALIDA.sinErrores);
    expect(r.salida).toContain('Uso: custodio validar');
  });

  it('un fallo interno, como un archivo que no se puede leer, sale con 3', () => {
    const sistema = {
      ...enMemoria(PROYECTO),
      leer: () => {
        throw new Error('permiso denegado');
      },
    };
    const r = correr(['historias'], PROYECTO, { sistema });
    expect(r.codigo).toBe(SALIDA.falloInterno);
    expect(r.errores).toBe('Error interno: permiso denegado');
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
        archivos: 4,
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
    // 12 historias, el vocabulario y el ambiente; las advertencias son las frases sin pasos.
    expect(JSON.parse(proceso.stdout)).toMatchObject({
      archivos: 14,
      errores: 0,
      advertencias: 19,
    });
  });

  it('sin comando, o con uno desconocido, sale con 2; con ayuda, con 0', () => {
    expect(custodio().status).toBe(SALIDA.usoInvalido);
    expect(custodio('ejecutar').stderr).toContain('Comando desconocido: «ejecutar».');
    expect(custodio('ayuda').status).toBe(SALIDA.sinErrores);
  });
});
