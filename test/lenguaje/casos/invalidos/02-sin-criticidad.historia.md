---
dsl: 0.1.0
id: HU-SUITE-902
producto: suite-parroquial
titulo: Caso sin criticidad
actor: Secretaria parroquial
etiquetas: [caso-invalido]
vocabularios: [acutis-suite]
---

## Historia
**Como** secretaria de la parroquia

**Quiero** entrar al panel de la parroquia

**Para** atender las solicitudes de la comunidad

## Escenario: entrar al panel
- CUANDO navego a `https://${PARROQUIA}.${DOMINIO_PRUEBAS}/admin`
- ENTONCES veo el campo "Correo"
