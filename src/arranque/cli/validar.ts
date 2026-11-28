/**
 * `custodio validar`: busca y lee los archivos, llama al validador de
 * `lenguaje` y escribe sus diagnósticos (diseño de la semana 3, §8).
 *
 * Recibe la E/S como parámetros, así que sus pruebas corren sin disco.
 */
import { analizar } from '../../lenguaje/index.ts';
import { presentarJson, presentarLegible } from './presentar.ts';
import {
  AYUDA_DEL_PROYECTO,
  correr,
  leerProyecto,
  OPCIONES_DEL_PROYECTO,
  SALIDA,
  type Consola,
  type SistemaDeArchivos,
} from './proyecto.ts';

export const USO_DE_VALIDAR = `Uso: custodio validar [rutas...] [--json] [--vocabularios <carpeta>] [--ambiente <archivo>]

Valida las historias y los vocabularios: la sintaxis y la semántica.
${AYUDA_DEL_PROYECTO}

  --json                     Salida en JSON (formato custodio-diagnosticos/0.1.0).

Sale con 0 si no hay errores, 1 si los hay, 2 si el uso es inválido y 3 si falla algo interno.`;

export function validar(
  argumentos: readonly string[],
  sistema: SistemaDeArchivos,
  consola: Consola,
): number {
  const opciones = { ...OPCIONES_DEL_PROYECTO, json: { type: 'boolean' } } as const;
  return correr(argumentos, opciones, USO_DE_VALIDAR, consola, ({ values, positionals }) => {
    const proyecto = leerProyecto(positionals, values, sistema);
    const resultado = analizar(proyecto);
    const fuentes = [
      ...proyecto.historias,
      ...proyecto.vocabularios,
      ...(proyecto.ambiente ? [proyecto.ambiente] : []),
    ];
    consola.escribir(
      values.json
        ? presentarJson(resultado.diagnosticos, proyecto.archivos)
        : presentarLegible(resultado.diagnosticos, proyecto.archivos, fuentes, consola.colores),
    );
    return resultado.diagnosticos.some((d) => d.severidad === 'error')
      ? SALIDA.conErrores
      : SALIDA.sinErrores;
  });
}
