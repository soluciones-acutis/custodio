---
dsl: 1.0
id: HU-SUITE-007
producto: suite-parroquial
titulo: La catequista pasa lista en el encuentro y lo deja como realizado
actor: Catequista
criticidad: media
etiquetas: [catequesis, asistencia]
---

## Historia
**Como** catequista
**Quiero** marcar a los presentes en el encuentro y dejarlo como realizado
**Para** que la parroquia sepa quién está asistiendo a la preparación de los sacramentos

## Antecedentes
- existe la inscripción activa de "${PREFIJO}Sofía Rojas" en el curso "${CURSO_CATEQUESIS}"
- inicio sesión como "catequista" en la parroquia "${PARROQUIA}"

## Escenario: pasar lista en el encuentro más cercano
- CUANDO navego a "Catequesis > Mis cursos y el pase de lista"
- Y marco la casilla "${PREFIJO}Sofía Rojas"
- Y marco la casilla "Encuentro por realizar"
- Y presiono el botón "Guardar la lista"
- ENTONCES veo el texto "Encuentro realizado"
- Y la asistencia de "${PREFIJO}Sofía Rojas" quedó como presente en el encuentro
- Y no veo el texto "sin guardar"

## Escenario: la catequista solo ve los cursos donde la nombraron
- CUANDO navego a "Catequesis > Mis cursos y el pase de lista"
- ENTONCES veo el texto "${CURSO_CATEQUESIS}"
- Y no veo el texto "${CURSO_OTRA_CATEQUISTA}"

## Limpieza
- ELIMINAR la asistencia registrada para "${PREFIJO}Sofía Rojas" y dejar el encuentro como por realizar
- ELIMINAR las inscripciones y fichas con prefijo "${PREFIJO}"