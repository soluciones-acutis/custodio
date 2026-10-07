---
dsl: 1.0
id: HU-SUITE-006
producto: suite-parroquial
titulo: La inscripción de un menor en catequesis solo se activa con el consentimiento firmado del apoderado
actor: Secretaria parroquial
criticidad: alta
etiquetas: [catequesis, menores, consentimiento, ley-21719]
---

## Historia
**Como** secretaria de la parroquia
**Quiero** inscribir a un niño en el mesón y activar su inscripción cuando el apoderado entrega el consentimiento firmado
**Para** cumplir la Ley 21.719 y que solo participen en catequesis los menores autorizados por su familia

## Antecedentes
- inicio sesión como "secretaria" en la parroquia "${PARROQUIA}"

## Escenario: la inscripción de un menor queda preinscrita sin consentimiento
- CUANDO navego a "Catequesis > Inscribir"
- Y elijo el curso "${CURSO_CATEQUESIS}" en el asistente de inscripción
- Y inscribo a "${PREFIJO}Sofía Rojas" con una ficha nueva
- Y agrego como apoderada a "${PREFIJO}Ana Rojas"
- Y presiono el botón "Inscribir"
- ENTONCES veo el texto "Preinscrita"
- Y veo el botón "Imprimir el consentimiento"
- Y "${PREFIJO}Sofía Rojas" no aparece en el pase de lista del curso "${CURSO_CATEQUESIS}"

## Escenario: registrar el consentimiento activa la inscripción
- DADO que existe la inscripción preinscrita de "${PREFIJO}Sofía Rojas" con apoderada "${PREFIJO}Ana Rojas" en el curso "${CURSO_CATEQUESIS}"
- CUANDO navego a "Catequesis > Inscripciones"
- Y selecciono "${CURSO_CATEQUESIS}" en el campo "Curso"
- Y presiono el botón "Registrar consentimiento y activar" en la fila de "${PREFIJO}Sofía Rojas"
- Y selecciono "${PREFIJO}Ana Rojas" en el campo "Quién firmó"
- Y selecciono "Madre" en el campo "Relación"
- Y completo el campo "Fecha de la firma" con la fecha de hoy
- Y presiono el botón "Registrar el consentimiento y activar"
- ENTONCES veo el texto "Activa" en la fila de "${PREFIJO}Sofía Rojas"
- Y "${PREFIJO}Sofía Rojas" aparece en el pase de lista del curso "${CURSO_CATEQUESIS}"

## Limpieza
- ELIMINAR las inscripciones, consentimientos y fichas con prefijo "${PREFIJO}"
