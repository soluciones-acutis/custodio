/**
 * Segundo nivel del analizador para los `.historia.md`: el frontmatter y las
 * secciones (gramática EBNF, sección 1), con los pasos de cada una.
 *
 * Cada sección termina en el próximo título `##`, y cada paso se analiza solo,
 * así que un error no arrastra al resto del archivo (diseño de la semana 3, §6.3).
 */
import { type Escenario, type Fase, type Historia, type Narrativa, type Paso } from './ast.ts';
import type { Diagnosticos, Posicion } from './diagnosticos.ts';
import {
  leerFrontmatter,
  revisarClaves,
  revisarVersion,
  texto,
  type Frontmatter,
} from './frontmatter.ts';
import { claseDeLinea, pareceCampo } from './lineas.ts';
import { analizarOracion, type ContextoDeOraciones } from './oraciones.ts';
import { distancia } from './sugerencias.ts';
import { comparable, lineasDe, saltarEspacios, type Linea } from './texto.ts';

const OBLIGATORIAS = ['dsl', 'id', 'producto', 'titulo', 'actor', 'criticidad'] as const;
const CONOCIDAS = [...OBLIGATORIAS, 'etiquetas', 'vocabularios'];
const FASE_DEL_PASO: Readonly<Record<string, Fase>> = {
  DADO: 'dado',
  CUANDO: 'cuando',
  ENTONCES: 'entonces',
  Y: 'y',
};

/** Lo que el analizador necesita saber de los vocabularios disponibles. */
export interface Vocabularios {
  /** Si existe un vocabulario con ese nombre, y si tiene errores. */
  estado(nombre: string): 'valido' | 'con-errores' | 'no-existe';
  /** El contexto para reconocer las oraciones de una historia que importa esos vocabularios. */
  contexto(nombres: readonly string[], callarDesconocidas: boolean): ContextoDeOraciones;
}

/** Una historia leída. Su AST solo vale si no hay errores entre `desde` y `hasta`. */
export interface HistoriaLeida {
  readonly historia: Historia;
  readonly id: { readonly valor: string; readonly posicion: Posicion } | null;
  readonly desde: number;
  readonly hasta: number;
}

/** Lee las historias de un archivo. */
export function leerHistorias(
  textoDelArchivo: string,
  vocabularios: Vocabularios,
  diagnosticos: Diagnosticos,
): HistoriaLeida[] {
  const lineas = lineasDe(textoDelArchivo);
  let i = lineas.findIndex((l) => claseDeLinea(l.texto) !== 'blanco');
  if (i === -1) {
    diagnosticos.agregar(
      'CUS-E001',
      { linea: 1, columna: 1 },
      'El archivo está vacío: falta el frontmatter.',
    );
    return [];
  }
  const leidas: HistoriaLeida[] = [];
  let conFrontmatter = claseDeLinea(lineas[i]?.texto ?? '') === 'delimitador';
  if (!conFrontmatter) {
    diagnosticos.agregar(
      'CUS-E001',
      { linea: 1, columna: 1 },
      'Falta el frontmatter: la historia empieza con `---`.',
    );
    i = 0;
  }
  while (i < lineas.length) {
    const leida = leerHistoria(lineas, i, conFrontmatter, vocabularios, diagnosticos);
    leidas.push(leida.historia);
    i = leida.siguiente;
    conFrontmatter = true;
  }
  return leidas;
}

/** Un `---` seguido de una línea `clave:` abre una historia nueva. */
const abreHistoria = (lineas: readonly Linea[], i: number): boolean =>
  claseDeLinea(lineas[i]?.texto ?? '') === 'delimitador' && pareceCampo(lineas[i + 1]?.texto ?? '');

function leerHistoria(
  lineas: readonly Linea[],
  inicio: number,
  conFrontmatter: boolean,
  vocabularios: Vocabularios,
  diagnosticos: Diagnosticos,
): { historia: HistoriaLeida; siguiente: number } {
  const origen = { linea: lineas[inicio]?.numero ?? 1, columna: 1 };
  const frontmatter = conFrontmatter ? leerFrontmatter(lineas, inicio, diagnosticos) : null;
  const cuerpo = frontmatter?.siguiente ?? inicio;
  let fin = cuerpo;
  while (fin < lineas.length && !abreHistoria(lineas, fin)) fin++;
  const hasta = lineas[fin - 1]?.numero ?? origen.linea;

  const datos = frontmatter
    ? revisarFrontmatter(frontmatter, vocabularios, diagnosticos, origen.linea)
    : { id: null, nombres: [], callar: false, valores: {} };
  const contexto = vocabularios.contexto(datos.nombres, datos.callar);
  const cuerpoLeido = leerCuerpo(lineas.slice(cuerpo, fin), origen, contexto, diagnosticos);

  const historia = {
    ...datos.valores,
    narrativa: cuerpoLeido.narrativa,
    antecedentes: cuerpoLeido.antecedentes,
    escenarios: cuerpoLeido.escenarios,
    limpieza: cuerpoLeido.limpieza,
    origen,
  } as unknown as Historia;
  return { historia: { historia, id: datos.id, desde: origen.linea, hasta }, siguiente: fin };
}

function revisarFrontmatter(
  frontmatter: Frontmatter,
  vocabularios: Vocabularios,
  diagnosticos: Diagnosticos,
  linea: number,
): {
  id: HistoriaLeida['id'];
  nombres: readonly string[];
  callar: boolean;
  valores: Record<string, unknown>;
} {
  // Si una línea del frontmatter no se entendió, no se informan los campos que faltan:
  // la causa es esa línea (regla 1 contra las cascadas).
  const yaMal = diagnosticos.lista.some((d) => d.codigo === 'CUS-E001' && d.linea >= linea);
  revisarClaves(frontmatter, yaMal ? [] : OBLIGATORIAS, CONOCIDAS, diagnosticos);
  const campos = frontmatter.campos;
  const invalido = (clave: string, mensaje: string): void => {
    const campo = campos.get(clave);
    if (campo) diagnosticos.agregar('CUS-E002', campo.posicion, mensaje);
  };

  const dsl = campos.get('dsl');
  if (dsl) revisarVersion(dsl.valor, dsl.posicion, diagnosticos);

  const idCampo = campos.get('id');
  let id: HistoriaLeida['id'] = null;
  if (idCampo) {
    if (typeof idCampo.valor === 'string' && /^HU-[A-Z]+-\d{3}$/.test(idCampo.valor)) {
      id = { valor: idCampo.valor, posicion: idCampo.posicion };
    } else {
      diagnosticos.agregar(
        'CUS-E003',
        idCampo.posicion,
        `El id \`${String(idCampo.valor)}\` no tiene la forma HU-<PRODUCTO>-<NNN>, por ejemplo HU-SUITE-001.`,
      );
    }
  }

  for (const clave of ['producto', 'titulo', 'actor']) {
    if (campos.has(clave) && texto(frontmatter, clave) === null)
      invalido(clave, `\`${clave}\` no puede estar vacío.`);
  }
  const criticidad = texto(frontmatter, 'criticidad');
  if (campos.has('criticidad') && !['alta', 'media', 'baja'].includes(criticidad ?? '')) {
    invalido('criticidad', 'La criticidad es `alta`, `media` o `baja`.');
  }
  const lista = (clave: string, forma: RegExp, mensaje: string): string[] => {
    const valor = campos.get(clave)?.valor;
    if (valor === undefined) return [];
    if (typeof valor === 'string' || !valor.every((v) => forma.test(v))) {
      invalido(clave, mensaje);
      return [];
    }
    return [...valor];
  };
  const etiquetas = lista(
    'etiquetas',
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    'Las etiquetas van en una lista `[a, b]`, en minúsculas con guiones.',
  );
  const nombres = lista('vocabularios', /^[\w-]+$/, 'Los vocabularios van en una lista `[a, b]`.');

  let callar = false;
  const campoVocabularios = campos.get('vocabularios');
  for (const nombre of nombres) {
    const estado = vocabularios.estado(nombre);
    if (estado === 'valido' || !campoVocabularios) continue;
    callar = true;
    diagnosticos.agregar(
      'CUS-E009',
      campoVocabularios.posicion,
      estado === 'no-existe'
        ? `El vocabulario «${nombre}» no existe.`
        : `El vocabulario «${nombre}» tiene errores: revisa su archivo.`,
    );
  }

  return {
    id,
    nombres,
    callar,
    valores: {
      dsl: texto(frontmatter, 'dsl'),
      id: texto(frontmatter, 'id'),
      producto: texto(frontmatter, 'producto'),
      titulo: texto(frontmatter, 'titulo'),
      actor: texto(frontmatter, 'actor'),
      criticidad,
      etiquetas,
      vocabularios: nombres,
    },
  };
}

type Seccion = 'antes' | 'historia' | 'antecedentes' | 'escenario' | 'limpieza' | 'nota';

interface EscenarioLeido {
  nombre: string;
  pasos: Paso[];
  origen: Posicion;
  lineasDePasos: number;
}

const RESERVADOS = ['Historia', 'Antecedentes', 'Escenario', 'Limpieza'];

function leerCuerpo(
  lineas: readonly Linea[],
  origen: Posicion,
  contexto: ContextoDeOraciones,
  diagnosticos: Diagnosticos,
): {
  narrativa: Narrativa | null;
  antecedentes: Paso[];
  escenarios: Escenario[];
  limpieza: Paso[];
} {
  let seccion: Seccion = 'antes';
  let tituloHistoria: Posicion | null = null;
  const partes = new Map<string, { texto: string; origen: Posicion }>();
  let antecedentes: Paso[] | null = null;
  let limpieza: Paso[] | null = null;
  const escenarios: EscenarioLeido[] = [];
  let actual: EscenarioLeido | null = null;

  for (const linea of lineas) {
    const clase = claseDeLinea(linea.texto);
    const posicion = { linea: linea.numero, columna: 1 };
    if (clase === 'titulo') {
      const titulo = linea.texto.slice(3).trim();
      actual = null;
      if (titulo === 'Historia') {
        if (tituloHistoria)
          diagnosticos.agregar('CUS-E004', posicion, 'La sección `## Historia` está repetida.');
        tituloHistoria ??= posicion;
        seccion = 'historia';
      } else if (titulo === 'Antecedentes') {
        if (antecedentes || escenarios.length > 0) {
          diagnosticos.agregar(
            'CUS-E005',
            posicion,
            '`## Antecedentes` va una sola vez, antes del primer escenario.',
          );
        }
        antecedentes ??= [];
        seccion = 'antecedentes';
      } else if (titulo === 'Limpieza') {
        if (limpieza || escenarios.length === 0) {
          diagnosticos.agregar(
            'CUS-E005',
            posicion,
            '`## Limpieza` va una sola vez, después de los escenarios.',
          );
        }
        limpieza ??= [];
        seccion = 'limpieza';
      } else if (titulo.startsWith('Escenario:')) {
        actual = abrirEscenario(linea, titulo, escenarios, diagnosticos);
        seccion = 'escenario';
      } else {
        avisarTituloParecido(linea, titulo, diagnosticos);
        seccion = 'nota';
      }
      continue;
    }
    if (seccion === 'historia' && clase === 'narrativa') {
      leerNarrativa(linea, partes, diagnosticos);
      continue;
    }
    if (clase !== 'paso') continue;
    if (seccion === 'escenario' && actual) {
      const paso = leerPasoDeEscenario(linea, actual, contexto, diagnosticos);
      if (paso) actual.pasos.push(paso);
    } else if (seccion === 'antecedentes' || seccion === 'limpieza') {
      const paso = leerPasoSinFase(linea, seccion, contexto, diagnosticos);
      if (paso) (seccion === 'antecedentes' ? (antecedentes ??= []) : (limpieza ??= [])).push(paso);
    }
  }

  const narrativa = cerrarNarrativa(tituloHistoria, partes, origen, diagnosticos);
  if (escenarios.length === 0) {
    diagnosticos.agregar('CUS-E005', origen, 'La historia no tiene ningún `## Escenario: …`.');
  }
  for (const escenario of escenarios) {
    if (escenario.lineasDePasos === 0) {
      diagnosticos.agregar(
        'CUS-E005',
        escenario.origen,
        `El escenario «${escenario.nombre}» no tiene pasos.`,
      );
    }
  }
  return {
    narrativa,
    antecedentes: antecedentes ?? [],
    escenarios: escenarios.map(
      ({ nombre, pasos, origen }) => ({ nombre, pasos, origen }) as unknown as Escenario,
    ),
    limpieza: limpieza ?? [],
  };
}

function abrirEscenario(
  linea: Linea,
  titulo: string,
  escenarios: EscenarioLeido[],
  diagnosticos: Diagnosticos,
): EscenarioLeido {
  const nombre = titulo.slice('Escenario:'.length).trim();
  const origen = { linea: linea.numero, columna: 1 };
  const columnaDelNombre = saltarEspacios(linea.caracteres, '## Escenario:'.length + 1);
  if (nombre === '') {
    diagnosticos.agregar(
      'CUS-E005',
      origen,
      'El escenario no tiene nombre: `## Escenario: <nombre>`.',
    );
  } else {
    const anterior = escenarios.find((e) => e.nombre === nombre);
    if (anterior) {
      diagnosticos.agregar(
        'CUS-E016',
        { linea: linea.numero, columna: columnaDelNombre },
        `Ya hay un escenario «${nombre}», en la línea ${String(anterior.origen.linea)}.`,
      );
    }
  }
  const escenario = { nombre, pasos: [], origen, lineasDePasos: 0 };
  escenarios.push(escenario);
  return escenario;
}

/** `CUS-W006`: un título que parece una sección del lenguaje, pero no lo es. */
function avisarTituloParecido(linea: Linea, titulo: string, diagnosticos: Diagnosticos): void {
  const cabeza = titulo.split(':')[0]?.trim() ?? '';
  const primera = cabeza.split(/\s+/)[0] ?? '';
  if (Array.from(primera).length < 4) return;
  for (const reservado of RESERVADOS) {
    const igual = primera === reservado;
    const parecido = !igual && distancia(comparable(primera), comparable(reservado)) <= 2;
    // «## Historia de cambios» es una nota legítima; «## Escenario sin dos puntos», no.
    if (!parecido && !(igual && reservado === 'Escenario')) continue;
    const sugerido =
      reservado === 'Escenario'
        ? `## Escenario: ${titulo.slice(primera.length).replace(/^[\s:]+/, '')}`
        : `## ${reservado}`;
    diagnosticos.agregar(
      'CUS-W006',
      { linea: linea.numero, columna: 4 },
      `«## ${titulo}» se parece a una sección del lenguaje, pero se trata como una nota.`,
      `¿Quisiste decir «${sugerido.trimEnd()}»?`,
    );
    return;
  }
}

function leerNarrativa(
  linea: Linea,
  partes: Map<string, { texto: string; origen: Posicion }>,
  diagnosticos: Diagnosticos,
): void {
  const m = /^\*\*(Como|Quiero|Para)\*\*(.*)$/.exec(linea.texto);
  const parte = m?.[1]?.toLowerCase() ?? '';
  const textoDeLaParte = (m?.[2] ?? '').trim();
  const posicion = { linea: linea.numero, columna: 1 };
  if (partes.has(parte)) {
    diagnosticos.agregar(
      'CUS-E004',
      posicion,
      `**${m?.[1] ?? ''}** está repetido en la narrativa.`,
    );
  } else if (textoDeLaParte === '') {
    diagnosticos.agregar('CUS-E004', posicion, `**${m?.[1] ?? ''}** no tiene texto.`);
  } else {
    partes.set(parte, { texto: textoDeLaParte, origen: posicion });
  }
}

function cerrarNarrativa(
  titulo: Posicion | null,
  partes: ReadonlyMap<string, { texto: string; origen: Posicion }>,
  origen: Posicion,
  diagnosticos: Diagnosticos,
): Narrativa | null {
  if (!titulo) {
    diagnosticos.agregar(
      'CUS-E004',
      origen,
      'Falta la sección `## Historia`, con **Como**, **Quiero** y **Para**.',
    );
    return null;
  }
  const faltan = ['Como', 'Quiero', 'Para'].filter((p) => !partes.has(p.toLowerCase()));
  if (faltan.length > 0) {
    diagnosticos.agregar(
      'CUS-E004',
      titulo,
      `A la narrativa le falta ${faltan.map((p) => `**${p}**`).join(', ')}.`,
    );
    return null;
  }
  const como = partes.get('como');
  const quiero = partes.get('quiero');
  const para = partes.get('para');
  if (!como || !quiero || !para) return null;
  if (!(como.origen.linea < quiero.origen.linea && quiero.origen.linea < para.origen.linea)) {
    diagnosticos.agregar(
      'CUS-E004',
      titulo,
      'La narrativa va en orden: **Como**, **Quiero** y **Para**.',
    );
    return null;
  }
  return { como: como.texto, quiero: quiero.texto, para: para.texto, origen: como.origen };
}

/** La fase con que empieza un paso, si la tiene: la palabra y la columna donde sigue la frase. */
function faseDe(linea: Linea): { palabra: string; columnaDeLaFrase: number } | null {
  const caracteres = linea.caracteres;
  let fin = 2;
  while (fin < caracteres.length && caracteres[fin] !== ' ' && caracteres[fin] !== '\t') fin++;
  const palabra = caracteres.slice(2, fin).join('');
  if (!(palabra.toUpperCase() in FASE_DEL_PASO)) return null;
  let columna = saltarEspacios(caracteres, fin + 1);
  const resto = caracteres.slice(columna - 1);
  if (resto.slice(0, 3).join('') === 'que' && (resto[3] === ' ' || resto[3] === '\t')) {
    columna = saltarEspacios(caracteres, columna + 3);
  }
  return { palabra, columnaDeLaFrase: columna };
}

function leerPasoDeEscenario(
  linea: Linea,
  escenario: EscenarioLeido,
  contexto: ContextoDeOraciones,
  diagnosticos: Diagnosticos,
): Paso | null {
  const posicion = { linea: linea.numero, columna: 3 };
  const primero = escenario.lineasDePasos === 0;
  escenario.lineasDePasos++;
  const fase = faseDe(linea);
  if (!fase) {
    diagnosticos.agregar(
      'CUS-E005',
      posicion,
      'El paso de un escenario empieza con DADO, CUANDO, ENTONCES o Y.',
    );
    return null;
  }
  const valor = FASE_DEL_PASO[fase.palabra];
  if (!valor) {
    diagnosticos.agregar(
      'CUS-E005',
      posicion,
      `La fase va en mayúsculas: ${fase.palabra.toUpperCase()}.`,
    );
    return null;
  }
  // Se mira la primera línea del escenario, se haya entendido o no (diseño de la semana 2, §11).
  if (primero && (valor === 'y' || valor === 'entonces')) {
    diagnosticos.agregar(
      'CUS-E005',
      posicion,
      `Un escenario no puede empezar con ${fase.palabra}: empieza con DADO o CUANDO.`,
    );
    return null;
  }
  if (fase.columnaDeLaFrase > linea.caracteres.length) {
    diagnosticos.agregar('CUS-E005', posicion, `Después de ${fase.palabra} falta la frase.`);
    return null;
  }
  return analizarOracion(linea, fase.columnaDeLaFrase, valor, contexto, diagnosticos);
}

function leerPasoSinFase(
  linea: Linea,
  seccion: 'antecedentes' | 'limpieza',
  contexto: ContextoDeOraciones,
  diagnosticos: Diagnosticos,
): Paso | null {
  const fase = faseDe(linea);
  if (fase && fase.palabra in FASE_DEL_PASO) {
    const nombre = seccion === 'antecedentes' ? 'Antecedentes' : 'Limpieza';
    diagnosticos.agregar(
      'CUS-E005',
      { linea: linea.numero, columna: 3 },
      `En \`## ${nombre}\` los pasos no llevan fase.`,
    );
    return null;
  }
  return analizarOracion(linea, 3, null, contexto, diagnosticos);
}
