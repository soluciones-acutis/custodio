/**
 * El analizador contra lo que dejó la semana 2 (diseño de la semana 3, §9):
 * - las 12 historias se analizan sin diagnósticos;
 * - su AST es igual a los ejemplos de docs/dsl/ejemplos/ y cumple el Schema;
 * - nunca lanza una excepción, por raro que sea el archivo;
 * - analiza 100 historias en menos de 2 segundos (RNF-05).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { analizar, type ArchivoFuente } from '../../src/lenguaje/index.ts';

const RAIZ = join(import.meta.dirname, '..', '..');
const EJEMPLOS = join(RAIZ, 'docs', 'dsl', 'ejemplos');
const leer = (ruta: string): ArchivoFuente => ({
  ruta,
  texto: readFileSync(join(RAIZ, ruta), 'utf8'),
});
const leerJson = (ruta: string): unknown => JSON.parse(readFileSync(ruta, 'utf8'));

const vocabulario = leer('vocabularios/acutis-suite.vocabulario.md');
const historias = readdirSync(join(RAIZ, 'historias'))
  .filter((n) => n.endsWith('.historia.md'))
  .map((n) => leer(`historias/${n}`));
const resultado = analizar({ historias, vocabularios: [vocabulario] });

const ajv = new Ajv2020({ allErrors: true, strictTypes: true });
const validar = ajv.compile(leerJson(join(RAIZ, 'docs', 'dsl', 'ast.schema.json')) as object);

describe('las 12 historias del inventario', () => {
  it('se analizan sin diagnósticos', () => {
    expect(resultado.diagnosticos).toEqual([]);
    expect(resultado.historias).toHaveLength(historias.length);
  });

  it.each(resultado.historias.map((a) => [a.archivo, a] as const))(
    'el AST de %s cumple el Schema',
    (_, ast) => {
      expect(validar(ast), ajv.errorsText(validar.errors)).toBe(true);
    },
  );

  it('el AST del vocabulario cumple el Schema', () => {
    expect(validar(resultado.vocabularios[0]), ajv.errorsText(validar.errors)).toBe(true);
  });
});

describe('los ejemplos del AST son la salida esperada', () => {
  const ejemplos = readdirSync(EJEMPLOS).filter((n) => n.startsWith('HU-'));

  it.each(ejemplos)('%s', (nombre) => {
    const archivo = `historias/${nombre.replace('.ast.json', '.historia.md')}`;
    const obtenido = resultado.historias.find((a) => a.archivo === archivo);
    expect(obtenido).toEqual(leerJson(join(EJEMPLOS, nombre)));
  });

  it('acutis-suite.vocabulario.ast.json', () => {
    expect(resultado.vocabularios[0]).toEqual(
      leerJson(join(EJEMPLOS, 'acutis-suite.vocabulario.ast.json')),
    );
  });
});

describe('robustez', () => {
  /** Generador pseudoaleatorio con semilla fija (mulberry32), para que la prueba sea reproducible. */
  function azar(semilla: number): () => number {
    let s = semilla;
    return () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** La historia con líneas borradas, duplicadas, recortadas o con caracteres sueltos. */
  function mutar(texto: string, siguiente: () => number): string {
    const lineas = texto.split('\n');
    const indice = (): number => Math.floor(siguiente() * lineas.length);
    for (let n = 0; n < 4; n++) {
      const i = indice();
      const linea = lineas[i] ?? '';
      const corte = Math.floor(siguiente() * (linea.length + 1));
      const accion = Math.floor(siguiente() * 4);
      if (accion === 0) lineas.splice(i, 1);
      else if (accion === 1) lineas.splice(i, 0, linea);
      else if (accion === 2) lineas[i] = linea.slice(0, corte);
      else
        lineas[i] =
          `${linea.slice(0, corte)}${'"`#-*>{}$'[Math.floor(siguiente() * 9)] ?? ''}${linea.slice(corte)}`;
    }
    return lineas.join('\n');
  }

  it('nunca lanza una excepción: siempre devuelve diagnósticos', () => {
    const siguiente = azar(20261111);
    for (let vuelta = 0; vuelta < 300; vuelta++) {
      const original = historias[vuelta % historias.length];
      if (!original) continue;
      const mutada = { ruta: original.ruta, texto: mutar(original.texto, siguiente) };
      const vocabularioMutado =
        vuelta % 10 === 0
          ? { ...vocabulario, texto: mutar(vocabulario.texto, siguiente) }
          : vocabulario;
      expect(() =>
        analizar({ historias: [mutada], vocabularios: [vocabularioMutado] }),
      ).not.toThrow();
    }
  });
});

describe('rendimiento (RNF-05)', () => {
  it('analiza 100 historias en menos de 2 segundos', () => {
    const cien = Array.from({ length: 100 }, (_, i) => {
      const original = historias[i % historias.length] ?? { ruta: '', texto: '' };
      return {
        ruta: `${String(i)}-${original.ruta}`,
        texto: original.texto.replace(/^id: (HU-SUITE)-\d{3}$/m, `id: $1-${String(100 + i)}`),
      };
    });
    const inicio = performance.now();
    const { diagnosticos } = analizar({ historias: cien, vocabularios: [vocabulario] });
    expect(performance.now() - inicio).toBeLessThan(2000);
    expect(diagnosticos).toEqual([]);
  });
});
