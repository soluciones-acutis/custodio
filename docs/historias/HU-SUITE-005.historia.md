---
dsl: 1.0
id: HU-SUITE-005
producto: suite-parroquial
titulo: La secretaría anota una partida de bautismo y emite un certificado que se puede verificar en el sitio
actor: Secretaria parroquial
criticidad: alta
etiquetas: [comunidad, libros-sacramentales, certificados]
---

## Historia
**Como** secretaria de la parroquia
**Quiero** transcribir una partida de bautismo y emitir su certificado desde la partida
**Para** entregarle a la familia un certificado fiel al libro, que cualquiera pueda verificar en el sitio de la parroquia

## Antecedentes
- inicio sesión como "secretaria" en la parroquia "${PARROQUIA}"

## Escenario: anotar una partida de bautismo
- CUANDO navego a "Comunidad > Libros sacramentales"
- Y selecciono "Bautismos" en el campo "Libro"
- Y presiono el botón "Anotar bautismo"
- Y completo el campo "Nombre" con "${PREFIJO}Tomás Pérez"
- Y presiono el botón "Crear la ficha"
- Y presiono el botón "Crear y elegir"
- Y completo el campo "Fecha" con "13-09-2026"
- Y completo el campo "Ministro" con "${PREFIJO}P. Ministro"
- Y completo el campo "Número" con "999"
- Y presiono el botón "Anotar"
- ENTONCES veo el enlace "Ver la partida"
- Y el libro de "Bautismos" muestra la partida de "${PREFIJO}Tomás Pérez"

## Escenario: emitir el certificado y verificarlo en el sitio
- DADO que existe la partida de bautismo de "${PREFIJO}Tomás Pérez"
- CUANDO abro la ficha de "${PREFIJO}Tomás Pérez"
- Y presiono el botón "Emitir certificado"
- Y presiono el botón "Sí, emitir"
- ENTONCES veo el texto "Vigente" en "Certificados emitidos"
- Y capturo el código del certificado como "codigoCertificado"
- Y el verificador del sitio de la parroquia "${PARROQUIA}" acepta el código "${codigoCertificado}" con el apellido "Pérez"

## Escenario: una partida cerrada ya no se puede corregir
- DADO que existe la partida de bautismo de "${PREFIJO}Tomás Pérez"
- CUANDO abro la partida de bautismo de "${PREFIJO}Tomás Pérez"
- Y presiono el botón "Cerrar la partida"
- Y presiono el botón "Sí, cerrar la partida"
- Y abro la partida de bautismo de "${PREFIJO}Tomás Pérez"
- ENTONCES veo el texto "Cerrada"
- Y veo el campo "Agregar nota marginal"
- Y no veo el botón "Corregir"

## Limpieza
- ELIMINAR los certificados, partidas y fichas con prefijo "${PREFIJO}"
