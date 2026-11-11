---
dsl: 0.1.0
id: HU-SUITE-919
producto: suite-parroquial
titulo: Caso inválido 19 (frase-en-dos-vocabularios)
actor: Secretaria parroquial
criticidad: media
etiquetas: [caso-invalido]
vocabularios: [acutis-suite, casos-repetida]
---

## Historia
**Como** secretaria de la parroquia

**Quiero** entrar al sitio de la parroquia

**Para** revisar lo que ven los fieles

## Escenario: entrar al sitio
- DADO que visito el sitio de la parroquia "${PARROQUIA}"
- ENTONCES veo el texto "Pedir una misa"
