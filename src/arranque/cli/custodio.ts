#!/usr/bin/env node
/**
 * Punto de entrada de la CLI `custodio`: arma la E/S real y elige el comando.
 *
 * Node 24 lo ejecuta sin compilar, quitando los tipos (ADR-003). Por eso no hay
 * sintaxis que Node no sepa quitar (`erasableSyntaxOnly` en tsconfig.json).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import {
  USO_DE_VALIDAR,
  validar,
  SALIDA,
  type Consola,
  type SistemaDeArchivos,
} from './validar.ts';

const USO = `Uso: custodio <comando>

Comandos:
  validar   Valida historias y vocabularios.

${USO_DE_VALIDAR}`;

const sistema: SistemaDeArchivos = {
  tipo(ruta) {
    const estado = statSync(ruta, { throwIfNoEntry: false });
    if (!estado) return null;
    return estado.isDirectory() ? 'carpeta' : 'archivo';
  },
  listar: (carpeta) => readdirSync(carpeta),
  leer: (ruta) => readFileSync(ruta, 'utf8'),
};

const consola: Consola = {
  escribir: (texto) => process.stdout.write(texto),
  error: (texto) => process.stderr.write(`${texto}\n`),
  colores: process.stdout.isTTY && process.env['NO_COLOR'] === undefined,
};

const [comando, ...argumentos] = process.argv.slice(2);
if (comando === 'validar') {
  process.exitCode = validar(argumentos, sistema, consola);
} else if (comando === 'ayuda' || comando === '--help' || comando === '-h') {
  consola.escribir(`${USO}\n`);
} else {
  consola.error(comando === undefined ? USO : `Comando desconocido: «${comando}».\n\n${USO}`);
  process.exitCode = SALIDA.usoInvalido;
}
