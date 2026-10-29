---
dsl: 0.1.0
id: HU-SUITE-918
producto: suite-parroquial
titulo: Caso inválido 18 (variable-no-declarada)
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
- CUANDO navego a `https://${PARROQUA}.${DOMINIO_PRUEBAS}/admin`
- ENTONCES veo el campo "Correo"
