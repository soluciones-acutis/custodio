---
dsl: 0.1.0
id: HU-SUITE-905
producto: suite-parroquial
titulo: Caso inválido 05 (escenario-empieza-con-y)
actor: Secretaria parroquial
criticidad: media
etiquetas: [caso-invalido]
vocabularios: [acutis-suite]
---

## Historia
**Como** secretaria de la parroquia
**Quiero** entrar al panel de la parroquia
**Para** atender las solicitudes de la comunidad

## Escenario: entrar al panel
- Y navego a `https://${PARROQUIA}.${DOMINIO_PRUEBAS}/admin`
- ENTONCES veo el campo "Correo"
