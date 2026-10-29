---
dsl: 0.1.0
id: HU-SUITE-009
producto: suite-parroquial
titulo: La secretaría rinde la colecta con su arqueo y tres firmantes, y la contadora la aprueba
actor: Secretaria parroquial
criticidad: alta
etiquetas: [rendiciones, colecta, contabilidad]
vocabularios: [acutis-suite]
---

## Historia
**Como** secretaria de la parroquia

**Quiero** rendir la colecta de una misa con su arqueo por denominación y tres firmantes

**Para** dejar respaldo transparente del dinero de la comunidad, con un ministro de fe del Consejo Económico

## Escenario: la colecta completa queda presentada con su total
- DADO que inicio sesión como "secretaria" en la parroquia "${PARROQUIA}"
- CUANDO navego a "Contabilidad"
- Y presiono el botón "Colecta (arqueo)"
- Y completo el campo "Detalle" con "${PREFIJO}Colecta misa domingo"
- Y completo la cantidad de billetes de "$10.000" con "3"
- Y completo la cantidad de billetes de "$1.000" con "5"
- Y completo el primer firmante con "${PREFIJO}Luis Díaz"
- Y completo el segundo firmante con "${PREFIJO}Rosa Muñoz"
- Y completo el tercer firmante, del Consejo Económico, con "${PREFIJO}Jorge Vera"
- Y presiono el botón "Guardar y presentar"
- Y navego a "Contabilidad"
- ENTONCES veo el texto "Presentada" en la fila de "${PREFIJO}Colecta misa domingo"
- Y veo el texto "$35.000" en la fila de "${PREFIJO}Colecta misa domingo"

## Escenario: la contadora aprueba la colecta y se genera su asiento
- DADO que existe la colecta presentada "${PREFIJO}Colecta misa domingo" por "$35.000"
- Y inicio sesión como "contadora" en la parroquia "${PARROQUIA}"
- CUANDO navego a "Contabilidad"
- Y presiono el botón "Aprobar" en la fila de "${PREFIJO}Colecta misa domingo"
- Y presiono el botón "Sí, aprobar"
- Y navego a "Contabilidad"
- ENTONCES veo el texto "Aprobada" en la fila de "${PREFIJO}Colecta misa domingo"
- Y el asiento de "${PREFIJO}Colecta misa domingo" carga "Colectas por depositar" contra "Ingresos colectas"

## Limpieza
- elimino todo lo creado con prefijo "${PREFIJO}"
