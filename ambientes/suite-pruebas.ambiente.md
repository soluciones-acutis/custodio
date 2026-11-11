---
ambiente: suite-pruebas
dsl: 0.1.0
producto: suite-parroquial
desechable: sí
---

# Ambiente `suite-pruebas`

La declaración del ambiente de pruebas de la Suite Digital Acutis: qué variables y qué secretos existen. Tiene **solo nombres**, nunca valores. Los valores los pone el servidor al ejecutar (SRV-01), y los de los secretos salen de la bóveda. El formato está en la [especificación v0.1](../docs/dsl/especificacion.md#95-el-archivo-de-ambiente), sección 9.5.

Es `desechable`: sus datos se pueden perder sin daño, así que un escenario cuya limpieza no tiene pasos todavía se ejecuta igual (§11.3).

## Variables
- DOMINIO_PRUEBAS
- PARROQUIA
- USUARIO_*
- NOMBRE_*
- CURSO_CATEQUESIS
- CURSO_OTRA_CATEQUISTA
- AFP_PRUEBA
- RUT_PRUEBA
- MES_PRUEBA
- PRIMER_DIA_MES_PRUEBA

`USUARIO_*` es el correo de cada cuenta de prueba (`USUARIO_secretaria`, `USUARIO_parroco`…) y `NOMBRE_*`, el nombre que muestra (`NOMBRE_fiel`). No son secretos: aparecen en pantalla.

## Secretos
- CLAVE_*
- TOTP_*

La contraseña y la semilla del segundo factor de cada cuenta de prueba.
