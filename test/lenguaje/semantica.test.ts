/**
 * La etapa de semántica (diseño de la semana 4, §1): expandir antes de revisar,
 * y cada diagnóstico en la causa, en la historia o en el vocabulario.
 */
import { describe, expect, it } from 'vitest';
import { analizar, type Diagnostico } from '../../src/lenguaje/index.ts';

const AMBIENTE = {
  ruta: 'a.ambiente.md',
  texto:
    '---\nambiente: a\ndsl: 0.1.0\nproducto: x\ndesechable: sí\n---\n\n## Variables\n- SITIO\n- USUARIO_*\n\n## Secretos\n- CLAVE_*\n',
};

const VOCABULARIO = `---
vocabulario: v
dsl: 0.1.0
producto: x
---

## Frase: entro como "{rol}"
- navego a \`https://\${SITIO}\`
- completo el campo "Correo" con "\${USUARIO_{rol}}"
- completo el campo "Clave" con "\${CLAVE_{rol}}"

## Frase: veo el saludo de "{rol}"
- veo el texto "\${CLAVE_{rol}}"

## Frase: guardo el link como "{como}"
> produce: {como}
- capturo el valor del campo "Link" como "{como}"

## Frase: limpio todo
> implementación: nativa — prueba
`;

/** Una historia con `pasos` en su escenario (desde la línea 19) y, si se indica, una limpieza. */
const historia = (pasos: string, limpieza = ''): string =>
  `---\ndsl: 0.1.0\nid: HU-X-001\nproducto: x\ntitulo: t\nactor: a\ncriticidad: media\nvocabularios: [v]\n---\n\n## Historia\n**Como** a\n\n**Quiero** b\n\n**Para** c\n\n## Escenario: e\n${pasos}\n${limpieza ? `\n## Limpieza\n${limpieza}\n` : ''}`;

interface Opciones {
  readonly vocabulario?: string;
  readonly limpieza?: string;
  /** `null`: sin ambiente. */
  readonly ambiente?: typeof AMBIENTE | null;
}

function validar(
  pasos: string,
  { vocabulario = VOCABULARIO, limpieza = '', ambiente = AMBIENTE }: Opciones = {},
): string[] {
  const { diagnosticos } = analizar({
    historias: [{ ruta: 'h.historia.md', texto: historia(pasos, limpieza) }],
    vocabularios: [{ ruta: 'v.vocabulario.md', texto: vocabulario }],
    ...(ambiente ? { ambiente } : {}),
  });
  return diagnosticos.map(
    (d: Diagnostico) => `${d.archivo} ${d.codigo}@${String(d.linea)}:${String(d.columna)}`,
  );
}

describe('variables, capturas y secretos en la historia', () => {
  it.each([
    [
      'una variable no declarada',
      '- CUANDO navego a `https://${OTRO}`\n- ENTONCES veo el texto "x"',
      ['h.historia.md CUS-E011@19:19'],
    ],
    [
      'una captura antes de hacerse',
      '- CUANDO navego a `${link}`\n- ENTONCES veo el texto "x"',
      ['h.historia.md CUS-E011@19:19'],
    ],
    [
      'un secreto en una verificación',
      '- CUANDO navego a `https://x`\n- ENTONCES veo el texto "${CLAVE_a}"',
      ['h.historia.md CUS-E013@20:25'],
    ],
    [
      'un secreto en el valor de completar',
      '- CUANDO completo el campo "Clave" con "${CLAVE_a}"\n- ENTONCES veo el texto "x"',
      [],
    ],
    [
      '${PREFIJO}, que no se declara',
      '- CUANDO completo el campo "Nombre" con "${PREFIJO}Ana"\n- ENTONCES veo el texto "x"',
      [],
    ],
    [
      'una captura de capturar y otra del produce de una frase',
      '- DADO que guardo el link como "uno"\n- CUANDO capturo el valor del campo "Otro" como "dos"\n- Y navego a `${uno}${dos}`\n- ENTONCES veo el texto "x"',
      [],
    ],
  ])('%s', (_, pasos, esperado) => {
    expect(validar(pasos)).toEqual(esperado);
  });

  it('sin ambiente no se revisan las variables en mayúsculas ni los secretos', () => {
    expect(
      validar('- CUANDO navego a `https://${OTRO}`\n- ENTONCES veo el texto "${CLAVE_a}"', {
        ambiente: null,
      }),
    ).toEqual([]);
  });

  it('las capturas se revisan también en la limpieza', () => {
    const pasos = '- DADO que guardo el link como "link"\n- ENTONCES veo el texto "x"';
    expect(validar(pasos, { limpieza: '- navego a `${link}`\n- navego a `${otro}`' })).toEqual([
      'h.historia.md CUS-E011@24:12',
    ]);
  });
});

describe('después de expandir (especificación §9.2)', () => {
  it('un argumento que arma un nombre de variable inválido: CUS-E014 en el argumento, una sola vez', () => {
    expect(validar('- CUANDO entro como "dos palabras"\n- ENTONCES veo el texto "x"')).toEqual([
      'h.historia.md CUS-E014@19:21',
    ]);
  });

  it('un secreto que la frase pone donde no puede ir: CUS-E013 en el argumento', () => {
    expect(validar('- CUANDO veo el saludo de "a"\n- ENTONCES veo el texto "x"')).toEqual([
      'h.historia.md CUS-E013@19:27',
    ]);
  });

  it('un argumento con una variable no declarada: CUS-E011 en el argumento', () => {
    expect(
      validar(
        '- CUANDO entro como "a"\n- Y guardo el link como "l"\n- ENTONCES veo el texto "${OTRA}"',
      ),
    ).toEqual(['h.historia.md CUS-E011@21:25']);
  });
});

describe('en el vocabulario', () => {
  const conFrase = (frase: string): string => `${VOCABULARIO}\n${frase}`;

  it.each([
    [
      'una variable no declarada, escrita tal cual',
      '## Frase: voy\n- navego a `${OTRO}`\n',
      ['v.vocabulario.md CUS-E011@23:12'],
    ],
    [
      'un secreto escrito tal cual donde no puede ir',
      '## Frase: miro\n- veo el texto "${CLAVE_x}"\n',
      ['v.vocabulario.md CUS-E013@23:16'],
    ],
    [
      'un produce que no coincide',
      '## Frase: guardo "{a}"\n> produce: {a}\n- veo el texto "{a}"\n',
      ['v.vocabulario.md CUS-E011@23:3'],
    ],
    [
      'un capturar sin produce',
      '## Frase: guardo "{a}"\n- capturo el valor del campo "x" como "{a}"\n',
      ['v.vocabulario.md CUS-E011@22:11'],
    ],
    [
      'un ciclo, una vez y en la primera frase',
      '## Frase: uno\n- dos\n\n## Frase: dos\n- tres\n\n## Frase: tres\n- uno\n',
      ['v.vocabulario.md CUS-E012@22:11'],
    ],
    [
      'una frase que se usa a sí misma',
      '## Frase: siempre\n- siempre\n',
      ['v.vocabulario.md CUS-E012@22:11'],
    ],
  ])('%s', (_, frase, esperado) => {
    const { diagnosticos } = analizar({
      historias: [],
      vocabularios: [{ ruta: 'v.vocabulario.md', texto: conFrase(frase) }],
      ambiente: AMBIENTE,
    });
    expect(
      diagnosticos.map((d) => `${d.archivo} ${d.codigo}@${String(d.linea)}:${String(d.columna)}`),
    ).toEqual(esperado);
  });

  it('un vocabulario con errores de semántica deja un CUS-E009 en la historia que lo importa', () => {
    const resultado = validar('- CUANDO entro como "a"\n- ENTONCES veo el texto "x"', {
      vocabulario: conFrase('## Frase: siempre\n- siempre\n'),
    });
    expect(resultado).toEqual(['h.historia.md CUS-E009@8:15', 'v.vocabulario.md CUS-E012@22:11']);
  });
});

describe('el flujo de cada escenario (especificación §11)', () => {
  it.each([
    [
      'sin ninguna verificación: CUS-W002',
      '- CUANDO navego a `https://x`',
      ['h.historia.md CUS-W002@18:1'],
    ],
    [
      'una frase en ENTONCES cuenta como verificación',
      '- CUANDO navego a `https://x`\n- ENTONCES veo el saludo de "x"',
      ['h.historia.md CUS-E013@20:29'],
    ],
    [
      '`no veo` justo después de cambiar la página: CUS-W003',
      '- CUANDO navego a `https://x`\n- ENTONCES no veo el texto "x"',
      ['h.historia.md CUS-W003@20:3'],
    ],
    [
      '`no veo` con un ancla antes',
      '- CUANDO navego a `https://x`\n- ENTONCES veo el texto "y"\n- Y no veo el texto "x"',
      [],
    ],
    [
      'una frase sin pasos en el escenario: CUS-W004',
      '- CUANDO limpio todo\n- ENTONCES veo el texto "x"',
      ['h.historia.md CUS-W004@19:3'],
    ],
  ])('%s', (_, pasos, esperado) => {
    expect(validar(pasos)).toEqual(esperado);
  });

  it('una frase sin pasos en la limpieza: CUS-W005, que dice qué pasa según el ambiente', () => {
    const pasos = '- CUANDO navego a `https://x`\n- ENTONCES veo el texto "x"';
    const avisos = (ambiente: typeof AMBIENTE | null): string[] =>
      analizar({
        historias: [{ ruta: 'h.historia.md', texto: historia(pasos, '- limpio todo') }],
        vocabularios: [{ ruta: 'v.vocabulario.md', texto: VOCABULARIO }],
        ...(ambiente ? { ambiente } : {}),
      }).diagnosticos.map((d) => `${d.codigo} ${d.mensaje}`);
    expect(avisos(AMBIENTE)).toEqual([
      expect.stringMatching(/^CUS-W005 .*la limpieza queda `limpieza_pendiente`/),
    ]);
    expect(avisos(null)).toEqual([
      expect.stringMatching(/^CUS-W005 .*los escenarios no se ejecutan/),
    ]);
  });
});

describe('el archivo de ambiente (especificación §9.5)', () => {
  const conAmbiente = (texto: string): string[] =>
    analizar({
      historias: [],
      vocabularios: [],
      ambiente: { ruta: 'a.ambiente.md', texto },
    }).diagnosticos.map((d) => `${d.codigo}@${String(d.linea)}:${String(d.columna)}`);

  it.each([
    ['sin frontmatter', '## Variables\n- A\n', ['CUS-E001@1:1']],
    [
      'desechable inválido',
      AMBIENTE.texto.replace('desechable: sí', 'desechable: tal vez'),
      ['CUS-E002@5:13'],
    ],
    [
      'sin ## Variables',
      '---\nambiente: a\ndsl: 0.1.0\nproducto: x\ndesechable: no\n---\n',
      ['CUS-E002@1:1'],
    ],
    ['un nombre inválido', AMBIENTE.texto.replace('- SITIO', '- MI SITIO'), ['CUS-E002@9:3']],
    [
      'un secreto también en Variables',
      AMBIENTE.texto.replace('- SITIO', '- CLAVE_*'),
      ['CUS-E002@1:1'],
    ],
  ])('%s', (_, texto, esperado) => {
    expect(conAmbiente(texto)).toEqual(esperado);
  });

  it('el de la Suite no tiene errores', () => {
    expect(AMBIENTE.texto).toContain('## Secretos');
    expect(conAmbiente(AMBIENTE.texto)).toEqual([]);
  });
});
