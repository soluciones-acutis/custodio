---
dsl: 1.0
id: HU-SUITE-001
producto: suite-parroquial
titulo: La secretaría entra al panel con su contraseña y el código de su app de autenticación
actor: Secretaria parroquial
criticidad: alta
etiquetas: [acceso, segundo-factor, panel]
---

## Historia
**Como** secretaria de la parroquia
**Quiero** entrar al panel con mi contraseña y un código de seis dígitos de mi app de autenticación
**Para** trabajar en la Suite con la certeza de que nadie más puede entrar con mi cuenta

## Antecedentes
- navego a `https://${PARROQUIA}.${DOMINIO_PRUEBAS}/admin`

## Escenario: entrada exitosa con contraseña y segundo factor
- CUANDO completo el campo "Correo" con "${USUARIO_secretaria}"
- Y completo el campo "Contraseña" con "${CLAVE_secretaria}"
- Y presiono el botón "Entrar"
- ENTONCES veo el texto "Verificación en dos pasos"
- CUANDO ingreso el código de segundo factor generado con el secreto "${TOTP_secretaria}"
- Y presiono el botón "Entrar"
- ENTONCES veo el texto "Tus módulos"
- Y veo el texto "Secretaría"

## Escenario: contraseña incorrecta
- CUANDO completo el campo "Correo" con "${USUARIO_secretaria}"
- Y completo el campo "Contraseña" con "clave-que-no-es"
- Y presiono el botón "Entrar"
- ENTONCES veo el texto "Correo o contraseña incorrectos"
- Y no veo el texto "Verificación en dos pasos"

## Escenario: código de segundo factor incorrecto
- CUANDO completo el campo "Correo" con "${USUARIO_secretaria}"
- Y completo el campo "Contraseña" con "${CLAVE_secretaria}"
- Y presiono el botón "Entrar"
- Y completo el campo "Código de seis dígitos" con "000000"
- Y presiono el botón "Entrar"
- ENTONCES veo el texto "El código no es válido"
- Y no veo el texto "Tus módulos"

## Escenario: salir del panel cierra la sesión
- DADO que inicio sesión como "secretaria" en la parroquia "${PARROQUIA}"
- CUANDO presiono el botón "${USUARIO_secretaria}"
- Y presiono el botón "Salir"
- ENTONCES veo el campo "Contraseña"
- CUANDO navego a `https://${PARROQUIA}.${DOMINIO_PRUEBAS}/admin`
- ENTONCES veo el campo "Contraseña"
- Y no veo el texto "Tus módulos"