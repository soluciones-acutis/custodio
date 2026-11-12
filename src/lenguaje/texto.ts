/**
 * El texto de un archivo, partido en líneas con sus caracteres.
 *
 * Las posiciones se cuentan en puntos de código sobre el texto original: una
 * línea es un arreglo de caracteres (`Array.from`), y la columna de un carácter
 * es su índice más 1. El texto no se normaliza: NFC se aplica solo al comparar
 * (`comparable`), para que una tilde combinada no corra las columnas.
 */

export interface Linea {
  /** Número de línea, desde 1. */
  readonly numero: number;
  readonly texto: string;
  /** Los caracteres de la línea, por punto de código. */
  readonly caracteres: readonly string[];
}

/** Parte el texto en líneas. Quita el BOM y el `\r` de los fines de línea CRLF. */
export function lineasDe(texto: string): Linea[] {
  const sinBom = texto.startsWith('\uFEFF') ? texto.slice(1) : texto;
  return sinBom.split('\n').map((cruda, indice) => {
    const linea = cruda.endsWith('\r') ? cruda.slice(0, -1) : cruda;
    return { numero: indice + 1, texto: linea, caracteres: Array.from(linea) };
  });
}

/** La forma de un texto para compararlo: NFC y en minúsculas. */
export const comparable = (texto: string): string => texto.normalize('NFC').toLowerCase();

/** Columna (desde 1) del primer carácter que no es un espacio, a partir de `desde`. */
export function saltarEspacios(caracteres: readonly string[], desde: number): number {
  let i = desde - 1;
  while (i < caracteres.length && (caracteres[i] === ' ' || caracteres[i] === '\t')) i++;
  return i + 1;
}
