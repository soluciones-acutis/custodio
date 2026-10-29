---
dsl: 0.1.0
id: HU-SUITE-011
producto: suite-parroquial
titulo: Un fiel pide oración a su comunidad desde Orar y la secretaría la revisa antes de publicarla
actor: Fiel
criticidad: media
etiquetas: [orar, peticiones-de-oracion, moderacion]
vocabularios: [acutis-suite]
---

## Historia
**Como** fiel con cuenta en Orar

**Quiero** pedir oración a mi comunidad parroquial

**Para** sentirme acompañado en la oración, sabiendo que la parroquia revisa cada petición antes de publicarla

## Escenario: la petición queda pendiente y no se publica sola
- DADO que inicio sesión en Orar como "fiel" en la parroquia "${PARROQUIA}"
- CUANDO navego a "Orar > Peticiones de oración"
- Y completo el campo "Tu petición" con "${PREFIJO}Por la salud de mi abuela"
- Y presiono el botón "Pedir oración"
- Y navego a "Orar > Peticiones de oración"
- ENTONCES veo el texto "${PREFIJO}Por la salud de mi abuela" en "Tus peticiones"
- Y veo el texto "Pendiente" en la fila de "${PREFIJO}Por la salud de mi abuela"
- Y la petición "${PREFIJO}Por la salud de mi abuela" no aparece en el muro público de Orar

## Escenario: la secretaría publica la petición sin el nombre de quien la pidió
- DADO que existe la petición de oración pendiente "${PREFIJO}Por la salud de mi abuela" del fiel "${NOMBRE_fiel}"
- Y inicio sesión como "secretaria" en la parroquia "${PARROQUIA}"
- CUANDO navego a "Sitio y difusión > Peticiones de oración"
- Y presiono el botón "Publicar" en la fila de "${PREFIJO}Por la salud de mi abuela"
- Y visito el sitio de la parroquia "${PARROQUIA}"
- Y navego a "Orar > Peticiones de oración"
- ENTONCES veo el texto "${PREFIJO}Por la salud de mi abuela"
- Y veo el texto "Alguien de la comunidad" en la fila de "${PREFIJO}Por la salud de mi abuela"
- Y no veo el texto "${NOMBRE_fiel}"

## Escenario: el encargado del sitio no ve las peticiones de oración
- DADO que inicio sesión como "encargado_sitio" en la parroquia "${PARROQUIA}"
- CUANDO navego a "Sitio y difusión"
- ENTONCES veo el texto "Escritorio del sitio"
- Y no veo el texto "Peticiones de oración"

## Limpieza
- elimino todo lo creado con prefijo "${PREFIJO}"
