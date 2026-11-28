/**
 * La expansión de las frases de negocio (diseño de la semana 4, §1): cada
 * paso de una historia se reemplaza por los pasos base de sus frases, con los
 * parámetros sustituidos sobre el AST y no sobre el texto (especificación §10.1).
 *
 * La usan el validador semántico, que revisa los pasos ya expandidos, y el
 * compilador, que los convierte en instrucciones del plan.
 */
import type { ArchivoDeVocabulario, FraseDeVocabulario, Paso } from './ast.ts';
import type { Posicion } from './diagnosticos.ts';
import { tokensDelPaso } from './rastros.ts';

/** El valor de un parámetro, y de dónde salió en la historia. */
export interface Parametro {
  readonly valor: string;
  /** La cadena de la historia de donde viene; `null` si lo escribió el vocabulario. */
  readonly posicion: Posicion | null;
}

/** Una frase por la que pasó un paso: la frase y el paso dentro de ella. */
export interface Via {
  readonly vocabulario: string;
  readonly frase: string;
  readonly archivo: string;
  readonly linea: number;
  readonly columna: number;
}

export type Evento =
  | {
      readonly tipo: 'paso';
      /** El paso base, con los parámetros sustituidos. */
      readonly paso: Paso;
      /** El mismo paso tal como está escrito: en el vocabulario, o el de la historia. */
      readonly plantilla: Paso;
      /** El paso de la historia de donde viene. */
      readonly raiz: Paso;
      readonly via: readonly Via[];
      readonly parametros: ReadonlyMap<string, Parametro>;
    }
  /** Una frase `pendiente` o `nativa`: no se puede expandir (`CUS-W004`, `CUS-W005`). */
  | { readonly tipo: 'sin-pasos'; readonly frase: FraseDeVocabulario; readonly raiz: Paso }
  /** Las capturas que deja una frase, con sus parámetros sustituidos. */
  | { readonly tipo: 'produce'; readonly nombres: readonly string[] };

/** Un parámetro `{x}` que no es parte de una variable `${…}`. */
const PARAMETRO = /(?<!\$)\{(\w+)\}/g;

/** Los vocabularios válidos, por nombre. */
export type VocabulariosPorNombre = ReadonlyMap<string, ArchivoDeVocabulario>;

export function buscarFrase(
  vocabularios: VocabulariosPorNombre,
  vocabulario: string,
  patron: string,
): { frase: FraseDeVocabulario; archivo: string } | null {
  const v = vocabularios.get(vocabulario);
  const frase = v?.frases.find((f) => f.patron === patron);
  return v && frase ? { frase, archivo: v.archivo } : null;
}

/** Expande un paso de la historia. Una frase que ya está en la pila (un ciclo) no se expande. */
export function expandir(raiz: Paso, vocabularios: VocabulariosPorNombre): Evento[] {
  const eventos: Evento[] = [];
  const visitar = (
    plantilla: Paso,
    parametros: ReadonlyMap<string, Parametro>,
    via: readonly Via[],
    pila: readonly string[],
  ): void => {
    const paso = sustituir(plantilla, parametros);
    if (paso.accion !== 'frase') {
      eventos.push({ tipo: 'paso', paso, plantilla, raiz, via, parametros });
      return;
    }
    const { vocabulario, nombre, argumentos } = paso.objetivo;
    const encontrada = buscarFrase(vocabularios, vocabulario, nombre);
    const clave = `${vocabulario}\n${nombre}`;
    if (!encontrada || pila.includes(clave)) return;
    const { frase, archivo } = encontrada;
    const deLaFrase = parametrosDe(frase, argumentos, plantilla, raiz, parametros);
    if (frase.implementacion !== 'pasos') {
      eventos.push({ tipo: 'sin-pasos', frase, raiz });
    } else {
      for (const sub of frase.pasos) {
        const paso = { vocabulario, frase: frase.patron, archivo, ...sub.origen };
        visitar(sub, deLaFrase, [...via, paso], [...pila, clave]);
      }
    }
    eventos.push({
      tipo: 'produce',
      nombres: frase.produce.map((p) => sustituirTexto(p, deLaFrase)),
    });
  };
  visitar(raiz, new Map(), [], []);
  return eventos;
}

/**
 * Los parámetros de una frase con los argumentos del paso que la usa. En la
 * historia, cada uno apunta a su cadena; dentro de un vocabulario, al parámetro
 * de afuera del que salió (`"{rol}"` en `"${TOTP_{rol}}"`).
 */
function parametrosDe(
  frase: FraseDeVocabulario,
  argumentos: Readonly<Record<string, string>>,
  plantilla: Paso,
  raiz: Paso,
  deAfuera: ReadonlyMap<string, Parametro>,
): Map<string, Parametro> {
  const cadenas =
    plantilla === raiz ? (tokensDelPaso.get(raiz) ?? []).filter((t) => t.tipo === 'cadena') : [];
  const escritos = plantilla.accion === 'frase' ? plantilla.objetivo.argumentos : {};
  return new Map(
    frase.parametros.map((nombre, i) => {
      const cadena = cadenas[i];
      const posicion = cadena
        ? { linea: raiz.origen.linea, columna: cadena.columna }
        : origenDe(escritos[nombre] ?? '', deAfuera);
      return [nombre, { valor: argumentos[nombre] ?? '', posicion }];
    }),
  );
}

/** De qué cadena de la historia sale un texto del vocabulario: la de su primer parámetro. */
export function origenDe(
  texto: string,
  parametros: ReadonlyMap<string, Parametro>,
): Posicion | null {
  for (const [, nombre] of texto.matchAll(PARAMETRO)) {
    const posicion = parametros.get(nombre ?? '')?.posicion;
    if (posicion) return posicion;
  }
  return null;
}

function sustituirTexto(texto: string, parametros: ReadonlyMap<string, Parametro>): string {
  return texto.replace(PARAMETRO, (todo, nombre: string) => parametros.get(nombre)?.valor ?? todo);
}

/** El paso con los parámetros sustituidos en todos sus textos. */
function sustituir<T>(valor: T, parametros: ReadonlyMap<string, Parametro>): T {
  if (parametros.size === 0) return valor;
  if (typeof valor === 'string') return sustituirTexto(valor, parametros) as T;
  if (Array.isArray(valor)) return valor.map((v: unknown) => sustituir(v, parametros)) as T;
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(
      Object.entries(valor).map(([clave, v]) => [
        clave,
        clave === 'origen' ? v : sustituir(v, parametros),
      ]),
    ) as T;
  }
  return valor;
}
