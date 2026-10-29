import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(import.meta.dirname, '..', '..', 'src');

const MODULOS = ['lenguaje', 'historias', 'ejecuciones', 'ambientes', 'informes', 'compartido'];
const MODULOS_HEXAGONALES = ['historias', 'ejecuciones', 'ambientes'];
const CAPAS = ['dominio', 'aplicacion', 'infraestructura'];

describe('estructura de src/ (ADR-002)', () => {
  it.each(MODULOS)('el módulo %s tiene su API pública en index.ts', (modulo) => {
    expect(existsSync(join(SRC, modulo, 'index.ts'))).toBe(true);
  });

  it.each(MODULOS_HEXAGONALES.flatMap((modulo) => CAPAS.map((capa) => [modulo, capa])))(
    'el módulo %s tiene la capa %s',
    (modulo, capa) => {
      expect(existsSync(join(SRC, modulo, capa))).toBe(true);
    },
  );

  it.each(['playwright', 'alternativo', 'simulado'])(
    'el motor %s tiene su carpeta en ejecuciones/infraestructura/motores',
    (motor) => {
      expect(existsSync(join(SRC, 'ejecuciones', 'infraestructura', 'motores', motor))).toBe(true);
    },
  );

  it.each(['http', 'cli', 'trabajador'])('arranque tiene la entrada %s', (entrada) => {
    expect(existsSync(join(SRC, 'arranque', entrada))).toBe(true);
  });
});
