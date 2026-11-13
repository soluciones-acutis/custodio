/**
 * Los casos del lenguaje v0.1 (docs/dsl/especificacion.md, §13):
 * - cada código de error de la especificación tiene su caso inválido, y al revés;
 * - el analizador informa el error de cada caso de sintaxis, en su línea y su
 *   columna, y ningún otro; los de semántica esperan al validador semántico;
 * - las historias del inventario son los casos válidos;
 * - todo lo del lenguaje comparte una sola versión.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  analizar,
  CATALOGO,
  VERSION_AST,
  type CodigoDeDiagnostico,
} from '../../src/lenguaje/index.ts';

const RAIZ = join(import.meta.dirname, '..', '..');
const INVALIDOS = join(RAIZ, 'test', 'lenguaje', 'casos', 'invalidos');
const HISTORIAS = join(RAIZ, 'historias');
const VOCABULARIO = join(RAIZ, 'vocabularios', 'acutis-suite.vocabulario.md');
const ESPECIFICACION = join(RAIZ, 'docs', 'dsl', 'especificacion.md');

interface Caso {
  readonly archivo: string;
  readonly codigo: CodigoDeDiagnostico;
  readonly requisito: string;
  readonly descripcion: string;
  readonly etapa: 'sintaxis' | 'semantica';
  readonly linea?: number;
  readonly columna?: number;
  /** El archivo del diagnóstico cuando no es la historia. */
  readonly en?: string;
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
    const cubiertos = new Set<string>(casos.map((c) => c.codigo));
    expect(codigosDeError.filter((c) => c && !cubiertos.has(c))).toEqual([]);
  });

  it('cada caso espera un código que está en la especificación', () => {
    expect(casos.filter((c) => !codigosDeError.includes(c.codigo))).toEqual([]);
  });

  it.each(casos)('$archivo está en la etapa de su código', ({ codigo, etapa }) => {
    expect(etapa).toBe(CATALOGO[codigo].etapa);
  });
});

describe('el analizador con los casos inválidos', () => {
  const fuente = (carpeta: string, nombre: string) => ({
    ruta: nombre,
    texto: leer(join(carpeta, nombre)),
  });
  const deSintaxis = casos.filter((c) => c.etapa === 'sintaxis');

  it.each(deSintaxis)(
    '$archivo informa $codigo en su línea y su columna, y ningún otro error',
    ({ archivo, codigo, linea, columna, en, vocabulario }) => {
      const { diagnosticos, historias } = analizar({
        historias: [fuente(INVALIDOS, archivo)],
        vocabularios: [
          { ruta: 'acutis-suite.vocabulario.md', texto: leer(VOCABULARIO) },
          ...(vocabulario ? [fuente(INVALIDOS, vocabulario)] : []),
        ],
      });
      const errores = diagnosticos
        .filter((d) => d.severidad === 'error')
        .map(({ codigo, archivo, linea, columna }) => ({ codigo, archivo, linea, columna }));
      const esperados: unknown[] = [{ codigo, archivo: en ?? archivo, linea, columna }];
      // Un error en un vocabulario deja a la historia que lo importa con un CUS-E009 (regla 2 de §6.3).
      if (en) esperados.push(expect.objectContaining({ codigo: 'CUS-E009', archivo }));
      expect(errores).toHaveLength(esperados.length);
      expect(errores).toEqual(expect.arrayContaining(esperados));
      expect(historias).toEqual([]);
    },
  );

  for (const { archivo } of casos.filter((c) => c.etapa === 'semantica')) {
    it.todo(`${archivo}: con el validador semántico`);
  }
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
