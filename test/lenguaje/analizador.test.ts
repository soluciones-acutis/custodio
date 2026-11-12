/**
 * El analizador por partes (diseño de la semana 3, §9): cada regla de la
 * gramática tiene al menos un caso que la acepta y uno que la rechaza.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analizar, type Diagnostico, type Paso } from '../../src/lenguaje/index.ts';

const RAIZ = join(import.meta.dirname, '..', '..');
const VOCABULARIO = {
  ruta: 'vocabularios/acutis-suite.vocabulario.md',
  texto: readFileSync(join(RAIZ, 'vocabularios', 'acutis-suite.vocabulario.md'), 'utf8'),
};

/** El frontmatter de una historia mínima, con `cambios` reemplazando o quitando campos. */
function frontmatter(cambios: Readonly<Record<string, string | null>> = {}): string {
  const campos: Record<string, string | null> = {
    dsl: '0.1.0',
    id: 'HU-PRUEBA-001',
    producto: 'suite-parroquial',
    titulo: 'Una prueba',
    actor: 'Secretaria',
    criticidad: 'media',
    vocabularios: '[acutis-suite]',
    ...cambios,
  };
  const lineas = Object.entries(campos).flatMap(([clave, valor]) =>
    valor === null ? [] : [clave === '_' ? valor : `${clave}: ${valor}`],
  );
  return `---\n${lineas.join('\n')}\n---\n`;
}

const NARRATIVA = '## Historia\n**Como** secretaria\n\n**Quiero** probar\n\n**Para** comprobar\n';

/** Una historia mínima: frontmatter, narrativa y un escenario con `pasos` (desde la línea 19). */
const historia = (pasos: string, cuerpo = ''): string =>
  `${frontmatter()}\n${NARRATIVA}\n## Escenario: prueba\n${pasos}\n${cuerpo}`;

function analizarTexto(texto: string, vocabularios = [VOCABULARIO]) {
  return analizar({ historias: [{ ruta: 'h.historia.md', texto }], vocabularios });
}

const codigos = (diagnosticos: readonly Diagnostico[]): string[] =>
  diagnosticos.map((d) => `${d.codigo}@${String(d.linea)}:${String(d.columna)}`);

/** El primer paso del escenario de una historia mínima, o sus diagnósticos. */
function paso(frase: string): { paso: Paso | undefined; diagnosticos: string[] } {
  const resultado = analizarTexto(historia(`- CUANDO ${frase}`));
  return {
    paso: resultado.historias[0]?.historias[0]?.escenarios[0]?.pasos[0],
    diagnosticos: codigos(resultado.diagnosticos),
  };
}

describe('frases base (especificación §6)', () => {
  it.each([
    [
      'navego a `https://x.test/admin`',
      { accion: 'navegar', objetivo: { por: 'url', url: 'https://x.test/admin' } },
    ],
    [
      'navego a "Mi parroquia > El equipo"',
      { accion: 'navegar', objetivo: { por: 'menu', ruta: ['Mi parroquia', 'El equipo'] } },
    ],
    [
      'completo el campo "Correo" con "a@b.test"',
      {
        accion: 'completar',
        objetivo: { por: 'campo', texto: 'Correo' },
        valor: { tipo: 'texto', texto: 'a@b.test' },
      },
    ],
    [
      'completo exactamente el campo "Nombre" con "x"',
      { objetivo: { por: 'campo', texto: 'Nombre', exacto: true } },
    ],
    [
      'completo el campo "Código" con el código generado con el secreto "${TOTP_x}"',
      { valor: { tipo: 'totp', secreto: '${TOTP_x}' } },
    ],
    [
      'completo el campo "Fecha" con la fecha de hoy',
      { valor: { tipo: 'fecha', fecha: 'hoy', formato: null } },
    ],
    [
      'completo el campo "Fecha" con la fecha de hoy en formato "AAAA-MM-DD"',
      { valor: { tipo: 'fecha', fecha: 'hoy', formato: 'AAAA-MM-DD' } },
    ],
    [
      'completo el campo "Número" con un número único',
      { valor: { tipo: 'unico', unico: 'numero' } },
    ],
    [
      'completo el elemento con rol "textbox" y nombre "Buscar" con "x"',
      { objetivo: { por: 'rol', rol: 'textbox', texto: 'Buscar' } },
    ],
    [
      'selecciono "Catequista" en el campo "Rol"',
      { accion: 'seleccionar', valor: { tipo: 'texto', texto: 'Catequista' } },
    ],
    [
      'marco la casilla "Acepto"',
      { accion: 'marcar', objetivo: { por: 'casilla', texto: 'Acepto' } },
    ],
    [
      'desmarco exactamente la opción "Sí"',
      { accion: 'desmarcar', objetivo: { por: 'opcion', texto: 'Sí', exacto: true } },
    ],
    [
      'presiono el enlace "Ver la partida"',
      { accion: 'presionar', objetivo: { por: 'enlace', texto: 'Ver la partida' } },
    ],
    ['presiono el título "Inicio"', { objetivo: { por: 'titulo', texto: 'Inicio' } }],
    [
      'espero el mensaje "Listo"',
      { accion: 'esperar', objetivo: { por: 'texto', texto: 'Listo' } },
    ],
    ['veo el botón "Guardar"', { accion: 'ver', objetivo: { por: 'boton', texto: 'Guardar' } }],
    [
      'no veo el campo "Contraseña"',
      { accion: 'noVer', objetivo: { por: 'campo', texto: 'Contraseña' } },
    ],
    [
      'veo que la dirección contiene "/admin"',
      { accion: 'ver', objetivo: { por: 'url', url: '/admin' } },
    ],
    [
      'espero que la dirección contiene "/fin"',
      { accion: 'esperar', objetivo: { por: 'url', url: '/fin' } },
    ],
    [
      'capturo el valor del campo "Link" como "link"',
      { accion: 'capturar', valor: { tipo: 'captura', como: 'link' } },
    ],
    [
      'veo el texto "Pulsa \\"Guardar\\" y \\\\ listo"',
      { objetivo: { por: 'texto', texto: 'Pulsa "Guardar" y \\ listo' } },
    ],
    ['Presiono el botón "Entrar"', { accion: 'presionar' }],
  ])('%s', (frase, esperado) => {
    const resultado = paso(frase);
    expect(resultado.diagnosticos).toEqual([]);
    expect(resultado.paso).toMatchObject(esperado);
  });

  it.each([
    ['presiono el botón "Revocar" en la fila de "x"', { por: 'fila', texto: 'x', ambito: null }],
    [
      'presiono el botón "Aprobar" en el aviso de confirmación',
      { por: 'dialogo', texto: null, ambito: null },
    ],
    [
      'presiono el botón "Aprobar" en el aviso "Cerrar el mes"',
      { por: 'dialogo', texto: 'Cerrar el mes', ambito: null },
    ],
    [
      'veo el texto "x" en la fila de "y" en "Invitaciones"',
      { por: 'fila', texto: 'y', ambito: { por: 'seccion', texto: 'Invitaciones', ambito: null } },
    ],
  ])('ámbito: %s', (frase, ambito) => {
    expect(paso(frase).paso?.ambito).toEqual(ambito);
  });

  it.each([
    [
      'presiono el elemento con id de prueba "guardar"',
      { por: 'idDePrueba', id: 'guardar' },
      'CUS-W001@19:19',
    ],
    ['veo el elemento con selector `.aviso`', { por: 'css', selector: '.aviso' }, 'CUS-W001@19:14'],
  ])('un escape avisa CUS-W001: %s', (frase, objetivo, aviso) => {
    const resultado = paso(frase);
    expect(resultado.paso?.objetivo).toEqual(objetivo);
    expect(resultado.diagnosticos).toEqual([aviso]);
  });
});

describe('frases que no se entienden', () => {
  it.each([
    ['completo el botón "Entrar" con "x"', 'CUS-E007@19:19'],
    ['selecciono "x" en el texto "y"', 'CUS-E007@19:28'],
    ['marco el campo "x"', 'CUS-E007@19:16'],
    ['completo el campo "Correo"', 'CUS-E008@19:10'],
    ['completo el campo "Correo" con algo', 'CUS-E008@19:41'],
    ['selecciono en el campo "Rol"', 'CUS-E008@19:10'],
    ['presiona el botón "Entrar"', 'CUS-E006@19:10'],
    ['veo el texto "sin cerrar', 'CUS-E006@19:23'],
    ['navego a `sin cerrar', 'CUS-E006@19:19'],
    ['inicio sesión como "secretaria"', 'CUS-E010@19:10'],
    ['inicio sesión como "a" en la parroquia "b" y algo más', 'CUS-E010@19:10'],
    ['presiono el botón "x" ahora', 'CUS-E006@19:10'],
    ['navego a "Mi parroquia >"', 'CUS-E006@19:10'],
  ])('%s → %s', (frase, esperado) => {
    expect(paso(frase).diagnosticos).toEqual([esperado]);
  });

  it('sugiere el verbo base más parecido', () => {
    const { diagnosticos } = analizarTexto(historia('- CUANDO presiona el botón "Entrar"'));
    expect(diagnosticos[0]?.sugerencia).toBe('¿Quisiste decir «presiono el botón "Entrar"»?');
  });

  it('sugiere la frase de negocio más parecida', () => {
    const { diagnosticos } = analizarTexto(
      historia('- DADO que visito el sitio de la parrokia "x"'),
    );
    expect(diagnosticos[0]?.codigo).toBe('CUS-E006');
    expect(diagnosticos[0]?.sugerencia).toBe(
      '¿Quisiste decir «visito el sitio de la parroquia "{parroquia}"»?',
    );
  });

  it('no sugiere nada si no hay nada parecido', () => {
    const { diagnosticos } = analizarTexto(
      historia('- CUANDO hago algo completamente distinto con "x"'),
    );
    expect(diagnosticos[0]?.sugerencia).toBeNull();
  });
});

describe('frases de negocio (especificación §10.1)', () => {
  it('reconoce la frase y arma sus argumentos', () => {
    expect(paso('inicio sesión como "parroco" en la parroquia "${PARROQUIA}"').paso).toEqual({
      fase: 'cuando',
      accion: 'frase',
      objetivo: {
        por: 'frase',
        vocabulario: 'acutis-suite',
        nombre: 'inicio sesión como "{rol}" en la parroquia "{parroquia}"',
        argumentos: { rol: 'parroco', parroquia: '${PARROQUIA}' },
      },
      ambito: null,
      valor: null,
      origen: { linea: 19, columna: 3 },
    });
  });

  it('las palabras no distinguen mayúsculas, pero las tildes cuentan', () => {
    expect(paso('Inicio Sesión como "a" en la parroquia "b"').diagnosticos).toEqual([]);
    expect(paso('inicio sesion como "a" en la parroquia "b"').diagnosticos).toEqual([
      'CUS-E006@19:10',
    ]);
  });

  it('reconoce los patrones que empiezan con un parámetro', () => {
    expect(paso('"Sofía" aparece en el pase de lista del curso "Primero"').paso?.accion).toBe(
      'frase',
    );
  });

  it('una oración que calza con frases de dos vocabularios es CUS-E017', () => {
    const otro = {
      ruta: 'otro.vocabulario.md',
      texto:
        '---\nvocabulario: otro\ndsl: 0.1.0\nproducto: x\n---\n\n## Frase: visito el sitio de la parroquia "{p}"\n- navego a `https://{p}`\n',
    };
    const texto = historia('- DADO que visito el sitio de la parroquia "x"').replace(
      '[acutis-suite]',
      '[acutis-suite, otro]',
    );
    expect(codigos(analizarTexto(texto, [VOCABULARIO, otro]).diagnosticos)).toEqual([
      'CUS-E017@19:12',
    ]);
  });
});

describe('frontmatter (especificación §3)', () => {
  const conFrontmatter = (cambios: Readonly<Record<string, string | null>>): string =>
    historia('- CUANDO navego a `https://x.test`').replace(frontmatter(), frontmatter(cambios));

  it.each([
    ['falta un campo', { criticidad: null }, ['CUS-E002@1:1']],
    ['criticidad desconocida', { criticidad: 'urgente' }, ['CUS-E002@7:13']],
    ['título vacío', { titulo: '""' }, ['CUS-E002@5:9']],
    ['etiquetas sin lista', { etiquetas: 'acceso' }, ['CUS-E002@9:12']],
    ['etiquetas con mayúsculas', { etiquetas: '[Acceso]' }, ['CUS-E002@9:12']],
    ['vocabularios sin lista', { vocabularios: 'acutis-suite' }, ['CUS-E002@8:15']],
    ['versión con v', { dsl: 'v1.0' }, ['CUS-E015@2:6']],
    ['versión no soportada', { dsl: '9.9.9' }, ['CUS-E015@2:6']],
    ['id mal formado', { id: 'HU-001' }, ['CUS-E003@3:5']],
    ['vocabulario inexistente', { vocabularios: '[otro]' }, ['CUS-E009@8:15']],
    ['clave desconocida', { criticidd: 'alta' }, ['CUS-W007@9:1']],
    [
      'línea sin dos puntos, sin cascada de E002',
      { criticidad: null, _: 'criticidad alta' },
      ['CUS-E001@8:1'],
    ],
    ['clave repetida', { _: 'actor: Otra' }, ['CUS-E001@9:8']],
  ])('%s', (_, cambios, esperado) => {
    expect(codigos(analizarTexto(conFrontmatter(cambios)).diagnosticos)).toEqual(esperado);
  });

  it('sugiere la clave más parecida', () => {
    const { diagnosticos } = analizarTexto(conFrontmatter({ criticidd: 'alta' }));
    expect(diagnosticos[0]?.sugerencia).toBe('¿Quisiste decir `criticidad`?');
  });

  it('un frontmatter sin cerrar es CUS-E001', () => {
    const texto = historia('- CUANDO navego a `https://x.test`').replace(
      'vocabularios: [acutis-suite]\n---',
      'vocabularios: [acutis-suite]',
    );
    expect(codigos(analizarTexto(texto).diagnosticos)).toEqual(['CUS-E001@1:1']);
  });

  it('un archivo vacío es CUS-E001', () => {
    expect(codigos(analizarTexto('\n\n').diagnosticos)).toEqual(['CUS-E001@1:1']);
  });

  it('acepta valores entre comillas', () => {
    expect(
      analizarTexto(conFrontmatter({ titulo: '"Con: dos puntos"' })).historias[0]?.historias[0]
        ?.titulo,
    ).toBe('Con: dos puntos');
  });
});

describe('secciones (especificación §4)', () => {
  const fm = frontmatter();
  const valida = historia('- CUANDO navego a `https://x.test`');

  it.each([
    [
      'sin ## Historia',
      `${fm}\n## Escenario: a\n- CUANDO navego a \`https://x\`\n`,
      ['CUS-E004@1:1'],
    ],
    ['a la narrativa le falta Para', valida.replace('**Para** comprobar\n', ''), ['CUS-E004@11:1']],
    [
      'narrativa desordenada',
      valida
        .replace('**Como** secretaria', '**Quiero** antes')
        .replace('**Quiero** probar', '**Como** después'),
      ['CUS-E004@11:1'],
    ],
    [
      'parte repetida',
      valida.replace('**Para** comprobar', '**Para** comprobar\n**Para** otra vez'),
      ['CUS-E004@17:1'],
    ],
    [
      'parte vacía',
      valida.replace('**Para** comprobar', '**Para**'),
      ['CUS-E004@16:1', 'CUS-E004@11:1'].sort(),
    ],
    ['Historia repetida', `${valida}\n## Historia\n`, ['CUS-E004@21:1']],
    ['sin escenarios', `${fm}\n${NARRATIVA}`, ['CUS-E005@1:1']],
    [
      'escenario sin nombre',
      valida.replace('## Escenario: prueba', '## Escenario:'),
      ['CUS-E005@18:1'],
    ],
    ['escenario sin pasos', `${valida}\n## Escenario: vacío\n`, ['CUS-E005@21:1']],
    [
      'escenarios repetidos',
      `${valida}\n## Escenario: prueba\n- CUANDO navego a \`https://x\`\n`,
      ['CUS-E016@21:15'],
    ],
    ['empieza con ENTONCES', valida.replace('- CUANDO', '- ENTONCES'), ['CUS-E005@19:3']],
    ['fase en minúsculas', valida.replace('- CUANDO', '- cuando'), ['CUS-E005@19:3']],
    ['paso sin fase', valida.replace('- CUANDO ', '- '), ['CUS-E005@19:3']],
    [
      'fase sin frase',
      valida.replace('- CUANDO navego a `https://x.test`', '- CUANDO'),
      ['CUS-E005@19:3'],
    ],
    [
      'paso vacío',
      valida.replace('- CUANDO navego a `https://x.test`', '- CUANDO que '),
      ['CUS-E005@19:3'],
    ],
    [
      'antecedentes después de un escenario',
      `${valida}\n## Antecedentes\n- navego a \`https://x\`\n`,
      ['CUS-E005@21:1'],
    ],
    [
      'fase en los antecedentes',
      valida.replace(
        '## Escenario',
        '## Antecedentes\n- DADO navego a `https://x`\n\n## Escenario',
      ),
      ['CUS-E005@19:3'],
    ],
    [
      'limpieza antes de los escenarios',
      valida.replace('## Escenario', '## Limpieza\n- navego a `https://x`\n\n## Escenario'),
      ['CUS-E005@18:1'],
    ],
    [
      'limpieza repetida',
      `${valida}\n## Limpieza\n- navego a \`https://x\`\n## Limpieza\n`,
      ['CUS-E005@23:1'],
    ],
  ])('%s', (_, texto, esperado) => {
    expect(codigos(analizarTexto(texto).diagnosticos).sort()).toEqual(esperado);
  });

  it.each([
    ['## Escenarios: otro', '¿Quisiste decir «## Escenario: otro»?'],
    ['## Escenario sin dos puntos', '¿Quisiste decir «## Escenario: sin dos puntos»?'],
    ['## Limpiza', '¿Quisiste decir «## Limpieza»?'],
    ['## historia', '¿Quisiste decir «## Historia»?'],
  ])('CUS-W006: %s', (titulo, sugerencia) => {
    const { diagnosticos } = analizarTexto(`${valida}\n${titulo}\n`);
    expect(codigos(diagnosticos)).toEqual(['CUS-W006@21:4']);
    expect(diagnosticos[0]?.sugerencia).toBe(sugerencia);
  });

  it.each(['## Notas', '## Historia de cambios', '## Ok'])(
    '%s es una nota, sin aviso',
    (titulo) => {
      expect(
        analizarTexto(`${valida}\n${titulo}\n- algo que no es un paso\n`).diagnosticos,
      ).toEqual([]);
    },
  );

  it('antecedentes y limpieza sin fase, y la narrativa sin líneas en blanco', () => {
    const texto = valida
      .replace(
        '**Como** secretaria\n\n**Quiero** probar\n\n',
        '**Como** secretaria\n**Quiero** probar\n',
      )
      .replace('## Escenario', '## Antecedentes\n- navego a `https://a`\n\n## Escenario')
      .concat('\n## Limpieza\n- elimino todo lo creado con prefijo "${PREFIJO}"\n');
    const [h] = analizarTexto(texto).historias[0]?.historias ?? [];
    expect(h?.antecedentes).toHaveLength(1);
    expect(h?.limpieza).toHaveLength(1);
    expect(h?.narrativa.quiero).toBe('probar');
  });
});

describe('archivos', () => {
  const valida = historia('- CUANDO navego a `https://x.test`');

  it('varias historias en un archivo: la unidad es la historia', () => {
    const otra = valida
      .replace('HU-PRUEBA-001', 'HU-PRUEBA-002')
      .replace('- CUANDO navego', '- CUANDO navegó');
    const resultado = analizarTexto(
      `${valida}\n---\n\nuna línea horizontal, que es una nota\n${otra}`,
    );
    expect(codigos(resultado.diagnosticos)).toEqual(['CUS-E006@42:10']);
    expect(resultado.historias[0]?.historias.map((h) => h.id)).toEqual(['HU-PRUEBA-001']);
  });

  it('un id repetido entre archivos: solo la segunda aparición pierde el AST', () => {
    const resultado = analizar({
      historias: [
        { ruta: 'a.historia.md', texto: valida },
        { ruta: 'b.historia.md', texto: valida },
      ],
      vocabularios: [VOCABULARIO],
    });
    expect(
      resultado.diagnosticos.map(
        (d) => `${d.archivo} ${d.codigo}@${String(d.linea)}:${String(d.columna)}`,
      ),
    ).toEqual(['b.historia.md CUS-E003@3:5']);
    expect(resultado.diagnosticos[0]?.mensaje).toContain('a.historia.md:3');
    expect(resultado.historias.map((h) => h.archivo)).toEqual(['a.historia.md']);
  });

  it('BOM, CRLF y tildes descompuestas (NFD) no mueven las columnas', () => {
    const BOM = String.fromCodePoint(0xfeff);
    const nfd = 'presiono el bote\u0301n "x" y'.normalize('NFD');
    const texto = `${BOM}${historia(`- CUANDO ${nfd}`)}`.replaceAll('\n', '\r\n');
    const { diagnosticos } = analizarTexto(texto);
    expect(codigos(diagnosticos)).toEqual(['CUS-E006@19:10']);
    const reconocida = `${BOM}${historia(`- CUANDO ${'presiono el botón "Sí"'.normalize('NFD')}`)}`;
    expect(
      analizarTexto(reconocida).historias[0]?.historias[0]?.escenarios[0]?.pasos[0]?.objetivo,
    ).toEqual({
      por: 'boton',
      texto: 'Sí'.normalize('NFD'),
    });
  });

  it('las columnas se cuentan sobre el texto original, aunque esté en NFD', () => {
    // «í» y «á» en NFD son dos puntos de código cada una, como los cuenta un editor.
    const texto = historia(`- CUANDO ${'veo el título "Más"'.normalize('NFD')} y "sin cerrar`);
    expect(codigos(analizarTexto(texto).diagnosticos)).toEqual(['CUS-E006@19:34']);
  });
});

describe('vocabularios (especificación §10)', () => {
  const vocabulario = (cuerpo: string, cabecera = 'vocabulario: v\ndsl: 0.1.0\nproducto: x\n') => ({
    ruta: 'v.vocabulario.md',
    texto: `---\n${cabecera}---\n\n${cuerpo}`,
  });
  const diagnosticosDe = (cuerpo: string, cabecera?: string): string[] =>
    codigos(
      analizar({ historias: [], vocabularios: [vocabulario(cuerpo, cabecera)] }).diagnosticos,
    );

  it.each([
    ['sin pasos ni implementación', '## Frase: algo "{x}"\n', ['CUS-E005@7:1']],
    [
      'nativa con pasos',
      '## Frase: algo\n> implementación: nativa\n- navego a `https://x`\n',
      ['CUS-E005@9:1'],
    ],
    [
      'implementación desconocida',
      '## Frase: algo\n> implementación: rápida\n',
      ['CUS-E005@8:3', 'CUS-E005@7:1'],
    ],
    [
      'produce mal escrito',
      '## Frase: algo\n> produce: link\n- navego a `https://x`\n',
      ['CUS-E010@8:3'],
    ],
    [
      'patrón con una cadena que no es parámetro',
      '## Frase: veo "algo"\n- navego a `https://x`\n',
      ['CUS-E010@7:15'],
    ],
    [
      'parámetro repetido',
      '## Frase: de "{a}" a "{a}"\n- navego a `https://x`\n',
      ['CUS-E010@7:22'],
    ],
    ['patrón vacío', '## Frase:\n', ['CUS-E010@7:10']],
    [
      'patrón repetido',
      '## Frase: algo "{a}"\n- navego a `https://x`\n\n## Frase: ALGO "{b}"\n- navego a `https://y`\n',
      ['CUS-E017@10:11'],
    ],
    [
      'patrón igual a una frase base',
      '## Frase: veo el texto "{t}"\n- navego a `https://x`\n',
      ['CUS-E017@7:11'],
    ],
    ['paso con fase', '## Frase: algo\n- DADO navego a `https://x`\n', ['CUS-E005@8:3']],
    ['paso desconocido', '## Frase: algo\n- hago cosas\n', ['CUS-E006@8:3']],
  ])('%s', (_, cuerpo, esperado) => {
    expect(diagnosticosDe(cuerpo).sort()).toEqual([...esperado].sort());
  });

  it.each([
    ['sin frontmatter', null, ['CUS-E001@1:1']],
    ['falta producto', 'vocabulario: v\ndsl: 0.1.0\n', ['CUS-E002@1:1']],
    ['nombre inválido', 'vocabulario: V Mal\ndsl: 0.1.0\nproducto: x\n', ['CUS-E002@2:14']],
    ['versión mal escrita', 'vocabulario: v\ndsl: 1\nproducto: x\n', ['CUS-E015@3:6']],
  ])('frontmatter: %s', (_, cabecera, esperado) => {
    const fuente =
      cabecera === null
        ? { ruta: 'v.vocabulario.md', texto: '## Frase: algo\n- navego a `https://x`\n' }
        : vocabulario('## Frase: algo\n- navego a `https://x`\n', cabecera);
    expect(codigos(analizar({ historias: [], vocabularios: [fuente] }).diagnosticos)).toEqual(
      esperado,
    );
  });

  it('un paso puede usar una frase definida más abajo', () => {
    const resultado = analizar({
      historias: [],
      vocabularios: [
        vocabulario(
          '## Frase: entro\n- abro "x"\n\n## Frase: abro "{y}"\n- navego a `https://{y}`\n',
        ),
      ],
    });
    expect(resultado.diagnosticos).toEqual([]);
    expect(resultado.vocabularios[0]?.frases[0]?.pasos[0]?.objetivo).toMatchObject({
      por: 'frase',
      nombre: 'abro "{y}"',
    });
  });

  it('una historia que importa un vocabulario con errores recibe un solo CUS-E009, sin sus CUS-E006', () => {
    const roto = vocabulario('## Frase: algo\n- hago cosas\n');
    const texto = historia('- CUANDO algo\n- Y otra cosa que no existe').replace(
      '[acutis-suite]',
      '[v]',
    );
    const resultado = analizar({
      historias: [{ ruta: 'h.historia.md', texto }],
      vocabularios: [roto],
    });
    expect(resultado.diagnosticos.map((d) => `${d.archivo} ${d.codigo}`)).toEqual([
      'h.historia.md CUS-E009',
      'v.vocabulario.md CUS-E006',
    ]);
  });
});
