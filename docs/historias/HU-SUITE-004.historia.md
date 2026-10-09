---
dsl: 1.0
id: HU-SUITE-004
producto: suite-parroquial
titulo: Una persona pide una misa desde el sitio y la secretaría la anota en el libro de intenciones
actor: Fiel
criticidad: alta
etiquetas: [misas, formulario-publico, libro-de-caja]
---

## Historia
**Como** fiel de la parroquia
**Quiero** pedir una misa por un difunto desde el sitio de la parroquia
**Para** encargarla sin tener que ir ni llamar a la secretaría en horario de oficina

## Escenario: petición enviada desde el sitio
- DADO que visito el sitio de la parroquia "${PARROQUIA}"
- CUANDO navego a "Pedir una misa"
- Y selecciono "Por un difunto" en el campo "¿Por qué motivo pides la misa?"
- Y completo el campo "Intención" con "${PREFIJO}Por el eterno descanso de Juan"
- Y completo el campo "Tu nombre" con "${PREFIJO}Marta"
- Y completo el campo "Teléfono" con "+56 9 0000 0000"
- Y marco la casilla "He leído y acepto el aviso de privacidad."
- Y presiono el botón "Enviar petición"
- ENTONCES veo el mensaje "Recibimos tu petición"
- Y la secretaría ve la petición de misa de "${PREFIJO}Marta"

## Escenario: la secretaría anota la misa con su ofrenda y responde la petición
- DADO que una persona pidió una misa desde el sitio a nombre de "${PREFIJO}Marta"
- Y inicio sesión como "secretaria" en la parroquia "${PARROQUIA}"
- CUANDO navego a "Misas y ofrendas"
- Y presiono el botón "Anotar en el libro" en la fila de "${PREFIJO}Marta"
- Y completo el campo "Celebrante" con "${PREFIJO}P. Celebrante"
- Y completo el campo "Ofrenda" con "5000"
- Y presiono el botón "Anotar la misa"
- Y presiono el botón "Marcar atendida" en la fila de "${PREFIJO}Marta"
- Y navego a "Misas y ofrendas"
- ENTONCES veo el texto "${PREFIJO}Por el eterno descanso de Juan" en "Próximas misas con intención"
- Y veo el texto "${PREFIJO}Marta" en "Respondidas hace poco"
- Y el libro de caja muestra un ingreso de "5.000" por la misa de "${PREFIJO}Marta"
- Y no veo el texto "${PREFIJO}Marta" en "Esperando respuesta"

## Limpieza
- ELIMINAR las peticiones de misa con prefijo "${PREFIJO}"
- ELIMINAR las misas del libro de intenciones con prefijo "${PREFIJO}" y sus ingresos en el libro de caja
