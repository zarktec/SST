# Pendientes y decisiones abiertas

Registro vivo: se agrega al detectarlo y se tacha (o mueve a "Resuelto") al cerrarlo. Resumen por fase en `CLAUDE.md`.

## Requiere acción del dueño del producto

- [ ] Credenciales y variables en Vercel: `RESEND_API_KEY`, `BLOB_READ_WRITE_TOKEN`, token de API de Vercel (`VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`) para dominios por empresa.
- [ ] Cuentas sandbox: Wompi, Siigo (con producto, impuesto IVA, forma de pago, tipo de comprobante FV y NC creados) y AUCO.
- [ ] Decidir prorrateo de mejoras de plan a mitad de ciclo (hoy: el cambio aplica en la próxima renovación).
- [ ] Decidir si el registro self-service debe exigir verificación del correo antes de crear la empresa (hoy se crea y se invita).
- [ ] Revisar y aprobar cada fase cerrada (0 y 1 pendientes de revisión).

## Validación por experto SST / contador (`TODO-NORMA`)

- [ ] Todo el contenido normativo cargado como semilla (estándares, rangos, grupos 7/21/60, parámetros, plazos): ver `src/modules/platform/catalogs/seed-data.ts`. Ningún texto oficial está cargado.
- [ ] Códigos DIAN: motivo de nota crédito, responsabilidades fiscales admitidas (`billing-profile.ts`).
- [ ] Lista de perfil exigido del responsable del SG-SST por tamaño y riesgo.

## Pruebas reales (se dejan para el final, decisión del dueño)

- [ ] Wompi sandbox: tokenización, cobro, webhook (firma de eventos: el ejemplo de la documentación no coincide con su hash).
- [ ] Siigo sandbox: cliente, factura, PDF, nota crédito, estado DIAN.
- [ ] AUCO: flujo de validación (Aucoface) y webhook `/api/webhooks/auco`.
- [ ] Google OAuth con credenciales reales; Microsoft Entra (último).

## Técnico

- [ ] Inngest como cola (hoy: cola en BD + cron diario de Vercel).
- [ ] Edge Config para caché de hosts (con la API de dominios de Vercel).
- [ ] Impersonación de soporte/SUPER ADMIN con motivo y autorización del tenant.
- [ ] Correo de factura con PDF adjunto (el módulo de correo no soporta adjuntos).
- [ ] Catálogo completo de municipios DANE (hoy: el usuario digita el código de 5 dígitos).
- [ ] Barra inferior móvil del panel admin muestra 5 ítems: "Catálogos" queda oculta en móvil.
- [ ] Fijar `engines` de Node a 22.x en `package.json`.
- [ ] CSP con nonce y E2E en CI (Fase 7).

## Fase 2 (se agrega a medida que avanza)

- [ ] Carga del logotipo (onboarding paso 4): requiere `BLOB_READ_WRITE_TOKEN`; hoy solo colores con contraste AA.
- [ ] Los parámetros nuevos del seed (`responsable.actualizacion_anios`, `responsable.alerta_dias`) no se agregan a catálogos ya sembrados (producción): el código usa el valor por defecto 3 años / 90 días hasta que el SUPER ADMIN publique una versión con ellos.
- [ ] Perfil mínimo exigido del responsable del SG-SST según tamaño y riesgo (`TODO-NORMA`): hoy solo se valida licencia vigente, curso de 50 h y actualización de 20 h.
- [ ] Revisar por qué `redirect("/")` desde una server action en el host de la empresa llega al sitio de marketing (se evitó navegando desde el cliente).
- [ ] Evaluación inicial / plan de trabajo sugerido del onboarding (paso 5): depende de la autoevaluación (2.3) y el plan anual (2.6).

- [ ] Documentos de la ficha del trabajador (soportes, contratos): requiere almacenamiento de archivos (`BLOB_READ_WRITE_TOKEN`).
- [ ] Día límite de verificación de seguridad social de contratistas (`contratistas.ss_verificacion_dia`, hoy 10): `TODO-NORMA`; mismo caso de parámetros no sembrados en producción.
- [ ] Alertas por correo/push de contratistas con seguridad social vencida (hoy solo aviso en `/personas`; notificaciones en Fase 6).
- [ ] Perfiles de cargo/profesiograma y fechas de documentos por persona (Fase 3, medicina del trabajo).
- [ ] Contratistas como empresa (NIT, requisitos de SST, evaluación): hoy solo personas con campo "empresa contratista".

- [ ] **Catálogo de estándares mínimos (Res. 0312) sin cargar**: la autoevaluación no puede iniciarse hasta que el SUPER ADMIN lo importe (CSV/JSON) con ciclo PHVA, estándar, ítem, criterio, verificación, valor y grupos aplicables. Requiere el texto oficial.
- [ ] Tratamiento de "no aplica" en el puntaje (hoy: cuenta con su valor máximo), mes de aplicación (12) y plazo de registro ante el Ministerio (vacío = sin recordatorio): `TODO-NORMA`. Parámetros nuevos no sembrados en producción.
- [ ] Evidencias de la autoevaluación como adjuntos (hoy descripción/enlace): requiere almacenamiento de archivos.
- [ ] Plan de mejoramiento: se integrará con acciones CAPA (Fase 4) y con el plan anual (2.6); recordatorios por correo de acciones vencidas (Fase 6).
- [ ] Botón para exportar la autoevaluación a PDF/Excel (Fase 6, reportes regulatorios).

- [ ] **Catálogos sin cargar para la matriz legal**: `legal_requirements` (artículos y requisitos por norma) y `hazard_catalog` (familias y peligros) están vacíos; la matriz legal solo muestra normas y la de peligros usa texto libre. Requiere textos oficiales.
- [ ] Escalas GTC 45 sembradas (`TODO-NORMA`): una deficiencia "Bajo" no se valora (sin valor numérico); validar el tratamiento con un experto.
- [ ] Matriz de peligros: filtros por sede/proceso, exportación a Excel/PDF y gráfico de mapa de calor (Fase 6); notificar al responsable cuando toque la revisión anual (parámetro `matriz_peligros.actualizacion_meses`, no sembrado en producción).
- [ ] Plan anual: la firma es "simple" propia (usuario + fecha + huella del contenido). La firma electrónica completa (OTP, IP, dispositivo, PDF firmado) llega en la Fase 6 y reemplazará este mecanismo.
- [ ] Plan anual: integración con recordatorios/notificaciones y con el calendario unificado (Fase 6); plan de capacitación anual (Fase 3).
- [ ] Menú de navegación móvil: solo caben 5 ítems; el resto de módulos de "Planear" se alcanza desde el inicio. Diseñar un menú "Más" cuando haya más módulos (Fase 3+).
- [ ] Onboarding paso 5 "plan de trabajo sugerido": ya existe en el plan anual (botón "Sugerir actividades"); falta enlazarlo desde el onboarding.

## Fase 3 (se agrega a medida que avanza)

- [ ] **Todos los números de la Fase 3 son provisionales (`TODO-NORMA`)**: umbral COPASST/Vigía (10), periodo (2 años), mínimos del CCL por parte, plazos de citación/reunión/seguimiento del CCL, periodicidad de la evaluación periódica (12 meses), retorno por ausencia (90 días), adaptación del puesto (20 días). Parámetros nuevos no sembrados en catálogos ya publicados (producción): el código usa los valores por defecto.
- [ ] Composición del CCL por tamaño de empresa (Res. 3461 de 2025) y del COPASST por número de trabajadores: hoy solo paridad y mínimos configurables.
- [ ] El acceso de los miembros del CCL se liga al **correo de su ficha de trabajador** (debe coincidir con el de su usuario). Falta un vínculo explícito usuario–trabajador y portal del trabajador (Fase 6).
- [ ] Capacitaciones obligatorias del comité (CCL/COPASST) y reglamento del comité como documento firmado; brigada de emergencias (Fase 5).
- [ ] Asistencia por QR: el freno de intentos por IP es en memoria (por instancia). Pasar a un limitador compartido (BD/Redis) con Inngest/Edge Config.
- [ ] Votaciones: los enlaces personales se descargan en CSV una sola vez (o llegan por correo si hay RESEND_API_KEY); no hay reenvío individual ni recuperación de un enlace perdido (hay que regenerar la votación).
- [ ] Certificado PDF solo de asistencia/aprobación; QR de verificación pública del certificado.
- [ ] EPP: entregas con firma del trabajador en el dispositivo del encargado; firma en el celular del trabajador por QR (reutilizar el flujo de capacitación). Control de inventario por talla.
- [ ] Medicina: solo concepto, restricciones y recomendaciones (nunca historia clínica). Falta profesiograma (exámenes por cargo y periodicidad), recordatorios por correo y reporte de ausentismo exportable (Fase 6); el indicador de ausentismo del catálogo `indicators` se conectará en la Fase 4.
- [ ] Ausentismo: costo estimado digitado a mano (no se calcula con salario).
- [ ] Cifrado de salud: los accesos de lectura de evaluaciones y quejas se registran; falta vista de auditoría para el SUPER ADMIN con autorización del tenant (impersonación).

## Fase 4 (se agrega a medida que avanza)

- [ ] Accidentes: plazos de reporte ARL/EPS (2 días hábiles) e investigación (15 días) y composición del equipo investigador son `TODO-NORMA` (parámetros `at.*`, aún no sembrados en producción; aplican los valores por defecto del código).
- [ ] Accidentes: el FURAT se entrega como datos precargados para copiar al formato de la ARL (no se genera el PDF oficial ni se envía por la API de la ARL). Fotos del evento: pendientes de `BLOB_READ_WRITE_TOKEN`.
- [ ] Accidentes: remisión a la ARL solo registra la fecha; falta adjuntar el informe y notificar a la ARL por correo. Investigación sin árbol de causas gráfico (texto por línea).
- [ ] Enfermedad laboral: registro y calificación manual; falta seguimiento periódico y vínculo con medicina (vigilancia epidemiológica).

- [ ] Reportes de actos/condiciones (`/reportes`): sin fotos (pendiente de `BLOB_READ_WRITE_TOKEN`); el reporte anónimo no guarda autor, así que no hay retroalimentación al reportante. Falta mostrar la ubicación en un mapa.

- [ ] Inspecciones (`/inspecciones`): el catálogo `checklist_templates` está vacío (sin textos oficiales); cada empresa crea sus plantillas o importa las de plataforma cuando existan. Frecuencia/programación de inspecciones y recordatorios por sede, y firma del inspector: pendientes. Fotos de hallazgos: `BLOB_READ_WRITE_TOKEN`.
- [ ] Modo offline: la cola vive en IndexedDB y las pantallas de ejecución se guardan en el service worker (`sst-pages-v2`). Falta (a) borrar esa caché y la cola al cerrar sesión (el mensaje `clear-pages` ya existe en `public/sw.js`, no hay botón de cerrar sesión aún), (b) Background Sync para enviar con la app cerrada (hoy se envía al abrir la pantalla o al volver la red), (c) reportes de condiciones inseguras sin conexión (hoy solo inspecciones).

- [ ] Indicadores (`/indicadores`): se calculan solo los 6 del catálogo (frecuencia, severidad, mortalidad, prevalencia, incidencia, ausentismo médico). Todo `TODO-NORMA`: trabajadores = vinculados en algún momento del periodo (no el promedio mensual), días cargados por muerte = 6000 (`indicadores.dias_cargados_mortal`, NTC 3701), prevalencia solo cuenta casos calificados de origen laboral, metas vacías en el catálogo. Faltan indicadores de estructura y proceso (cumplimiento del plan anual, capacitación, inspecciones, CAPA a tiempo, EPP), exportación y la revisión por la dirección que consume estos resultados (Fase 5).
- [ ] Los parámetros provisionales nuevos de la Fase 4 (`at.*`, `inspecciones.plazo_accion_dias`, `indicadores.dias_cargados_mortal`) están en el seed pero no en catálogos ya publicados en producción: aplican los valores por defecto del código hasta publicar una versión nueva.

## Fase 5 (se agrega a medida que avanza)

- [ ] Emergencias (`/emergencias`): periodicidades (inspección de equipos 30 d, revisión del plan 12 meses, simulacro mínimo 1/año) y plazos son `TODO-NORMA` parametrizables (`emergencias.*`). Planos de rutas de evacuación: pendientes de `BLOB_READ_WRITE_TOKEN`. Brigada: la capacitación se digita; falta vincularla con las sesiones de capacitación y con la dotación del módulo EPP. Sin recordatorios por correo de vencimientos (Fase 6, notificaciones).

- [ ] Alto riesgo (`/alto-riesgo`): listas de verificación predeterminadas, duración máxima (8 h) y vigencia del certificado de alturas (12 meses, `alturas.vigencia_certificado_meses`) son provisionales `TODO-NORMA` (Res. 4272 de 2021: validar niveles de certificación, reentrenamiento y requisitos del coordinador). Sin firma de cierre ni de los ejecutores; sin plan de rescate/ATS como documentos adjuntos (Blob). Los permisos solo se programan el mismo día (no turnos que crucen la medianoche). Un solo usuario no puede solicitar y autorizar: la empresa necesita al menos dos con permiso `high_risk`.

- [ ] Riesgo químico (`/quimicos`): la matriz de incompatibilidades por pictograma (4 pares) y la revisión de la FDS cada 5 años son provisionales `TODO-NORMA`; la compatibilidad real depende de la sección 7 de cada FDS y de la clase química (ácidos vs. bases, etc.). No se adjuntan FDS ni fotos de etiquetas (Blob). Falta generador de etiquetas SGA y control de cantidades máximas almacenadas.

- [ ] PESV (`/pesv`, módulo opcional por plan): la lista preoperacional (9 ítems) y el plazo de 2 días por falla crítica son provisionales `TODO-NORMA`; las fórmulas oficiales de los indicadores y del reporte anual de autogestión (Res. 40595 de 2022) no están cargadas: hoy se entregan conteos base. Faltan kilometraje recorrido para la tasa de siniestralidad, preoperacional offline y por QR del vehículo, investigación del siniestro vial con el flujo de accidentes, plan de capacitación de conductores y nivel de riesgo del PESV (según el tamaño de la flota).

- [ ] Vigilancia y psicosocial (`/vigilancia`): los programas son registro y seguimiento, no hay criterios de ingreso por tipo de PVE ni protocolos (TODO-NORMA con el experto). Casos y seguimientos usan el permiso `medical` (cifrados, con registro de lectura). Psicosocial: periodicidad 12/24 meses y nivel "muy alto" como anual son `TODO-NORMA` (Res. 2646 de 2008 y 2764 de 2022); falta registrar los resultados por dominio/forma de la batería, los informes del psicólogo (Blob) y los casos individuales que remite la batería al PVE psicosocial.

- [ ] Auditoría interna (`/auditorias`) y revisión por la dirección (`/revision-direccion`): las entradas de la revisión (accidentalidad, indicadores, auditorías, acciones, autoevaluación, plan anual + 3 campos manuales) son una lectura provisional del art. 2.2.4.6.31 del Decreto 1072 `TODO-NORMA`: falta confirmar la lista exacta con el experto e incluir la política y los objetivos cuando exista el módulo de política (Fase 6, gestión documental). Sin PDF de informe/acta firmada (Fase 6). Las listas de verificación no vienen de un catálogo oficial: texto libre o criterios de la última autoevaluación. Hay que garantizar que la alta dirección tenga el permiso `management_review:approve` (rol ALTA_DIRECCION).
- [ ] Notificaciones: ninguna alerta de la Fase 5 (vencimientos de equipos, certificados, SOAT, licencias, simulacro anual, seguimiento de casos, batería psicosocial, auditoría atrasada) envía correo todavía; hoy son alertas en pantalla. Se resuelve con el servicio de notificaciones de la Fase 6.

## Fase 6 (se agrega a medida que avanza)

- [ ] Notificaciones (`/notificaciones`, `/calendario`): el barrido diario las genera a partir de ~35 alertas de los módulos de las Fases 4 y 5 (más evaluaciones médicas); faltan las de capacitación, EPP, comités (renovación), contratistas (seguridad social), autoevaluación y plan anual. Correo: solo al responsable SG-SST y administrador, de lo nuevo (crítico/atención) + resumen semanal los lunes; falta preferencias por usuario. **Push**: requiere `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` (`npx web-push generate-vapid-keys`) en Vercel; sin ellas el interruptor no aparece. El cron corre una vez al día (11:00 UTC): para avisos más oportunos, pasar a la cola (Inngest). Calendario: descarga .ics; falta suscripción por URL con token (Google Calendar la actualiza solo) y la agenda por sede.

- [ ] Documentos (`/documentos`): el contenido es texto (no hay carga de archivos PDF/Word hasta tener `BLOB_READ_WRITE_TOKEN`); el catálogo `doc_templates` está vacío (política, objetivos, procedimientos: sin textos oficiales). Periodicidad de revisión (12 meses) `TODO-NORMA`. Falta flujo de aprobación con varios niveles, distribución controlada y aceptación por trabajador en el portal (Fase 6.4), y exportar la lista maestra (6.3).

- [ ] Informes (`/informes`): 13 informes en PDF (con la marca), Excel y CSV, informe de investigación de accidentes, carpeta de inspección y exportación total. Pendiente: (a) las plantillas **no son editables por el SUPER ADMIN** (hoy el formato está en código; la spec lo pide editable porque los formatos oficiales cambian); (b) la carpeta de inspección se organiza por ciclo PHVA, no por estándar de la Res. 0312 (falta el catálogo oficial); (c) el registro de la autoevaluación en el Ministerio sigue manual (sin API pública): el informe entrega los datos y la app ya guarda la fecha de confirmación; (d) la versión "para la ARL" de la autoevaluación es el mismo informe; (e) el PDF usa fuente estándar (sin caracteres fuera de Latin-1) y no incluye el logo de la empresa (Blob); (f) las exportaciones son síncronas: para empresas grandes pasar a la cola con aviso al terminar.
- [ ] Exportación total: omite contenido cifrado (salud, quejas), firmas, huellas y la facturación; falta el procedimiento de autorización del titular para entregar esos datos (Ley 1581 de 2012) y el archivo cifrado de retención tras cancelar la cuenta.

- [ ] Portal del trabajador (`/portal`): el usuario se vincula con su ficha **por correo** (el de la cuenta debe coincidir con el de la ficha, sin distinguir mayúsculas); falta un vínculo explícito usuario-persona y la invitación masiva de trabajadores. No muestra firmas pendientes de EPP ni capacitaciones por QR, ni el concepto médico (solo tipo, estado y fechas). Los trabajadores necesitan un rol con acceso al portal (TRABAJADOR).
- [ ] Privacidad (`/privacidad`): el aviso es **genérico y provisional** (`TODO-NORMA`): la empresa debe adaptarlo con su asesor jurídico; versión y plazos (consulta 10 y reclamo 15 días hábiles) parametrizables. Falta forzar la autorización antes de usar la plataforma (hoy es un aviso en el portal), registro de la autorización por canal alterno (papel) y la supresión efectiva con las reglas de conservación de 20 años.
- [ ] Búsqueda global (`/buscar`): palabra clave en 8 módulos con filtro por permisos, sin salud ni quejas ni documentos de identidad (cifrados). Faltan los filtros guardados, búsqueda por sede y de capacitación/EPP/contratistas.
- [ ] Multi-sede: el filtro por sede/centro de trabajo no está en todos los módulos (hoy solo donde la sede es un dato del registro).

## Fase 7 (se agrega a medida que avanza)

- [x] Seguridad: CSP con nonce por solicitud (sin `unsafe-inline`/`unsafe-eval` en scripts), encabezados, límite de intentos compartido entre instancias (asistencia, votación, registro), `pnpm audit` sin vulnerabilidades (overrides de `zod` y `esbuild` transitivos). Pendiente: Sentry (`SENTRY_DSN`) para errores en producción; escaneo de dependencias en CI de forma periódica; prueba de penetración externa antes de producción.
- [x] Accesibilidad: axe-core (WCAG 2.1 A/AA) sin violaciones en la landing, registro, login y 28 pantallas de la empresa (escritorio y 375 px), objetivos táctiles de 44 px en botones y campos, enlace "Saltar al contenido" y foco visible. Pendiente: pantallas del panel SUPER ADMIN (requieren sesión con 2FA), estados con datos densos (tablas grandes), prueba con lector de pantalla real (NVDA/VoiceOver) y contraste de marcas blancas extremas (hoy se valida AA al guardar los colores).
- [x] Rendimiento: paginación por enlaces (`Pager`, `parsePage`) con límite/desplazamiento en la BD y conteo en personas, acciones y reportes de condiciones inseguras; calendario acotado en pantalla (200 próximas + 100 vencidas; el .ics lleva todo). Medido con 5000 acciones: inicio 0,3 s, acciones 0,3 s, CSV/Excel 0,2 s, PDF 1,8 s, carpeta de inspección 2 s. Pendiente: paginar el resto de listas (accidentes, inspecciones, documentos, alertas) cuando crezcan; medir LCP real en 4G con Lighthouse sobre el despliegue; comprimir imágenes en el cliente al activar las fotos (Blob); exportaciones largas a la cola.
- [x] E2E en CI: trabajo `e2e` (Postgres de servicio, build, migración, seed y Playwright en escritorio y móvil con reintento y reporte como artefacto). Verificado localmente contra una BD nueva: 102 pruebas pasan. Pendiente: confirmar la primera corrida real en GitHub Actions (instalación de Chromium, tiempos) y proteger la rama `main` exigiendo `check` y `e2e`.
- [x] Fecha "de hoy" en hora de Colombia (`todayYmd`): antes usaba UTC y entre 7 p. m. y medianoche los plazos se calculaban con la fecha de mañana. Corregido en el código y en las pruebas.
- [x] Cola offline: carrera entre la sincronización de la pantalla anterior y la recarga de la lista (la lista podía quedar vieja tras reconectar). Ahora la pantalla nueva se refresca una vez si detecta una sincronización reciente.
- [ ] CSP: `style-src` conserva `'unsafe-inline'` (atributos `style` de React y variables de marca blanca). Para endurecerlo habría que mover los estilos a clases y generar la hoja de marca con nonce.

## Resuelto

- [x] Enlace repo–Vercel, Neon, SUPER_ADMIN, DNS en Cloudflare.
