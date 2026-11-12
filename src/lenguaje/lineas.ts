/**
 * Primer nivel del analizador: cada línea se clasifica sola, sin mirar el
 * contexto (diseño de la semana 3, §4.2). El léxico nunca falla.
 */

export type ClaseDeLinea =
  'delimitador' | 'titulo' | 'narrativa' | 'paso' | 'declaracion' | 'blanco' | 'texto';

export function claseDeLinea(texto: string): ClaseDeLinea {
  if (texto.trim() === '') return 'blanco';
  if (texto.trimEnd() === '---') return 'delimitador';
  if (texto.startsWith('## ')) return 'titulo';
  if (/^\*\*(Como|Quiero|Para)\*\*/.test(texto)) return 'narrativa';
  if (texto.startsWith('- ')) return 'paso';
  if (texto.startsWith('> ')) return 'declaracion';
  return 'texto';
}

/** Una línea `clave: valor`, como la primera de un frontmatter. */
export const pareceCampo = (texto: string): boolean => /^[A-Za-z_][\w-]*:/.test(texto);
