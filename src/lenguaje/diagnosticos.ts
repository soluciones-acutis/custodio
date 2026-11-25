/**
 * El catálogo de diagnósticos del DSL (docs/dsl/especificacion.md, §13).
 *
 * Cada código tiene su severidad, el requisito que lo pide y la etapa que lo
 * detecta: la sintaxis (lo que se decide mirando una frase o un archivo) o la
 * semántica (lo que necesita seguir referencias). `test/lenguaje/diagnosticos.test.ts`
 * comprueba que el catálogo y la tabla de la especificación tengan los mismos códigos.
 */

export type Severidad = 'error' | 'advertencia';
export type Etapa = 'sintaxis' | 'semantica';

interface EntradaDelCatalogo {
  readonly severidad: Severidad;
  readonly etapa: Etapa;
  readonly requisito: string;
  readonly problema: string;
}

const error = (etapa: Etapa, requisito: string, problema: string): EntradaDelCatalogo => ({
  severidad: 'error',
  etapa,
  requisito,
  problema,
});
const advertencia = (etapa: Etapa, requisito: string, problema: string): EntradaDelCatalogo => ({
  severidad: 'advertencia',
  etapa,
  requisito,
  problema,
});

export const CATALOGO = {
  'CUS-E001': error('sintaxis', 'DSL-01', 'Falta el frontmatter o su YAML es inválido.'),
  'CUS-E002': error(
    'sintaxis',
    'DSL-01',
    'Falta un campo obligatorio del frontmatter, o su valor no es válido.',
  ),
  'CUS-E003': error('sintaxis', 'DSL-02', 'El id tiene un formato inválido o está repetido.'),
  'CUS-E004': error('sintaxis', 'DSL-03', 'Falta la narrativa o una de sus partes.'),
  'CUS-E005': error('sintaxis', 'DSL-04', 'Escenario o pasos mal formados.'),
  'CUS-E006': error('sintaxis', 'DSL-05, DSL-07', 'Frase desconocida.'),
  'CUS-E007': error('sintaxis', 'DSL-05', 'La acción no acepta ese objetivo.'),
  'CUS-E008': error('sintaxis', 'DSL-05', 'Falta un valor obligatorio.'),
  'CUS-E009': error('sintaxis', 'DSL-07', 'El vocabulario importado no existe o tiene errores.'),
  'CUS-E010': error(
    'sintaxis',
    'DSL-07',
    'A una frase de negocio le faltan o le sobran parámetros.',
  ),
  'CUS-E011': error(
    'semantica',
    'DSL-08',
    'Variable no declarada o captura usada antes de hacerse.',
  ),
  'CUS-E012': error('semantica', 'DSL-07', 'Referencia circular entre frases.'),
  'CUS-E013': error('semantica', 'DSL-08', 'Secreto en un lugar no permitido.'),
  'CUS-E014': error(
    'semantica',
    'DSL-07, DSL-08',
    'Nombre de variable inválido después de sustituir parámetros.',
  ),
  'CUS-E015': error('sintaxis', 'DSL-11', 'Versión dsl mal escrita o no soportada.'),
  'CUS-E016': error('sintaxis', 'DSL-04', 'Dos escenarios con el mismo nombre.'),
  'CUS-E017': error('sintaxis', 'DSL-07', 'Una oración calza con dos frases.'),
  'CUS-W001': advertencia('sintaxis', 'DSL-06', 'Elemento ubicado con un escape.'),
  'CUS-W002': advertencia('semantica', 'DSL-04', 'Escenario sin ninguna verificación.'),
  'CUS-W003': advertencia('semantica', 'DSL-05', '`no veo` sin ancla.'),
  'CUS-W004': advertencia('semantica', 'DSL-07', 'La historia usa una frase sin pasos.'),
  'CUS-W005': advertencia('semantica', 'DSL-10', 'La limpieza usa una frase sin pasos.'),
  'CUS-W006': advertencia('sintaxis', 'DSL-04', 'Título parecido a una sección del lenguaje.'),
  'CUS-W007': advertencia('sintaxis', 'DSL-01', 'Clave desconocida en el frontmatter.'),
} as const satisfies Record<string, EntradaDelCatalogo>;

export type CodigoDeDiagnostico = keyof typeof CATALOGO;

/** Un punto del archivo fuente, desde 1. La columna cuenta puntos de código. */
export interface Posicion {
  readonly linea: number;
  readonly columna: number;
}

export interface Diagnostico {
  readonly codigo: CodigoDeDiagnostico;
  readonly severidad: Severidad;
  readonly archivo: string;
  readonly linea: number;
  readonly columna: number;
  /** En español, una oración. */
  readonly mensaje: string;
  readonly sugerencia: string | null;
}

/** Junta los diagnósticos de un archivo. */
export class Diagnosticos {
  readonly lista: Diagnostico[] = [];
  readonly archivo: string;

  constructor(archivo: string) {
    this.archivo = archivo;
  }

  agregar(
    codigo: CodigoDeDiagnostico,
    posicion: Posicion,
    mensaje: string,
    sugerencia: string | null = null,
  ): void {
    this.lista.push({
      codigo,
      severidad: CATALOGO[codigo].severidad,
      archivo: this.archivo,
      linea: posicion.linea,
      columna: posicion.columna,
      mensaje,
      sugerencia,
    });
  }

  /** Si hay algún error entre las líneas `desde` y `hasta`, ambas incluidas. */
  hayErroresEntre(desde: number, hasta: number): boolean {
    return this.lista.some((d) => d.severidad === 'error' && d.linea >= desde && d.linea <= hasta);
  }
}

/** Ordena por archivo, línea y columna. */
export function ordenar(diagnosticos: readonly Diagnostico[]): Diagnostico[] {
  return [...diagnosticos].sort(
    (a, b) =>
      (a.archivo < b.archivo ? -1 : a.archivo > b.archivo ? 1 : 0) ||
      a.linea - b.linea ||
      a.columna - b.columna,
  );
}
