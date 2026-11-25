/**
 * La etapa de semántica (especificación §13): lo que necesita seguir
 * referencias. Expande las frases y revisa los pasos ya expandidos (diseño de
 * la semana 4, §1), así que `${CLAVE_{rol}}` se revisa como `${CLAVE_secretaria}`.
 *
 * - En los vocabularios: ciclos (`CUS-E012`), `produce` que no coincide
 *   (`CUS-E011`), y variables escritas tal cual (`CUS-E011`, `CUS-E013`).
 * - En las historias: variables, capturas y secretos (`CUS-E011`, `CUS-E013`),
 *   nombres armados con parámetros (`CUS-E014`) y el flujo de cada escenario
 *   (`CUS-W002` a `CUS-W005`).
 */
import type { ArchivoDeVocabulario, FraseDeVocabulario, Historia, Paso } from './ast.ts';
import { declarado, type DeclaracionDeAmbiente } from './ambiente.ts';
import type { CodigoDeDiagnostico, Diagnosticos, Posicion } from './diagnosticos.ts';
import { expandir, origenDe, type Evento, type VocabulariosPorNombre } from './expansion.ts';
import { posicionDelPatron, posicionDelProduce, tokensDelPaso } from './rastros.ts';

/** Una variable `${…}`, que puede tener parámetros adentro: `${USUARIO_{rol}}`. */
const VARIABLE = /\$\{((?:[^{}]|\{\w+\})*)\}/g;

/** Revisa un vocabulario sin errores de sintaxis. */
export function revisarVocabulario(
  vocabulario: ArchivoDeVocabulario,
  ambiente: DeclaracionDeAmbiente | null,
  diagnosticos: Diagnosticos,
): void {
  const informar: Informar = (codigo, posicion, mensaje) => {
    diagnosticos.agregar(codigo, posicion, mensaje);
  };
  revisarCiclos(vocabulario, diagnosticos);
  for (const frase of vocabulario.frases) {
    revisarProduce(frase, diagnosticos);
    for (const paso of frase.pasos) {
      for (const { nombre, permitido } of variablesDe(paso)) {
        // Un nombre con parámetros se revisa al expandir, en cada historia que usa la frase.
        if (/\{\w+\}/.test(nombre)) continue;
        const posicion = posicionDelToken(paso, `\${${nombre}}`);
        revisarNombre(nombre, permitido, { ambiente, informar }, posicion, null);
      }
    }
  }
}

/** `CUS-E012`: una vez por ciclo, en el patrón de su primera frase. */
function revisarCiclos(vocabulario: ArchivoDeVocabulario, diagnosticos: Diagnosticos): void {
  const usa = new Map(
    vocabulario.frases.map((f) => [
      f.patron,
      f.pasos.flatMap((p) => (p.accion === 'frase' ? [p.objetivo.nombre] : [])),
    ]),
  );
  const informadas = new Set<string>();
  for (const frase of vocabulario.frases) {
    if (informadas.has(frase.patron)) continue;
    const camino = cicloDesde(frase.patron, usa);
    if (!camino) continue;
    for (const patron of camino) informadas.add(patron);
    diagnosticos.agregar(
      'CUS-E012',
      posicionDelPatron.get(frase) ?? frase.origen,
      `«${frase.patron}» termina usándose a sí misma: ${[...camino, frase.patron].map((p) => `«${p}»`).join(' → ')}.`,
    );
  }
}

/** El camino de frases que vuelve a `inicio`, si existe. */
function cicloDesde(inicio: string, usa: ReadonlyMap<string, readonly string[]>): string[] | null {
  const vistas = new Set<string>();
  const buscar = (actual: string, camino: string[]): string[] | null => {
    for (const siguiente of usa.get(actual) ?? []) {
      if (siguiente === inicio) return camino;
      if (vistas.has(siguiente)) continue;
      vistas.add(siguiente);
      const encontrado = buscar(siguiente, [...camino, siguiente]);
      if (encontrado) return encontrado;
    }
    return null;
  };
  return buscar(inicio, [inicio]);
}

/** `CUS-E011`: el `produce` de una frase con pasos tiene que coincidir con sus `capturar`. */
function revisarProduce(frase: FraseDeVocabulario, diagnosticos: Diagnosticos): void {
  if (frase.implementacion !== 'pasos') return;
  const capturas = frase.pasos.flatMap((p) => (p.accion === 'capturar' ? [p.valor.como] : []));
  const iguales =
    capturas.length === frase.produce.length && capturas.every((c) => frase.produce.includes(c));
  if (iguales) return;
  diagnosticos.agregar(
    'CUS-E011',
    posicionDelProduce.get(frase) ?? posicionDelPatron.get(frase) ?? frase.origen,
    `«${frase.patron}» declara \`produce: ${frase.produce.join(', ') || '—'}\`, pero sus pasos capturan ${capturas.join(', ') || 'nada'}.`,
  );
}

/** Revisa una historia sin errores de sintaxis. */
export function revisarHistoria(
  historia: Historia,
  vocabularios: VocabulariosPorNombre,
  ambiente: DeclaracionDeAmbiente | null,
  diagnosticos: Diagnosticos,
): void {
  const revisados = new Set<string>();
  const unaVez: Informar = (codigo, posicion, mensaje, sugerencia = null) => {
    const clave = `${codigo}@${String(posicion.linea)}:${String(posicion.columna)}`;
    if (revisados.has(clave)) return;
    revisados.add(clave);
    diagnosticos.agregar(codigo, posicion, mensaje, sugerencia);
  };
  const reporte: Reporte = { informar: unaVez, ambiente };
  // La primera frase sin pasos, en los antecedentes o los escenarios, y en la limpieza.
  const sinPasos: { antes?: SinPasos; limpieza?: SinPasos } = {};
  for (const escenario of historia.escenarios) {
    const capturas = new Set<string>();
    const recorrer = (pasos: readonly Paso[], enLimpieza: boolean): void => {
      for (const raiz of pasos) {
        for (const evento of expandir(raiz, vocabularios)) {
          if (evento.tipo === 'sin-pasos') {
            if (enLimpieza) sinPasos.limpieza ??= evento;
            else sinPasos.antes ??= evento;
          } else if (evento.tipo === 'produce') {
            for (const nombre of evento.nombres) capturas.add(nombre);
          } else {
            revisarPaso(evento, capturas, reporte);
            if (evento.paso.accion === 'capturar') capturas.add(evento.paso.valor.como);
          }
        }
      }
    };
    recorrer([...historia.antecedentes, ...escenario.pasos], false);
    recorrer(historia.limpieza, true);
    revisarFlujo(
      [...historia.antecedentes, ...escenario.pasos],
      escenario.origen,
      escenario.nombre,
      unaVez,
    );
  }

  if (sinPasos.antes) {
    const { frase, raiz } = sinPasos.antes;
    unaVez(
      'CUS-W004',
      raiz.origen,
      `«${frase.patron}» no tiene pasos (\`${frase.implementacion}\`): los escenarios que la usan quedan \`incompleto\`.`,
    );
  }
  if (sinPasos.limpieza) {
    const { frase, raiz } = sinPasos.limpieza;
    const efecto = ambiente?.desechable
      ? `en «${ambiente.ambiente}», que es desechable, los escenarios se ejecutan y la limpieza queda \`limpieza_pendiente\``
      : 'los escenarios no se ejecutan, porque el ambiente no es desechable';
    unaVez(
      'CUS-W005',
      raiz.origen,
      `La limpieza usa «${frase.patron}», que no tiene pasos: ${efecto}.`,
    );
  }
}

type Informar = (
  codigo: CodigoDeDiagnostico,
  posicion: Posicion,
  mensaje: string,
  sugerencia?: string | null,
) => void;

interface SinPasos {
  readonly frase: FraseDeVocabulario;
  readonly raiz: Paso;
}

interface Reporte {
  readonly informar: Informar;
  readonly ambiente: DeclaracionDeAmbiente | null;
}

/** Las variables de un paso expandido, con la posición de su causa en la historia. */
function revisarPaso(
  evento: Extract<Evento, { tipo: 'paso' }>,
  capturas: ReadonlySet<string>,
  reporte: Reporte,
): void {
  const plantillas = variablesDe(evento.plantilla);
  variablesDe(evento.paso).forEach(({ nombre, permitido }, i) => {
    const posicion = causa(evento, nombre, plantillas[i]?.texto ?? '');
    // Sin causa en la historia: la variable la escribió el vocabulario, y se revisa ahí.
    if (!posicion) return;
    revisarNombre(nombre, permitido, reporte, posicion, capturas);
  });
}

/**
 * Dónde informar una variable de un paso expandido: el token de la historia que
 * la contiene, o la cadena del argumento de donde salió.
 */
function causa(
  evento: Extract<Evento, { tipo: 'paso' }>,
  nombre: string,
  plantilla: string,
): Posicion | null {
  if (evento.via.length === 0) return posicionDelToken(evento.raiz, `\${${nombre}}`);
  if (plantilla.includes(`\${${nombre}}`)) return null;
  return origenDe(plantilla, evento.parametros);
}

/**
 * `CUS-E014`, `CUS-E011` y `CUS-E013` para una variable.
 * Con `capturas` en `null` no se revisan las capturas (en un vocabulario).
 */
function revisarNombre(
  nombre: string,
  permitido: boolean,
  { informar, ambiente }: Reporte,
  posicion: Posicion,
  capturas: ReadonlySet<string> | null,
): void {
  if (!/^\w+$/.test(nombre)) {
    informar(
      'CUS-E014',
      posicion,
      `\`\${${nombre}}\` no es un nombre de variable: solo letras, números y \`_\`.`,
    );
    return;
  }
  if (/^[a-z]/.test(nombre)) {
    if (capturas && !capturas.has(nombre)) {
      informar('CUS-E011', posicion, `\`\${${nombre}}\` se usa antes de capturarse.`);
    }
    return;
  }
  if (nombre === 'PREFIJO' || !ambiente) return;
  if (!declarado(nombre, [...ambiente.variables, ...ambiente.secretos])) {
    informar(
      'CUS-E011',
      posicion,
      `\`\${${nombre}}\` no está declarada en el ambiente «${ambiente.ambiente}».`,
    );
  } else if (!permitido && declarado(nombre, ambiente.secretos)) {
    informar(
      'CUS-E013',
      posicion,
      `El secreto \`\${${nombre}}\` no puede ir aquí: solo en el valor de \`completar\` o en el código generado.`,
    );
  }
}

/** Las variables de un paso, en orden, y si ahí puede ir un secreto (§9.2). */
function variablesDe(paso: Paso): { nombre: string; texto: string; permitido: boolean }[] {
  const resultado: { nombre: string; texto: string; permitido: boolean }[] = [];
  const recorrer = (valor: unknown, permitido: boolean): void => {
    if (typeof valor === 'string') {
      for (const [, nombre] of valor.matchAll(VARIABLE)) {
        resultado.push({ nombre: nombre ?? '', texto: valor, permitido });
      }
    } else if (Array.isArray(valor)) {
      for (const v of valor) recorrer(v, permitido);
    } else if (valor && typeof valor === 'object') {
      for (const v of Object.values(valor)) recorrer(v, permitido);
    }
  };
  recorrer(paso.objetivo, paso.accion === 'frase');
  recorrer(paso.ambito, false);
  if (paso.accion !== 'capturar') recorrer(paso.valor, paso.accion === 'completar');
  return resultado;
}

/** La posición del token del paso que contiene el texto; si no, la del paso. */
function posicionDelToken(paso: Paso, texto: string): Posicion {
  const token = tokensDelPaso.get(paso)?.find((t) => t.texto.includes(texto));
  return token ? { linea: paso.origen.linea, columna: token.columna } : paso.origen;
}

/** `CUS-W002` y `CUS-W003`: el flujo de un escenario, sobre sus pasos de la historia. */
function revisarFlujo(
  pasos: readonly Paso[],
  origen: Posicion,
  nombre: string,
  unaVez: Informar,
): void {
  let cambioSinAncla = false;
  let verifica = false;
  for (const paso of pasos) {
    if (paso.accion === 'navegar' || paso.accion === 'presionar' || paso.accion === 'frase') {
      cambioSinAncla = true;
    }
    if (paso.accion === 'ver' || paso.accion === 'esperar') cambioSinAncla = false;
    if (
      paso.accion === 'ver' ||
      paso.accion === 'noVer' ||
      (paso.accion === 'frase' && (paso.fase === 'entonces' || paso.fase === 'y'))
    ) {
      verifica = true;
    }
    if (paso.accion === 'noVer' && cambioSinAncla) {
      unaVez(
        'CUS-W003',
        paso.origen,
        '`no veo` justo después de cambiar la página pasa aunque la página no haya terminado de responder.',
        'Pon antes un `veo` o un `espero` de algo que confirme que la página ya cambió (§11.2).',
      );
    }
  }
  if (!verifica) unaVez('CUS-W002', origen, `El escenario «${nombre}» no verifica nada.`);
}
