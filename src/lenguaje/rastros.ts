/**
 * Posiciones que el analizador conoce y el AST no guarda: dónde está cada
 * token de un paso, el patrón y el `produce` de una frase, o la lista de
 * vocabularios de una historia. Las usa la etapa de semántica para que sus
 * diagnósticos apunten a la causa (especificación §13), sin volver a leer el
 * texto ni agrandar el AST.
 *
 * Son mapas débiles por nodo del AST: no cambian el AST ni lo retienen.
 */
import type { Posicion } from './diagnosticos.ts';
import type { Token } from './tokens.ts';

/** Los tokens de la oración de un paso, con sus columnas. */
export const tokensDelPaso = new WeakMap<object, readonly Token[]>();

/** Dónde empieza el patrón de una frase, después de `## Frase:`. */
export const posicionDelPatron = new WeakMap<object, Posicion>();

/** La línea `> produce:` de una frase, si la tiene. */
export const posicionDelProduce = new WeakMap<object, Posicion>();

/** El valor de `vocabularios:` en el frontmatter de una historia. */
export const posicionDeLosVocabularios = new WeakMap<object, Posicion>();
