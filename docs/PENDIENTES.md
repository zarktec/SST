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

## Resuelto

- [x] Enlace repo–Vercel, Neon, SUPER_ADMIN, DNS en Cloudflare.
