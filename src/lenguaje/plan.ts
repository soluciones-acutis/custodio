/**
 * El plan de ejecución (DSL-14): el único contrato entre `lenguaje` y
 * `ejecuciones` (ADR-002). Es la misma forma que describe
 * `docs/dsl/plan.schema.json`; las constantes de este archivo y los enums del
 * Schema se verifican entre sí en `test/lenguaje/plan.test.ts`.
 *
 * Un plan por historia, con un bloque por escenario (diseño de la semana 4, §2).
 * Las instrucciones son acciones base, sin frases, y las variables siguen como
 * `${…}`: el plan nunca tiene el valor de un secreto.
 *
 * Solo tipos y constantes: sin E/S (regla 6 de la arquitectura).
 */
import type { Accion, Ambito, Criticidad, Fase, Localizador, Valor } from './ast.ts';

export const VERSION_PLAN = '0.1.0';

/** Si un escenario se puede ejecutar (especificación §10.3 y §11.3). */
export const ESTADOS_DE_COMPILACION = ['ejecutable', 'incompleto', 'limpieza_pendiente'] as const;
export type EstadoDeCompilacion = (typeof ESTADOS_DE_COMPILACION)[number];

export type AccionDelPlan = Exclude<Accion, 'frase'>;

/** Una frase por la que pasó la instrucción, con el paso dentro de ella. */
export interface PasoPorFrase {
  readonly vocabulario: string;
  readonly frase: string;
  readonly archivo: string;
  readonly linea: number;
  readonly columna: number;
}

/**
 * De dónde sale una instrucción: el paso de la historia y, si vino de una
 * frase, cada frase por la que pasó, de afuera hacia adentro.
 */
export interface OrigenDeInstruccion {
  readonly archivo: string;
  readonly linea: number;
  readonly columna: number;
  readonly via: readonly PasoPorFrase[];
}

export interface Instruccion {
  readonly accion: AccionDelPlan;
  /** La fase del paso de la historia; `null` en los antecedentes y la limpieza. */
  readonly fase: Fase | null;
  readonly objetivo:
    | Localizador
    | { readonly por: 'url'; readonly url: string }
    | {
        readonly por: 'menu';
        readonly ruta: readonly [string, ...string[]];
      };
  readonly ambito: Ambito | null;
  readonly valor: Valor | null;
  readonly origen: OrigenDeInstruccion;
}

export interface EscenarioDelPlan {
  readonly nombre: string;
  readonly estado: EstadoDeCompilacion;
  /** Por qué no es `ejecutable`: la frase sin pasos. */
  readonly motivo: string | null;
  /** Antecedentes y pasos, ya expandidos. Vacío si el escenario está `incompleto`. */
  readonly instrucciones: readonly Instruccion[];
  /** Vacía si la limpieza no se ejecuta. */
  readonly limpieza: readonly Instruccion[];
  readonly linea: number;
}

export interface Plan {
  readonly plan: typeof VERSION_PLAN;
  readonly historia: {
    readonly id: string;
    readonly titulo: string;
    readonly producto: string;
    readonly criticidad: Criticidad;
    readonly etiquetas: readonly string[];
    readonly archivo: string;
  };
  /** El ambiente con que se compiló, o `null` si no se indicó uno. */
  readonly ambiente: string | null;
  readonly escenarios: readonly EscenarioDelPlan[];
}
