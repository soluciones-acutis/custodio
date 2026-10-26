---
dsl: 0.1.0
id: HU-SUITE-914
producto: suite-parroquial
titulo: Caso inválido 14 (parametro-invalido-en-nombre-de-variable)
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
- CUANDO inicio sesión como "secretaria parroquial" en la parroquia "${PARROQUIA}"
- ENTONCES veo el texto "Tus módulos"
