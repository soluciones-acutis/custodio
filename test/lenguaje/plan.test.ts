/**
 * El plan de ejecución (diseño de la semana 4, §2): el compilador produce
 * planes que cumplen su JSON Schema, con el estado de cada escenario, el origen
 * de cada instrucción y las variables sin resolver. Los tipos de
 * src/lenguaje/plan.ts no se desincronizan del Schema.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import {
  ACCIONES,
  analizar,
  compilar,
  ESTADOS_DE_COMPILACION,
  VERSION_PLAN,
  type ArchivoFuente,
  type Plan,
} from '../../src/lenguaje/index.ts';

const RAIZ = join(import.meta.dirname, '..', '..');
const DSL = join(RAIZ, 'docs', 'dsl');
const leer = (ruta: string): ArchivoFuente => ({
  ruta,
  texto: readFileSync(join(RAIZ, ruta), 'utf8'),
});
const leerJson = (ruta: string): unknown => JSON.parse(readFileSync(ruta, 'utf8'));

const historias = readdirSync(join(RAIZ, 'historias'))
  .filter((n) => n.endsWith('.historia.md'))
  .map((n) => leer(`historias/${n}`));
const vocabulario = leer('vocabularios/acutis-suite.vocabulario.md');
const ambiente = leer('ambientes/suite-pruebas.ambiente.md');
const resultado = analizar({ historias, vocabularios: [vocabulario], ambiente });
const planes = compilar(resultado);
const plan = (id: string): Plan => {
  const encontrado = planes.find((p) => p.historia.id === id);
  if (!encontrado) throw new Error(`no hay plan para ${id}`);
  return encontrado;
};

interface Esquema {
  readonly $defs: Readonly<
    Record<string, { readonly enum?: readonly string[]; readonly const?: string }>
  >;
}
const esquema = leerJson(join(DSL, 'plan.schema.json')) as Esquema;
const ajv = new Ajv2020({ allErrors: true, strictTypes: true });
ajv.addSchema(leerJson(join(DSL, 'ast.schema.json')) as object);
const validar = ajv.compile(esquema);

describe('el plan cumple su Schema', () => {
  it('hay un plan por historia', () => {
    expect(planes.map((p) => p.historia.id)).toEqual(
      resultado.historias.flatMap((a) => a.historias.map((h) => h.id)),
    );
  });

  it.each(planes.map((p) => [p.historia.id, p] as const))('%s', (_, p) => {
    expect(validar(p), ajv.errorsText(validar.errors)).toBe(true);
  });

  it.each(readdirSync(join(DSL, 'ejemplos')).filter((n) => n.endsWith('.plan.json')))(
    'el ejemplo %s cumple el Schema y es la salida del compilador',
    (nombre) => {
      const ejemplo = leerJson(join(DSL, 'ejemplos', nombre)) as Plan;
      expect(validar(ejemplo), ajv.errorsText(validar.errors)).toBe(true);
      expect(plan(ejemplo.historia.id)).toEqual(ejemplo);
    },
  );

  it.each([
    {
      constante: 'VERSION_PLAN',
      valores: [VERSION_PLAN],
      enSchema: [esquema.$defs['VersionPlan']?.const],
    },
    {
      constante: 'ESTADOS_DE_COMPILACION',
      valores: ESTADOS_DE_COMPILACION,
      enSchema: esquema.$defs['EstadoDeCompilacion']?.enum,
    },
    {
      constante: 'las acciones del AST sin `frase`',
      valores: ACCIONES.filter((a) => a !== 'frase'),
      enSchema: esquema.$defs['AccionDelPlan']?.enum,
    },
  ])('$constante coincide con el Schema', ({ valores, enSchema }) => {
    expect(enSchema).toEqual(valores);
  });
});

describe('el estado de cada escenario (especificación §10.3 y §11.3)', () => {
  it('ejecutable: todas sus frases tienen pasos', () => {
    expect(plan('HU-SUITE-001').escenarios.map((e) => e.estado)).toEqual(
      Array(4).fill('ejecutable'),
    );
  });

  it('limpieza_pendiente: la limpieza no tiene pasos y el ambiente es desechable', () => {
    const [escenario] = plan('HU-SUITE-003').escenarios;
    expect(escenario).toMatchObject({
      estado: 'limpieza_pendiente',
      motivo: 'elimino todo lo creado con prefijo "{prefijo}"',
      limpieza: [],
    });
    expect(escenario?.instrucciones.length).toBeGreaterThan(0);
  });

  it('incompleto: la limpieza no tiene pasos y el ambiente no es desechable', () => {
    const noDesechable = {
      ...ambiente,
      texto: ambiente.texto.replace('desechable: sí', 'desechable: no'),
    };
    const [p] = compilar(
      analizar({ historias, vocabularios: [vocabulario], ambiente: noDesechable }),
      {
        ids: ['HU-SUITE-003'],
      },
    );
    expect(p?.escenarios.map((e) => e.estado)).toEqual(Array(3).fill('incompleto'));
  });

  it('incompleto: un escenario usa una frase sin pasos, y no tiene instrucciones', () => {
    const escenario = plan('HU-SUITE-004').escenarios[1];
    expect(escenario).toMatchObject({ estado: 'incompleto', instrucciones: [], limpieza: [] });
    expect(escenario?.motivo).toContain('el libro de caja muestra');
  });
});

describe('las instrucciones', () => {
  const instrucciones = plan('HU-SUITE-001').escenarios.flatMap((e) => e.instrucciones);

  it('son acciones base: ninguna frase llega al plan', () => {
    expect(instrucciones.every((i) => (ACCIONES as readonly string[]).includes(i.accion))).toBe(
      true,
    );
    expect(instrucciones.some((i) => (i.accion as string) === 'frase')).toBe(false);
  });

  it('las variables siguen como ${…}: el plan nunca tiene el valor de un secreto', () => {
    const texto = JSON.stringify(plan('HU-SUITE-001'));
    expect(texto).toContain('${CLAVE_secretaria}');
    expect(texto).toContain('${TOTP_secretaria}');
  });

  it('el origen dice el paso de la historia y cada frase por la que pasó', () => {
    const totp = instrucciones.find((i) => i.valor?.tipo === 'totp');
    expect(totp?.origen).toEqual({
      archivo: 'historias/HU-SUITE-001.historia.md',
      linea: 27,
      columna: 3,
      via: [
        {
          vocabulario: 'acutis-suite',
          frase: 'ingreso el código de segundo factor generado con el secreto "{secreto}"',
          archivo: 'vocabularios/acutis-suite.vocabulario.md',
          linea: 32,
          columna: 3,
        },
      ],
    });
  });

  it('una frase dentro de otra deja las dos en la vía, de afuera hacia adentro', () => {
    const anidada = plan('HU-SUITE-004')
      .escenarios.flatMap((e) => e.instrucciones)
      .find((i) => i.origen.via.length === 2);
    expect(anidada?.origen.via.map((v) => v.frase)).toEqual([
      'la secretaría ve la petición de misa de "{nombre}"',
      'inicio sesión como "{rol}" en la parroquia "{parroquia}"',
    ]);
  });
});

describe('la selección (DSL-15)', () => {
  const ids = (seleccion: Parameters<typeof compilar>[1]): string[] =>
    compilar(resultado, seleccion).map((p) => p.historia.id);

  it('sin criterios, todas las historias', () => {
    expect(ids({})).toHaveLength(historias.length);
  });

  it.each([
    [{ ids: ['HU-SUITE-003', 'HU-SUITE-005'] }, ['HU-SUITE-003', 'HU-SUITE-005']],
    [{ etiquetas: ['segundo-factor'] }, ['HU-SUITE-001']],
    [{ criticidades: ['alta'], etiquetas: ['equipo'] }, ['HU-SUITE-003']],
    [{ productos: ['otro'] }, []],
  ])('%j', (seleccion, esperados) => {
    expect(ids(seleccion)).toEqual(esperados);
  });
});
