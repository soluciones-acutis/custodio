/**
 * Los tokens de una frase: palabras, cadenas entre comillas y código entre
 * acentos graves (diseño de la semana 3, §4.4). Las variables `${…}` quedan
 * dentro de las cadenas y del código, sin resolver.
 */
import { comparable } from './texto.ts';

export type Token =
  | {
      readonly tipo: 'palabra';
      readonly texto: string;
      readonly comparable: string;
      readonly columna: number;
    }
  | { readonly tipo: 'cadena'; readonly texto: string; readonly columna: number }
  | { readonly tipo: 'codigo'; readonly texto: string; readonly columna: number };

export type ResultadoDeTokens =
  | { readonly ok: true; readonly tokens: readonly Token[] }
  | { readonly ok: false; readonly columna: number; readonly mensaje: string };

const esEspacio = (c: string | undefined): boolean => c === ' ' || c === '\t';

/**
 * Parte en tokens los caracteres de una línea desde la columna `desde`.
 * En una cadena, `\"` es una comilla y `\\` una barra; otra barra es literal (§6.4).
 */
export function tokenizar(caracteres: readonly string[], desde: number): ResultadoDeTokens {
  const tokens: Token[] = [];
  let i = desde - 1;
  while (i < caracteres.length) {
    const c = caracteres[i];
    if (esEspacio(c)) {
      i++;
      continue;
    }
    const columna = i + 1;
    if (c === '"') {
      let texto = '';
      i++;
      for (;;) {
        const actual = caracteres[i];
        if (actual === undefined) {
          return {
            ok: false,
            columna,
            mensaje: 'La cadena que empieza aquí no se cierra con `"`.',
          };
        }
        if (actual === '"') break;
        const siguiente = caracteres[i + 1];
        if (actual === '\\' && (siguiente === '"' || siguiente === '\\')) {
          texto += siguiente;
          i += 2;
          continue;
        }
        texto += actual;
        i++;
      }
      i++;
      tokens.push({ tipo: 'cadena', texto, columna });
    } else if (c === '`') {
      const cierre = caracteres.indexOf('`', i + 1);
      if (cierre === -1) {
        return {
          ok: false,
          columna,
          mensaje: 'El código que empieza aquí no se cierra con un acento grave.',
        };
      }
      tokens.push({ tipo: 'codigo', texto: caracteres.slice(i + 1, cierre).join(''), columna });
      i = cierre + 1;
    } else {
      let texto = '';
      while (i < caracteres.length) {
        const actual = caracteres[i];
        if (actual === undefined || esEspacio(actual) || actual === '"' || actual === '`') break;
        texto += actual;
        i++;
      }
      tokens.push({ tipo: 'palabra', texto, comparable: comparable(texto), columna });
    }
  }
  return { ok: true, tokens };
}

/** La frase como texto, con `"…"` en lugar de cada cadena: para comparar y sugerir. */
export const firma = (tokens: readonly Token[]): string =>
  tokens
    .map((t) => (t.tipo === 'palabra' ? t.comparable : t.tipo === 'cadena' ? '"…"' : '`…`'))
    .join(' ');
