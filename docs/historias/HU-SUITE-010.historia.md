---
dsl: 1.0
id: HU-SUITE-010
producto: suite-parroquial
titulo: El encargado del sitio escribe una noticia en borrador y la publica en la portada
actor: Administrador del sitio web
criticidad: media
etiquetas: [sitio, noticias, publicacion]
---

## Historia
**Como** encargado del sitio de la parroquia
**Quiero** escribir una noticia, revisarla en borrador y publicarla cuando esté lista
**Para** mantener informada a la comunidad sin que salga al sitio nada sin revisar

## Antecedentes
- inicio sesión como "encargado_sitio" en la parroquia "${PARROQUIA}"

## Escenario: la noticia nace en borrador y no sale al sitio
- CUANDO navego a "Sitio y difusión > Noticias"
- Y presiono el botón "Escribir una noticia"
- Y completo el campo "Título" con "${PREFIJO}Kermesse parroquial"
- Y completo el campo "Resumen" con "Te esperamos este domingo en el patio de la parroquia"
- Y completo el campo "Texto" con "Habrá juegos, comida y música para toda la familia."
- Y presiono el botón "Guardar como borrador"
- Y navego a "Sitio y difusión > Noticias"
- ENTONCES veo el texto "Borrador" en la fila de "${PREFIJO}Kermesse parroquial"
- Y la noticia "${PREFIJO}Kermesse parroquial" no aparece en el sitio de la parroquia "${PARROQUIA}"

## Escenario: publicar la noticia la deja en la portada del sitio
- DADO que existe la noticia en borrador "${PREFIJO}Kermesse parroquial"
- CUANDO navego a "Sitio y difusión > Noticias"
- Y presiono el botón "Publicar" en la fila de "${PREFIJO}Kermesse parroquial"
- Y visito el sitio de la parroquia "${PARROQUIA}"
- ENTONCES veo el texto "${PREFIJO}Kermesse parroquial"
- Y veo el texto "Te esperamos este domingo en el patio de la parroquia"

## Limpieza
- ELIMINAR las noticias con prefijo "${PREFIJO}"