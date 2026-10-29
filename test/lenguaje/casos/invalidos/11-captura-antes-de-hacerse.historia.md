---
dsl: 0.1.0
id: HU-SUITE-911
producto: suite-parroquial
titulo: Caso inválido 11 (captura-antes-de-hacerse)
actor: Secretaria parroquial
criticidad: media
etiquetas: [caso-invalido]
vocabularios: [acutis-suite]
---

## Historia
**Como** secretaria de la parroquia

**Quiero** entrar al panel de la parroquia

**Para** atender las solicitudes de la comunidad

## Escenario: abrir la invitación
- CUANDO navego a `${linkInvitacion}`
- ENTONCES veo el texto "Esta invitación ya no es válida"
