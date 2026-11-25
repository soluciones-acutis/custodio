/**
 * El catálogo de diagnósticos (src/lenguaje/diagnosticos.ts) y la tabla del §13
 * de la especificación tienen los mismos códigos, con la misma severidad.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATALOGO } from '../../src/lenguaje/index.ts';
import { distancia, masParecido } from '../../src/lenguaje/sugerencias.ts';

const especificacion = readFileSync(
  join(import.meta.dirname, '..', '..', 'docs', 'dsl', 'especificacion.md'),
  'utf8',
);
const enLaEspecificacion = [...especificacion.matchAll(/^\| `(CUS-[EW]\d{3})` \|/gm)].map(
  (m) => m[1],
);

describe('catálogo de diagnósticos', () => {
  it('tiene los mismos códigos que la tabla del §13', () => {
    expect(Object.keys(CATALOGO).sort()).toEqual([...enLaEspecificacion].sort());
  });

  it.each(Object.entries(CATALOGO))('%s: la severidad sale del código', (codigo, { severidad }) => {
    expect(severidad).toBe(codigo.startsWith('CUS-E') ? 'error' : 'advertencia');
  });

  it.each(Object.entries(CATALOGO))('%s: la etapa es la de la tabla', (codigo, { etapa }) => {
    const fila = new RegExp(`^\\| \`${codigo}\` \\|.*\\| (sintaxis|semántica) \\|$`, 'm').exec(
      especificacion,
    );
    expect(fila?.[1]).toBe(etapa === 'semantica' ? 'semántica' : 'sintaxis');
  });
});

describe('sugerencias', () => {
  it.each([
    ['presiona', 'presiono', 1],
    ['criticidd', 'criticidad', 1],
    ['Limpiza', 'Limpieza', 1],
    ['ab', 'ba', 1],
    ['', 'abc', 3],
    ['sí', 'si', 1],
  ])('distancia(%s, %s) = %i', (a, b, esperada) => {
    expect(distancia(a, b)).toBe(esperada);
  });

  it('elige el candidato más cercano dentro del máximo', () => {
    expect(masParecido('presiona', ['presiono', 'espero'], 2)).toBe('presiono');
    expect(masParecido('xyz', ['presiono'], 2)).toBeNull();
  });
});
