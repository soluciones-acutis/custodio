# Inventario de historias críticas — Suite Digital Acutis

## Cómo se priorizó

Una historia es crítica si, al fallar, **alguien se queda sin servicio o en riesgo**. Se ordenaron según el daño que causaría su falla, de mayor a menor:

1. **Seguridad y acceso**: entra alguien que no debe, o ve lo que no le corresponde.
2. **Datos personales y menores**: incumplir la Ley 21.719, o un menor que participa sin el consentimiento de su apoderado.
3. **Registros que no se pueden rehacer**: libros sacramentales y certificados.
4. **Servicio directo a las familias**: formularios públicos del sitio (misas, catequesis).
5. **Dinero de la comunidad**: caja, colectas, sueldos.
6. **Contenido público y vida pastoral**: sitio, Orar, asistencia.

## Inventario Historias de usuario priorizado

| Prioridad | ID | Historia | Actor | Módulo | Criticidad |
|:-:|---|---|---|---|:-:|
| 1 | HU-SUITE-001 | La secretaría entra al panel con su contraseña y el segundo factor | Secretaria | Primeros pasos | alta |
| 2 | HU-SUITE-002 | Cada persona ve en el panel solo los módulos de su rol | Párroco | Roles y seguridad | alta |
| 3 | HU-SUITE-003 | El párroco invita a alguien al equipo y revoca la invitación que ya no corresponde | Párroco | Mi parroquia | alta |
| 4 | HU-SUITE-006 | La inscripción de un menor solo se activa con el consentimiento del apoderado | Secretaria | Catequesis | alta |
| 5 | HU-SUITE-005 | Anotar una partida de bautismo y emitir un certificado verificable | Secretaria | Comunidad | alta |
| 6 | HU-SUITE-012 | Una familia inscribe a su hijo en catequesis desde el sitio | Apoderado | Catequesis | alta |
| 7 | HU-SUITE-004 | Pedir una misa desde el sitio y anotarla en el libro de intenciones | Fiel | Misas y ofrendas | alta |
| 8 | HU-SUITE-009 | Rendir la colecta con arqueo y tres firmantes, y aprobarla | Secretaria | Rendiciones · Contabilidad | alta |
| 9 | HU-SUITE-008 | Contratar a una persona y cerrar el mes con su liquidación | Contadora | Remuneraciones | alta |
| 10 | HU-SUITE-011 | Pedir oración en Orar, con revisión antes de publicarla | Fiel | Orar · Sitio | media |
| 11 | HU-SUITE-010 | Escribir una noticia en borrador y publicarla | Encargado del sitio | Sitio y difusión | media |
| 12 | HU-SUITE-007 | La catequista pasa lista y deja el encuentro realizado | Catequista | Catequesis | media |

## Las historias en lenguaje natural

**1. HU-SUITE-001 · Entrar al panel con segundo factor.**
La secretaría escribe su correo y su contraseña, y luego el código de seis dígitos de su app de autenticación. Así llega a su panel.

**2. HU-SUITE-002 · Cada rol ve lo suyo.**
Al entrar, la catequista ve solo Catequesis, la contadora ve Remuneraciones y Contabilidad, y el Consejo Económico ve solo «Cuentas de la parroquia».

**3. HU-SUITE-003 · Invitar y revocar acceso.**
El párroco invita a una persona con su correo y su rol. El link se muestra una sola vez. Si revoca la invitación, el link deja de servir. Nadie puede restablecer su propio acceso.

**4. HU-SUITE-006 · Consentimiento del apoderado.**
Una inscripción hecha en el mesón queda «Preinscrita» y no aparece en el pase de lista. Cuando se registra el consentimiento firmado, pasa a «Activa» y entra al pase de lista.

**5. HU-SUITE-005 · Partida y certificado.**
La secretaría transcribe un bautismo en el libro y emite su certificado. El código del certificado se acepta en «Verificar un certificado» del sitio. Una partida cerrada ya no se puede corregir: solo admite notas marginales.

**6. HU-SUITE-012 · Inscripción a catequesis desde el sitio.**
La familia envía la inscripción desde el sitio y la secretaría la ve. Al aprobarla, queda «Preinscrita» en el curso.

**7. HU-SUITE-004 · Petición de misa.**
Una persona pide la misa desde «Pedir una misa». La secretaría la anota en el libro con su ofrenda y la marca como atendida. La ofrenda entra sola al libro de caja.

**8. HU-SUITE-009 · Rendición de colecta.**
La secretaría rinde la colecta con su arqueo por billetes y tres firmantes, y queda «Presentada» con su total. La contadora la aprueba y se genera el asiento «Colectas por depositar» contra «Ingresos colectas».

**9. HU-SUITE-008 · Contratar y cerrar el mes.**
La contadora contrata a una persona con el asistente de cinco pasos. Después genera, calcula y cierra las liquidaciones del mes. La contadora no puede reabrir una liquidación cerrada.

**10. HU-SUITE-011 · Petición de oración en Orar.**
El fiel pide oración y su petición queda «Pendiente», sin aparecer en el muro. La secretaría la publica y se ve sin el nombre del fiel. El encargado del sitio no tiene acceso a las peticiones.

**11. HU-SUITE-010 · Noticia en el sitio.**
La noticia nace en borrador y no sale al sitio. Al publicarla, aparece en la portada.

**12. HU-SUITE-007 · Pase de lista.**
La catequista marca a los presentes, deja el encuentro como realizado y la asistencia queda guardada. Solo ve los cursos donde la nombraron.