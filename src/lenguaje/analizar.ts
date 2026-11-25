/**
 * El validador: del texto de varios archivos al AST y los diagnósticos de las
 * dos etapas, la sintaxis (diseño de la semana 3) y la semántica (diseño de la
 * semana 4, §1). Es una función pura: no lee archivos.
 *
 * Se analizan juntos porque hay errores que cruzan archivos: un `id` repetido
 * (`CUS-E003`), un vocabulario importado que no existe o tiene errores
 * (`CUS-E009`), una oración que calza con frases de dos vocabularios
 * (`CUS-E017`) y dos vocabularios con el mismo nombre (`CUS-E018`).
 *
 * La unidad es la historia: una historia con errores no produce AST, pero las
 * demás de su archivo sí.
 */
import type { ArchivoDeHistorias, ArchivoDeVocabulario, Historia } from './ast.ts';
import { VERSION_AST } from './ast.ts';
import { leerAmbiente, type DeclaracionDeAmbiente } from './ambiente.ts';
import { Diagnosticos, ordenar, type Diagnostico } from './diagnosticos.ts';
import { leerHistorias, type HistoriaLeida, type Vocabularios } from './historias.ts';
import type { ContextoDeOraciones, FraseConocida } from './oraciones.ts';
import { IndiceDePatrones } from './patrones.ts';
import { revisarHistoria, revisarVocabulario } from './semantica.ts';
import { leerVocabulario, tieneErrores, type VocabularioLeido } from './vocabularios.ts';

export interface ArchivoFuente {
  /** Solo para los diagnósticos y el campo `archivo` del AST. */
  readonly ruta: string;
  readonly texto: string;
}

export interface EntradaDelAnalizador {
  readonly historias: readonly ArchivoFuente[];
  readonly vocabularios: readonly ArchivoFuente[];
  /**
   * La declaración del ambiente (§9.5). Sin ella no se revisan las variables en
   * mayúsculas ni los secretos, y la limpieza sin pasos se trata como en un
   * ambiente que no es desechable.
   */
  readonly ambiente?: ArchivoFuente;
}

export interface ResultadoDeAnalisis {
  /** Un archivo por cada archivo de historias con al menos una historia sin errores. */
  readonly historias: readonly ArchivoDeHistorias[];
  /** Los vocabularios sin errores. */
  readonly vocabularios: readonly ArchivoDeVocabulario[];
  /** La declaración del ambiente, si se indicó uno y no tiene errores. */
  readonly ambiente: DeclaracionDeAmbiente | null;
  /** Los de todos los archivos, por archivo, línea y columna. */
  readonly diagnosticos: readonly Diagnostico[];
}

export function analizar(entrada: EntradaDelAnalizador): ResultadoDeAnalisis {
  const diagnosticosDelAmbiente = entrada.ambiente ? new Diagnosticos(entrada.ambiente.ruta) : null;
  const ambiente =
    entrada.ambiente && diagnosticosDelAmbiente
      ? leerAmbiente(entrada.ambiente.ruta, entrada.ambiente.texto, diagnosticosDelAmbiente)
      : null;

  const leidos = entrada.vocabularios.map((fuente) =>
    leerVocabulario(fuente.ruta, fuente.texto, new Diagnosticos(fuente.ruta)),
  );
  const vocabularios = new VocabulariosDisponibles(leidos);
  // La semántica de los vocabularios va antes que las historias: un vocabulario con
  // errores de semántica también deja un CUS-E009 en las historias que lo importan.
  for (const leido of leidos) {
    if (leido.ast && !tieneErrores(leido))
      revisarVocabulario(leido.ast, ambiente, leido.diagnosticos);
  }

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

  const validos = vocabularios.validos();
  const sinErrores = (diagnosticos: Diagnosticos, leida: HistoriaLeida): boolean =>
    !diagnosticos.hayErroresEntre(leida.desde, leida.hasta);
  for (const { diagnosticos, historias } of archivos) {
    for (const leida of historias) {
      if (sinErrores(diagnosticos, leida)) {
        revisarHistoria(leida.historia, validos, ambiente, diagnosticos);
      }
    }
  }

  return {
    historias: archivos.flatMap(({ fuente, diagnosticos, historias }) => {
      const validas = historias.flatMap((h): Historia[] =>
        sinErrores(diagnosticos, h) ? [h.historia] : [],
      );
      const [primera, ...resto] = validas;
      return primera
        ? [{ ast: VERSION_AST, archivo: fuente.ruta, historias: [primera, ...resto] }]
        : [];
    }),
    vocabularios: leidos.flatMap((v) => (v.ast && !tieneErrores(v) ? [v.ast] : [])),
    ambiente,
    diagnosticos: ordenar([
      ...(diagnosticosDelAmbiente?.lista ?? []),
      ...leidos.flatMap((v) => v.diagnosticos.lista),
      ...archivos.flatMap((a) => a.diagnosticos.lista),
    ]),
  };
}

/**
 * Los vocabularios leídos, por nombre. Si dos tienen el mismo nombre, el
 * segundo es `CUS-E018` (issue #21): ninguno gana sin avisar.
 */
class VocabulariosDisponibles implements Vocabularios {
  private readonly porNombre = new Map<string, VocabularioLeido>();
  private readonly contextos = new Map<string, ContextoDeOraciones>();

  constructor(leidos: readonly VocabularioLeido[]) {
    for (const leido of leidos) {
      if (leido.nombre === null) continue;
      const anterior = this.porNombre.get(leido.nombre);
      if (!anterior) {
        this.porNombre.set(leido.nombre, leido);
        continue;
      }
      leido.diagnosticos.agregar(
        'CUS-E018',
        leido.posicionDelNombre ?? { linea: 1, columna: 1 },
        `Ya hay un vocabulario «${leido.nombre}», en ${anterior.diagnosticos.archivo}: cambia el nombre de uno de los dos.`,
      );
    }
  }

  estado(nombre: string): 'valido' | 'con-errores' | 'no-existe' {
    const leido = this.porNombre.get(nombre);
    if (!leido) return 'no-existe';
    return tieneErrores(leido) ? 'con-errores' : 'valido';
  }

  contexto(nombres: readonly string[], callarDesconocidas: boolean): ContextoDeOraciones {
    const clave = `${callarDesconocidas ? '!' : ''}${nombres.join('\n')}`;
    let contexto = this.contextos.get(clave);
    if (!contexto) {
      const frases = new IndiceDePatrones<FraseConocida>();
      const otras = new IndiceDePatrones<FraseConocida>();
      for (const [nombre, leido] of this.porNombre) {
        const indice = nombres.includes(nombre) ? frases : otras;
        for (const frase of leido.frases) indice.agregar(frase);
      }
      contexto = { frases, otras, callarDesconocidas };
      this.contextos.set(clave, contexto);
    }
    return contexto;
  }

  /** Los AST de los vocabularios sin errores, por nombre: los que se pueden expandir. */
  validos(): Map<string, ArchivoDeVocabulario> {
    const validos = new Map<string, ArchivoDeVocabulario>();
    for (const [nombre, leido] of this.porNombre) {
      if (leido.ast && !tieneErrores(leido)) validos.set(nombre, leido.ast);
    }
    return validos;
  }
}
