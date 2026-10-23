# Prompt para Claude Code: Plataforma SaaS de SG-SST (Colombia)

> Copia este documento en la raíz del repositorio como `docs/PRODUCT_SPEC.md` y dale a Claude Code la instrucción que aparece al final ("Cómo trabajar").

---

## 1. Rol y objetivo

Actúa como arquitecto de software senior y desarrollador full-stack experto en SaaS multi-tenant, Next.js, Vercel y en la normativa colombiana de Seguridad y Salud en el Trabajo (SST).

Vas a construir **una aplicación web SaaS, responsive y mobile-first (PWA)**. La app permite a empresas colombianas **montar, administrar, hacer seguimiento y demostrar el cumplimiento** de su Sistema de Gestión de Seguridad y Salud en el Trabajo (SG-SST).

Las empresas pagan una suscripción para usarla. Un **SUPER ADMIN**, que pertenece a la empresa dueña de la plataforma y no a ninguna empresa cliente, parametriza la plataforma completa.

El producto debe ser robusto, auditable y listo para producción. Su meta es que una empresa pueda pasar una inspección del Ministerio del Trabajo o una auditoría de su ARL **generando la evidencia desde la app**.

---

## 2. Stack técnico obligatorio

- **Framework:** Next.js (última versión estable, App Router) con TypeScript en modo `strict`.
- **UI:** Tailwind CSS + shadcn/ui + lucide-react. Diseño mobile-first con navegación inferior en móvil y sidebar en desktop.
- **PWA:**
  - Manifest e instalable.
  - Service worker.
  - **Modo offline** para inspecciones, reportes de actos y condiciones inseguras, reporte de incidentes y listas de asistencia.
  - En offline: cola en IndexedDB y sincronización al reconectar.
- **Base de datos:** PostgreSQL (Neon vía Vercel Marketplace) con **Prisma** o Drizzle (elige uno y justifícalo). Migraciones versionadas.
- **Autenticación:** Auth.js o Better Auth (elige uno y justifícalo). El elegido debe permitir cargar la configuración de proveedores de forma dinámica, en cada request, desde la base de datos.
  - Email + contraseña, magic link, **Google** y **Microsoft** (Microsoft Entra ID).
  - Las credenciales de Google y Microsoft **no van en variables de entorno**: se administran desde el panel del SUPER ADMIN (ver sección 5.9).
  - 2FA (TOTP) obligatorio para SUPER ADMIN y opcional para el resto.
- **Archivos:** Vercel Blob (evidencias, fotos, PDFs, logotipos). URLs firmadas y validación de tipo y tamaño.
- **Correo:** Resend + React Email, con plantillas con la marca de cada empresa.
- **Jobs y tareas programadas:**
  - Vercel Cron para recordatorios y vencimientos.
  - Una cola (Inngest o Upstash QStash) para exportaciones pesadas y envíos masivos, sin superar los timeouts de las funciones de Vercel.
- **Validación:** Zod en cliente y servidor.
- **Estado de datos:** Server Actions + TanStack Query donde aplique.
- **Gráficas:** Recharts.
- **Exportaciones:**
  - PDF: `@react-pdf/renderer` o Playwright/Chromium serverless.
  - Excel: ExcelJS.
  - CSV y ZIP.
- **Pruebas:**
  - Vitest para lógica de negocio. Los cálculos normativos son obligatorios: puntaje de estándares, indicadores y plazos en días hábiles.
  - Playwright para flujos críticos E2E.
- **Calidad:** ESLint, Prettier, Husky + lint-staged, GitHub Actions (lint, typecheck, test).
- **Observabilidad:** Sentry y Vercel Analytics/Speed Insights.
- **Localización:** español de Colombia (`es-CO`), zona horaria `America/Bogota`, moneda COP. Debe existir un **calendario de festivos de Colombia** para calcular plazos en días hábiles.

---

## 3. Arquitectura multi-tenant y marca blanca

### 3.1 Aislamiento de datos
- Base de datos compartida con `tenantId` en todas las tablas de negocio.
- **Row Level Security (RLS) de PostgreSQL** como segunda barrera, además del filtrado en la capa de datos.
- Ninguna consulta puede ejecutarse sin contexto de tenant, salvo las del SUPER ADMIN, que quedan auditadas.
- Debe existir un test automatizado que verifique que un tenant **no puede** leer datos de otro.

### 3.2 Resolución del tenant por dominio
- Cada empresa recibe un subdominio: `empresa.midominio.com`. Usa un wildcard domain en Vercel.
- Cada empresa puede conectar **su propio dominio** (ej. `sst.miempresa.com`). Flujo:
  1. La empresa escribe el dominio en Configuración.
  2. La app lo registra en el proyecto mediante la **API de dominios de Vercel**.
  3. La app muestra los registros DNS (CNAME/A/TXT) que la empresa debe crear, con instrucciones claras.
  4. Verificación periódica del estado y del SSL, con estados: pendiente, verificado, error.
- El middleware de Next.js resuelve el tenant según el `host`, con caché en Edge Config o KV.
- El panel del SUPER ADMIN vive en un dominio propio (ej. `admin.midominio.com`).

### 3.3 Personalización por empresa (white-label)
- Logotipo (claro y oscuro), favicon, nombre comercial.
- Colores primario, secundario y de acento, aplicados como CSS variables en tiempo de ejecución.
- Validación automática de contraste WCAG AA. Si un color no cumple, se advierte y se sugiere un ajuste.
- Vista previa en vivo antes de guardar.
- La marca se aplica en la app, los correos, los PDFs exportados (encabezado y pie) y la pantalla de login del dominio de la empresa.
- Modo claro/oscuro.

---

## 4. Roles y permisos (RBAC granular)

### Nivel plataforma
- **SUPER_ADMIN:** control total de la plataforma.
- **SOPORTE_PLATAFORMA:** acceso de solo lectura a los tenants, más impersonación con motivo obligatorio y registro en auditoría.

### Nivel empresa
Los roles son configurables, con permisos por módulo y acción (ver, crear, editar, eliminar, aprobar, exportar):

- **ADMIN_EMPRESA:** gestiona usuarios, suscripción, marca y dominio.
- **ALTA_DIRECCION:** aprueba la política, el plan anual y la revisión por la dirección; firma documentos.
- **RESPONSABLE_SST:** opera todo el sistema.
- **APOYO_SST.**
- **MIEMBRO_COPASST / VIGIA_SST.**
- **MIEMBRO_CCL** (Comité de Convivencia Laboral). Ve las quejas confidenciales **solo** si es miembro activo.
- **JEFE_AREA:** ve a su equipo, aprueba permisos de trabajo y cierra acciones asignadas.
- **BRIGADISTA.**
- **TRABAJADOR:** portal de autoservicio móvil.
- **CONTRATISTA:** portal limitado.
- **AUDITOR_EXTERNO:** solo lectura, con acceso temporal y fecha de expiración.

Reglas obligatorias:
- La información médica y la de convivencia o acoso tiene **acceso restringido por diseño**.
- La app **nunca** almacena la historia clínica. Solo guarda el concepto de aptitud, las restricciones y las recomendaciones. Esto está alineado con la Resolución 1843 de 2025.

---

## 5. Módulo SUPER ADMIN (back-office de la plataforma)

### 5.1 Planes (100 % administrables)
CRUD de planes con estos campos:
- Nombre, descripción, precio, moneda.
- **Periodicidad:** cada plan puede ofrecerse **mensual, anual o ambos**, con un precio independiente para cada periodicidad (ej. el anual con descuento). La empresa elige la periodicidad al suscribirse y puede cambiarla.
- Precio con IVA incluido o IVA aparte, configurable.
- Días de prueba.
- Límites: número de trabajadores, usuarios, sedes y almacenamiento.
- **Módulos habilitados** (feature flags por plan).
- Visible o no, y orden en la página de precios.

**Planes iniciales (seed):**
- `Free Trial`: 30 días, todos los módulos, sin tarjeta, límites razonables configurables.
- `Profesional`: **$200.000 COP**. Por defecto es mensual. Deja el IVA y la periodicidad configurables.

Requisitos adicionales:
- Los cambios de precio no afectan a las suscripciones activas hasta su renovación, salvo que se fuerce el cambio.
- Cupones y descuentos (porcentaje o valor, vigencia, usos máximos).
- Extensión manual de trials y concesión de meses gratis.

### 5.2 Suscripciones y facturación
- **Ciclo de vida:** trial → activa → en mora (gracia configurable, ej. 5 días) → suspendida (solo lectura) → cancelada.
- **Retención de datos:** tras la cancelación, los datos se conservan N días configurables. Antes de borrarlos, se ofrece exportar todo en ZIP.
- **Recordatorios de fin de trial:** días 7, 3 y 1 antes, más el día de vencimiento.
- **Pasarela de pago:** **Wompi**, con métodos de pago tokenizados y cobro recurrente (detalle en la sección 5.7). Mantén la integración detrás de una interfaz `PaymentProvider` para poder cambiar de pasarela en el futuro, pero implementa solo Wompi.
- **Facturación electrónica DIAN:** **Siigo**. Cada pago aprobado genera automáticamente su factura electrónica (detalle en la sección 5.8). Mantén la integración detrás de una interfaz `InvoicingProvider`.
- **Vista global de pagos y facturas:** todos los cobros de la plataforma con filtros por estado, empresa y fecha. Incluye las facturas rechazadas por la DIAN con botón de reintento y la opción de emitir una factura manual.

### 5.3 Gestión de empresas (tenants)
- Listado con buscador y filtros: plan, estado, fecha de vencimiento, número de trabajadores, % de cumplimiento de estándares.
- Crear, editar, suspender y reactivar empresas.
- Impersonar, con motivo obligatorio y registro en auditoría.
- Ver el estado de los dominios personalizados.

### 5.4 Parametrización normativa global (versionada)
**Toda la normativa debe ser data, no código.** Así, cuando cambie una norma, el SUPER ADMIN la actualiza sin desplegar.

Cada catálogo debe tener **versión, fecha de vigencia y norma fuente**:

- **Estándares mínimos (Resolución 0312 de 2019):**
  - Ciclo PHVA, estándar, ítem, criterio, modo de verificación y valor o puntaje.
  - Aplicabilidad por tamaño y clase de riesgo (grupos de 7, 21 y 60 estándares).
  - Rangos de calificación:
    - Menor a 60 %: crítico.
    - 60 % a 85 %: moderadamente aceptable.
    - Mayor a 85 %: aceptable.
    - Cada rango con sus acciones asociadas.
- **Clasificación de actividades económicas y clases de riesgo** (Decreto 768 de 2022).
- **Catálogo de peligros y metodología de valoración** (GTC 45: niveles de deficiencia, exposición, probabilidad, consecuencia y riesgo, más la aceptabilidad).
- **Matriz legal base:** normas, artículos, requisito y a quién aplica. Normas iniciales a cargar:
  - Ley 1562 de 2012.
  - Decreto 1072 de 2015 (Libro 2, Parte 2, Título 4, Capítulo 6).
  - Resolución 0312 de 2019.
  - Resolución 1843 de 2025 (evaluaciones médicas).
  - Resolución 3461 de 2025 (Comités de Convivencia).
  - Resolución 2646 de 2008 y Resolución 2764 de 2022 (riesgo psicosocial).
  - Resolución 4272 de 2021 (trabajo en alturas).
  - Resolución 2013 de 1986 (COPASST).
  - Resolución 1401 de 2007 (investigación de accidentes).
  - Resolución 156 de 2005 (reporte de AT/EL).
  - Decreto 1496 de 2018 (SGA, químicos).
  - Resolución 40595 de 2022 de MinTransporte (PESV).
  - Resolución 4927 de 2016 y Circular 047 de 2025 (curso de 50/20 horas).
  - Decreto 472 de 2015 (sanciones).
  - Ley 2466 de 2025 (reforma laboral).
  - Ley 1581 de 2012 (habeas data).
- **Indicadores** (Decreto 1072 y artículo 30 de la Resolución 0312): fórmulas parametrizables.
- **Tipos de evaluación médica** (Resolución 1843 de 2025): preingreso, periódica, egreso, postincapacidad, retorno laboral y seguimiento.
- **Plantillas de documentos** con variables tipo `{{empresa.razonSocial}}`: política, objetivos, actas, procedimientos, formatos e informes.
- **Plantillas de checklists de inspección.**
- **Plantillas de exportación** para entes reguladores (ver sección 7), editables cuando cambie el formato oficial.
- **Calendario de obligaciones** con fechas y plazos parametrizables. Ejemplos: ventana de autoevaluación en diciembre, fecha límite de registro de la autoevaluación que fija la circular anual del Ministerio, reporte anual del PESV.
- **Festivos de Colombia** por año.

### 5.5 Otros
- **Métricas de negocio:** MRR, ARR, trials activos, tasa de conversión trial→pago, churn y empresas por plan.
- **Comunicaciones:** anuncios y banners a todos los tenants o a segmentos (ej. "Nueva norma: actualiza tu matriz legal").
- **Configuración global:** pasarela, correo, términos y condiciones, política de tratamiento de datos (versionada, con aceptación registrada).
- **Logs de auditoría** de toda la plataforma y **centro de soporte** (tickets básicos).

### 5.6 Centro de integraciones (credenciales administrables)
Todas las credenciales de terceros (Wompi, Siigo, Google, Microsoft) se administran desde una pantalla **Integraciones** del panel del SUPER ADMIN, no desde variables de entorno.

**Almacenamiento seguro:**
- Los secretos se guardan **cifrados en la base de datos** (AES-256-GCM, cifrado por sobre).
- La única llave que vive en variables de entorno de Vercel es la llave maestra de cifrado (`ENCRYPTION_MASTER_KEY`).
- Después de guardarlos, los secretos **nunca se vuelven a mostrar completos**. Solo se ven enmascarados (ej. `prv_prod_••••••3f9a`) y se pueden reemplazar, no leer.
- Los secretos nunca se envían al navegador. La única excepción es la llave pública de Wompi, que está diseñada para usarse en el cliente.

**Funcionalidades de la pantalla:**
- **Ambientes separados** por integración: sandbox/pruebas y producción, con un selector de ambiente activo y una advertencia visible cuando la plataforma opera en sandbox.
- **Botón "Probar conexión"** en cada integración, que hace una llamada real de verificación y muestra el resultado.
- **Activar o desactivar** cada integración.
- **Historial de cambios:** quién cambió qué credencial y cuándo, sin registrar el valor.
- **Caché de configuración** con invalidación inmediata al guardar.
- **Alertas** de credenciales próximas a vencer (los secretos de Microsoft tienen fecha de expiración) y de fallos repetidos de una integración.

**Arranque del sistema:** el SUPER ADMIN siempre puede entrar con email + contraseña + 2FA. Así, su acceso no depende de que Google o Microsoft estén bien configurados.

### 5.7 Integración con Wompi (pagos recurrentes)

**Variables administrables desde el panel (por ambiente):**
- Llave pública (`pub_...`).
- Llave privada (`prv_...`).
- Secreto de eventos, para verificar la firma de los webhooks.
- Secreto de integridad, para firmar las transacciones.
- URL base de la API por ambiente (sandbox y producción, editables).
- Métodos de pago habilitados: tarjeta de crédito/débito y Nequi, si aplica para cobro recurrente.
- La URL del webhook que el SUPER ADMIN debe registrar en el dashboard de Wompi. La app la muestra lista para copiar.

**Registro de métodos de pago por la empresa (tokenización):**
1. La empresa entra a "Facturación → Métodos de pago" y agrega un método.
2. La app obtiene de la API de Wompi los **tokens de aceptación** vigentes (términos y autorización de tratamiento de datos) y muestra los enlaces y casillas que el usuario debe aceptar. Wompi los exige para crear fuentes de pago y transacciones.
3. Los datos de la tarjeta se **tokenizan desde el navegador directamente contra Wompi** con la llave pública. **Los datos de la tarjeta nunca pasan por nuestros servidores ni se guardan.**
4. El servidor crea la **fuente de pago** (`payment_source`) en Wompi con la llave privada, el token, el email del cliente y el token de aceptación.
5. Solo se guarda: el ID de la fuente de pago, el tipo, la franquicia, los últimos 4 dígitos, la fecha de expiración, el titular y quién la registró y cuándo.

La empresa puede tener varios métodos, marcar uno como **predeterminado**, definir uno de **respaldo** y desactivar o eliminar métodos. Si un método está próximo a vencer, se le avisa a la empresa.

**Cobro recurrente:**
- Un cron diario identifica las suscripciones que vencen ese día y crea la transacción en Wompi con la fuente de pago predeterminada. La transacción lleva el monto en centavos, la moneda COP, una **referencia única e idempotente** (ej. `SUB-{subscriptionId}-{periodo}`), la **firma de integridad** y la marca de pago recurrente.
- **Confirmación del resultado:** webhook `transaction.updated` con verificación del checksum usando el secreto de eventos. Como respaldo, consulta del estado de la transacción en la API.
- **Estados manejados:** aprobado, rechazado, anulado, error y pendiente.
- **Al aprobarse:** se extiende el periodo (1 mes o 1 año según el plan) y se dispara la facturación en Siigo.
- **Si se rechaza:** esquema de reintentos configurable (ej. días 1, 3 y 5). Si falla de nuevo, se intenta con el método de respaldo. Se notifica a la empresa en cada intento. Al agotar los reintentos y el periodo de gracia, la cuenta queda suspendida en solo lectura.
- **Fin del trial:** si la empresa registró un método de pago, se cobra automáticamente el plan elegido. Si no, la cuenta pasa a solo lectura con un llamado claro a suscribirse.

**Cambios de plan o periodicidad:**
- Pasar a un plan superior o de mensual a anual: efecto inmediato, con prorrateo configurable por el SUPER ADMIN.
- Pasar a un plan inferior o de anual a mensual: aplica al final del periodo vigente.

**Reembolsos y anulaciones:** se registran manualmente por el SUPER ADMIN y generan la nota crédito correspondiente en Siigo.

**Pruebas:** usa el ambiente sandbox de Wompi y sus tarjetas de prueba para los escenarios aprobado, rechazado y pendiente. Escribe tests de la verificación de firmas y de la idempotencia del webhook.

### 5.8 Integración con Siigo (factura electrónica)

**Variables administrables desde el panel (por ambiente):**
- Usuario de API (username).
- Access key.
- Partner-Id. Siigo lo exige como encabezado en cada request.
- URL base de la API (editable).
- ID del tipo de comprobante de factura de venta (FV) a usar.
- ID del vendedor (usuario Siigo).
- ID del impuesto de IVA 19 %.
- ID de la forma de pago que representa los cobros por Wompi.
- **Mapeo plan → código de producto/servicio en Siigo**, uno por cada plan y periodicidad.
- Centro de costo (opcional).
- Enviar automáticamente a la DIAN (sí/no).
- Enviar la factura por correo desde Siigo (sí/no).

Para facilitar la configuración, el panel ofrece **selectores que leen de Siigo** los tipos de comprobante, impuestos, formas de pago, vendedores y productos, en lugar de pedir IDs a mano.

**Autenticación:** `POST /auth` con usuario y access key. El access token se cachea y se renueva automáticamente antes de expirar.

**Flujo automático al aprobarse cada pago (mensual o anual):**
1. Se encola un job de facturación. Es **idempotente**: un solo pago genera una sola factura, aunque el webhook llegue repetido.
2. Se verifica que el cliente exista en Siigo por su número de identificación. Si no existe, se crea con los datos de facturación de la empresa.
3. Se crea la factura con `POST /v1/invoices`. Lleva el plan y el periodo facturado, el IVA y la forma de pago, y se envía a la DIAN.
4. Se guarda el ID de Siigo, el número (prefijo-consecutivo), el CUFE, la fecha y el estado.
5. Se descarga el PDF con `GET /v1/invoices/{id}/pdf` (llega en base64), se guarda en Vercel Blob y se notifica a la empresa por correo con su marca.
6. **Si la DIAN la rechaza:** se consultan los errores con `GET /v1/invoices/{id}/stamp/errors`, se alerta al SUPER ADMIN y el job queda en cola de reintento manual o automático.
7. Un job de **conciliación diaria** sincroniza los estados de las facturas pendientes.

**Datos de facturación que la empresa debe completar** (obligatorios antes del primer cobro, validados en el formulario):
- Tipo de persona y tipo de documento.
- NIT con dígito de verificación (validado con el algoritmo de la DIAN).
- Razón social.
- Dirección, departamento y municipio (código DANE).
- Teléfono.
- **Correo de recepción de factura electrónica.**
- Responsabilidades fiscales y régimen.

**Notas crédito:** para reembolsos o anulaciones, con el mismo esquema de idempotencia y almacenamiento.

**Pruebas:** mocks de la API de Siigo para tests automatizados, y una cuenta de pruebas para la validación manual.

### 5.9 Login con Google y Microsoft

**Variables administrables desde el panel:**
- **Google:** Client ID, Client Secret, activado/desactivado.
- **Microsoft (Entra ID):**
  - Application (client) ID.
  - Client Secret, con su **fecha de expiración** para alertar antes de que venza.
  - Tenant: `common` (cuentas personales y corporativas), `organizations` (solo corporativas) o un tenant específico.
  - Activado/desactivado.
- El panel muestra las **URLs de redirección exactas** que se deben registrar en Google Cloud Console y en el portal de Azure, listas para copiar.

**Dominios personalizados y OAuth:** las URLs de redirección no se pueden registrar para cada dominio de cada empresa. Por eso, el flujo OAuth pasa por un **dominio central de autenticación** (ej. `auth.midominio.com`). Al terminar, redirige al dominio de la empresa con un token de un solo uso y corta duración, y allí se crea la sesión. Así, el login con Google o Microsoft funciona igual en subdominios y en dominios propios.

**Reglas de seguridad:**
- El login social solo vincula una cuenta existente si el proveedor confirma que el email está verificado.
- Un usuario solo entra a una empresa si fue invitado o si su dominio de correo está en la lista de dominios permitidos que configure la empresa.
- Si un usuario pertenece a varias empresas, ve un selector de empresa después de entrar.
- La empresa puede exigir **solo SSO** (Google o Microsoft) para sus usuarios. El SUPER ADMIN puede desactivar un proveedor globalmente.
- Los botones de login se muestran solo si el proveedor está activo y configurado.

---

## 6. Módulos de la empresa (organizados por PHVA)

### 6.0 Onboarding guiado (wizard)
1. **Datos de la empresa:** NIT con dígito de verificación, razón social, actividad económica (CIIU), clase de riesgo, ARL, representante legal, sedes o centros de trabajo y número de trabajadores.
2. **Clasificación automática:** el sistema determina qué estándares aplican (7, 21 o 60) según el número de trabajadores y la clase de riesgo. Recalcula y alerta si estos datos cambian.
3. **Responsable del SG-SST:**
   - Datos, licencia SST (número y vigencia) y certificado del curso de 50 horas, con alertas para la actualización de 20 horas cada 3 años.
   - Validación del perfil exigido según el tamaño y el riesgo de la empresa.
4. **Marca:** carga de logotipo y colores.
5. **Evaluación inicial:** genera automáticamente el plan de trabajo sugerido.

### 6.1 Dashboard
- **% de cumplimiento de estándares mínimos** con semáforo según los rangos de la Resolución 0312.
- **Próximos vencimientos** de los siguientes 7 y 30 días: exámenes médicos, cursos, certificados de alturas, extintores, reuniones de comités, reportes de AT, investigaciones y acciones.
- Indicadores clave con tendencia mensual.
- Avance del plan anual.
- Accidentes del mes.
- Acciones abiertas y vencidas.
- Vista adaptada a cada rol. El trabajador ve solo sus pendientes.

### 6.2 PLANEAR
- **Política y objetivos de SST:** editor con plantilla, aprobación y firma de la alta dirección, divulgación con confirmación de lectura y revisión anual.
- **Responsabilidades y rendición de cuentas:** responsabilidades asignadas por rol o cargo, registro anual de rendición de cuentas.
- **Recursos y presupuesto:** presupuesto anual por rubro, ejecución y evidencias.
- **Evaluación inicial y autoevaluación de estándares mínimos:**
  - Cada ítem tiene estado (cumple, no cumple, no aplica con justificación), **evidencias adjuntas**, responsable y observaciones.
  - Cálculo automático del puntaje y de la calificación.
  - Comparativo histórico entre años.
  - **Plan de mejoramiento generado automáticamente** a partir de los ítems que no cumplen.
  - Recordatorio para aplicar la autoevaluación en diciembre y para registrarla en la plataforma del Ministerio dentro del plazo parametrizado.
- **Matriz legal:**
  - Parte de la matriz base del SUPER ADMIN.
  - La empresa marca qué normas le aplican y registra evidencia de cumplimiento.
  - Alerta cuando el SUPER ADMIN publica una norma nueva.
- **Matriz de identificación de peligros y valoración de riesgos (GTC 45):**
  - Por proceso, actividad, tarea y sede, indicando si la tarea es rutinaria.
  - Valoración automática del riesgo.
  - Controles según la jerarquía: eliminación, sustitución, controles de ingeniería, controles administrativos y EPP.
  - Versionado, participación de los trabajadores y actualización como mínimo anual o tras un accidente grave o un cambio.
- **Plan anual de trabajo:**
  - Actividades con responsable, fechas, recursos y estado.
  - Vista Gantt o calendario.
  - % de cumplimiento.
  - Firma del empleador y del responsable del SG-SST.
- **Plan de capacitación anual:** temas, población objetivo y cronograma.
- **Gestión del cambio:** evaluación del impacto en SST de los cambios internos y externos.

### 6.3 HACER
- **Trabajadores y contratistas:**
  - Ficha con datos personales, cargo, área, sede y tipo de vinculación (incluye aprendices).
  - Afiliaciones: EPS, AFP, ARL con clase de riesgo, y caja de compensación.
  - Fechas de ingreso y retiro, y documentos.
  - Carga masiva desde Excel con validación y reporte de errores.
  - **Contratistas:** verificación mensual de pago de seguridad social, con alertas de vencimiento.
- **Perfiles de cargo y profesiograma:** exámenes y pruebas requeridos por cargo, con su periodicidad.
- **Medicina del trabajo (Resolución 1843 de 2025):**
  - Programación de evaluaciones por tipo, con recordatorios automáticos de las periódicas.
  - Evaluación de **retorno** cuando el trabajador se ausenta por razones no médicas más de 90 días calendario.
  - Registro del **concepto de aptitud, las restricciones y las recomendaciones**, sin historia clínica.
  - Al recibir recomendaciones o restricciones, la app crea una tarea de adaptación del puesto con **plazo de 20 días** (parametrizable), con seguimiento y alerta.
  - Envío a la IPS del perfil de cargo y de los riesgos del trabajador.
  - **Bloqueo explícito:** la app no permite registrar ni solicitar pruebas de embarazo, VIH o serología como requisito.
  - Registro de costos de las evaluaciones, asumidos por el empleador.
- **Ausentismo e incapacidades:** registro por causa (común, laboral, licencias), días y costo estimado. Alimenta el indicador de ausentismo.
- **Programas de vigilancia epidemiológica (PVE):** osteomuscular, auditivo, cardiovascular, visual y psicosocial. Población, actividades, seguimiento y casos.
- **Riesgo psicosocial (Resolución 2646 de 2008 y Resolución 2764 de 2022):**
  - Registro de la aplicación de la batería: fecha, psicólogo con licencia y nivel de riesgo resultante.
  - Periodicidad automática: anual si el riesgo es alto, cada 2 años si es medio o bajo.
  - Plan de intervención.
  - La app **no aplica** la batería; solo gestiona sus resultados y el plan.
- **Capacitación y formación:**
  - Inducción y reinducción obligatorias.
  - Sesiones con **asistencia por QR o firma táctil en el móvil**.
  - Evaluaciones tipo quiz con puntaje.
  - Certificados en PDF con la marca de la empresa.
  - Matriz de competencias por cargo y vencimientos.
- **Elementos de protección personal (EPP):** matriz por cargo, inventario, entregas con firma digital del trabajador, reposiciones y vencimientos.
- **Comités:**
  - **COPASST o Vigía:**
    - Se usa Vigía si la empresa tiene menos de 10 trabajadores y COPASST si tiene 10 o más.
    - **Elecciones electrónicas:** convocatoria, inscripción de candidatos, votación desde el móvil (un voto por trabajador) y escrutinio automático.
    - Acta de conformación, periodo de 2 años con alerta de renovación.
    - Reuniones mensuales con actas, compromisos y seguimiento.
  - **Comité de Convivencia Laboral (Resolución 3461 de 2025):**
    - Conformación según el tamaño de la empresa, con miembros principales y suplentes.
    - Comité central y **un comité por centro de trabajo** cuando la empresa tiene varios.
    - Reglamento del comité y **acuerdos de confidencialidad firmados**.
    - **Reuniones mensuales** con actas.
    - Requisitos de los miembros: no pueden integrarlo quienes hayan sido denunciados o víctimas de acoso laboral en el año anterior.
    - **Canal confidencial de quejas** con acceso exclusivo de los miembros activos y trazabilidad de cada acceso.
    - Flujo de trámite y conciliación con plazos.
    - Capacitaciones obligatorias del comité.
    - Política de prevención del acoso laboral.
  - **Canal separado para quejas de acoso sexual y violencia de género:** lo reciben la alta dirección o talento humano, **nunca el CCL**.
  - **Brigada de emergencias:** integrantes, capacitación y dotación.
- **Gestión de emergencias:**
  - Plan de prevención, preparación y respuesta ante emergencias.
  - Análisis de vulnerabilidad por sede.
  - Procedimientos operativos normalizados (PON).
  - Simulacros: planeación, ejecución, evaluación y acciones de mejora. Mínimo uno al año, con alerta.
  - Inventario de extintores, botiquines y camillas con vencimientos e inspecciones.
  - Rutas de evacuación (planos adjuntos).
- **Tareas de alto riesgo:**
  - Trabajo en alturas (Resolución 4272 de 2021): certificados de los trabajadores con vencimiento, coordinador de alturas, **permisos de trabajo digitales** con firmas y checklist, plan de rescate e inventario de equipos certificados.
  - Espacios confinados, trabajo en caliente y trabajo eléctrico. El tipo de permiso es configurable.
- **Riesgo químico (SGA, Decreto 1496 de 2018):** inventario de sustancias, fichas de datos de seguridad (FDS), etiquetado, matriz de compatibilidad y almacenamiento.
- **PESV (Resolución 40595 de 2022), módulo opcional por plan:**
  - Vehículos y documentación: SOAT, revisión técnico-mecánica.
  - Conductores: licencias y vencimientos.
  - Inspecciones preoperacionales desde el móvil.
  - Siniestros viales.
  - Indicadores y datos para el reporte anual de autogestión.
- **Contratistas y proveedores:** requisitos de SST para contratar, evaluación, documentos y vencimientos.

### 6.4 VERIFICAR
- **Reporte de actos y condiciones inseguras:** cualquier trabajador lo hace desde el móvil en menos de 30 segundos, con foto, ubicación y opción anónima.
- **Accidentes e incidentes de trabajo:**
  - Reporte inmediato desde el móvil: fotos, testigos, lugar, parte del cuerpo afectada y tipo de lesión.
  - **Alerta y contador del plazo de 2 días hábiles** para el reporte a la ARL y a la EPS (Resolución 156 de 2005), usando el calendario de festivos.
  - Generación de los datos precargados para el formato de reporte de la ARL.
  - **Investigación (Resolución 1401 de 2007):**
    - Plazo de 15 días con alerta.
    - Equipo investigador (incluye COPASST o Vigía y el responsable del SG-SST).
    - Metodología: árbol de causas o 5 porqués.
    - Causas inmediatas y básicas.
    - Plan de acción.
    - Remisión a la ARL cuando sea grave o mortal.
  - Lecciones aprendidas divulgadas.
- **Enfermedad laboral:** casos, calificación y seguimiento.
- **Inspecciones:**
  - Checklists configurables (locativas, equipos, EPP, orden y aseo, extintores, vehículos).
  - **Funcionan offline.**
  - Hallazgos con foto que se convierten en acciones con responsable y fecha.
- **Indicadores:**
  - Tablero con los indicadores mínimos de la Resolución 0312: frecuencia y severidad de accidentalidad, proporción de accidentes mortales, prevalencia e incidencia de enfermedad laboral, y ausentismo por causa médica.
  - Indicadores de estructura, proceso y resultado del Decreto 1072.
  - Fórmulas tomadas del catálogo, con metas, tendencia y análisis.
- **Auditoría interna:** programa anual, listas de verificación, hallazgos e informe. Participación del COPASST.
- **Revisión por la alta dirección:** plantilla con las entradas que exige el Decreto 1072, conclusiones, decisiones y firma.

### 6.5 ACTUAR
- **Acciones correctivas, preventivas y de mejora:** módulo central que reciben de inspecciones, accidentes, auditorías, autoevaluación, PVE, simulacros y quejas.
  - Análisis de causa.
  - Responsable, fecha y evidencia de cierre.
  - Verificación de eficacia.
  - Escalamiento automático de las acciones vencidas.

### 6.6 Transversales
- **Gestión documental:**
  - Control de versiones, aprobación, vigencia y lista maestra de documentos.
  - **Conservación de registros por mínimo 20 años** contados desde la terminación de la relación laboral, según el artículo 2.2.4.6.13 del Decreto 1072. Por eso hay borrado lógico, nunca físico, para estos registros.
- **Firma electrónica simple** (Ley 527 de 1999 y Decreto 2364 de 2012): firma táctil o aceptación con OTP, más evidencia de fecha y hora, IP, dispositivo y hash del documento.
- **Notificaciones:** in-app, correo y push (PWA). Resumen semanal para el responsable del SG-SST.
- **Calendario unificado de obligaciones** con exportación a iCal y Google Calendar.
- **Portal del trabajador (móvil):** sus capacitaciones, exámenes, EPP, firmas pendientes, reportes y la política de SST.
- **Multi-sede:** todos los módulos filtrables por sede o centro de trabajo.
- **Búsqueda global** y filtros guardados.
- **Auditoría:** log inmutable de quién hizo qué y cuándo, con valores antes y después en cambios sensibles.

### 6.7 Suscripción y facturación (portal de la empresa)
Esta sección solo la ven ADMIN_EMPRESA y los usuarios con el permiso de facturación.

- **Mi plan:**
  - Plan actual, periodicidad (mensual o anual) y valor.
  - Fecha del próximo cobro y días restantes del trial.
  - Uso frente a los límites del plan.
  - Botones para cambiar de plan o periodicidad, y para cancelar (con confirmación y encuesta de salida).
- **Métodos de pago:** agregar (tokenización con Wompi), marcar como predeterminado o de respaldo, y eliminar. Se muestran solo la franquicia, los últimos 4 dígitos y la expiración.
- **Datos de facturación:** el formulario de la sección 5.8, editable en cualquier momento. Los cambios aplican a las siguientes facturas.
- **Historial de pagos y facturas:**
  - Una fila o tarjeta por cobro con: fecha, periodo facturado, plan, valor antes de IVA, IVA, total y método usado (ej. Visa ••••1234).
  - **Estado del pago:** aprobado, rechazado, pendiente, anulado o reembolsado, con el motivo del rechazo cuando exista.
  - **Estado de la factura:** en proceso, emitida, aceptada por la DIAN o rechazada.
  - Número de factura y CUFE.
  - **Botón para descargar la factura en PDF** (y el XML si Siigo lo provee).
  - Filtros por año y estado, y exportación del historial a Excel.
- **Reintento de pago:** si hay un cobro rechazado, botón "Pagar ahora" para reintentar con el mismo método o con otro.
- **Avisos:** banner visible cuando hay un pago fallido, cuando la tarjeta está próxima a vencer o cuando el trial está por terminar.

---

## 7. Reportes y exportaciones para entes reguladores

Todo exportable en **PDF** (con la marca de la empresa), **Excel** y **CSV**. Las plantillas de formato son editables por el SUPER ADMIN, porque los formatos oficiales cambian.

1. **Autoevaluación de estándares mínimos y plan de mejoramiento**, con la estructura del formulario del artículo 27 de la Resolución 0312. Debe facilitar el registro en la plataforma del Ministerio del Trabajo (`sgrl.mintrabajo.gov.co`).
   - No existe una API pública conocida para ese registro, así que **no intentes automatizarlo**. Genera un archivo y una vista con los datos listos para transcribir o cargar, y registra la fecha en que la empresa confirma el reporte.
   - Incluye la versión para enviar copia a la ARL.
2. **Datos precargados del reporte de accidente de trabajo y enfermedad laboral** (FURAT/FUREL) para diligenciar en la ARL.
3. **Informe de investigación de accidente** (Resolución 1401 de 2007).
4. **Indicadores mínimos** del periodo, con fichas técnicas.
5. **Matriz de peligros (GTC 45), matriz legal, plan anual de trabajo y plan de capacitación.**
6. **Actas** del COPASST o Vigía y del CCL. Las del CCL excluyen la información confidencial de las quejas.
7. **Informe de rendición de cuentas e informe de revisión por la dirección.**
8. **Reporte anual de autogestión del PESV** (datos de indicadores).
9. **"Carpeta de inspección" con un clic:** ZIP con índice en PDF y todas las evidencias organizadas por estándar de la Resolución 0312, para entregar al inspector del Ministerio del Trabajo o a la ARL.
10. **Exportación total de los datos de la empresa** (portabilidad y cierre de cuenta).

---

## 8. Requisitos no funcionales

- **Seguridad:**
  - OWASP Top 10, rate limiting y cabeceras de seguridad (CSP).
  - Cifrado en reposo de campos sensibles: salud, quejas de acoso y número de documento.
  - Sesiones seguras y protección CSRF.
  - Validación de archivos subidos.
  - Los secretos de infraestructura van en variables de entorno de Vercel. Los de integraciones van cifrados en la base de datos, administrados desde el panel (sección 5.6).
- **Pagos:**
  - Los datos de tarjeta nunca tocan nuestros servidores, logs ni base de datos; la tokenización se hace contra Wompi desde el navegador.
  - Todos los webhooks verifican la firma, son idempotentes y responden rápido; el procesamiento pesado va a la cola.
  - Los montos se manejan como enteros en centavos, nunca como decimales de punto flotante.
- **Protección de datos (Ley 1581 de 2012):**
  - Aviso de privacidad y autorización de tratamiento de datos, incluidos los datos sensibles de salud, registrada por usuario.
  - Derechos de los titulares (consulta, rectificación, supresión cuando la ley lo permita).
  - Registro de accesos a datos sensibles.
- **Rendimiento móvil:**
  - LCP menor a 2,5 s en 4G.
  - Paginación o virtualización en tablas.
  - Imágenes comprimidas en el cliente antes de subirlas.
  - En móvil, las tablas se convierten en tarjetas.
- **Accesibilidad:** WCAG 2.1 AA, objetivos táctiles de 44 px como mínimo y navegación con teclado.
- **Respaldo:** backups automáticos de la base de datos (point-in-time de Neon) y procedimiento de restauración documentado.
- **Escalabilidad:** las exportaciones y los envíos masivos se procesan en cola, con notificación cuando terminan.
- **Límites del plan:** se aplican en el servidor. Si se superan, se muestra un mensaje claro con la opción de actualizar el plan.

---

## 9. Despliegue en Vercel

- Un solo proyecto Next.js con:
  - Dominio raíz para la landing y la página de precios.
  - Wildcard `*.midominio.com` para los tenants.
  - `admin.` para el SUPER ADMIN.
  - `auth.` para el flujo OAuth centralizado (sección 5.9).
  - Dominios personalizados agregados por API.
- Endpoints de webhooks de Wompi expuestos en una ruta fija (ej. `/api/webhooks/wompi`) del dominio raíz.
- Cron jobs adicionales: cobros recurrentes, reintentos de cobro, conciliación de facturas con Siigo y alertas de credenciales por vencer.
- El `.env.example` solo contiene variables de infraestructura (base de datos, `AUTH_SECRET`, `ENCRYPTION_MASTER_KEY`, Blob, cola, token de la API de Vercel para dominios, Sentry, Resend y las credenciales iniciales del SUPER ADMIN). Las credenciales de Wompi, Siigo, Google y Microsoft se cargan desde el panel.
- Entornos Preview y Production con bases de datos separadas (branching de Neon para previews).
- `vercel.json` con los cron jobs: vencimientos diarios a las 6:00 a. m. hora de Colombia, fin de trial, cobros y verificación de dominios.
- Archivo `.env.example` completo y documentado.
- **Seed:** SUPER ADMIN inicial (por variables de entorno), planes, catálogos normativos (estándares de la Resolución 0312, GTC 45, Decreto 768, matriz legal base, indicadores, festivos 2026–2027) y una empresa demo con datos ficticios realistas.

---

## 10. Landing pública y registro

- Landing de marketing con beneficios, módulos, precios (leídos de los planes activos), preguntas frecuentes y contacto.
- Registro self-service:
  1. Crear cuenta.
  2. Crear empresa.
  3. Elegir subdominio.
  4. Iniciar el trial de 30 días.
  5. Pasar al wizard de onboarding.
- Términos y política de datos aceptados y versionados.

---

## 11. Cómo trabajar (instrucciones para Claude Code)

1. **No escribas código todavía.** Primero lee este documento completo y entrégame:
   - La arquitectura propuesta y la estructura de carpetas.
   - El **modelo de datos completo** (diagrama ER en Mermaid y schema).
   - Las decisiones técnicas justificadas (ORM, autenticación, cola).
   - Los riesgos identificados.
   - Las preguntas que necesites resolver.
   - Espera mi aprobación.
2. Crea un `CLAUDE.md` con convenciones, comandos y decisiones. Mantenlo actualizado.
3. Construye **por fases**. Al final de cada fase: tests pasando, `typecheck` y `lint` limpios, deploy de preview funcionando y un resumen de lo hecho y de lo pendiente.
   - **Fase 0:** setup del repo, CI, base de datos, cifrado de secretos, centro de integraciones, autenticación (email, Google y Microsoft con dominio central de auth), multi-tenancy con RLS, middleware de dominios, marca blanca y layout mobile-first.
   - **Fase 1:** SUPER ADMIN (planes mensuales/anuales, tenants, catálogos normativos versionados), suscripciones y trial, Wompi (tokenización, fuentes de pago, cobro recurrente, webhooks, reintentos), Siigo (factura automática, PDF, conciliación), portal de facturación de la empresa y landing con registro. Todo probado en los ambientes sandbox antes de cerrar la fase.
   - **Fase 2:** onboarding, trabajadores y contratistas, autoevaluación de estándares mínimos con plan de mejoramiento, matriz legal, matriz de peligros (GTC 45) y plan anual.
   - **Fase 3:** capacitación (QR y firma), EPP, comités (COPASST con elecciones y CCL según la Resolución 3461), medicina del trabajo (Resolución 1843) y ausentismo.
   - **Fase 4:** accidentes e investigación, actos y condiciones inseguras, inspecciones offline, acciones CAPA e indicadores.
   - **Fase 5:** emergencias, tareas de alto riesgo, químicos, PESV, PVE, psicosocial, auditoría y revisión por la dirección.
   - **Fase 6:** reportes y exportaciones regulatorias, carpeta de inspección, gestión documental, notificaciones push y portal del trabajador.
   - **Fase 7:** endurecimiento final (seguridad, rendimiento, accesibilidad, pruebas E2E completas), documentación de usuario y de operación.
4. **Las reglas normativas son datos parametrizables.** Cada vez que codifiques una regla legal (plazos, periodicidades, rangos), cita en un comentario la norma fuente. Si no tienes certeza de un detalle normativo, **no lo inventes**: déjalo parametrizable y márcalo como `TODO-NORMA` para validación de un experto SST.
5. Prioriza siempre la experiencia móvil. Antes de dar una pantalla por terminada, pruébala a 375 px de ancho.
