/**
 * El analizador: del texto de varios archivos al AST y los diagnósticos
 * (diseño de la semana 3, §4.5). Es una función pura: no lee archivos.
 *
 * Se analizan juntos porque hay errores que cruzan archivos: un `id` repetido
 * (`CUS-E003`), un vocabulario importado que no existe o tiene errores
 * (`CUS-E009`) y una oración que calza con frases de dos vocabularios (`CUS-E017`).
 *
 * La unidad es la historia: una historia con errores no produce AST, pero las
 * demás de su archivo sí.
 */
import type { ArchivoDeHistorias, ArchivoDeVocabulario, Historia } from './ast.ts';
import { VERSION_AST } from './ast.ts';
import { Diagnosticos, ordenar, type Diagnostico } from './diagnosticos.ts';
import { leerHistorias, type HistoriaLeida, type Vocabularios } from './historias.ts';
import type { ContextoDeOraciones, FraseConocida } from './oraciones.ts';
import { IndiceDePatrones } from './patrones.ts';
import { leerVocabulario, type VocabularioLeido } from './vocabularios.ts';

export interface ArchivoFuente {
  /** Solo para los diagnósticos y el campo `archivo` del AST. */
  readonly ruta: string;
  readonly texto: string;
}

export interface EntradaDelAnalizador {
  readonly historias: readonly ArchivoFuente[];
  readonly vocabularios: readonly ArchivoFuente[];
}

export interface ResultadoDeAnalisis {
  /** Un archivo por cada archivo de historias con al menos una historia sin errores. */
  readonly historias: readonly ArchivoDeHistorias[];
  /** Los vocabularios sin errores. */
  readonly vocabularios: readonly ArchivoDeVocabulario[];
  /** Los de todos los archivos, por archivo, línea y columna. */
  readonly diagnosticos: readonly Diagnostico[];
}

export function analizar(entrada: EntradaDelAnalizador): ResultadoDeAnalisis {
  const leidos = entrada.vocabularios.map((fuente) =>
    leerVocabulario(fuente.ruta, fuente.texto, new Diagnosticos(fuente.ruta)),
  );
  const vocabularios = new VocabulariosDisponibles(leidos);

  const archivos = entrada.historias.map((fuente) => {
    const diagnosticos = new Diagnosticos(fuente.ruta);
    return {
      fuente,
      diagnosticos,
      historias: leerHistorias(fuente.texto, vocabularios, diagnosticos),
    };
  });

  // Un id repetido se informa en la segunda aparición, que es la que pierde su AST.
  const ids = new Map<string, string>();
  for (const { fuente, diagnosticos, historias } of archivos) {
    for (const { id } of historias) {
      if (!id) continue;
      const anterior = ids.get(id.valor);
      if (anterior) {
        diagnosticos.agregar(
          'CUS-E003',
          id.posicion,
          `El id \`${id.valor}\` ya está en ${anterior}.`,
        );
      } else {
        ids.set(id.valor, `${fuente.ruta}:${String(id.posicion.linea)}`);
      }
    }
  }

  const sinErrores = (diagnosticos: Diagnosticos, leida: HistoriaLeida): Historia[] =>
    diagnosticos.hayErroresEntre(leida.desde, leida.hasta) ? [] : [leida.historia];
  return {
    historias: archivos.flatMap(({ fuente, diagnosticos, historias }) => {
      const validas = historias.flatMap((h) => sinErrores(diagnosticos, h));
      const [primera, ...resto] = validas;
      return primera
        ? [{ ast: VERSION_AST, archivo: fuente.ruta, historias: [primera, ...resto] }]
        : [];
    }),
    vocabularios: leidos.flatMap((v) => (v.ast ? [v.ast] : [])),
    diagnosticos: ordenar([
      ...leidos.flatMap((v) => v.diagnosticos.lista),
      ...archivos.flatMap((a) => a.diagnosticos.lista),
    ]),
  };
}

/** Los vocabularios leídos, por nombre. Si dos tienen el mismo nombre, vale el primero. */
class VocabulariosDisponibles implements Vocabularios {
  private readonly porNombre = new Map<string, VocabularioLeido>();
  private readonly contextos = new Map<string, ContextoDeOraciones>();

  constructor(leidos: readonly VocabularioLeido[]) {
    for (const leido of leidos) {
      if (leido.nombre !== null && !this.porNombre.has(leido.nombre))
        this.porNombre.set(leido.nombre, leido);
    }
  }

  estado(nombre: string): 'valido' | 'con-errores' | 'no-existe' {
    const leido = this.porNombre.get(nombre);
    if (!leido) return 'no-existe';
    return leido.ast ? 'valido' : 'con-errores';
  }

  contexto(nombres: readonly string[], callarDesconocidas: boolean): ContextoDeOraciones {
    const clave = `${callarDesconocidas ? '!' : ''}${nombres.join('\n')}`;
    let contexto = this.contextos.get(clave);
    if (!contexto) {
      const frases = new IndiceDePatrones<FraseConocida>();
      for (const nombre of nombres) {
        for (const frase of this.porNombre.get(nombre)?.frases ?? []) frases.agregar(frase);
      }
      contexto = { frases, callarDesconocidas };
      this.contextos.set(clave, contexto);
    }
    return contexto;
  }
}
