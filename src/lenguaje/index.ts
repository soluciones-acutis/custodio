/**
 * API pública del módulo `lenguaje`: el DSL, del texto al AST, la validación y
 * el plan de ejecución neutral. Son funciones puras, sin E/S (regla 6).
 *
 * Los demás módulos solo importan desde este archivo (regla 4). Por ahora
 * expone el modelo del AST (v0.1).
 */
export * from './ast.ts';
