/**
 * Sugerencias para los diagnósticos (DSL-12): «¿Quisiste decir…?».
 */

/**
 * Distancia de edición de Damerau-Levenshtein (variante de alineación óptima):
 * inserciones, borrados, reemplazos y transposiciones de dos caracteres vecinos.
 * Cuenta puntos de código.
 */
export function distancia(a: string, b: string): number {
  const x = Array.from(a);
  const y = Array.from(b);
  const filas = Array.from({ length: x.length + 1 }, (_, i) =>
    Array.from({ length: y.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  const celda = (i: number, j: number): number => filas[i]?.[j] ?? 0;
  for (let i = 1; i <= x.length; i++) {
    for (let j = 1; j <= y.length; j++) {
      const costo = x[i - 1] === y[j - 1] ? 0 : 1;
      let valor = Math.min(celda(i - 1, j) + 1, celda(i, j - 1) + 1, celda(i - 1, j - 1) + costo);
      if (i > 1 && j > 1 && x[i - 1] === y[j - 2] && x[i - 2] === y[j - 1]) {
        valor = Math.min(valor, celda(i - 2, j - 2) + 1);
      }
      const fila = filas[i];
      if (fila) fila[j] = valor;
    }
  }
  return celda(x.length, y.length);
}

/**
 * El candidato más parecido a `texto`, si está lo bastante cerca: a lo más
 * `maximo` ediciones. Con un empate gana el primero de la lista.
 */
export function masParecido(
  texto: string,
  candidatos: readonly string[],
  maximo: number,
): string | null {
  let mejor: string | null = null;
  let mejorDistancia = maximo + 1;
  for (const candidato of candidatos) {
    const d = distancia(texto, candidato);
    if (d < mejorDistancia) {
      mejor = candidato;
      mejorDistancia = d;
    }
  }
  return mejor;
}
