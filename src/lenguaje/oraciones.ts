/**
 * Una oración, el texto de un paso después de su fase, se reconoce en este
 * orden (diseño de la semana 3, §4.4):
 *
 * 1. frase base completa;
 * 2. frase de negocio de un vocabulario importado;
 * 3. frase base incompleta (`CUS-E007`, `CUS-E008`);
 * 4. frase de negocio incompleta (`CUS-E010`);
 * 5. nada: `CUS-E006`, con sugerencia.
 *
 * La frase base incompleta va después de la de negocio porque hay frases de
 * negocio que empiezan con un verbo base («completo el primer firmante con…»).
 */
import type { Fase, Paso } from './ast.ts';
import type { Diagnosticos } from './diagnosticos.ts';
import { fraseBase, VERBOS } from './frases-base.ts';
import { firmaDelPatron, type IndiceDePatrones, type Patron } from './patrones.ts';
import { masParecido } from './sugerencias.ts';
import type { Linea } from './texto.ts';
import { firma, tokenizar, type Token } from './tokens.ts';

/** Una frase de un vocabulario, para reconocer oraciones con ella. */
export interface FraseConocida {
  readonly vocabulario: string;
  readonly patron: Patron;
}

export interface ContextoDeOraciones {
  readonly frases: IndiceDePatrones<FraseConocida>;
  /**
   * Si un vocabulario importado no existe o tiene errores, las oraciones que no
   * calzan no se informan: la causa es el vocabulario (diseño, §6.3, regla 2).
   */
  readonly callarDesconocidas: boolean;
}

/**
 * Analiza la oración que empieza en `columna`. Devuelve el paso normalizado, o
 * `null` si tiene un error, que queda en `diagnosticos`.
 */
export function analizarOracion(
  linea: Linea,
  columna: number,
  fase: Fase | null,
  contexto: ContextoDeOraciones,
  diagnosticos: Diagnosticos,
): Paso | null {
  const posicion = { linea: linea.numero, columna };
  const texto = linea.caracteres
    .slice(columna - 1)
    .join('')
    .trimEnd();
  const resultado = tokenizar(linea.caracteres, columna);
  if (!resultado.ok) {
    diagnosticos.agregar(
      'CUS-E006',
      { linea: linea.numero, columna: resultado.columna },
      resultado.mensaje,
    );
    return null;
  }
  const tokens = resultado.tokens;
  if (tokens.length === 0) {
    diagnosticos.agregar('CUS-E005', posicion, 'El paso está vacío.');
    return null;
  }
  const origen = { linea: linea.numero, columna: 3 };

  const base = fraseBase(tokens);
  if (base.tipo === 'completa') {
    for (const columnaDelEscape of base.escapes) {
      diagnosticos.agregar(
        'CUS-W001',
        { linea: linea.numero, columna: columnaDelEscape },
        'El elemento se ubica con un escape: es deuda de accesibilidad. Prefiere su rol, su etiqueta o su texto.',
      );
    }
    return {
      fase,
      accion: base.accion,
      objetivo: base.objetivo,
      ambito: base.ambito,
      valor: base.valor,
      origen,
    } as Paso;
  }

  const calzan = contexto.frases.calzan(tokens);
  const vocabularios = [...new Set(calzan.map((c) => c.entrada.vocabulario))];
  if (vocabularios.length > 1) {
    diagnosticos.agregar(
      'CUS-E017',
      posicion,
      `«${texto}» calza con frases de varios vocabularios: ${vocabularios.join(', ')}. Cambia el patrón en uno de ellos.`,
    );
    return null;
  }
  const calce = calzan[0];
  if (calce) {
    return {
      fase,
      accion: 'frase',
      objetivo: {
        por: 'frase',
        vocabulario: calce.entrada.vocabulario,
        nombre: calce.entrada.patron.texto,
        argumentos: calce.argumentos,
      },
      ambito: null,
      valor: null,
      origen,
    };
  }

  if (base.tipo === 'incompleta') {
    diagnosticos.agregar(base.codigo, { linea: linea.numero, columna: base.columna }, base.mensaje);
    return null;
  }

  const incompleta = fraseIncompleta(tokens, contexto.frases.todas);
  if (incompleta) {
    diagnosticos.agregar(
      'CUS-E010',
      posicion,
      `«${texto}» no tiene los parámetros de «${incompleta.patron.texto}».`,
    );
    return null;
  }

  if (!contexto.callarDesconocidas) {
    diagnosticos.agregar(
      'CUS-E006',
      posicion,
      `Frase desconocida: «${texto}».`,
      sugerencia(texto, tokens, contexto),
    );
  }
  return null;
}

/**
 * La frase de negocio con que la oración empieza o termina igual, salvo los
 * parámetros: las mismas palabras con otras cadenas, o una parte de la frase
 * de al menos tres palabras.
 */
function fraseIncompleta(
  tokens: readonly Token[],
  frases: readonly FraseConocida[],
): FraseConocida | null {
  const palabras = tokens.flatMap((t) => (t.tipo === 'palabra' ? [t.comparable] : []));
  const empiezaIgual = (a: readonly string[], b: readonly string[]): boolean =>
    a.length >= 3 && a.length <= b.length && a.every((p, i) => p === b[i]);
  return (
    frases.find(
      ({ patron }) =>
        empiezaIgual(palabras, patron.palabras) || empiezaIgual(patron.palabras, palabras),
    ) ?? null
  );
}

function sugerencia(
  texto: string,
  tokens: readonly Token[],
  contexto: ContextoDeOraciones,
): string | null {
  const primera = tokens[0];
  if (primera?.tipo === 'palabra' && !(VERBOS as readonly string[]).includes(primera.comparable)) {
    const verbo = masParecido(primera.comparable, VERBOS, 2);
    if (verbo) {
      const resto = Array.from(texto).slice(Array.from(primera.texto).length).join('');
      return `¿Quisiste decir «${verbo}${resto}»?`;
    }
  }
  const frases = contexto.frases.todas;
  const firmaDeLaOracion = firma(tokens);
  const maximo = Math.max(2, Math.floor(Array.from(firmaDeLaOracion).length / 3));
  const parecida = masParecido(
    firmaDeLaOracion,
    frases.map((f) => firmaDelPatron(f.patron)),
    maximo,
  );
  const frase = frases.find((f) => firmaDelPatron(f.patron) === parecida);
  return frase ? `¿Quisiste decir «${frase.patron.texto}»?` : null;
}
