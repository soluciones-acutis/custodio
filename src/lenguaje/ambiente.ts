/**
 * La declaración de un ambiente: el `.ambiente.md` (especificación §9.5,
 * gramática EBNF, sección 9). Tiene solo nombres, nunca valores.
 *
 * La declaración es de `lenguaje`, porque es texto y la usa el validador; los
 * valores son del módulo `ambientes` (ADR-002).
 */
import type { Diagnosticos } from './diagnosticos.ts';
import { leerFrontmatter, revisarClaves, revisarVersion, texto } from './frontmatter.ts';
import { claseDeLinea } from './lineas.ts';
import { lineasDe } from './texto.ts';

export interface DeclaracionDeAmbiente {
  readonly archivo: string;
  readonly ambiente: string;
  readonly producto: string;
  /** Si sus datos se pueden perder sin daño (§11.3). */
  readonly desechable: boolean;
  /** Nombres o patrones como `USUARIO_*`. */
  readonly variables: readonly string[];
  readonly secretos: readonly string[];
}

const CLAVES = ['ambiente', 'dsl', 'producto', 'desechable'];
const NOMBRE = /^[A-Za-z_]\w*\*?$/;

/** Lee un archivo de ambiente. Con errores de sintaxis devuelve `null`. */
export function leerAmbiente(
  ruta: string,
  textoDelArchivo: string,
  diagnosticos: Diagnosticos,
): DeclaracionDeAmbiente | null {
  const lineas = lineasDe(textoDelArchivo);
  const inicio = lineas.findIndex((l) => claseDeLinea(l.texto) !== 'blanco');
  if (inicio === -1 || claseDeLinea(lineas[inicio]?.texto ?? '') !== 'delimitador') {
    diagnosticos.agregar(
      'CUS-E001',
      { linea: 1, columna: 1 },
      'Falta el frontmatter: el ambiente empieza con `---`.',
    );
    return null;
  }
  const frontmatter = leerFrontmatter(lineas, inicio, diagnosticos);
  const yaMal = diagnosticos.lista.some((d) => d.codigo === 'CUS-E001');
  revisarClaves(frontmatter, yaMal ? [] : CLAVES, CLAVES, diagnosticos);
  const dsl = frontmatter.campos.get('dsl');
  if (dsl) revisarVersion(dsl.valor, dsl.posicion, diagnosticos);
  const desechable = frontmatter.campos.get('desechable');
  if (desechable && desechable.valor !== 'sí' && desechable.valor !== 'no') {
    diagnosticos.agregar('CUS-E002', desechable.posicion, '`desechable` es `sí` o `no`.');
  }

  const listas = new Map<string, string[]>();
  let actual: string[] | null = null;
  for (const linea of lineas.slice(frontmatter.siguiente)) {
    const clase = claseDeLinea(linea.texto);
    if (clase === 'titulo') {
      const titulo = linea.texto.slice(3).trim();
      actual = titulo === 'Variables' || titulo === 'Secretos' ? [] : null;
      if (actual) listas.set(titulo, actual);
    } else if (actual && clase === 'paso') {
      const nombre = linea.texto.slice(2).trim();
      if (NOMBRE.test(nombre)) actual.push(nombre);
      else {
        diagnosticos.agregar(
          'CUS-E002',
          { linea: linea.numero, columna: 3 },
          `«${nombre}» no es un nombre de variable: letras, dígitos y \`_\`, y opcionalmente \`*\` al final.`,
        );
      }
    }
  }
  const variables = listas.get('Variables');
  const secretos = listas.get('Secretos') ?? [];
  if (!variables) {
    diagnosticos.agregar('CUS-E002', frontmatter.apertura, 'Falta la sección `## Variables`.');
  }
  for (const repetido of secretos.filter((s) => variables?.includes(s))) {
    diagnosticos.agregar(
      'CUS-E002',
      frontmatter.apertura,
      `«${repetido}» está en \`## Variables\` y en \`## Secretos\`: un secreto va solo en \`## Secretos\`.`,
    );
  }
  if (diagnosticos.lista.some((d) => d.severidad === 'error')) return null;
  return {
    archivo: ruta,
    ambiente: texto(frontmatter, 'ambiente') ?? '',
    producto: texto(frontmatter, 'producto') ?? '',
    desechable: desechable?.valor === 'sí',
    variables: variables ?? [],
    secretos,
  };
}

/** Si el nombre está declarado: `USUARIO_*` calza con cualquier final de letras, dígitos y `_`. */
export function declarado(nombre: string, lista: readonly string[]): boolean {
  return lista.some((d) =>
    d.endsWith('*')
      ? nombre.startsWith(d.slice(0, -1)) && /^\w*$/.test(nombre.slice(d.length - 1))
      : nombre === d,
  );
}
