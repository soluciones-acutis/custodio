---
dsl: 0.1.0
id: HU-SUITE-008
producto: suite-parroquial
titulo: La contadora contrata a una persona y cierra el mes con su liquidación de sueldo
actor: Contadora
criticidad: alta
etiquetas: [remuneraciones, liquidaciones, cierre-de-mes]
vocabularios: [acutis-suite]
---

## Historia
**Como** contadora de la parroquia

**Quiero** contratar a una persona y cerrar el mes con su liquidación calculada

**Para** pagar sueldos correctos según la legislación laboral chilena y dejar el mes fijo, sin cambios posteriores

## Antecedentes
- inicio sesión como "contadora" en la parroquia "${PARROQUIA}"

## Escenario: contratar a una persona con el asistente
- CUANDO presiono el botón "Contratar a una persona"
- Y completo el campo "Nombres" con "${PREFIJO}Pedro"
- Y completo el campo "Apellidos" con "Soto"
- Y completo el campo "RUT" con "${RUT_PRUEBA}"
- Y paso al siguiente paso del asistente
- Y completo el campo "Fecha de ingreso" con "${PRIMER_DIA_MES_PRUEBA}"
- Y completo el campo "Cargo" con "Sacristán"
- Y completo el campo "Sueldo base mensual" con "600000"
- Y completo el campo "Horas semanales" con "40"
- Y paso al siguiente paso del asistente
- Y selecciono "${AFP_PRUEBA}" en el campo "AFP"
- Y selecciono "Fonasa" en el campo "Salud"
- Y paso al siguiente paso del asistente
- Y presiono el botón "Seguir sin cargas"
- Y confirmo la contratación de "${PREFIJO}Pedro Soto"
- Y navego a "Remuneraciones > Fichas de los trabajadores"
- ENTONCES veo el texto "${PREFIJO}Pedro Soto"

## Escenario: calcular y cerrar la liquidación del mes
- DADO que "${PREFIJO}Pedro Soto" está contratado desde "${PRIMER_DIA_MES_PRUEBA}" con AFP y salud vigentes
- CUANDO navego a "Remuneraciones > Cerrar el mes"
- Y selecciono "${MES_PRUEBA}" en el campo "Mes"
- Y presiono el botón "Generar liquidaciones"
- Y calculo las liquidaciones pendientes
- Y presiono el botón "Cerrar el mes"
- Y confirmo el cierre del mes
- Y navego a "Remuneraciones > Cerrar el mes"
- Y selecciono "${MES_PRUEBA}" en el campo "Mes"
- ENTONCES veo el texto "cerrada" en la fila de "${PREFIJO}Pedro Soto"
- Y no veo el botón "Reabrir"

## Limpieza
- elimino todo lo creado con prefijo "${PREFIJO}"
- reabro el mes "${MES_PRUEBA}" si quedó cerrado
