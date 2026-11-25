/**
 * Los `.vocabulario.md` (gramática EBNF, sección 8): las firmas de las frases
 * de negocio y sus pasos.
 *
 * Se leen en dos pasadas: primero todos los patrones, después los pasos, porque
 * un paso puede usar una frase definida más abajo en el mismo vocabulario.
 */
import {
  IMPLEMENTACIONES,
  VERSION_AST,
  type ArchivoDeVocabulario,
  type FraseDeVocabulario,
  type Implementacion,
  type PasoSinFase,
} from './ast.ts';
import type { Diagnosticos, Posicion } from './diagnosticos.ts';
import { fraseBase } from './frases-base.ts';
import { leerFrontmatter, revisarClaves, revisarVersion, texto } from './frontmatter.ts';
import { claseDeLinea } from './lineas.ts';
import { analizarOracion, type FraseConocida } from './oraciones.ts';
import { ejemplo, firmaDelPatron, IndiceDePatrones, leerPatron, type Patron } from './patrones.ts';
import { lineasDe, saltarEspacios, type Linea } from './texto.ts';

const CLAVES = ['vocabulario', 'dsl', 'producto'];

interface FraseLeida {
  readonly patron: Patron;
  readonly origen: Posicion;
  produce: string[];
  implementacion: Implementacion;
  motivo: string | null;
  readonly lineasDePasos: Linea[];
  readonly pasos: PasoSinFase[];
}

export interface VocabularioLeido {
  readonly nombre: string | null;
  /** Las frases con un patrón válido, para reconocer oraciones con ellas. */
  readonly frases: readonly FraseConocida[];
  readonly diagnosticos: Diagnosticos;
  /** El AST, si el vocabulario no tiene errores. */
  readonly ast: ArchivoDeVocabulario | null;
}

/** Lee un vocabulario completo. */
export function leerVocabulario(
  ruta: string,
  textoDelArchivo: string,
  diagnosticos: Diagnosticos,
): VocabularioLeido {
  const lineas = lineasDe(textoDelArchivo);
  const inicio = lineas.findIndex((l) => claseDeLinea(l.texto) !== 'blanco');
  if (inicio === -1 || claseDeLinea(lineas[inicio]?.texto ?? '') !== 'delimitador') {
    diagnosticos.agregar(
      'CUS-E001',
      { linea: 1, columna: 1 },
      'Falta el frontmatter: el vocabulario empieza con `---`.',
    );
    return { nombre: null, frases: [], diagnosticos, ast: null };
  }
  const frontmatter = leerFrontmatter(lineas, inicio, diagnosticos);
  const yaMal = diagnosticos.lista.some((d) => d.codigo === 'CUS-E001');
  revisarClaves(frontmatter, yaMal ? [] : CLAVES, CLAVES, diagnosticos);
  const dsl = frontmatter.campos.get('dsl');
  if (dsl) revisarVersion(dsl.valor, dsl.posicion, diagnosticos);
  const nombre = texto(frontmatter, 'vocabulario');
  const campoNombre = frontmatter.campos.get('vocabulario');
  if (campoNombre && (nombre === null || !/^[\w-]+$/.test(nombre))) {
    diagnosticos.agregar(
      'CUS-E002',
      campoNombre.posicion,
      'El nombre del vocabulario va en minúsculas con guiones.',
    );
  }

  const frases = leerFrases(lineas.slice(frontmatter.siguiente), diagnosticos);
  const vocabulario = nombre ?? '';
  const conocidas = frases.map((f) => ({ vocabulario, patron: f.patron }));
  const indice = new IndiceDePatrones<FraseConocida>();
  for (const conocida of conocidas) indice.agregar(conocida);
  for (const frase of frases) {
    for (const linea of frase.lineasDePasos) {
      if (/^- (DADO|CUANDO|ENTONCES|Y)\s/.test(linea.texto)) {
        diagnosticos.agregar(
          'CUS-E005',
          { linea: linea.numero, columna: 3 },
          'Los pasos de una frase no llevan fase.',
        );
        continue;
      }
      const paso = analizarOracion(
        linea,
        3,
        null,
        { frases: indice, callarDesconocidas: false },
        diagnosticos,
      );
      if (paso) frase.pasos.push(paso as PasoSinFase);
    }
  }

  const conErrores = diagnosticos.lista.some((d) => d.severidad === 'error');
  return {
    nombre,
    frases: conocidas,
    diagnosticos,
    ast: conErrores
      ? null
      : {
          ast: VERSION_AST,
          archivo: ruta,
          vocabulario,
          dsl: texto(frontmatter, 'dsl') ?? '',
          producto: texto(frontmatter, 'producto') ?? '',
          frases: frases.map((f): FraseDeVocabulario => ({
            patron: f.patron.texto,
            parametros: f.patron.parametros,
            produce: f.produce,
            implementacion: f.implementacion,
            motivo: f.motivo,
            pasos: f.pasos,
            origen: f.origen,
          })),
        },
  };
}

/** Primera pasada: los títulos `## Frase:`, sus declaraciones y las líneas de sus pasos. */
function leerFrases(lineas: readonly Linea[], diagnosticos: Diagnosticos): FraseLeida[] {
  const frases: FraseLeida[] = [];
  const firmas = new Map<string, number>();
  let actual: FraseLeida | null = null;
  for (const linea of lineas) {
    const clase = claseDeLinea(linea.texto);
    if (clase === 'titulo') {
      actual = linea.texto.startsWith('## Frase:') ? abrirFrase(linea, firmas, diagnosticos) : null;
      if (actual) frases.push(actual);
    } else if (actual && clase === 'declaracion' && actual.lineasDePasos.length === 0) {
      leerDeclaracion(linea, actual, diagnosticos);
    } else if (actual && clase === 'paso') {
      actual.lineasDePasos.push(linea);
    }
  }
  for (const frase of frases) {
    const conPasos = frase.lineasDePasos.length > 0;
    if (frase.implementacion === 'pasos' && !conPasos) {
      diagnosticos.agregar(
        'CUS-E005',
        frase.origen,
        `La frase «${frase.patron.texto}» no tiene pasos ni \`> implementación:\`.`,
      );
    } else if (frase.implementacion !== 'pasos' && conPasos) {
      const primera = frase.lineasDePasos[0];
      diagnosticos.agregar(
        'CUS-E005',
        { linea: primera?.numero ?? frase.origen.linea, columna: 1 },
        `Una frase \`${frase.implementacion}\` no lleva pasos.`,
      );
    }
  }
  return frases;
}

function abrirFrase(
  linea: Linea,
  firmas: Map<string, number>,
  diagnosticos: Diagnosticos,
): FraseLeida | null {
  const columna = saltarEspacios(linea.caracteres, '## Frase:'.length + 1);
  const resultado = leerPatron(linea.caracteres, columna);
  if (!resultado.ok) {
    diagnosticos.agregar(
      'CUS-E010',
      { linea: linea.numero, columna: resultado.columna },
      resultado.mensaje,
    );
    return null;
  }
  const patron = resultado.patron;
  const posicion = { linea: linea.numero, columna };
  const firma = firmaDelPatron(patron);
  const anterior = firmas.get(firma);
  if (anterior !== undefined) {
    diagnosticos.agregar(
      'CUS-E017',
      posicion,
      `La frase «${patron.texto}» ya está en la línea ${String(anterior)}.`,
    );
  } else if (fraseBase(ejemplo(patron)).tipo === 'completa') {
    diagnosticos.agregar(
      'CUS-E017',
      posicion,
      `«${patron.texto}» es una frase base: la base se reconoce primero y esta frase nunca se usaría. Cambia el patrón.`,
    );
  }
  firmas.set(firma, anterior ?? linea.numero);
  return {
    patron,
    origen: { linea: linea.numero, columna: 1 },
    produce: [],
    implementacion: 'pasos',
    motivo: null,
    lineasDePasos: [],
    pasos: [],
  };
}

/** `> produce: {a}, {b}` y `> implementación: pendiente|nativa — motivo`. Otro `>` es una nota. */
function leerDeclaracion(linea: Linea, frase: FraseLeida, diagnosticos: Diagnosticos): void {
  const posicion = { linea: linea.numero, columna: 3 };
  const produce = /^> produce:\s*(.*)$/.exec(linea.texto);
  if (produce) {
    const nombres = (produce[1] ?? '').split(',').map((p) => p.trim());
    if (nombres.some((n) => !/^\{\w+\}$/.test(n))) {
      diagnosticos.agregar(
        'CUS-E010',
        posicion,
        '`produce` es una lista de parámetros: `> produce: {a}, {b}`.',
      );
    }
    frase.produce = nombres;
    return;
  }
  const implementacion = /^> implementación:\s*(\S+)(?:\s+—\s*(.*))?$/.exec(linea.texto);
  if (!implementacion) return;
  const tipo = implementacion[1] ?? '';
  if (tipo === 'pasos' || !(IMPLEMENTACIONES as readonly string[]).includes(tipo)) {
    diagnosticos.agregar('CUS-E005', posicion, 'La implementación es `pendiente` o `nativa`.');
    return;
  }
  frase.implementacion = tipo as Implementacion;
  frase.motivo = implementacion[2]?.trim() || null;
}
