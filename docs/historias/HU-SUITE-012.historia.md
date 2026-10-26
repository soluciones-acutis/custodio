---
dsl: 0.1.0
id: HU-SUITE-012
producto: suite-parroquial
titulo: Una familia inscribe a su hijo en catequesis desde el sitio de la parroquia
actor: Apoderado
criticidad: alta
etiquetas: [catequesis, formulario-publico]
vocabularios: [acutis-suite]
---

## Historia
**Como** apoderado de la parroquia
**Quiero** inscribir a mi hijo en catequesis desde el sitio web
**Para** no tener que ir a la secretaría en horario de oficina

## Escenario: solicitud de inscripción enviada correctamente
- DADO que visito el sitio de la parroquia "${PARROQUIA}"
- CUANDO navego a "Catequesis"
- Y presiono el botón "Inscribir" en "${CURSO_CATEQUESIS}"
- Y completo el campo "Nombre del niño o niña" con "${PREFIJO}Carlo"
- Y acepto el tratamiento de datos personales
- Y presiono el botón "Enviar inscripción"
- ENTONCES veo el mensaje "Recibimos tu inscripción"
- Y la secretaría ve la inscripción de "${PREFIJO}Carlo"

## Escenario: la secretaría aprueba la solicitud y queda preinscrita
- DADO que una familia envió desde el sitio la inscripción de "${PREFIJO}Carlo" al curso "${CURSO_CATEQUESIS}"
- Y inicio sesión como "secretaria" en la parroquia "${PARROQUIA}"
- CUANDO navego a "Catequesis > Escritorio"
- Y presiono el botón "Aprobar" en la fila de "${PREFIJO}Carlo"
- Y presiono el botón "Aprobar" en el aviso de confirmación
- Y navego a "Catequesis > Inscripciones"
- Y selecciono "${CURSO_CATEQUESIS}" en el campo "Curso"
- ENTONCES veo el texto "Preinscrita" en la fila de "${PREFIJO}Carlo"
- Y no veo el texto "${PREFIJO}Carlo" en "Solicitudes por revisar"

## Limpieza
- elimino las inscripciones, solicitudes y fichas con prefijo "${PREFIJO}"