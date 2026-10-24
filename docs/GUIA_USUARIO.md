# Guía de usuario — SST

Esta guía explica, por rol, qué puede hacer cada persona en la plataforma. Todas las cifras y plazos normativos son
**provisionales** hasta que un experto SST los valide (ver `docs/PENDIENTES.md`, marcados `TODO-NORMA`).

## Primeros pasos

1. **Registro** (`/registro` en el dominio principal): datos de la empresa y del responsable; comienza el periodo de prueba.
2. **Ingreso**: cada empresa tiene su dirección (`empresa.sst.zark.pro`). Se entra con correo y contraseña o con enlace de
   acceso por correo; el responsable puede activar verificación en dos pasos.
3. **Onboarding** (`/onboarding`): datos de la empresa, clasificación por tamaño y riesgo, sedes, responsable del SG-SST y colores
   de marca.
4. **Usuarios** (`/usuarios`, administrador): invitar por correo con un rol, cambiar roles, desactivar. Siempre debe quedar al
   menos un administrador activo. Las invitaciones vencen a los 14 días y cuentan para el límite de usuarios del plan.

## Roles

| Rol             | Qué hace                                                                     |
| --------------- | ---------------------------------------------------------------------------- |
| Administrador   | Facturación, usuarios, marca y todos los módulos SST.                        |
| Responsable SST | Opera todos los módulos SST; recibe las alertas por correo.                  |
| Otros roles     | Acceso por módulo (ver, crear, editar, aprobar) según la matriz de permisos. |
| Trabajador      | Portal personal (`/portal`): sus capacitaciones, EPP, documentos y reportes. |

## Módulos por tema

- **Planeación**: Estándares mínimos (`/estandares`, autoevaluación 0312 con plan de mejoramiento), Matriz legal
  (`/matriz-legal`), Matriz de peligros GTC 45 (`/peligros`), Plan anual (`/plan-anual`).
- **Personas**: trabajadores y contratistas (`/personas`, carga masiva CSV, seguridad social de contratistas), Capacitación
  (`/capacitacion`, asistencia por QR con firma), EPP (`/epp`).
- **Comités y convivencia**: COPASST/Vigía con votación secreta (`/comites`), Comité de Convivencia con quejas cifradas
  (`/convivencia`), canal de acoso sexual separado (`/acoso-sexual`).
- **Salud**: Medicina del trabajo (`/medicina`), Vigilancia epidemiológica y psicosocial (`/vigilancia`). Datos sensibles:
  cada lectura queda registrada.
- **Eventos y mejora**: Accidentes e incidentes (`/accidentes`), Reportes de condiciones y actos inseguros (`/reportes`,
  pueden ser anónimos), Inspecciones (`/inspecciones`, funcionan sin conexión y se sincronizan al volver), Acciones CAPA
  (`/acciones`), Indicadores (`/indicadores`).
- **Riesgos específicos**: Emergencias (`/emergencias`), Alto riesgo (`/alto-riesgo`), Químicos (`/quimicos`), PESV (`/pesv`, si
  tu plan lo incluye).
- **Gestión**: Auditoría interna (`/auditorias`), Revisión por la dirección (`/revision-direccion`), Documentos y política
  (`/documentos`).

## Alertas, calendario e informes

- **Alertas** (`/notificaciones`): se calculan cada día; llegan dentro de la plataforma, por correo (lo nuevo) y un resumen
  semanal los lunes. Se puede activar push en el celular.
- **Calendario** (`/calendario`): obligaciones con fecha; descarga `.ics` para tu agenda.
- **Informes** (`/informes`): 13 informes en PDF, Excel o CSV, carpeta de inspección (ZIP con índice y huellas SHA-256) y
  exportación total de los datos.
- **Búsqueda** (`/buscar`) en personas, documentos y acciones.

## Firmas y evidencia

Las firmas son simples (trazo táctil + huella del contenido). Quien elabora no puede aprobar su propio documento ni acta. Lo
aprobado queda inmutable; los cambios generan una nueva versión.

## Privacidad (Ley 1581)

`/privacidad` registra la autorización de tratamiento de datos y las solicitudes de los titulares (consulta, corrección,
supresión). Los documentos de identidad se guardan cifrados; solo se ven los últimos 4 dígitos.

## Facturación

`/facturacion` (administrador): plan, método de pago, facturas y cambio de plan (aplica en la próxima renovación). Si un pago
falla hay reintentos; tras la mora la cuenta pasa a solo lectura y luego a suspensión. Al cancelar, los registros obligatorios
quedan en un archivo cifrado de solo conservación.

## Soporte

El soporte de la plataforma solo puede ver datos sensibles con autorización vigente de la empresa. Cada acceso de plataforma
queda auditado.
