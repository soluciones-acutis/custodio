/**
 * `custodio compilar` (diseño de la semana 4, §2): los planes en la salida
 * estándar, los diagnósticos en la de errores, y la selección de DSL-15.
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compilar } from '../../src/arranque/cli/compilar.ts';
import { SALIDA } from '../../src/arranque/cli/proyecto.ts';
import type { Plan } from '../../src/lenguaje/index.ts';
import { correr as correrComando, historia, PROYECTO } from './memoria.ts';

const RAIZ = join(import.meta.dirname, '..', '..');
const correr = (argumentos: readonly string[], archivos = PROYECTO) =>
  correrComando(compilar, argumentos, archivos);
const planes = (salida: string): Plan[] => JSON.parse(salida) as Plan[];

describe('custodio compilar', () => {
  it('escribe un plan por historia en la salida estándar y sale con 0', () => {
    const r = correr(['historias']);
    expect(r.codigo).toBe(SALIDA.sinErrores);
    expect(r.errores).toBe('');
    expect(planes(r.salida).map((p) => [p.historia.id, p.ambiente])).toEqual([
      ['HU-X-001', 'a'],
      ['HU-X-002', 'a'],
    ]);
  });

  it.each([
    [['--id', 'HU-X-002'], ['HU-X-002']],
    [
      ['--etiqueta', 'prueba', '--etiqueta', 'otra'],
      ['HU-X-001', 'HU-X-002'],
    ],
    [['--etiqueta', 'otra', '--criticidad', 'alta'], []],
    [
      ['--producto', 'x', '--criticidad', 'media'],
      ['HU-X-001', 'HU-X-002'],
    ],
  ])('selecciona con %j', (argumentos, ids) => {
    expect(planes(correr(['historias', ...argumentos]).salida).map((p) => p.historia.id)).toEqual(
      ids,
    );
  });

  it('con errores no escribe ningún plan: muestra los errores en la salida de errores y sale con 1', () => {
    const r = correr(['historias'], {
      ...PROYECTO,
      'historias/a.historia.md': historia('HU-X-001', '- CUANDO presiona'),
    });
    expect(r.codigo).toBe(SALIDA.conErrores);
    expect(r.salida).toBe('');
    expect(r.errores).toContain('historias/a.historia.md:20:10  error  CUS-E006');
  });

  it('con advertencias compila y las cuenta en la salida de errores', () => {
    const r = correr(['historias'], {
      ...PROYECTO,
      'historias/a.historia.md': historia('HU-X-001', '- CUANDO entro'),
    });
    expect(r.codigo).toBe(SALIDA.sinErrores);
    expect(r.errores).toBe('1 advertencia: corre custodio validar para verlas.');
    expect(planes(r.salida)).toHaveLength(2);
  });

  it('--help muestra el uso', () => {
    expect(correr(['--help']).salida).toContain('Uso: custodio compilar');
  });
});

describe('el proceso real', () => {
  it('compila una historia del repositorio', () => {
    const proceso = spawnSync(
      process.execPath,
      [
        join('src', 'arranque', 'cli', 'custodio.ts'),
        'compilar',
        'historias',
        '--id',
        'HU-SUITE-001',
      ],
      { cwd: RAIZ, encoding: 'utf8' },
    );
    expect(proceso.status).toBe(SALIDA.sinErrores);
    const [plan] = planes(proceso.stdout);
    expect(plan?.historia.id).toBe('HU-SUITE-001');
    expect(plan?.escenarios.every((e) => e.estado === 'ejecutable')).toBe(true);
  });
});
