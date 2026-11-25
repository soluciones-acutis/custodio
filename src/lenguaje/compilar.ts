/**
 * El compilador: de las historias válidas al plan de ejecución (DSL-14), y la
 * selección de historias (DSL-15) que comparten `custodio compilar` y
 * `custodio ejecutar` (diseño de la semana 4, §2).
 */
import type { ArchivoDeVocabulario, Historia, Paso } from './ast.ts';
import type { ResultadoDeAnalisis } from './analizar.ts';
import { expandir, type VocabulariosPorNombre } from './expansion.ts';
import { VERSION_PLAN, type EscenarioDelPlan, type Instruccion, type Plan } from './plan.ts';

/**
 * Qué historias compilar. Cada criterio que se indica tiene que cumplirse, y
 * dentro de un criterio basta con uno de sus valores.
 */
export interface Seleccion {
  readonly ids?: readonly string[];
  readonly etiquetas?: readonly string[];
  readonly productos?: readonly string[];
  readonly criticidades?: readonly string[];
}

export function seleccionada(historia: Historia, seleccion: Seleccion): boolean {
  const cumple = (valores: readonly string[] | undefined, de: readonly string[]): boolean =>
    !valores?.length || valores.some((v) => de.includes(v));
  return (
    cumple(seleccion.ids, [historia.id]) &&
    cumple(seleccion.etiquetas, historia.etiquetas) &&
    cumple(seleccion.productos, [historia.producto]) &&
    cumple(seleccion.criticidades, [historia.criticidad])
  );
}

/** Un plan por cada historia válida y seleccionada. */
export function compilar(resultado: ResultadoDeAnalisis, seleccion: Seleccion = {}): Plan[] {
  const vocabularios: VocabulariosPorNombre = new Map(
    resultado.vocabularios.map((v): [string, ArchivoDeVocabulario] => [v.vocabulario, v]),
  );
  const desechable = resultado.ambiente?.desechable ?? false;
  return resultado.historias.flatMap((archivo) =>
    archivo.historias
      .filter((h) => seleccionada(h, seleccion))
      .map((historia): Plan => ({
        plan: VERSION_PLAN,
        historia: {
          id: historia.id,
          titulo: historia.titulo,
          producto: historia.producto,
          criticidad: historia.criticidad,
          etiquetas: historia.etiquetas,
          archivo: archivo.archivo,
        },
        ambiente: resultado.ambiente?.ambiente ?? null,
        escenarios: historia.escenarios.map((escenario) => {
          const pasos = traducir(
            [...historia.antecedentes, ...escenario.pasos],
            archivo.archivo,
            vocabularios,
          );
          const limpieza = traducir(historia.limpieza, archivo.archivo, vocabularios);
          const base = { nombre: escenario.nombre, linea: escenario.origen.linea };
          return estadoDe(base, pasos, limpieza, desechable);
        }),
      })),
  );
}

interface Traducidos {
  readonly instrucciones: Instruccion[];
  /** La primera frase sin pasos, si hay una. */
  readonly sinPasos: string | null;
}

/** El estado de un escenario según sus frases sin pasos (especificación §10.3 y §11.3). */
function estadoDe(
  base: { nombre: string; linea: number },
  pasos: Traducidos,
  limpieza: Traducidos,
  desechable: boolean,
): EscenarioDelPlan {
  if (pasos.sinPasos) {
    return {
      ...base,
      estado: 'incompleto',
      motivo: pasos.sinPasos,
      instrucciones: [],
      limpieza: [],
    };
  }
  if (limpieza.sinPasos && !desechable) {
    return {
      ...base,
      estado: 'incompleto',
      motivo: limpieza.sinPasos,
      instrucciones: [],
      limpieza: [],
    };
  }
  if (limpieza.sinPasos) {
    return {
      ...base,
      estado: 'limpieza_pendiente',
      motivo: limpieza.sinPasos,
      instrucciones: pasos.instrucciones,
      limpieza: [],
    };
  }
  return {
    ...base,
    estado: 'ejecutable',
    motivo: null,
    instrucciones: pasos.instrucciones,
    limpieza: limpieza.instrucciones,
  };
}

function traducir(
  pasos: readonly Paso[],
  archivo: string,
  vocabularios: VocabulariosPorNombre,
): Traducidos {
  const instrucciones: Instruccion[] = [];
  let sinPasos: string | null = null;
  for (const raiz of pasos) {
    for (const evento of expandir(raiz, vocabularios)) {
      if (evento.tipo === 'sin-pasos') sinPasos ??= evento.frase.patron;
      if (evento.tipo !== 'paso' || evento.paso.accion === 'frase') continue;
      const { paso, via } = evento;
      instrucciones.push({
        accion: paso.accion,
        fase: raiz.fase,
        objetivo: paso.objetivo,
        ambito: paso.ambito,
        valor: paso.valor,
        origen: { archivo, linea: raiz.origen.linea, columna: raiz.origen.columna, via },
      });
    }
  }
  return { instrucciones, sinPasos };
}
