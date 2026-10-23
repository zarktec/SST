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

Ver sección "Estado de fases" al final; actualizar al cerrar cada fase.

### Estado de fases

- Fase 0: en curso.
