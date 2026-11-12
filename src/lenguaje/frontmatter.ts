/**
 * El frontmatter: un subconjunto de YAML escrito a mano, el que define la
 * gramática (`clave: valor` y listas `[a, b]`). Lo que se salga de él es
 * `CUS-E001` (ADR-003).
 */
import { VERSION_AST } from './ast.ts';
import type { Diagnosticos, Posicion } from './diagnosticos.ts';
import { masParecido } from './sugerencias.ts';
import type { Linea } from './texto.ts';

export interface CampoDelFrontmatter {
  readonly clave: string;
  readonly valor: string | readonly string[];
  /** Dónde empieza el valor. */
  readonly posicion: Posicion;
}

export interface Frontmatter {
  readonly campos: ReadonlyMap<string, CampoDelFrontmatter>;
  /** La línea del `---` que lo abre. */
  readonly apertura: Posicion;
  /** Índice de la primera línea después del frontmatter. */
  readonly siguiente: number;
}

const CAMPO = /^([A-Za-z_][\w-]*):(\s*)(.*)$/;

/** Lee el frontmatter que abre el `---` de `lineas[indice]`. */
export function leerFrontmatter(
  lineas: readonly Linea[],
  indice: number,
  diagnosticos: Diagnosticos,
): Frontmatter {
  const apertura = { linea: lineas[indice]?.numero ?? 1, columna: 1 };
  const campos = new Map<string, CampoDelFrontmatter>();
  for (let i = indice + 1; i < lineas.length; i++) {
    const linea = lineas[i];
    if (!linea) break;
    const texto = linea.texto;
    if (texto.trimEnd() === '---') return { campos, apertura, siguiente: i + 1 };
    if (texto.trim() === '') continue;
    if (texto.startsWith('## ')) {
      diagnosticos.agregar('CUS-E001', apertura, 'El frontmatter no se cierra con `---`.');
      return { campos, apertura, siguiente: i };
    }
    const m = CAMPO.exec(texto);
    if (!m) {
      diagnosticos.agregar(
        'CUS-E001',
        { linea: linea.numero, columna: 1 },
        'Esta línea del frontmatter no tiene la forma `clave: valor`.',
      );
      continue;
    }
    const clave = m[1] ?? '';
    const crudo = (m[3] ?? '').trimEnd();
    const posicion = {
      linea: linea.numero,
      columna: Array.from(`${clave}:${m[2] ?? ''}`).length + 1,
    };
    if (campos.has(clave)) {
      diagnosticos.agregar('CUS-E001', posicion, `La clave \`${clave}\` está repetida.`);
      continue;
    }
    campos.set(clave, { clave, valor: valorDe(crudo), posicion });
  }
  diagnosticos.agregar('CUS-E001', apertura, 'El frontmatter no se cierra con `---`.');
  return { campos, apertura, siguiente: lineas.length };
}

function valorDe(crudo: string): string | readonly string[] {
  const lista = /^\[(.*)\]$/.exec(crudo);
  if (lista) {
    return (lista[1] ?? '')
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v !== '');
  }
  const entreComillas = /^"(.*)"$/.exec(crudo);
  return entreComillas ? (entreComillas[1] ?? '') : crudo;
}

/**
 * Informa los campos obligatorios que faltan (`CUS-E002`) y las claves que no
 * conoce (`CUS-W007`, con sugerencia).
 */
export function revisarClaves(
  frontmatter: Frontmatter,
  obligatorias: readonly string[],
  conocidas: readonly string[],
  diagnosticos: Diagnosticos,
): void {
  for (const clave of obligatorias) {
    if (!frontmatter.campos.has(clave)) {
      diagnosticos.agregar(
        'CUS-E002',
        frontmatter.apertura,
        `Falta \`${clave}\` en el frontmatter.`,
      );
    }
  }
  for (const campo of frontmatter.campos.values()) {
    if (conocidas.includes(campo.clave)) continue;
    const parecida = masParecido(campo.clave, conocidas, 2);
    diagnosticos.agregar(
      'CUS-W007',
      { linea: campo.posicion.linea, columna: 1 },
      `La clave \`${campo.clave}\` no es del frontmatter.`,
      parecida ? `¿Quisiste decir \`${parecida}\`?` : null,
    );
  }
}

/** El valor de un campo si es un texto no vacío. */
export function texto(frontmatter: Frontmatter, clave: string): string | null {
  const valor = frontmatter.campos.get(clave)?.valor;
  return typeof valor === 'string' && valor !== '' ? valor : null;
}

const VERSIONES_SOPORTADAS: readonly string[] = [VERSION_AST];

/** `CUS-E015`: semver sin `v`, en una versión que el validador soporta (§14). */
export function revisarVersion(
  valor: string | readonly string[],
  posicion: Posicion,
  diagnosticos: Diagnosticos,
): void {
  if (typeof valor !== 'string' || !/^\d+\.\d+\.\d+$/.test(valor)) {
    diagnosticos.agregar(
      'CUS-E015',
      posicion,
      `La versión \`${String(valor)}\` va en semver, sin \`v\`: por ejemplo \`${VERSION_AST}\`.`,
    );
  } else if (!VERSIONES_SOPORTADAS.includes(valor)) {
    diagnosticos.agregar(
      'CUS-E015',
      posicion,
      `La versión \`${valor}\` no está soportada. Las soportadas son: ${VERSIONES_SOPORTADAS.join(', ')}.`,
    );
  }
}
