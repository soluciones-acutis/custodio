/**
 * API pública del módulo `lenguaje`: el DSL, del texto al AST, la validación y
 * el plan de ejecución neutral. Son funciones puras, sin E/S (regla 6).
 *
 * Los demás módulos solo importan desde este archivo (regla 4): el modelo del
 * AST (v0.1), el validador, el catálogo de diagnósticos, el plan y el compilador.
 */
export * from './ast.ts';
export {
  analizar,
  type ArchivoFuente,
  type EntradaDelAnalizador,
  type ResultadoDeAnalisis,
} from './analizar.ts';
export { compilar, seleccionada, type Seleccion } from './compilar.ts';
export * from './plan.ts';
export { declarado, type DeclaracionDeAmbiente } from './ambiente.ts';
export {
  CATALOGO,
  type CodigoDeDiagnostico,
  type Diagnostico,
  type Etapa,
  type Severidad,
} from './diagnosticos.ts';
