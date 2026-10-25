# SST — Plataforma SaaS SG-SST (Colombia)

Spec: `docs/PRODUCT_SPEC.md`. Arquitectura aprobada: `docs/ARQUITECTURA_PROPUESTA.md`.
Lee también `AGENTS.md`: esta versión de Next.js (16) difiere de lo habitual; consulta `node_modules/next/dist/docs/` antes de usar APIs de Next.

## Comandos

- `pnpm dev` · `pnpm build` · `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm format`
- `pnpm db:generate` (drizzle-kit) · `pnpm db:migrate` · `pnpm db:seed`
- Tests de BD requieren `TEST_DATABASE_URL` (Postgres 16 local: `service postgresql start`, BD `sst_test`, rol `sst_owner`).

## Convenciones

- TypeScript `strict`. Identificadores en inglés; UI y términos legales en español (`copasst`, `ccl`, `furat`).
- `proxy.ts` (no `middleware.ts`): Next 16 renombró middleware a proxy y corre en Node. Enruta por host y, en el dominio raíz, por el primer segmento de la ruta (`/{slug}/…` → `src/app/tenant/…`); fija `x-tenant-id`/`x-tenant-base` (y borra los que mande el cliente). Todo enlace de la app de empresa debe llevar la base: usa `Link`/`A` de `@/components/ui/link`, `useTenantPath()` en cliente y `await tp("/ruta")` en `redirect()` de servidor; URLs absolutas con `tenantUrl()` (`src/core/tenancy/urls.ts`). El slug no puede coincidir con una ruta de marketing: agrega toda carpeta nueva de `src/app/site` a `RESERVED_SLUGS` (lo verifica `hosts.test.ts`). Las empresas comparten origen en el dominio raíz: nada del cliente (IndexedDB, caché del service worker) debe mezclar empresas (ver `base` en `src/lib/offline-queue.ts`).
- IDs UUID v7. Dinero en `bigint` centavos. Fechas UTC; mostrar en `America/Bogota`.
- Borrado lógico (`deleted_at`) en registros de negocio; registros ♻ nunca se borran físicamente.
- Cada regla normativa cita su norma fuente en un comentario. Si hay duda: parametrizable + `TODO-NORMA`.
- Módulos en `src/modules/<dominio>/{schema,rules,queries,actions}.ts`; servicios compartidos en `src/core`.

## Multi-tenancy (crítico)

- Toda tabla de negocio tiene `tenant_id` + RLS forzada. Política: `tenant_id = app_tenant_id() OR app_is_platform()`.
- Acceso a datos de negocio SOLO con `withTenant(ctx, fn)` (SET LOCAL ROLE app_tenant + `app.tenant_id`). SUPER ADMIN: `withPlatform()` auditado.
- `systemDb` (sin rol restringido) es solo para tablas globales (auth, catálogos, integraciones). No usarlo para tablas con `tenant_id`.
- Tabla nueva con `tenant_id` ⇒ llamar `select enable_tenant_rls('tabla')` en su migración. El test `rls.test.ts` falla si falta.

## Secretos

- Solo `ENCRYPTION_MASTER_KEY`, `BLIND_INDEX_KEY`, `AUTH_SECRET` y similares viven en env. Credenciales de integraciones: cifradas en BD (sobre AES-256-GCM), enmascaradas en UI, nunca enviadas al navegador.

## Decisiones tomadas por el dueño del producto

- Dominio: `sst.zark.pro`. Cada empresa vive en `sst.zark.pro/{slug}` (**sin subdominios por empresa**) y puede conectar su dominio propio (`mi-empresa.com`, con el panel en la raíz, desde `/dominio`); `admin.` y `auth.` se mantienen. Neon en EE. UU.
- Precio/IVA (con %) y duración del Free Trial son configurables en el panel; Free Trial sin restricciones.
- Acceso de usuarios: correo (+ contraseña) o magic link. Personas naturales y jurídicas se facturan.
- Datos sensibles: acceso de soporte/SUPER ADMIN solo con autorización del tenant.
- Verificación de identidad con **AUCO**: complemento de plan pago (cargo fijo + variable por validación); credenciales administradas en el panel.
- Pruebas de Wompi/Siigo/AUCO reales se dejan para el final. Microsoft Entra, al final de la Fase 0.
- Sin experto SST por ahora: toda norma incierta queda `TODO-NORMA`; no hay textos oficiales cargados.
- Retención ♻: tras cancelar, archivo cifrado de solo conservación para registros obligatorios.

## Estado

Ver sección "Estado de fases" al final; actualizar al cerrar cada fase. Pendientes y decisiones abiertas: `docs/PENDIENTES.md` (actualizar al detectar o cerrar uno).

### Estado de fases

- Fase 0: **completa** (pendiente de tu revisión). Hecho: scaffold + CI, esquema + RLS + cifrado de sobre, centro de integraciones (Wompi, Siigo, AUCO, Google, Microsoft) con UI, auth (correo, magic link, 2FA, handoff por dominio central, Google cableado), proxy por host, marca blanca (contraste AA), layout móvil, PWA base.
  - Pendiente de Fase 0: probar Google/Microsoft con credenciales reales (Microsoft Entra: al final, por decisión del dueño); CSP con nonce y E2E en CI (Fase 7); Edge Config para caché de hosts (Fase 1, con API de dominios de Vercel); flujo de validación AUCO (Aucoface) y su webhook, en la fase del complemento.
  - E2E local: `pnpm build && pnpm db:migrate && pnpm db:seed && pnpm exec playwright test` (usa `.env.local`, hosts `*.localhost:3000`).

- Fase 1: **completa** (pendiente de tu revisión y de las pruebas reales de integraciones). Hecho: planes/cupones/IVA configurables, empresas + suscripciones (trial, mora, suspensión, cancelación), festivos/días hábiles, catálogos normativos versionados, Wompi (tokenización en navegador, cobro recurrente, reintentos, webhooks), Siigo (factura por pago, conciliación, notas crédito), portal de facturación de la empresa (`/facturacion`), vista SUPER ADMIN "Pagos y facturas", landing `/precios` y registro self-service (`/registro`).
  - Decisiones provisionales: los cambios de plan aplican en la próxima renovación (sin prorrateo; pendiente del dueño); motivo de nota crédito y responsabilidades fiscales/códigos DIAN `TODO-NORMA` (validar con contador); correo de factura sin PDF adjunto (se descarga del portal).
  - Pendiente: pruebas sandbox reales de Wompi/Siigo/AUCO; `RESEND_API_KEY`, `BLOB_READ_WRITE_TOKEN`, token de API de Vercel para dominios por empresa; impersonación de soporte; catálogo completo de municipios DANE.

- Fase 2: **completa** (pendiente de tu revisión y de cargar los catálogos oficiales). 2.4 matriz legal (`/matriz-legal`, base del SUPER ADMIN + evaluación por empresa, alerta de normas nuevas), 2.5 matriz de peligros GTC 45 (`/peligros`, versionada e inmutable al aprobar, valoración automática con escalas del catálogo, jerarquía de controles, revisión anual), 2.6 plan anual (`/plan-anual`, cronograma, avance, sugerencias desde mejoramiento y peligros, firma simple del empleador y del responsable). **2.3 autoevaluación 0312 hecha** (`/estandares`: ítems del catálogo por grupo con snapshot, calificación con evidencia/responsable/justificación, puntaje y rango, cierre inmutable, plan de mejoramiento automático, histórico con tendencia, recordatorios; **el catálogo `standards_0312` debe cargarse con el texto oficial**). **2.1 onboarding y 2.2 trabajadores/contratistas hechos** (`/personas`: ficha con documento cifrado + blind index, carga masiva CSV con reporte por fila, retiro conservando el registro, verificación mensual de seguridad social de contratistas, límite de trabajadores del plan). **2.1** (datos de empresa, clasificación 7/21/60 con aviso al cambiar, sedes, responsable con alerta de actualización de 20 h, colores de marca, módulo de permisos `company`, `requirePermission(modulo, acción)` en `src/core/auth/session.ts`).

- Fase 3: **completa** (pendiente de tu revisión; ver `docs/PENDIENTES.md`, todas las cifras normativas son provisionales). 3.1 capacitación (`/capacitacion`: cursos con evaluación, sesiones con asistencia por QR público y firma táctil con evidencia, certificado PDF, matriz de competencias por cargo con vencimientos), 3.2 EPP (`/epp`: catálogo, inventario, matriz por cargo, entregas con firma y reposición), 3.3 comités (`/comites`: COPASST/Vigía con elecciones electrónicas de voto secreto, actas, compromisos, renovación; `/convivencia`: CCL con quejas cifradas, trámite con plazos, elegibilidad, acuerdo de confidencialidad, accesos registrados; `/acoso-sexual`: canal separado que nunca recibe el CCL), 3.4 medicina del trabajo (`/medicina`: evaluaciones por tipo, concepto/restricciones cifrados, tarea de adaptación a 20 días, retorno por ausencia >90 días, bloqueo de pruebas de embarazo/VIH/serología, envío a la IPS, ausentismo).
  - Utilidades nuevas: `src/core/signature` (firma táctil validada + huella), `src/components/ui/{select,field,signature-pad}`, `src/lib/{dates,form-state}`.

- Fase 4: **completa** (pendiente de tu revisión; ver `docs/PENDIENTES.md`, las cifras normativas son provisionales). 4.1 CAPA (`/acciones`, escalamiento por mora, verificación de eficacia, cron diario) y 4.2 accidentes e incidentes (`/accidentes`: plazo ARL/EPS en días hábiles, investigación con equipo/5 porqués, plan de acción en CAPA, remisión a la ARL, lecciones, datos FURAT, enfermedad laboral) hechos. 4.3 reporte de actos/condiciones inseguras (`/reportes`, anónimo, geolocalización, conversión a CAPA) hecho. 4.4 inspecciones (`/inspecciones`: plantillas propias, cola offline en IndexedDB con envío idempotente por `offlineId` a `/api/inspecciones/sync`, pantallas de ejecución cacheadas por el service worker, hallazgos → CAPA) hecho. 4.5 indicadores (`/indicadores`: fórmulas del catálogo calculadas con datos reales, tendencia, meta por empresa y análisis por periodo) hecho.

- Fase 5: **completa** (pendiente de tu revisión; ver `docs/PENDIENTES.md`, toda cifra normativa es provisional). 5.1 emergencias (`/emergencias`: plan por sede, brigada, equipos con vencimiento/inspección, simulacros → CAPA), 5.2 alto riesgo (`/alto-riesgo`: permisos firmados con autorización por otra persona, certificados y equipos de alturas, tipos configurables), 5.3 químicos (`/quimicos`: inventario SGA, FDS, etiquetado, matriz de compatibilidad provisional), 5.4 PESV (`/pesv`, módulo opcional por plan: vehículos, conductores, preoperacional, siniestros, datos del reporte anual), 5.5 vigilancia (`/vigilancia`: PVE con casos cifrados y registro de lecturas; `/vigilancia/psicosocial`: batería, periodicidad, plan de intervención → CAPA), 5.6 auditoría interna (`/auditorias`) y revisión por la dirección (`/revision-direccion`, firma que congela y crea acciones).
  - Utilidades nuevas: `src/components/forms/action-form.tsx` (`ActionForm` declarativo con campos como datos, `RunButton`), `src/core/db/test-utils` acepta `modules` del plan.

- Fase 6: **completa** (pendiente de tu revisión; ver `docs/PENDIENTES.md`). 6.1 notificaciones (`/notificaciones`: barrido diario del cron → alertas in-app, correo de lo nuevo y resumen semanal los lunes, push PWA con llaves VAPID; `/calendario` con descarga .ics), 6.2 documentos (`/documentos`: lista maestra, versiones, aprobación firmada por otra persona, política, constancia de lectura; trigger de inmutabilidad), 6.3 informes (`/informes`: 13 informes en PDF/Excel/CSV, informe de investigación, carpeta de inspección ZIP con índice y huellas, exportación total), 6.4 portal del trabajador (`/portal`), privacidad Ley 1581 (`/privacidad`: autorización, solicitudes de titulares), búsqueda global (`/buscar`).
  - Utilidades nuevas: `src/core/reports/{pdf,xlsx,csv,zip,types}.ts` (sin dependencias pesadas: `fflate` + `pdf-lib`), `src/modules/notifications/{collect,service,rules}.ts` (para sumar una alerta, agregarla en `collectAlerts`), `permissionList` en `src/core/rbac/can.ts`. Variables nuevas: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

- Cambio de arquitectura (empresa por ruta, no por subdominio): hecho. `sst.zark.pro/{slug}` (login en `/{slug}/login`), dominio propio opcional por empresa (`/dominio`, panel en la raíz), sesión de un solo origen en el dominio raíz (el handoff por `auth.` queda para Google/Microsoft y dominios propios, con `slug` para el dominio raíz). Pruebas: `src/proxy.test.ts`, `hosts.test.ts`, `flow.test.ts`, E2E con `TENANT = http://localhost:3000/demo`.

- Fase 7: **completa** (pendiente de tu revisión; ver `docs/PENDIENTES.md`). Seguridad (CSP con nonce, límite de intentos compartido, `pnpm audit` limpio), accesibilidad (axe en E2E), paginación, E2E en CI (`.github/workflows/ci.yml`), fecha de hoy en hora de Colombia, `/usuarios` (invitaciones y roles) y documentación (`README.md`, `docs/OPERACION.md`, `docs/GUIA_USUARIO.md`).
  - Pendiente: primera corrida real en GitHub Actions y protección de rama; Sentry; pruebas reales de Wompi/Siigo/AUCO; catálogos oficiales y validación de `TODO-NORMA`.

- Fase 8 (UX): **hecha** (pendiente de tu revisión). Todos los formularios de agregar/editar van en modales (`FormModal`, `src/components/ui/modal.tsx`: `<dialog>` nativo, hoja inferior en móvil, contenido montado solo al abrir). `useActionState` de `@/components/forms/use-form-state` cierra el modal y muestra un aviso (`toast`) al guardar bien (`keepOpen` en el `FormState` lo evita, p. ej. reporte de carga masiva). Menú agrupado por módulos según permisos (`src/components/layout/nav-config.ts`, una sola definición para barra lateral, menú móvil e inicio), barra superior con búsqueda y alertas, inicio con accesos rápidos. Panel SUPER ADMIN: planes, cupones y empresas también en modales. E2E: `openModal(page, "Texto del botón")` de `e2e/helpers.ts`.
  - Quedan inline a propósito: onboarding (asistente), conformar comités, calificación de ítems de estándares, formularios públicos (radicar queja/acoso, asistencia, voto) y login.

- Identidad ZarK: **hecha**. Paleta por defecto azul `#001953` (primario/secundario: botones, barra lateral y superior) y naranja `#ff5800` (acento: ítem activo, indicadores, CTA con texto oscuro), definida en `ZARK_BRAND` (`src/core/branding/contrast.ts`), en los tokens de `globals.css` y como default de `tenant_branding` (migración `0064_marca_zark` también migra las empresas que nunca cambiaron la paleta). Cada empresa puede sobrescribirla con su marca (contraste AA validado); en tema oscuro un primario oscuro pasa al acento. Logotipos en `public/brand/zark-logo-{white,navy}.png` y `zark-mark.png` (`BrandLogo` en `src/components/ui/brand-logo.tsx`: `auto` cambia según el tema); íconos PWA y favicon salen del isotipo. La empresa que cargue su logo lo ve en la barra lateral sobre una pastilla blanca con su nombre; si no, solo el logo de ZarK (sin texto). **Solo el tema claro usa la paleta ZarK**: el tema oscuro conserva la de siempre (verde azulado/pizarra, `DARK_DEFAULT_BRAND`) salvo que la empresa defina marca propia. La barra lateral/superior se pintan con las variables `--shell-*` y `--nav-active-*` (claro: azul y acento oscurecido lo mínimo para texto blanco AA; oscuro: tarjeta y primario). Scroll del menú: clase `.sidebar-scroll`.

- Centro de ayuda (documentación de usuario **dentro de la app**): **hecho**. `/ayuda` (empresas) y `/ayuda` del panel de administración; contenido en `src/modules/help/content/*.ts`, vistas en `src/components/help`. Botón **?** de la barra superior = ayuda contextual (primera ruta del módulo → guía). **Al agregar una pantalla al menú, agrega su guía** (`help.test.ts` lo exige). `docs/GUIA_USUARIO.md` solo apunta a ella.

## Despliegue (Vercel)

- Proyecto Vercel `sst` (equipo ZarK, `prj_kpoOB6LCtrFYpXrk1s6oXhU1aQfm`), Next.js, Node 22, región iad1. Dominios agregados: `sst.zark.pro`, `admin.`, `auth.` (el wildcard `*.sst.zark.pro` ya no se usa: las empresas van por ruta; los dominios propios se agregan por API).
- Variables de infraestructura ya cargadas (production/preview): `NEXT_PUBLIC_ROOT_DOMAIN`, `ENCRYPTION_MASTER_KEY`, `BLIND_INDEX_KEY`, `AUTH_SECRET`, `CRON_SECRET`, `MAIL_FROM`.
- Neon ya instalado (DATABASE_URL y DATABASE_URL_UNPOOLED, sensibles: no se pueden leer fuera de Vercel). Build de Vercel = `pnpm vercel-build`: en producción migra + seed idempotente (SUPER ADMIN, integraciones; sin empresa demo) antes de `next build`; preview no toca la BD.
- Pendiente: enlazar el repo zarktec/sst al proyecto (Settings → Git; la API no permite enlazar un proyecto existente), `RESEND_API_KEY`, `BLOB_READ_WRITE_TOKEN`, `SUPER_ADMIN_EMAIL/PASSWORD` y DNS de `sst.zark.pro`, `admin.` y `auth.` en Cloudflare (sin wildcard: ya no se necesita).
