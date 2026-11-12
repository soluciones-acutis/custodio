/**
 * La salida de `custodio validar`: legible para personas, o JSON para máquinas
 * (diseño de la semana 3, §8.2 y §8.3).
 */
import type { ArchivoFuente, Diagnostico } from '../../lenguaje/index.ts';

/** La versión del formato de `--json`, descrito en docs/dsl/diagnosticos.schema.json. */
export const FORMATO_JSON = 'custodio-diagnosticos/0.1.0';

export function presentarJson(diagnosticos: readonly Diagnostico[], archivos: number): string {
  const errores = diagnosticos.filter((d) => d.severidad === 'error').length;
  return `${JSON.stringify(
    {
      formato: FORMATO_JSON,
      archivos,
      errores,
      advertencias: diagnosticos.length - errores,
      diagnosticos,
    },
    null,
    2,
  )}\n`;
}

const COLOR = { rojo: '\u001b[31m', amarillo: '\u001b[33m', tenue: '\u001b[2m', fin: '\u001b[0m' };

/**
 * Cada diagnóstico en el formato `archivo:línea:columna` que entienden los
 * editores, con la línea del archivo y una marca bajo la columna.
 */
export function presentarLegible(
  diagnosticos: readonly Diagnostico[],
  archivos: number,
  fuentes: readonly ArchivoFuente[],
  colores: boolean,
): string {
  const pintar = (color: keyof typeof COLOR, texto: string): string =>
    colores ? `${COLOR[color]}${texto}${COLOR.fin}` : texto;
  const lineas = new Map(fuentes.map((f) => [f.ruta, f.texto.split('\n')]));
  const bloques = diagnosticos.map((d) => {
    const severidad =
      d.severidad === 'error' ? pintar('rojo', 'error') : pintar('amarillo', 'advertencia');
    const salida = [
      `${d.archivo}:${String(d.linea)}:${String(d.columna)}  ${severidad}  ${d.codigo}`,
      `  ${d.mensaje}`,
    ];
    const linea = lineas
      .get(d.archivo)
      ?.[d.linea - 1]?.replace(/\r$/, '')
      .replace(/^\uFEFF/, '');
    if (linea !== undefined) {
      const numero = String(d.linea);
      // La marca va bajo la columna, contando puntos de código como el analizador.
      const antes = Array.from(linea)
        .slice(0, d.columna - 1)
        .map((c) => (c === '\t' ? '\t' : ' '))
        .join('');
      salida.push(
        `${pintar('tenue', `    ${numero} │`)} ${linea}`,
        `${pintar('tenue', `    ${' '.repeat(numero.length)} │`)} ${antes}^`,
      );
    }
    if (d.sugerencia) salida.push(`  ${d.sugerencia}`);
    return salida.join('\n');
  });
  return `${[...bloques, resumen(diagnosticos, archivos)].join('\n\n')}\n`;
}

function resumen(diagnosticos: readonly Diagnostico[], archivos: number): string {
  const errores = diagnosticos.filter((d) => d.severidad === 'error').length;
  const advertencias = diagnosticos.length - errores;
  const contar = (n: number, singular: string, plural: string): string =>
    `${String(n)} ${n === 1 ? singular : plural}`;
  return `${contar(errores, 'error', 'errores')} y ${contar(advertencias, 'advertencia', 'advertencias')} en ${contar(archivos, 'archivo', 'archivos')}.`;
}
