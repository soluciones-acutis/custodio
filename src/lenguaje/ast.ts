/**
 * Tipos del AST del DSL v0.1: la estructura que produce el analizador a partir
 * de un `.historia.md` o un `.vocabulario.md` (docs/dsl/especificacion.md, §12).
 *
 * Es la misma forma que describe `docs/dsl/ast.schema.json`. Las constantes de
 * este archivo y los enums del Schema se verifican entre sí en
 * `test/lenguaje/ast.test.ts`, para que no se desincronicen.
 *
 * Solo tipos y constantes: sin E/S (regla 6 de la arquitectura).
 */

export const VERSION_AST = '0.1.0';

export const FASES = ['dado', 'cuando', 'entonces', 'y'] as const;
export type Fase = (typeof FASES)[number];

export const CRITICIDADES = ['alta', 'media', 'baja'] as const;
export type Criticidad = (typeof CRITICIDADES)[number];

export const ACCIONES = [
  'navegar',
  'completar',
  'seleccionar',
  'marcar',
  'desmarcar',
  'presionar',
  'esperar',
  'ver',
  'noVer',
  'capturar',
  'frase',
] as const;
export type Accion = (typeof ACCIONES)[number];

/**
 * Localizadores que encuentran un elemento por su nombre accesible, etiqueta o texto.
 * `fila` y `seccion` no están: en el markdown solo existen como ámbito (§8.3).
 */
export const LOCALIZADORES_POR_TEXTO = [
  'boton',
  'enlace',
  'campo',
  'casilla',
  'opcion',
  'titulo',
  'texto',
] as const;
export type LocalizadorPorTextoClave = (typeof LOCALIZADORES_POR_TEXTO)[number];

export const AMBITOS = ['fila', 'seccion', 'dialogo'] as const;

export const IMPLEMENTACIONES = ['pasos', 'pendiente', 'nativa'] as const;
export type Implementacion = (typeof IMPLEMENTACIONES)[number];

/** Posición en el archivo fuente, para los diagnósticos (DSL-12). */
export interface Origen {
  readonly linea: number;
  readonly columna: number;
}

// ── Localizadores ────────────────────────────────────────────────────────────

export interface LocalizadorPorTexto<
  P extends LocalizadorPorTextoClave = LocalizadorPorTextoClave,
> {
  readonly por: P;
  readonly texto: string;
  readonly exacto?: boolean;
}

/** Un cuadro de diálogo; sin texto es «el aviso de confirmación» que esté abierto. */
export interface LocalizadorDeDialogo {
  readonly por: 'dialogo';
  readonly texto: string | null;
  readonly exacto?: boolean;
}

export interface LocalizadorPorRol {
  readonly por: 'rol';
  readonly rol: string;
  readonly texto: string;
  readonly exacto?: boolean;
}

/** Escape: genera la advertencia CUS-W001. */
export interface LocalizadorPorIdDePrueba {
  readonly por: 'idDePrueba';
  readonly id: string;
}

/** Escape: genera la advertencia CUS-W001. */
export interface LocalizadorPorCss {
  readonly por: 'css';
  readonly selector: string;
}

export type Localizador =
  | LocalizadorPorTexto
  | LocalizadorDeDialogo
  | LocalizadorPorRol
  | LocalizadorPorIdDePrueba
  | LocalizadorPorCss;

export type LocalizadorDeCampo = LocalizadorPorTexto<'campo'> | LocalizadorPorRol;
export type LocalizadorDeCasilla = LocalizadorPorTexto<'casilla' | 'opcion'> | LocalizadorPorRol;

// ── Objetivos que no son localizadores ───────────────────────────────────────

/** Con `ver` o `noVer` significa «la URL actual contiene». */
export interface ObjetivoUrl {
  readonly por: 'url';
  readonly url: string;
}

export interface ObjetivoMenu {
  readonly por: 'menu';
  readonly ruta: readonly [string, ...string[]];
}

export interface ObjetivoFrase {
  readonly por: 'frase';
  readonly vocabulario: string;
  /** El patrón de la frase tal como está en el vocabulario. */
  readonly nombre: string;
  readonly argumentos: Readonly<Record<string, string>>;
}

export type Objetivo = Localizador | ObjetivoUrl | ObjetivoMenu | ObjetivoFrase;

// ── Ámbito ───────────────────────────────────────────────────────────────────

/** Dónde buscar el objetivo. Se anida: `ambito.ambito` contiene a `ambito`. */
export type Ambito =
  | { readonly por: 'fila' | 'seccion'; readonly texto: string; readonly ambito: Ambito | null }
  | { readonly por: 'dialogo'; readonly texto: string | null; readonly ambito: Ambito | null };

// ── Valores ──────────────────────────────────────────────────────────────────

export interface ValorTexto {
  readonly tipo: 'texto';
  readonly texto: string;
}

/** El código de segundo factor, calculado al ejecutar (DSL-09). */
export interface ValorTotp {
  readonly tipo: 'totp';
  readonly secreto: string;
}

/**
 * La fecha del día, tomada del puerto Reloj. Con `formato: null`, el adaptador
 * usa el formato que pide el campo (especificación, §6.3).
 */
export interface ValorFecha {
  readonly tipo: 'fecha';
  readonly fecha: 'hoy';
  readonly formato: string | null;
}

/** Un valor que la aplicación exige único, como el número de una partida. */
export interface ValorUnico {
  readonly tipo: 'unico';
  readonly unico: 'numero';
}

/** Dónde guarda `capturar` el valor leído. */
export interface ValorCaptura {
  readonly tipo: 'captura';
  readonly como: string;
}

export type Valor = ValorTexto | ValorTotp | ValorFecha | ValorUnico | ValorCaptura;

// ── Pasos ────────────────────────────────────────────────────────────────────

interface PasoBase<A extends Accion, O extends Objetivo, V extends Valor | null> {
  readonly fase: Fase | null;
  readonly accion: A;
  readonly objetivo: O;
  readonly ambito: Ambito | null;
  readonly valor: V;
  readonly origen: Origen;
}

/**
 * Un paso normalizado: siempre las mismas claves. Cada acción acepta solo
 * ciertos objetivos y valores (especificación, §7), y la unión lo refleja.
 */
export type Paso =
  | PasoBase<'navegar', ObjetivoUrl | ObjetivoMenu, null>
  | PasoBase<'completar', LocalizadorDeCampo, ValorTexto | ValorTotp | ValorFecha | ValorUnico>
  | PasoBase<'seleccionar', LocalizadorDeCampo, ValorTexto>
  | PasoBase<'marcar' | 'desmarcar', LocalizadorDeCasilla, null>
  | PasoBase<'presionar', Localizador, null>
  | PasoBase<'esperar' | 'ver' | 'noVer', Localizador | ObjetivoUrl, null>
  | PasoBase<'capturar', Localizador, ValorCaptura>
  | (PasoBase<'frase', ObjetivoFrase, null> & { readonly ambito: null });

export type PasoDeEscenario = Paso & { readonly fase: Fase };
export type PasoSinFase = Paso & { readonly fase: null };

// ── Historias ────────────────────────────────────────────────────────────────

export interface Narrativa {
  readonly como: string;
  readonly quiero: string;
  readonly para: string;
  readonly origen: Origen;
}

export interface Escenario {
  readonly nombre: string;
  readonly pasos: readonly [PasoDeEscenario, ...PasoDeEscenario[]];
  readonly origen: Origen;
}

export interface Historia {
  readonly dsl: string;
  readonly id: string;
  readonly producto: string;
  readonly titulo: string;
  readonly actor: string;
  readonly criticidad: Criticidad;
  readonly etiquetas: readonly string[];
  readonly vocabularios: readonly string[];
  readonly narrativa: Narrativa;
  readonly antecedentes: readonly PasoSinFase[];
  readonly escenarios: readonly [Escenario, ...Escenario[]];
  readonly limpieza: readonly PasoSinFase[];
  readonly origen: Origen;
}

export interface ArchivoDeHistorias {
  readonly ast: typeof VERSION_AST;
  readonly archivo: string;
  readonly historias: readonly [Historia, ...Historia[]];
}

// ── Vocabularios ─────────────────────────────────────────────────────────────

export interface FraseDeVocabulario {
  readonly patron: string;
  readonly parametros: readonly string[];
  /** Capturas que deja disponibles la frase (pueden usar sus parámetros). */
  readonly produce: readonly string[];
  readonly implementacion: Implementacion;
  /** Por qué la frase es `pendiente` o `nativa`. */
  readonly motivo: string | null;
  readonly pasos: readonly PasoSinFase[];
  readonly origen: Origen;
}

export interface ArchivoDeVocabulario {
  readonly ast: typeof VERSION_AST;
  readonly archivo: string;
  readonly vocabulario: string;
  readonly dsl: string;
  readonly producto: string;
  readonly frases: readonly FraseDeVocabulario[];
}
