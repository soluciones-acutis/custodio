---
dsl: 1.0
id: HU-SUITE-003
producto: suite-parroquial
titulo: El párroco invita a una persona al equipo con su rol y revoca la invitación que ya no corresponde
actor: Párroco
criticidad: alta
etiquetas: [acceso, equipo, mi-parroquia]
---

## Historia
**Como** párroco
**Quiero** invitar a una persona nueva al panel con el rol que tendrá, y revocar la invitación si ya no corresponde
**Para** decidir yo quién entra a la información de la parroquia y con qué permisos

## Antecedentes
- inicio sesión como "parroco" en la parroquia "${PARROQUIA}"

## Escenario: invitar a una catequista
- CUANDO navego a "Mi parroquia > El equipo"
- Y presiono el botón "Invitar a alguien"
- Y completo el campo "Correo" con "${PREFIJO}catequista@ejemplo.test"
- Y selecciono "Catequista" en el campo "Rol"
- Y presiono el botón "Crear la invitación"
- Y presiono el botón "Ya lo pasé"
- Y navego a "Mi parroquia > El equipo"
- ENTONCES veo el texto "${PREFIJO}catequista@ejemplo.test" en "Invitaciones sin aceptar"
- Y veo el texto "Catequista" en la fila de "${PREFIJO}catequista@ejemplo.test"
- Y no veo el botón "Copiar el link"

## Escenario: una invitación revocada deja de servir
- DADO que existe una invitación sin aceptar para "${PREFIJO}revocar@ejemplo.test" con rol "Catequista" y guardo su link como "linkInvitacion"
- CUANDO navego a "Mi parroquia > El equipo"
- Y presiono el botón "Revocar" en la fila de "${PREFIJO}revocar@ejemplo.test"
- Y presiono el botón "Sí, revocar"
- Y navego a `${linkInvitacion}`
- ENTONCES veo el texto "Esta invitación ya no es válida"
- Y no veo el campo "Contraseña"

## Escenario: nadie puede restablecer su propio acceso
- CUANDO navego a "Mi parroquia > El equipo"
- ENTONCES veo el texto "No disponible" en la fila de "${USUARIO_parroco}"
- Y no veo el botón "Quitar el acceso" en la fila de "${USUARIO_parroco}"

## Limpieza
- ELIMINAR las invitaciones con prefijo "${PREFIJO}"
