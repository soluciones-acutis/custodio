/**
 * Los patrones de las frases de negocio y cómo se reconoce una oración con
 * ellos (especificación §10.1).
 *
 * Comparar es comparar tokens: cada palabra del patrón con una palabra de la
 * oración, sin distinguir mayúsculas y con las tildes contando, y cada
 * parámetro `"{x}"` con una cadena.
 */
import { tokenizar, type Token } from './tokens.ts';

type Parte =
  | { readonly tipo: 'palabra'; readonly comparable: string }
  | { readonly tipo: 'parametro'; readonly nombre: string };

export interface Patron {
  /** El patrón tal como está en el vocabulario. */
  readonly texto: string;
  readonly partes: readonly Parte[];
  readonly parametros: readonly string[];
  /** Las palabras del patrón, sin los parámetros: para `CUS-E010`. */
  readonly palabras: readonly string[];
}

export type ResultadoDePatron =
  | { readonly ok: true; readonly patron: Patron }
  | { readonly ok: false; readonly columna: number; readonly mensaje: string };

const PARAMETRO = /^\{([A-Za-zÀ-ɏ][\wÀ-ɏ]*)\}$/;

/** Lee el patrón de `## Frase: …`, que empieza en la columna `desde`. */
export function leerPatron(caracteres: readonly string[], desde: number): ResultadoDePatron {
  const tokens = tokenizar(caracteres, desde);
  if (!tokens.ok) return tokens;
  if (tokens.tokens.length === 0)
    return { ok: false, columna: desde, mensaje: 'La frase no tiene patrón.' };
  const partes: Parte[] = [];
  for (const token of tokens.tokens) {
    if (token.tipo === 'palabra') {
      partes.push({ tipo: 'palabra', comparable: token.comparable });
      continue;
    }
    const nombre = token.tipo === 'cadena' ? PARAMETRO.exec(token.texto)?.[1] : undefined;
    if (!nombre) {
      return {
        ok: false,
        columna: token.columna,
        mensaje: 'Un patrón solo tiene palabras y parámetros `"{nombre}"`.',
      };
    }
    if (partes.some((p) => p.tipo === 'parametro' && p.nombre === nombre)) {
      return {
        ok: false,
        columna: token.columna,
        mensaje: `El parámetro \`{${nombre}}\` está repetido.`,
      };
    }
    partes.push({ tipo: 'parametro', nombre });
  }
  return {
    ok: true,
    patron: {
      texto: caracteres
        .slice(desde - 1)
        .join('')
        .trimEnd(),
      partes,
      parametros: partes.flatMap((p) => (p.tipo === 'parametro' ? [p.nombre] : [])),
      palabras: partes.flatMap((p) => (p.tipo === 'palabra' ? [p.comparable] : [])),
    },
  };
}

/** Los argumentos de la oración si calza con el patrón; si no, `null`. */
export function calzar(patron: Patron, tokens: readonly Token[]): Record<string, string> | null {
  if (tokens.length !== patron.partes.length) return null;
  const argumentos: Record<string, string> = {};
  for (let i = 0; i < tokens.length; i++) {
    const parte = patron.partes[i];
    const token = tokens[i];
    if (!parte || !token) return null;
    if (parte.tipo === 'palabra') {
      if (token.tipo !== 'palabra' || token.comparable !== parte.comparable) return null;
    } else {
      if (token.tipo !== 'cadena') return null;
      argumentos[parte.nombre] = token.texto;
    }
  }
  return argumentos;
}

/** El patrón como oración de ejemplo, con `"x"` en cada parámetro: para probar si es una frase base. */
export function ejemplo(patron: Patron): Token[] {
  return patron.partes.map((parte, i) =>
    parte.tipo === 'palabra'
      ? { tipo: 'palabra', texto: parte.comparable, comparable: parte.comparable, columna: i + 1 }
      : { tipo: 'cadena', texto: 'x', columna: i + 1 },
  );
}

/** El patrón con `"…"` en cada parámetro: para comparar y sugerir. */
export const firmaDelPatron = (patron: Patron): string =>
  patron.partes.map((p) => (p.tipo === 'palabra' ? p.comparable : '"…"')).join(' ');

/**
 * Los patrones, agrupados por su primera palabra, más un grupo aparte para los
 * que empiezan con un parámetro (diseño de la semana 3, §5.1).
 */
export class IndiceDePatrones<T extends { readonly patron: Patron }> {
  private readonly porPrimeraPalabra = new Map<string, T[]>();
  private readonly conParametroPrimero: T[] = [];
  readonly todas: T[] = [];

  agregar(entrada: T): void {
    this.todas.push(entrada);
    const primera = entrada.patron.partes[0];
    if (primera?.tipo !== 'palabra') {
      this.conParametroPrimero.push(entrada);
      return;
    }
    const grupo = this.porPrimeraPalabra.get(primera.comparable) ?? [];
    grupo.push(entrada);
    this.porPrimeraPalabra.set(primera.comparable, grupo);
  }

  /** Las entradas cuyo patrón calza con la oración, con sus argumentos. */
  calzan(tokens: readonly Token[]): { entrada: T; argumentos: Record<string, string> }[] {
    const primera = tokens[0];
    const candidatas =
      primera?.tipo === 'palabra'
        ? (this.porPrimeraPalabra.get(primera.comparable) ?? [])
        : primera?.tipo === 'cadena'
          ? this.conParametroPrimero
          : [];
    return candidatas.flatMap((entrada) => {
      const argumentos = calzar(entrada.patron, tokens);
      return argumentos ? [{ entrada, argumentos }] : [];
    });
  }
}
