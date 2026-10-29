/**
 * Los casos del lenguaje v0.1 (docs/dsl/especificacion.md, §13):
 * - cada código de error de la especificación tiene su caso inválido, y al revés;
 * - las historias del inventario son los casos válidos;
 * - todo lo del lenguaje comparte una sola versión.
 *
 * El validador llega en la S3. Esta prueba asegura, desde ya, que los casos
 * contra los que se va a medir existen y están completos.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { VERSION_AST } from '../../src/lenguaje/index.ts';

const RAIZ = join(import.meta.dirname, '..', '..');
const INVALIDOS = join(RAIZ, 'test', 'lenguaje', 'casos', 'invalidos');
const HISTORIAS = join(RAIZ, 'historias');
const VOCABULARIO = join(RAIZ, 'vocabularios', 'acutis-suite.vocabulario.md');
const ESPECIFICACION = join(RAIZ, 'docs', 'dsl', 'especificacion.md');

interface Caso {
  readonly archivo: string;
  readonly codigo: string;
  readonly requisito: string;
  readonly descripcion: string;
  readonly vocabulario?: string;
}

const leer = (ruta: string): string => readFileSync(ruta, 'utf8');
const casos = (JSON.parse(leer(join(INVALIDOS, 'esperados.json'))) as { casos: Caso[] }).casos;
const especificacion = leer(ESPECIFICACION);
const codigosDeError = [...especificacion.matchAll(/^\| `(CUS-E\d{3})` \|/gm)].map((m) => m[1]);
const campo = (texto: string, nombre: string): string | undefined =>
  new RegExp(`^${nombre}: (.+)$`, 'm').exec(texto)?.[1];

describe('casos inválidos (test/lenguaje/casos/invalidos)', () => {
  it('hay al menos 15', () => {
    expect(casos.length).toBeGreaterThanOrEqual(15);
  });

  it('cada caso existe y cada historia de la carpeta tiene su caso', () => {
    const historias = readdirSync(INVALIDOS).filter((n) => n.endsWith('.historia.md'));
    expect(historias.sort()).toEqual(casos.map((c) => c.archivo).sort());
  });

  it.each(casos)('$archivo espera un código de error válido', ({ codigo, vocabulario }) => {
    expect(codigo).toMatch(/^CUS-E\d{3}$/);
    if (vocabulario) expect(existsSync(join(INVALIDOS, vocabulario))).toBe(true);
  });

  it('la especificación tiene la tabla de códigos de error', () => {
    expect(codigosDeError.length).toBeGreaterThanOrEqual(15);
  });

  it('cada código de error de la especificación tiene un caso', () => {
    const cubiertos = new Set(casos.map((c) => c.codigo));
    expect(codigosDeError.filter((c) => c && !cubiertos.has(c))).toEqual([]);
  });

  it('cada caso espera un código que está en la especificación', () => {
    expect(casos.filter((c) => !codigosDeError.includes(c.codigo))).toEqual([]);
  });
});

describe('casos válidos (historias)', () => {
  const historias = readdirSync(HISTORIAS)
    .filter((n) => n.endsWith('.historia.md'))
    .map((nombre) => ({ nombre, texto: leer(join(HISTORIAS, nombre)) }));

  it('son al menos 12, las del inventario', () => {
    expect(historias.length).toBeGreaterThanOrEqual(12);
  });

  it.each(historias)(
    '$nombre tiene un id válido, igual al nombre del archivo',
    ({ nombre, texto }) => {
      const id = campo(texto, 'id');
      expect(id).toMatch(/^HU-[A-Z]+-\d{3}$/);
      expect(nombre).toBe(`${id ?? ''}.historia.md`);
    },
  );

  it('los ids no se repiten', () => {
    const ids = historias.map(({ texto }) => campo(texto, 'id'));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('una sola versión del lenguaje', () => {
  it.each([
    {
      donde: 'la especificación',
      version: /\*\*Versión del lenguaje:\*\* `([^`]+)`/.exec(especificacion)?.[1],
    },
    { donde: 'el vocabulario acutis-suite', version: campo(leer(VOCABULARIO), 'dsl') },
    ...readdirSync(HISTORIAS)
      .filter((n) => n.endsWith('.historia.md'))
      .map((n) => ({ donde: n, version: campo(leer(join(HISTORIAS, n)), 'dsl') })),
  ])('$donde usa la versión del AST', ({ version }) => {
    expect(version).toBe(VERSION_AST);
  });
});
