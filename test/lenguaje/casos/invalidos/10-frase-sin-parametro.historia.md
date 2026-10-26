---
dsl: 0.1.0
id: HU-SUITE-910
producto: suite-parroquial
titulo: Caso inválido 10 (frase-sin-parametro)
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
- CUANDO inicio sesión como "secretaria"
- ENTONCES veo el texto "Tus módulos"
