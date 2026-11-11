---
dsl: 0.1.0
id: HU-SUITE-908
producto: suite-parroquial
titulo: Caso inválido 08 (completar-sin-valor)
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
- CUANDO navego a `https://${PARROQUIA}.${DOMINIO_PRUEBAS}/admin`
- Y completo el campo "Correo"
- ENTONCES veo el campo "Correo"
