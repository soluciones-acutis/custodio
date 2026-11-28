/**
 * `custodio compilar`: valida las historias y escribe sus planes de ejecución
 * en JSON (DSL-14), con la selección de DSL-15 (diseño de la semana 4, §2).
 *
 * Los planes van a la salida estándar, para encadenarlos; los diagnósticos, a
 * la salida de errores.
 */
import { analizar, compilar as compilarPlanes } from '../../lenguaje/index.ts';
import { presentarLegible } from './presentar.ts';
import {
  AYUDA_DEL_PROYECTO,
  correr,
  leerProyecto,
  OPCIONES_DEL_PROYECTO,
  SALIDA,
  type Consola,
  type SistemaDeArchivos,
} from './proyecto.ts';

export const USO_DE_COMPILAR = `Uso: custodio compilar [rutas...] [--id <id>]... [--etiqueta <etiqueta>]... [--producto <producto>]... [--criticidad <criticidad>]...

Valida las historias y escribe en JSON un plan de ejecución por cada historia
(docs/dsl/plan.schema.json). Si hay errores, no escribe ningún plan.
${AYUDA_DEL_PROYECTO}

Selección: cada criterio que se indica tiene que cumplirse, y dentro de un criterio
basta con uno de sus valores. Cada opción se puede repetir.

  --id <id>                  Por ejemplo HU-SUITE-001.
  --etiqueta <etiqueta>
  --producto <producto>
  --criticidad <alta|media|baja>

Sale con 0 si compiló, 1 si hay errores, 2 si el uso es inválido y 3 si falla algo interno.`;

const SELECCION = {
  id: { type: 'string', multiple: true },
  etiqueta: { type: 'string', multiple: true },
  producto: { type: 'string', multiple: true },
  criticidad: { type: 'string', multiple: true },
} as const;

export function compilar(
  argumentos: readonly string[],
  sistema: SistemaDeArchivos,
  consola: Consola,
): number {
  const opciones = { ...OPCIONES_DEL_PROYECTO, ...SELECCION } as const;
  return correr(argumentos, opciones, USO_DE_COMPILAR, consola, ({ values, positionals }) => {
    const proyecto = leerProyecto(positionals, values, sistema);
    const resultado = analizar(proyecto);
    const errores = resultado.diagnosticos.filter((d) => d.severidad === 'error');
    if (errores.length > 0) {
      const fuentes = [
        ...proyecto.historias,
        ...proyecto.vocabularios,
        ...(proyecto.ambiente ? [proyecto.ambiente] : []),
      ];
      consola.error(
        presentarLegible(errores, proyecto.archivos, fuentes, consola.colores).trimEnd(),
      );
      return SALIDA.conErrores;
    }
    const advertencias = resultado.diagnosticos.length;
    if (advertencias > 0) {
      consola.error(
        `${String(advertencias)} ${advertencias === 1 ? 'advertencia' : 'advertencias'}: corre custodio validar para verlas.`,
      );
    }
    const planes = compilarPlanes(resultado, {
      ids: values.id ?? [],
      etiquetas: values.etiqueta ?? [],
      productos: values.producto ?? [],
      criticidades: values.criticidad ?? [],
    });
    consola.escribir(`${JSON.stringify(planes, null, 2)}\n`);
    return SALIDA.sinErrores;
  });
}
