/**
 * Lo que comparten los comandos de la CLI: la E/S que reciben como parámetros,
 * los códigos de salida y cómo se buscan los archivos del DSL de un proyecto.
 */
import { parseArgs, type ParseArgsOptionsConfig } from 'node:util';
import type { EntradaDelAnalizador } from '../../lenguaje/index.ts';

/** Lo que la CLI necesita del sistema de archivos. Las rutas usan `/`. */
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

/** Los códigos de salida. */
export const SALIDA = { sinErrores: 0, conErrores: 1, usoInvalido: 2, falloInterno: 3 } as const;

/** El uso del comando está mal: una opción, una ruta. Sale con 2. */
export class UsoInvalido extends Error {}

/** Las opciones que comparten `validar` y `compilar` para encontrar los archivos. */
export const OPCIONES_DEL_PROYECTO = {
  vocabularios: { type: 'string' },
  ambiente: { type: 'string' },
} as const satisfies ParseArgsOptionsConfig;

export const AYUDA_DEL_PROYECTO = `Busca los .historia.md y .vocabulario.md en las rutas (archivos o carpetas; por defecto,
la carpeta actual), y además los vocabularios de ./vocabularios y el ambiente de ./ambientes.

  --vocabularios <carpeta>   Carpeta de los vocabularios.
  --ambiente <archivo>       El .ambiente.md. Si no se indica, el único que haya en ./ambientes.`;

/**
 * Corre un comando: lee sus argumentos y traduce los errores a un código de
 * salida. Un fallo que no es de uso (un archivo que no se puede leer) es interno.
 */
export function correr<O extends ParseArgsOptionsConfig>(
  argumentos: readonly string[],
  opciones: O,
  uso: string,
  consola: Consola,
  comando: (
    valores: ReturnType<typeof parseArgs<{ options: O; allowPositionals: true }>>,
  ) => number,
): number {
  if (argumentos.includes('--help') || argumentos.includes('-h')) {
    consola.escribir(`${uso}
`);
    return SALIDA.sinErrores;
  }
  try {
    return comando(parseArgs({ args: [...argumentos], options: opciones, allowPositionals: true }));
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error);
    if (error instanceof UsoInvalido || esErrorDeArgumentos(error)) {
      consola.error(`${mensaje}\n\n${uso}`);
      return SALIDA.usoInvalido;
    }
    consola.error(`Error interno: ${mensaje}`);
    return SALIDA.falloInterno;
  }
}

/** Los errores de `parseArgs` (una opción desconocida o sin valor) tienen un código `ERR_PARSE_ARGS_…`. */
const esErrorDeArgumentos = (error: unknown): boolean =>
  error instanceof Error && 'code' in error && String(error.code).startsWith('ERR_PARSE_ARGS');

const NO_SE_RECORREN = new Set(['node_modules', '.git']);

/** Los archivos del DSL de las rutas, leídos y listos para el analizador. */
export function leerProyecto(
  rutas: readonly string[],
  opciones: { readonly vocabularios?: string | undefined; readonly ambiente?: string | undefined },
  sistema: SistemaDeArchivos,
): EntradaDelAnalizador & { readonly archivos: number } {
  const historias = new Set<string>();
  const vocabularios = new Set<string>();
  const ambientes = new Set<string>();
  const agregar = (ruta: string, explicita: boolean): void => {
    if (ruta.endsWith('.historia.md')) historias.add(ruta);
    else if (ruta.endsWith('.vocabulario.md')) vocabularios.add(ruta);
    else if (explicita && ruta.endsWith('.ambiente.md')) ambientes.add(ruta);
    else if (explicita) {
      throw new UsoInvalido(
        `«${ruta}» no es un .historia.md, un .vocabulario.md ni un .ambiente.md.`,
      );
    }
  };
  const recorrer = (carpeta: string): void => {
    for (const nombre of sistema.listar(carpeta)) {
      const ruta = unir(carpeta, nombre);
      const tipo = sistema.tipo(ruta);
      if (tipo === 'carpeta' && !NO_SE_RECORREN.has(nombre)) recorrer(ruta);
      else if (tipo === 'archivo') agregar(ruta, false);
    }
  };

  for (const cruda of rutas.length > 0 ? rutas : ['.']) {
    const ruta = normalizar(cruda);
    const tipo = sistema.tipo(ruta);
    if (tipo === null) throw new UsoInvalido(`La ruta «${cruda}» no existe.`);
    if (tipo === 'carpeta') recorrer(ruta);
    else agregar(ruta, true);
  }

  for (const ruta of archivosDe(
    opciones.vocabularios,
    'vocabularios',
    '.vocabulario.md',
    sistema,
  )) {
    vocabularios.add(ruta);
  }
  if (opciones.ambiente !== undefined) {
    const ruta = normalizar(opciones.ambiente);
    if (sistema.tipo(ruta) !== 'archivo') {
      throw new UsoInvalido(`El ambiente «${opciones.ambiente}» no existe.`);
    }
    ambientes.add(ruta);
  } else if (ambientes.size === 0) {
    for (const ruta of archivosDe(undefined, 'ambientes', '.ambiente.md', sistema))
      ambientes.add(ruta);
  }
  if (ambientes.size > 1) {
    throw new UsoInvalido(
      `Hay varios ambientes (${[...ambientes].sort().join(', ')}): elige uno con --ambiente.`,
    );
  }

  const leer = (ruta: string) => ({ ruta, texto: sistema.leer(ruta) });
  const [ambiente] = ambientes;
  return {
    historias: [...historias].sort().map(leer),
    vocabularios: [...vocabularios].sort().map(leer),
    ...(ambiente ? { ambiente: leer(ambiente) } : {}),
    archivos: historias.size + vocabularios.size + ambientes.size,
  };
}

/** Los archivos con esa extensión en una carpeta: la indicada, que tiene que existir, o la de por defecto, si existe. */
function archivosDe(
  indicada: string | undefined,
  porDefecto: string,
  extension: string,
  sistema: SistemaDeArchivos,
): string[] {
  const carpeta = normalizar(indicada ?? porDefecto);
  if (sistema.tipo(carpeta) !== 'carpeta') {
    if (indicada !== undefined) throw new UsoInvalido(`La carpeta «${indicada}» no existe.`);
    return [];
  }
  return sistema
    .listar(carpeta)
    .filter((nombre) => nombre.endsWith(extension))
    .map((nombre) => unir(carpeta, nombre));
}

/** `\` pasa a `/`, sin `./` al principio ni `/` al final. */
const normalizar = (ruta: string): string =>
  ruta
    .replaceAll('\\', '/')
    .replace(/^(\.\/)+/, '')
    .replace(/(.)\/+$/, '$1') || '.';

const unir = (carpeta: string, nombre: string): string =>
  carpeta === '.' ? nombre : `${carpeta}/${nombre}`;
