/**
 * El AST v0.1: los ejemplos de docs/dsl/ejemplos/ cumplen el JSON Schema, el
 * Schema rechaza lo que la especificación prohíbe, y los tipos de
 * src/lenguaje/ast.ts no se desincronizan del Schema.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import {
  ACCIONES,
  AMBITOS,
  CRITICIDADES,
  FASES,
  IMPLEMENTACIONES,
  LOCALIZADORES_POR_TEXTO,
  VERSION_AST,
  type ArchivoDeHistorias,
  type Historia,
  type PasoDeEscenario,
} from '../../src/lenguaje/index.ts';

const DSL = join(import.meta.dirname, '..', '..', 'docs', 'dsl');
const EJEMPLOS = join(DSL, 'ejemplos');

interface Definicion {
  readonly enum?: readonly string[];
  readonly const?: string;
  readonly properties?: Readonly<Record<string, Definicion>>;
}
interface Esquema {
  readonly $defs: Readonly<Record<string, Definicion>>;
}

const leerJson = (ruta: string): unknown => JSON.parse(readFileSync(ruta, 'utf8'));
const esquema = leerJson(join(DSL, 'ast.schema.json')) as Esquema;

// strictTypes: true convierte en error lo que ajv solo advertiría (tipos implícitos en el
// Schema), para que el Schema se mantenga explícito.
const ajv = new Ajv2020({ allErrors: true, strictTypes: true });
const validar = ajv.compile(esquema);
const errores = (): string => ajv.errorsText(validar.errors);

// Un AST mínimo y válido, escrito con los tipos de TypeScript.
const origen = { linea: 1, columna: 1 };
const pasoValido = {
  fase: 'cuando',
  accion: 'presionar',
  objetivo: { por: 'boton', texto: 'Entrar' },
  ambito: null,
  valor: null,
  origen,
} satisfies PasoDeEscenario;

const historiaMinima = {
  dsl: '0.1.0',
  id: 'HU-SUITE-999',
  producto: 'suite-parroquial',
  titulo: 'Historia mínima',
  actor: 'Secretaria',
  criticidad: 'alta',
  etiquetas: [],
  vocabularios: [],
  narrativa: { como: 'secretaria', quiero: 'entrar', para: 'trabajar', origen },
  antecedentes: [],
  escenarios: [{ nombre: 'entrar', pasos: [pasoValido], origen }],
  limpieza: [],
  origen,
} satisfies Historia;

const minimo = {
  ast: VERSION_AST,
  archivo: 'docs/historias/HU-SUITE-999.historia.md',
  historias: [historiaMinima],
} satisfies ArchivoDeHistorias;

/** El AST mínimo con otros pasos en su escenario, o con otros datos en la historia. */
function archivo(pasos: readonly unknown[], cambios: Readonly<Record<string, unknown>> = {}) {
  const escenario = { ...historiaMinima.escenarios[0], pasos };
  return { ...minimo, historias: [{ ...historiaMinima, escenarios: [escenario], ...cambios }] };
}

describe('AST v0.1 (docs/dsl/ast.schema.json)', () => {
  const ejemplos = readdirSync(EJEMPLOS).filter((nombre) => nombre.endsWith('.ast.json'));

  it('hay ejemplos de historias y del vocabulario', () => {
    expect(ejemplos.filter((n) => n.startsWith('HU-')).length).toBeGreaterThanOrEqual(5);
    expect(ejemplos).toContain('acutis-suite.vocabulario.ast.json');
  });

  it.each(ejemplos)('el ejemplo %s cumple el Schema', (nombre) => {
    expect(validar(leerJson(join(EJEMPLOS, nombre))), errores()).toBe(true);
  });

  it('un AST mínimo escrito con los tipos de TypeScript cumple el Schema', () => {
    expect(validar(minimo), errores()).toBe(true);
  });

  it.each([
    {
      descripcion: 'presionar en el aviso de confirmación (diálogo sin título)',
      paso: { ...pasoValido, ambito: { por: 'dialogo', texto: null, ambito: null } },
    },
    {
      descripcion: 'un ámbito anidado: fila dentro de una sección',
      paso: {
        ...pasoValido,
        ambito: {
          por: 'fila',
          texto: 'x',
          ambito: { por: 'seccion', texto: 'Invitaciones', ambito: null },
        },
      },
    },
    {
      descripcion: 'ver que la URL contiene un texto',
      paso: { ...pasoValido, accion: 'ver', objetivo: { por: 'url', url: '/admin' } },
    },
  ])('acepta $descripcion', ({ paso }) => {
    expect(validar(archivo([paso])), errores()).toBe(true);
  });

  it.each([
    { descripcion: 'una acción que no existe', paso: { ...pasoValido, accion: 'presiona' } },
    {
      descripcion: 'completar un botón',
      paso: {
        ...pasoValido,
        accion: 'completar',
        objetivo: { por: 'boton', texto: 'Entrar' },
        valor: { tipo: 'texto', texto: 'x' },
      },
    },
    {
      descripcion: 'completar sin valor',
      paso: { ...pasoValido, accion: 'completar', objetivo: { por: 'campo', texto: 'Correo' } },
    },
    {
      descripcion: 'ver un menú',
      paso: { ...pasoValido, accion: 'ver', objetivo: { por: 'menu', ruta: ['Mi parroquia'] } },
    },
    {
      descripcion: 'una frase con ámbito',
      paso: {
        ...pasoValido,
        accion: 'frase',
        objetivo: { por: 'frase', vocabulario: 'acutis-suite', nombre: 'x', argumentos: {} },
        ambito: { por: 'fila', texto: 'x', ambito: null },
      },
    },
    { descripcion: 'un paso de escenario sin fase', paso: { ...pasoValido, fase: null } },
    {
      descripcion: 'un localizador CSS sin selector',
      paso: { ...pasoValido, objetivo: { por: 'css' } },
    },
  ])('rechaza $descripcion', ({ paso }) => {
    expect(validar(archivo([paso]))).toBe(false);
  });

  it.each([
    { descripcion: 'la versión v1.0', cambios: { dsl: 'v1.0' } },
    { descripcion: 'un id mal formado', cambios: { id: 'HU-001' } },
    { descripcion: 'una criticidad desconocida', cambios: { criticidad: 'urgente' } },
  ])('rechaza una historia con $descripcion', ({ cambios }) => {
    expect(validar(archivo([pasoValido], cambios))).toBe(false);
  });

  it('rechaza una frase pendiente que tiene pasos', () => {
    const vocabulario = leerJson(join(EJEMPLOS, 'acutis-suite.vocabulario.ast.json')) as {
      frases: { implementacion: string; pasos: unknown[] }[];
    };
    const conPasos = vocabulario.frases.find((f) => f.implementacion === 'pasos');
    const pendiente = vocabulario.frases.find((f) => f.implementacion === 'pendiente');
    if (!conPasos || !pendiente) throw new Error('el ejemplo necesita una frase de cada tipo');
    pendiente.pasos = conPasos.pasos;
    expect(validar(vocabulario)).toBe(false);
  });
});

describe('los tipos de src/lenguaje/ast.ts coinciden con el Schema', () => {
  const definicion = (nombre: string): Definicion => {
    const def = esquema.$defs[nombre];
    if (!def) throw new Error(`el Schema no define ${nombre}`);
    return def;
  };
  const enumDe = (nombre: string, propiedad?: string): readonly string[] | undefined =>
    propiedad ? definicion(nombre).properties?.[propiedad]?.enum : definicion(nombre).enum;

  it.each([
    { constante: 'FASES', valores: FASES, enSchema: enumDe('Fase') },
    { constante: 'ACCIONES', valores: ACCIONES, enSchema: enumDe('Accion') },
    {
      constante: 'CRITICIDADES',
      valores: CRITICIDADES,
      enSchema: enumDe('Historia', 'criticidad'),
    },
    {
      constante: 'LOCALIZADORES_POR_TEXTO',
      valores: LOCALIZADORES_POR_TEXTO,
      enSchema: enumDe('LocalizadorPorTexto', 'por'),
    },
    { constante: 'AMBITOS', valores: AMBITOS, enSchema: enumDe('Ambito', 'por') },
    {
      constante: 'IMPLEMENTACIONES',
      valores: IMPLEMENTACIONES,
      enSchema: enumDe('FraseDeVocabulario', 'implementacion'),
    },
  ])('$constante', ({ valores, enSchema }) => {
    expect(enSchema).toEqual(valores);
  });

  it('VERSION_AST', () => {
    expect(definicion('VersionAst').const).toBe(VERSION_AST);
  });
});
