/**
 * Para probar la CLI sin disco: un sistema de archivos en memoria y una
 * consola que guarda lo que se escribe.
 */
import type { Consola, SistemaDeArchivos } from '../../src/arranque/cli/proyecto.ts';

export const VOCABULARIO =
  '---\nvocabulario: v\ndsl: 0.1.0\nproducto: x\n---\n\n## Frase: entro\n- navego a `https://x`\n';

export const AMBIENTE =
  '---\nambiente: a\ndsl: 0.1.0\nproducto: x\ndesechable: sí\n---\n\n## Variables\n- SITIO\n';

/** Una historia válida, con `pasos` en su escenario desde la línea 20. */
export const historia = (
  id: string,
  pasos = '- CUANDO entro\n- ENTONCES veo el texto "Hola"',
  etiquetas = '[prueba]',
): string =>
  `---\ndsl: 0.1.0\nid: ${id}\nproducto: x\ntitulo: t\nactor: a\ncriticidad: media\netiquetas: ${etiquetas}\nvocabularios: [v]\n---\n\n## Historia\n**Como** a\n\n**Quiero** b\n\n**Para** c\n\n## Escenario: e\n${pasos}\n`;

/** Un proyecto chico: dos historias, un vocabulario, un ambiente y archivos que no se leen. */
export const PROYECTO: Readonly<Record<string, string>> = {
  'vocabularios/v.vocabulario.md': VOCABULARIO,
  'ambientes/a.ambiente.md': AMBIENTE,
  'historias/a.historia.md': historia('HU-X-001'),
  'historias/sub/b.historia.md': historia('HU-X-002', undefined, '[otra]'),
  'node_modules/p/c.historia.md': 'no se lee',
  'README.md': '# no se lee',
};

/** Un sistema de archivos en memoria: las carpetas salen de las rutas de los archivos. */
export function enMemoria(archivos: Readonly<Record<string, string>>): SistemaDeArchivos {
  const carpetas = new Set(['.']);
  for (const ruta of Object.keys(archivos)) {
    const partes = ruta.split('/');
    for (let i = 1; i < partes.length; i++) carpetas.add(partes.slice(0, i).join('/'));
  }
  return {
    tipo: (ruta) => (ruta in archivos ? 'archivo' : carpetas.has(ruta) ? 'carpeta' : null),
    listar: (carpeta) => {
      const prefijo = carpeta === '.' ? '' : `${carpeta}/`;
      const nombres = [...Object.keys(archivos), ...carpetas]
        .filter(
          (r) => r.startsWith(prefijo) && r !== carpeta && !r.slice(prefijo.length).includes('/'),
        )
        .map((r) => r.slice(prefijo.length));
      return [...new Set(nombres)].filter((n) => n !== '' && n !== '.');
    },
    leer: (ruta) => {
      const texto = archivos[ruta];
      if (texto === undefined) throw new Error(`no se puede leer ${ruta}`);
      return texto;
    },
  };
}

type Comando = (
  argumentos: readonly string[],
  sistema: SistemaDeArchivos,
  consola: Consola,
) => number;

/** Corre un comando con los archivos en memoria y devuelve su código y lo que escribió. */
export function correr(
  comando: Comando,
  argumentos: readonly string[],
  archivos: Readonly<Record<string, string>>,
  { colores = false, sistema = enMemoria(archivos) } = {},
) {
  let salida = '';
  let errores = '';
  const consola: Consola = {
    escribir: (t) => (salida += t),
    error: (t) => (errores += t),
    colores,
  };
  const codigo = comando(argumentos, sistema, consola);
  return { codigo, salida, errores };
}
