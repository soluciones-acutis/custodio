/**
 * `custodio validar`: busca y lee los archivos, llama al analizador de
 * `lenguaje` y escribe sus diagnósticos (diseño de la semana 3, §8).
 *
 * Recibe la E/S como parámetros, así que sus pruebas corren sin disco.
 */
import { parseArgs } from 'node:util';
import { analizar, type ArchivoFuente } from '../../lenguaje/index.ts';
import { presentarJson, presentarLegible } from './presentar.ts';

/** Lo que `validar` necesita del sistema de archivos. Las rutas usan `/`. */
export interface SistemaDeArchivos {
  tipo(ruta: string): 'archivo' | 'carpeta' | null;
  /** Los nombres de lo que hay en una carpeta. */
  listar(carpeta: string): readonly string[];
  leer(ruta: string): string;
}

export interface Consola {
  escribir(texto: string): void;
  error(texto: string): void;
  /** Si la salida admite colores: una terminal y sin `NO_COLOR`. */
  readonly colores: boolean;
}

/** Los códigos de salida (§8.1). */
export const SALIDA = { sinErrores: 0, conErrores: 1, usoInvalido: 2 } as const;

export const USO_DE_VALIDAR = `Uso: custodio validar [rutas...] [--json] [--vocabularios <carpeta>]

Valida los .historia.md y .vocabulario.md de las rutas (archivos o carpetas; por defecto, la carpeta actual).
Además lee los vocabularios de ./vocabularios, o de la carpeta de --vocabularios.

  --json                  Salida en JSON (formato custodio-diagnosticos/0.1.0).
  --vocabularios <ruta>   Carpeta de los vocabularios.

Sale con 0 si no hay errores, 1 si los hay y 2 si el uso es inválido.`;

const NO_SE_RECORREN = new Set(['node_modules', '.git']);

class UsoInvalido extends Error {}

export function validar(
  argumentos: readonly string[],
  sistema: SistemaDeArchivos,
  consola: Consola,
): number {
  try {
    const { values: opciones, positionals: rutas } = parseArgs({
      args: [...argumentos],
      options: { json: { type: 'boolean' }, vocabularios: { type: 'string' } },
      allowPositionals: true,
    });
    const archivos = buscar(rutas.length > 0 ? rutas : ['.'], opciones.vocabularios, sistema);
    const leer = (ruta: string): ArchivoFuente => ({ ruta, texto: sistema.leer(ruta) });
    const historias = archivos.historias.map(leer);
    const vocabularios = archivos.vocabularios.map(leer);
    const resultado = analizar({ historias, vocabularios });
    const total = historias.length + vocabularios.length;
    consola.escribir(
      opciones.json
        ? presentarJson(resultado.diagnosticos, total)
        : presentarLegible(
            resultado.diagnosticos,
            total,
            [...historias, ...vocabularios],
            consola.colores,
          ),
    );
    return resultado.diagnosticos.some((d) => d.severidad === 'error')
      ? SALIDA.conErrores
      : SALIDA.sinErrores;
  } catch (error) {
    if (!(error instanceof UsoInvalido) && !esErrorDeArgumentos(error)) throw error;
    consola.error(`${(error as Error).message}\n\n${USO_DE_VALIDAR}`);
    return SALIDA.usoInvalido;
  }
}

/** Los errores de `parseArgs` (una opción desconocida o sin valor) tienen un código `ERR_PARSE_ARGS_…`. */
const esErrorDeArgumentos = (error: unknown): boolean =>
  error instanceof Error && 'code' in error && String(error.code).startsWith('ERR_PARSE_ARGS');

/** Los archivos del DSL en las rutas, ordenados y sin repetir. */
function buscar(
  rutas: readonly string[],
  carpetaDeVocabularios: string | undefined,
  sistema: SistemaDeArchivos,
): { historias: string[]; vocabularios: string[] } {
  const historias = new Set<string>();
  const vocabularios = new Set<string>();
  const agregar = (ruta: string, explicita: boolean): void => {
    if (ruta.endsWith('.historia.md')) historias.add(ruta);
    else if (ruta.endsWith('.vocabulario.md')) vocabularios.add(ruta);
    else if (explicita)
      throw new UsoInvalido(`«${ruta}» no es un .historia.md ni un .vocabulario.md.`);
  };
  const recorrer = (carpeta: string): void => {
    for (const nombre of sistema.listar(carpeta)) {
      const ruta = unir(carpeta, nombre);
      const tipo = sistema.tipo(ruta);
      if (tipo === 'carpeta' && !NO_SE_RECORREN.has(nombre)) recorrer(ruta);
      else if (tipo === 'archivo') agregar(ruta, false);
    }
  };

  for (const cruda of rutas) {
    const ruta = normalizar(cruda);
    const tipo = sistema.tipo(ruta);
    if (tipo === null) throw new UsoInvalido(`La ruta «${cruda}» no existe.`);
    if (tipo === 'carpeta') recorrer(ruta);
    else agregar(ruta, true);
  }

  const vocabulariosPorDefecto = carpetaDeVocabularios === undefined;
  const carpeta = normalizar(carpetaDeVocabularios ?? 'vocabularios');
  const tipo = sistema.tipo(carpeta);
  if (tipo === 'carpeta') {
    for (const nombre of sistema.listar(carpeta)) {
      if (nombre.endsWith('.vocabulario.md')) vocabularios.add(unir(carpeta, nombre));
    }
  } else if (!vocabulariosPorDefecto) {
    throw new UsoInvalido(`La carpeta de vocabularios «${carpetaDeVocabularios}» no existe.`);
  }
  return { historias: [...historias].sort(), vocabularios: [...vocabularios].sort() };
}

/** `\` pasa a `/`, sin `./` al principio ni `/` al final. */
const normalizar = (ruta: string): string =>
  ruta
    .replaceAll('\\', '/')
    .replace(/^(\.\/)+/, '')
    .replace(/(.)\/+$/, '$1') || '.';

const unir = (carpeta: string, nombre: string): string =>
  carpeta === '.' ? nombre : `${carpeta}/${nombre}`;
