---
vocabulario: acutis-suite
dsl: 0.1.0
producto: suite-parroquial
---

# Vocabulario `acutis-suite`

Frases de negocio de la Suite Digital Acutis que usan las historias de `historias/`. El formato está en la [especificación v0.1](../docs/dsl/especificacion.md#10-frases-de-negocio-y-vocabularios), sección 10.

Cada frase declara cómo se implementa:

- **Con pasos:** la frase tiene sus pasos y se puede ejecutar.
- **`pendiente`:** se conocen su nombre y sus parámetros, pero no sus pantallas. La historia se valida (con la advertencia `CUS-W004`) y no se ejecuta: el escenario queda `incompleto`.
- **`nativa`:** la implementará un puerto de datos de prueba (API o siembra), porque por pantalla es imposible o demasiado frágil. Hasta que exista ese puerto, se comporta como `pendiente`. En la `## Limpieza` hay una excepción (§11.3 de la especificación): en un ambiente desechable, el escenario se ejecuta igual y la limpieza se informa como `limpieza_pendiente`.

Los parámetros son los `"{nombre}"` del patrón. Los pasos usan las mismas frases que las historias, sin fase.

## Acceso y sitio

## Frase: inicio sesión como "{rol}" en la parroquia "{parroquia}"
- navego a `https://{parroquia}.${DOMINIO_PRUEBAS}/admin`
- completo el campo "Correo" con "${USUARIO_{rol}}"
- completo el campo "Contraseña" con "${CLAVE_{rol}}"
- presiono el botón "Entrar"
- veo el texto "Verificación en dos pasos"
- ingreso el código de segundo factor generado con el secreto "${TOTP_{rol}}"
- presiono el botón "Entrar"
- veo el texto "Tus módulos"

## Frase: ingreso el código de segundo factor generado con el secreto "{secreto}"
- completo el campo "Código de seis dígitos" con el código generado con el secreto "{secreto}"

## Frase: visito el sitio de la parroquia "{parroquia}"
- navego a `https://{parroquia}.${DOMINIO_PRUEBAS}`

## Frase: inicio sesión en Orar como "{rol}" en la parroquia "{parroquia}"
> implementación: pendiente — falta confirmar cómo entra un fiel a Orar y si usa segundo factor.

## Datos de prueba

## Frase: elimino todo lo creado con prefijo "{prefijo}"
> implementación: nativa — una sola operación del puerto de datos de prueba de la Suite borra todo registro que lleve el prefijo, y lo que depende de él (ingresos de caja, asientos, consentimientos).

Todo dato que crea una prueba lleva `${PREFIJO}`, que es único por escenario (§9.3 de la especificación). Por eso basta una limpieza para todos los módulos, en vez de una por tipo de registro.

## Mi parroquia

## Frase: existe una invitación sin aceptar para "{correo}" con rol "{rol}" y guardo su link como "{guardarLinkComo}"
> produce: {guardarLinkComo}
- navego a "Mi parroquia > El equipo"
- presiono el botón "Invitar a alguien"
- completo el campo "Correo" con "{correo}"
- selecciono "{rol}" en el campo "Rol"
- presiono el botón "Crear la invitación"
- capturo el valor del campo "Link de la invitación" como "{guardarLinkComo}"
- presiono el botón "Ya lo pasé"

La etiqueta «Link de la invitación» hay que confirmarla en la Suite.

## Misas y ofrendas

## Frase: una persona pidió una misa desde el sitio a nombre de "{nombre}"
- visito el sitio de la parroquia "${PARROQUIA}"
- navego a "Pedir una misa"
- selecciono "Por un difunto" en el campo "¿Por qué motivo pides la misa?"
- completo el campo "Intención" con "${PREFIJO}Por el eterno descanso de Juan"
- completo el campo "Tu nombre" con "{nombre}"
- completo el campo "Teléfono" con "+56 9 0000 0000"
- marco la casilla "He leído y acepto el aviso de privacidad."
- presiono el botón "Enviar petición"
- veo el mensaje "Recibimos tu petición"

## Frase: la secretaría ve la petición de misa de "{nombre}"
- inicio sesión como "secretaria" en la parroquia "${PARROQUIA}"
- navego a "Misas y ofrendas"
- veo el texto "{nombre}" en "Esperando respuesta"

## Frase: el libro de caja muestra un ingreso de "{monto}" por la misa de "{nombre}"
> implementación: pendiente — falta la pantalla del libro de caja.

## Comunidad y libros sacramentales

## Frase: existe la partida de bautismo de "{persona}"
- navego a "Comunidad > Libros sacramentales"
- selecciono "Bautismos" en el campo "Libro"
- presiono el botón "Anotar bautismo"
- completo el campo "Nombre" con "{persona}"
- presiono el botón "Crear la ficha"
- presiono el botón "Crear y elegir"
- completo el campo "Fecha" con "13-09-2026"
- completo el campo "Ministro" con "${PREFIJO}P. Ministro"
- completo el campo "Número" con un número único
- presiono el botón "Anotar"
- veo el enlace "Ver la partida"

## Frase: abro la partida de bautismo de "{persona}"
- navego a "Comunidad > Libros sacramentales"
- selecciono "Bautismos" en el campo "Libro"
- presiono el enlace "Ver la partida" en la fila de "{persona}"

## Frase: el libro de "{libro}" muestra la partida de "{persona}"
- navego a "Comunidad > Libros sacramentales"
- selecciono "{libro}" en el campo "Libro"
- veo el texto "{persona}"

## Frase: abro la ficha de "{persona}"
> implementación: pendiente — falta confirmar desde dónde se abre la ficha de una persona en «Comunidad».

## Frase: capturo el código del certificado como "{como}"
> produce: {como}
> implementación: pendiente — falta la etiqueta del código en «Certificados emitidos».

## Frase: el verificador del sitio de la parroquia "{parroquia}" acepta el código "{codigo}" con el apellido "{apellido}"
> implementación: pendiente — se sabe que la página es «Verificar un certificado» del sitio; faltan sus campos.

## Catequesis

## Frase: elijo el curso "{curso}" en el asistente de inscripción
> implementación: pendiente — falta recorrer el asistente de inscripción.

## Frase: inscribo a "{persona}" con una ficha nueva
> implementación: pendiente — falta recorrer el asistente de inscripción.

## Frase: agrego como apoderada a "{persona}"
> implementación: pendiente — falta recorrer el asistente de inscripción.

## Frase: existe la inscripción preinscrita de "{persona}" con apoderada "{apoderado}" en el curso "{curso}"
- navego a "Catequesis > Inscribir"
- elijo el curso "{curso}" en el asistente de inscripción
- inscribo a "{persona}" con una ficha nueva
- agrego como apoderada a "{apoderado}"
- presiono el botón "Inscribir"
- veo el texto "Preinscrita"

## Frase: existe la inscripción activa de "{persona}" en el curso "{curso}"
> implementación: nativa — prepararla por pantalla exige entrar como secretaria, inscribir y registrar el consentimiento antes de que la catequista inicie sesión.

## Frase: "{persona}" aparece en el pase de lista del curso "{curso}"
> implementación: pendiente — el pase de lista está en «Catequesis > Mis cursos y el pase de lista» (HU-SUITE-007), que es la vista de la catequista; falta confirmar dónde lo ve la secretaría.

## Frase: "{persona}" no aparece en el pase de lista del curso "{curso}"
> implementación: pendiente — igual que «aparece en el pase de lista», terminando con `no veo`.

## Frase: la asistencia de "{persona}" quedó como presente en el encuentro
> implementación: pendiente — falta la pantalla donde se consulta la asistencia guardada.

## Frase: acepto el tratamiento de datos personales
> implementación: pendiente — falta la etiqueta de la casilla en el formulario público de catequesis.

## Frase: una familia envió desde el sitio la inscripción de "{nombre}" al curso "{curso}"
- visito el sitio de la parroquia "${PARROQUIA}"
- navego a "Catequesis"
- presiono el botón "Inscribir" en "{curso}"
- completo el campo "Nombre del niño o niña" con "{nombre}"
- acepto el tratamiento de datos personales
- presiono el botón "Enviar inscripción"
- veo el mensaje "Recibimos tu inscripción"

## Frase: la secretaría ve la inscripción de "{nombre}"
- inicio sesión como "secretaria" en la parroquia "${PARROQUIA}"
- navego a "Catequesis > Escritorio"
- veo el texto "{nombre}" en "Solicitudes por revisar"

## Frase: elimino la asistencia registrada para "{persona}" y dejo el encuentro como por realizar
> implementación: nativa — necesita revertir un registro guardado.

## Remuneraciones

## Frase: paso al siguiente paso del asistente
> implementación: pendiente — falta la etiqueta del botón que avanza el asistente de contratación.

## Frase: confirmo la contratación de "{persona}"
> implementación: pendiente — falta el último paso del asistente de contratación.

## Frase: "{persona}" está contratado desde "{fecha}" con AFP y salud vigentes
> implementación: nativa — contratar por pantalla son más de diez pasos que no son lo que el escenario prueba.

## Frase: calculo las liquidaciones pendientes
> implementación: pendiente — falta la pantalla de cálculo de liquidaciones.

## Frase: confirmo el cierre del mes
> implementación: pendiente — falta el aviso de confirmación del cierre.

## Frase: reabro el mes "{mes}" si quedó cerrado
> implementación: nativa — la contadora no puede reabrir un mes cerrado por pantalla (lo verifica la propia HU-SUITE-008).

## Contabilidad y rendiciones

## Frase: completo la cantidad de billetes de "{denominacion}" con "{cantidad}"
> implementación: pendiente — falta cómo se rotulan los campos del arqueo por denominación.

## Frase: completo el primer firmante con "{nombre}"
> implementación: pendiente — falta la etiqueta de los campos de firmantes.

## Frase: completo el segundo firmante con "{nombre}"
> implementación: pendiente — falta la etiqueta de los campos de firmantes.

## Frase: completo el tercer firmante, del Consejo Económico, con "{nombre}"
> implementación: pendiente — falta la etiqueta de los campos de firmantes.

## Frase: existe la colecta presentada "{detalle}" por "{monto}"
> implementación: nativa — por pantalla el monto sale del arqueo, así que no se puede preparar una colecta por un monto dado.

## Frase: el asiento de "{detalle}" carga "{debe}" contra "{haber}"
> implementación: pendiente — falta la pantalla del libro diario.

## Sitio, noticias y Orar

## Frase: existe la noticia en borrador "{titulo}"
- navego a "Sitio y difusión > Noticias"
- presiono el botón "Escribir una noticia"
- completo el campo "Título" con "{titulo}"
- completo el campo "Resumen" con "Te esperamos este domingo en el patio de la parroquia"
- completo el campo "Texto" con "Habrá juegos, comida y música para toda la familia."
- presiono el botón "Guardar como borrador"

## Frase: la noticia "{titulo}" no aparece en el sitio de la parroquia "{parroquia}"
> implementación: pendiente — falta un elemento del sitio que confirme que la portada terminó de cargar; sin él, el `no veo` no tiene ancla (`CUS-W003`).

## Frase: existe la petición de oración pendiente "{peticion}" del fiel "{fiel}"
> implementación: nativa — la petición tiene que quedar asociada a la cuenta de un fiel de prueba.

## Frase: la petición "{peticion}" no aparece en el muro público de Orar
> implementación: pendiente — falta la dirección del muro público y un elemento que sirva de ancla.

