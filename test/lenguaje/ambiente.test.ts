/**
 * Los archivos de ambiente (docs/dsl/especificacion.md, §9.5):
 * - cada uno tiene su frontmatter y sus listas de variables y secretos;
 * - declaran cada variable en MAYÚSCULAS que usan las historias y el vocabulario,
 *   para que el validador de la S3 pueda revisar CUS-E011 y CUS-E013.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { VERSION_AST } from '../../src/lenguaje/index.ts';

const RAIZ = join(import.meta.dirname, '..', '..');
const AMBIENTES = join(RAIZ, 'ambientes');
const HISTORIAS = join(RAIZ, 'historias');
const VOCABULARIO = join(RAIZ, 'vocabularios', 'acutis-suite.vocabulario.md');

const leer = (ruta: string): string => readFileSync(ruta, 'utf8');
const campo = (texto: string, nombre: string): string | undefined =>
  new RegExp(`^${nombre}: (.+)$`, 'm').exec(texto)?.[1];

/** Los nombres de una sección `## …` del ambiente: un `- NOMBRE` por línea. */
function nombres(ambiente: string, seccion: string): string[] {
  let actual = '';
  const encontrados: string[] = [];
  for (const linea of ambiente.split('\n')) {
    if (linea.startsWith('## ')) actual = linea.slice(3).trim();
    else if (actual === seccion && linea.startsWith('- ')) encontrados.push(linea.slice(2).trim());
  }
  return encontrados;
}

/** `USUARIO_*` calza con cualquier final de letras, dígitos y `_`. */
const calza = (nombre: string, declarado: string): boolean =>
  declarado.endsWith('*')
    ? nombre.startsWith(declarado.slice(0, -1)) && /^\w*$/.test(nombre.slice(declarado.length - 1))
    : nombre === declarado;

const ambientes = readdirSync(AMBIENTES)
  .filter((n) => n.endsWith('.ambiente.md'))
  .map((nombre) => ({ nombre, texto: leer(join(AMBIENTES, nombre)) }));

describe('ambientes (ambientes/)', () => {
  it('hay al menos uno', () => {
    expect(ambientes.length).toBeGreaterThanOrEqual(1);
  });

  it.each(ambientes)('$nombre tiene su frontmatter, variables y secretos', ({ nombre, texto }) => {
    const variables = nombres(texto, 'Variables');
    const secretos = nombres(texto, 'Secretos');
    expect(nombre).toBe(`${campo(texto, 'ambiente') ?? ''}.ambiente.md`);
    expect(campo(texto, 'dsl')).toBe(VERSION_AST);
    expect(campo(texto, 'desechable')).toMatch(/^(sí|no)$/);
    expect(variables.length).toBeGreaterThan(0);
    expect(secretos.filter((s) => variables.includes(s))).toEqual([]);
  });

  it.each(ambientes)(
    '$nombre declara cada variable en MAYÚSCULAS de las historias y el vocabulario',
    ({ texto }) => {
      const textos = [
        leer(VOCABULARIO),
        ...readdirSync(HISTORIAS)
          .filter((n) => n.endsWith('.historia.md'))
          .map((n) => leer(join(HISTORIAS, n))),
      ];
      // Un parámetro dentro del nombre (`CLAVE_{rol}`) se revisa como un valor cualquiera.
      const usadas = new Set(
        textos.flatMap((t) =>
          [...t.matchAll(/\$\{([A-Z][\w{}]*)\}/g)].map((m) =>
            (m[1] ?? '').replace(/\{\w+\}/g, 'x'),
          ),
        ),
      );
      usadas.delete('PREFIJO');
      const declaradas = [...nombres(texto, 'Variables'), ...nombres(texto, 'Secretos')];
      expect([...usadas].filter((v) => !declaradas.some((d) => calza(v, d)))).toEqual([]);
    },
  );
});
