---
dsl: 0.1.0
id: HU-SUITE-904
producto: suite-parroquial
titulo: Caso inválido 04 (sin-para)
actor: Secretaria parroquial
criticidad: media
etiquetas: [caso-invalido]
vocabularios: [acutis-suite]
---

## Historia
**Como** secretaria de la parroquia
**Quiero** entrar al panel de la parroquia

## Escenario: entrar al panel
- CUANDO navego a `https://${PARROQUIA}.${DOMINIO_PRUEBAS}/admin`
- ENTONCES veo el campo "Correo"
