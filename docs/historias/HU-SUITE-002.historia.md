---
dsl: 1.0
id: HU-SUITE-002
producto: suite-parroquial
titulo: Cada persona del equipo ve en el panel solo los módulos de su rol
actor: Párroco
criticidad: alta
etiquetas: [acceso, roles, proteccion-datos]
---

## Historia
**Como** párroco
**Quiero** que cada persona del equipo vea en su panel solo los módulos de su rol
**Para** que los sueldos, las cuentas y los libros sacramentales no queden a la vista de quien no los necesita

## Escenario: la catequista solo ve Catequesis
- CUANDO inicio sesión como "catequista" en la parroquia "${PARROQUIA}"
- ENTONCES veo el texto "Catequesis"
- Y no veo el texto "Comunidad"
- Y no veo el texto "Remuneraciones"
- Y no veo el texto "Contabilidad"

## Escenario: la contadora ve Remuneraciones y Contabilidad, pero no Catequesis
- CUANDO inicio sesión como "contadora" en la parroquia "${PARROQUIA}"
- ENTONCES veo el texto "Remuneraciones"
- Y veo el texto "Contabilidad"
- Y no veo el texto "Catequesis"
- Y no veo el texto "Sitio y difusión"

## Escenario: el Consejo Económico solo ve las cuentas de la parroquia
- CUANDO inicio sesión como "consejo" en la parroquia "${PARROQUIA}"
- ENTONCES veo el texto "Cuentas de la parroquia"
- Y no veo el texto "Comprobantes del mes"
- Y no veo el texto "Remuneraciones"
