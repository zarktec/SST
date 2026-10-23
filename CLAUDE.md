# SST — Plataforma SaaS SG-SST (Colombia)

Spec: `docs/PRODUCT_SPEC.md`. Arquitectura aprobada: `docs/ARQUITECTURA_PROPUESTA.md`.
Lee también `AGENTS.md`: esta versión de Next.js (16) difiere de lo habitual; consulta `node_modules/next/dist/docs/` antes de usar APIs de Next.

## Comandos

- `pnpm dev` · `pnpm build` · `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm format`
- `pnpm db:generate` (drizzle-kit) · `pnpm db:migrate` · `pnpm db:seed`
- Tests de BD requieren `TEST_DATABASE_URL` (Postgres 16 local: `service postgresql start`, BD `sst_test`, rol `sst_owner`).

## Convenciones

- TypeScript `strict`. Identificadores en inglés; UI y términos legales en español (`copasst`, `ccl`, `furat`).
- `proxy.ts` (no `middleware.ts`): Next 16 renombró middleware a proxy y corre en Node.
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

- Dominio: `sst.zark.pro` (subdominios por empresa, `admin.`, `auth.`). Neon en EE. UU.
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

- Fase 2 (en curso): **2.3 autoevaluación 0312 hecha** (`/estandares`: ítems del catálogo por grupo con snapshot, calificación con evidencia/responsable/justificación, puntaje y rango, cierre inmutable, plan de mejoramiento automático, histórico con tendencia, recordatorios; **el catálogo `standards_0312` debe cargarse con el texto oficial**). **2.1 onboarding y 2.2 trabajadores/contratistas hechos** (`/personas`: ficha con documento cifrado + blind index, carga masiva CSV con reporte por fila, retiro conservando el registro, verificación mensual de seguridad social de contratistas, límite de trabajadores del plan). **2.1** (datos de empresa, clasificación 7/21/60 con aviso al cambiar, sedes, responsable con alerta de actualización de 20 h, colores de marca, módulo de permisos `company`, `requirePermission(modulo, acción)` en `src/core/auth/session.ts`). Pendiente: 2.4 matriz legal, 2.5 matriz GTC 45, 2.6 plan anual.

## Despliegue (Vercel)

- Proyecto Vercel `sst` (equipo ZarK, `prj_kpoOB6LCtrFYpXrk1s6oXhU1aQfm`), Next.js, Node 22, región iad1. Dominios agregados: `sst.zark.pro`, `admin.`, `auth.` y `*.sst.zark.pro`.
- Variables de infraestructura ya cargadas (production/preview): `NEXT_PUBLIC_ROOT_DOMAIN`, `ENCRYPTION_MASTER_KEY`, `BLIND_INDEX_KEY`, `AUTH_SECRET`, `CRON_SECRET`, `MAIL_FROM`.
- Neon ya instalado (DATABASE_URL y DATABASE_URL_UNPOOLED, sensibles: no se pueden leer fuera de Vercel). Build de Vercel = `pnpm vercel-build`: en producción migra + seed idempotente (SUPER ADMIN, integraciones; sin empresa demo) antes de `next build`; preview no toca la BD.
- Pendiente: enlazar el repo zarktec/sst al proyecto (Settings → Git; la API no permite enlazar un proyecto existente), `RESEND_API_KEY`, `BLOB_READ_WRITE_TOKEN`, `SUPER_ADMIN_EMAIL/PASSWORD` y DNS en Cloudflare (wildcard requiere delegar `sst.zark.pro` a los nameservers de Vercel).
