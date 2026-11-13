/**
 * Las frases base del lenguaje (especificación §6 y §7), leídas por descenso
 * recursivo sobre los tokens de una frase. Cada regla de la sección 3 a 6 de la
 * gramática EBNF es una función.
 *
 * Una frase puede ser una base completa, una base incompleta (empezó como una
 * base, pero el objetivo no sirve: `CUS-E007`, o falta el valor: `CUS-E008`) o
 * no ser una frase base.
 */
import type {
  Accion,
  Ambito,
  Localizador,
  Objetivo,
  ValorCaptura,
  ValorFecha,
  ValorTexto,
  ValorTotp,
  ValorUnico,
} from './ast.ts';
import type { CodigoDeDiagnostico } from './diagnosticos.ts';
import type { Token } from './tokens.ts';

type Valor = ValorTexto | ValorTotp | ValorFecha | ValorUnico | ValorCaptura;

export type FraseBase =
  | {
      readonly tipo: 'completa';
      readonly accion: Accion;
      readonly objetivo: Objetivo;
      readonly ambito: Ambito | null;
      readonly valor: Valor | null;
      /** Columnas de los elementos ubicados con un escape (`CUS-W001`). */
      readonly escapes: readonly number[];
    }
  | {
      readonly tipo: 'incompleta';
      readonly codigo: Extract<CodigoDeDiagnostico, 'CUS-E007' | 'CUS-E008'>;
      readonly columna: number;
      readonly mensaje: string;
    }
  | { readonly tipo: 'no' };

/** Los verbos con que empiezan las frases base, para las sugerencias. */
export const VERBOS = [
  'navego',
  'completo',
  'selecciono',
  'marco',
  'desmarco',
  'presiono',
  'espero',
  'veo',
  'capturo',
] as const;

type ClaseDeElemento = 'texto' | 'campo' | 'casilla' | 'rol' | 'escape';

interface Elemento {
  readonly objetivo: Localizador;
  readonly clase: ClaseDeElemento;
  readonly columna: number;
}

const NO: FraseBase = { tipo: 'no' };

/** Recorre los tokens de una frase. */
class Lector {
  posicion = 0;
  readonly tokens: readonly Token[];

  constructor(tokens: readonly Token[]) {
    this.tokens = tokens;
  }

  get fin(): boolean {
    return this.posicion >= this.tokens.length;
  }

  get actual(): Token | undefined {
    return this.tokens[this.posicion];
  }

  /** Consume las palabras indicadas, en orden, o no consume nada. */
  palabras(...palabras: readonly string[]): boolean {
    const desde = this.posicion;
    for (const palabra of palabras) {
      const token = this.tokens[this.posicion];
      if (token?.tipo !== 'palabra' || token.comparable !== palabra) {
        this.posicion = desde;
        return false;
      }
      this.posicion++;
    }
    return true;
  }

  cadena(): string | null {
    const token = this.actual;
    if (token?.tipo !== 'cadena') return null;
    this.posicion++;
    return token.texto;
  }

  codigo(): string | null {
    const token = this.actual;
    if (token?.tipo !== 'codigo') return null;
    this.posicion++;
    return token.texto;
  }
}

const NOMBRE_DEL_LOCALIZADOR: Record<string, string> = {
  boton: 'un botón',
  enlace: 'un enlace',
  titulo: 'un título',
  texto: 'un texto',
  campo: 'un campo',
  casilla: 'una casilla',
  opcion: 'una opción',
  rol: 'un elemento por rol',
  idDePrueba: 'un elemento por id de prueba',
  css: 'un selector',
};

/** `elemento` de la gramática, con `exactamente` opcional (salvo en los escapes). */
function elemento(l: Lector): Elemento | null {
  const desde = l.posicion;
  const columna = l.actual?.columna ?? 0;
  const exacto = l.palabras('exactamente');
  const conExacto = <T extends object>(objetivo: T): T =>
    exacto ? { ...objetivo, exacto: true } : objetivo;
  const porTexto: readonly [readonly string[], Localizador['por'], ClaseDeElemento][] = [
    [['el', 'botón'], 'boton', 'texto'],
    [['el', 'enlace'], 'enlace', 'texto'],
    [['el', 'título'], 'titulo', 'texto'],
    [['el', 'texto'], 'texto', 'texto'],
    [['el', 'mensaje'], 'texto', 'texto'],
    [['el', 'campo'], 'campo', 'campo'],
    [['la', 'casilla'], 'casilla', 'casilla'],
    [['la', 'opción'], 'opcion', 'casilla'],
  ];
  for (const [palabras, por, clase] of porTexto) {
    if (!l.palabras(...palabras)) continue;
    const texto = l.cadena();
    if (texto === null) break;
    return { objetivo: conExacto({ por, texto } as Localizador), clase, columna };
  }
  if (l.palabras('el', 'elemento', 'con', 'rol')) {
    const rol = l.cadena();
    if (rol !== null && l.palabras('y', 'nombre')) {
      const texto = l.cadena();
      if (texto !== null)
        return { objetivo: conExacto({ por: 'rol', rol, texto }), clase: 'rol', columna };
    }
  } else if (!exacto && l.palabras('el', 'elemento', 'con', 'id', 'de', 'prueba')) {
    const id = l.cadena();
    if (id !== null) return { objetivo: { por: 'idDePrueba', id }, clase: 'escape', columna };
  } else if (!exacto && l.palabras('el', 'elemento', 'con', 'selector')) {
    const selector = l.codigo();
    if (selector !== null) return { objetivo: { por: 'css', selector }, clase: 'escape', columna };
  }
  l.posicion = desde;
  return null;
}

/** `valor` de la gramática. */
function valor(l: Lector): ValorTexto | ValorTotp | ValorFecha | ValorUnico | null {
  const texto = l.cadena();
  if (texto !== null) return { tipo: 'texto', texto };
  if (l.palabras('el', 'código', 'generado', 'con', 'el', 'secreto')) {
    const secreto = l.cadena();
    return secreto === null ? null : { tipo: 'totp', secreto };
  }
  if (l.palabras('la', 'fecha', 'de', 'hoy')) {
    if (!l.palabras('en', 'formato')) return { tipo: 'fecha', fecha: 'hoy', formato: null };
    const formato = l.cadena();
    return formato === null ? null : { tipo: 'fecha', fecha: 'hoy', formato };
  }
  if (l.palabras('un', 'número', 'único')) return { tipo: 'unico', unico: 'numero' };
  return null;
}

/**
 * Los sufijos de ámbito hasta el final de la frase (`ambito` de la gramática).
 * El primero es el ámbito inmediato y los siguientes lo contienen. Devuelve
 * `undefined` si queda algo que no es un ámbito.
 */
function ambitos(l: Lector): Ambito | null | undefined {
  const sufijos: Omit<Ambito, 'ambito'>[] = [];
  while (!l.fin) {
    if (!l.palabras('en')) return undefined;
    if (l.palabras('la', 'fila', 'de')) {
      const texto = l.cadena();
      if (texto === null) return undefined;
      sufijos.push({ por: 'fila', texto });
    } else if (l.palabras('el', 'aviso', 'de', 'confirmación')) {
      sufijos.push({ por: 'dialogo', texto: null });
    } else if (l.palabras('el', 'aviso')) {
      const texto = l.cadena();
      if (texto === null) return undefined;
      sufijos.push({ por: 'dialogo', texto });
    } else {
      const texto = l.cadena();
      if (texto === null) return undefined;
      sufijos.push({ por: 'seccion', texto });
    }
  }
  return sufijos.reduceRight<Ambito | null>(
    (contenedor, sufijo) => ({ ...sufijo, ambito: contenedor }) as Ambito,
    null,
  );
}

function completa(
  l: Lector,
  accion: Accion,
  objetivo: Objetivo,
  valor: Valor | null,
  escapes: readonly number[] = [],
): FraseBase {
  const ambito = ambitos(l);
  if (ambito === undefined) return NO;
  return { tipo: 'completa', accion, objetivo, ambito, valor, escapes };
}

const escapesDe = (e: Elemento): number[] => (e.clase === 'escape' ? [e.columna] : []);

function objetivoNoAceptado(accion: string, e: Elemento): FraseBase {
  return {
    tipo: 'incompleta',
    codigo: 'CUS-E007',
    columna: e.columna,
    mensaje: `\`${accion}\` no acepta ${NOMBRE_DEL_LOCALIZADOR[e.objetivo.por] ?? 'ese objetivo'} como objetivo.`,
  };
}

/** Lee una frase base. */
export function fraseBase(tokens: readonly Token[]): FraseBase {
  const l = new Lector(tokens);
  const inicio = tokens[0];
  if (inicio?.tipo !== 'palabra') return NO;
  const columnaDelVerbo = inicio.columna;

  if (l.palabras('navego', 'a')) {
    const url = l.codigo();
    if (url !== null) return l.fin ? completa(l, 'navegar', { por: 'url', url }, null) : NO;
    const menu = l.cadena();
    if (menu === null || !l.fin) return NO;
    const ruta = menu.split('>').map((parte) => parte.trim());
    if (ruta.some((parte) => parte === '')) return NO;
    return completa(l, 'navegar', { por: 'menu', ruta: ruta as [string, ...string[]] }, null);
  }

  if (l.palabras('completo')) {
    const e = elemento(l);
    if (!e) return NO;
    if (e.clase !== 'campo' && e.clase !== 'rol') return objetivoNoAceptado('completar', e);
    if (l.fin) {
      return {
        tipo: 'incompleta',
        codigo: 'CUS-E008',
        columna: columnaDelVerbo,
        mensaje: 'A «completo» le falta el valor: completo el campo "…" con "…".',
      };
    }
    if (!l.palabras('con')) return NO;
    const columnaDelValor = l.actual?.columna ?? columnaDelVerbo;
    const v = valor(l);
    if (!v) {
      return {
        tipo: 'incompleta',
        codigo: 'CUS-E008',
        columna: columnaDelValor,
        mensaje:
          'El valor no es válido: va entre comillas, o es un código generado, la fecha de hoy o un número único.',
      };
    }
    return completa(l, 'completar', e.objetivo, v);
  }

  if (l.palabras('selecciono')) {
    const opcion = l.cadena();
    if (opcion === null) {
      return l.palabras('en')
        ? {
            tipo: 'incompleta',
            codigo: 'CUS-E008',
            columna: columnaDelVerbo,
            mensaje: 'A «selecciono» le falta la opción: selecciono "…" en el campo "…".',
          }
        : NO;
    }
    if (!l.palabras('en')) return NO;
    const e = elemento(l);
    if (!e) return NO;
    if (e.clase !== 'campo' && e.clase !== 'rol') return objetivoNoAceptado('seleccionar', e);
    return completa(l, 'seleccionar', e.objetivo, { tipo: 'texto', texto: opcion });
  }

  const marcar = l.palabras('marco') ? 'marcar' : l.palabras('desmarco') ? 'desmarcar' : null;
  if (marcar) {
    const e = elemento(l);
    if (!e) return NO;
    if (e.clase !== 'casilla' && e.clase !== 'rol') return objetivoNoAceptado(marcar, e);
    return completa(l, marcar, e.objetivo, null);
  }

  if (l.palabras('presiono')) {
    const e = elemento(l);
    return e ? completa(l, 'presionar', e.objetivo, null, escapesDe(e)) : NO;
  }

  const verificar = l.palabras('espero')
    ? 'esperar'
    : l.palabras('veo')
      ? 'ver'
      : l.palabras('no', 'veo')
        ? 'noVer'
        : null;
  if (verificar) {
    if (l.palabras('que', 'la', 'dirección', 'contiene')) {
      const url = l.cadena();
      return url === null ? NO : completa(l, verificar, { por: 'url', url }, null);
    }
    const e = elemento(l);
    return e ? completa(l, verificar, e.objetivo, null, escapesDe(e)) : NO;
  }

  if (l.palabras('capturo', 'el', 'valor', 'del', 'campo')) {
    const texto = l.cadena();
    if (texto === null || !l.palabras('como')) return NO;
    const como = l.cadena();
    if (como === null) return NO;
    return completa(l, 'capturar', { por: 'campo', texto }, { tipo: 'captura', como });
  }

  return NO;
}
