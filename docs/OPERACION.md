# Guía de operación

Para quien despliega, configura y opera la plataforma. Complementa `CLAUDE.md` (convenciones) y `docs/PENDIENTES.md`.

## 1. Arquitectura en una página

- **Next.js 16** (App Router, Node 22) en un solo proyecto de Vercel. `src/proxy.ts` enruta por host: raíz → `/site`, `admin.` →
  `/platform`, `auth.` → `/central`, cualquier otro subdominio o dominio propio → `/tenant` (la empresa se resuelve por host).
- **PostgreSQL (Neon)** con **RLS forzada**: toda tabla de negocio tiene `tenant_id`; la app cambia a `app_tenant` por transacción
  (`withTenant`) o a `app_platform` (`withPlatform`, auditado). `systemDb` solo toca tablas globales.
- **Cifrado de sobre** AES-256-GCM (`ENCRYPTION_MASTER_KEY`) para salud, quejas y documento de identidad; blind index para buscar.
- **Better Auth** (correo + contraseña, enlace mágico, 2FA, Google) con dominio central de autenticación.
- **Integraciones** (Wompi, Siigo, AUCO, Google, Microsoft): credenciales cifradas en BD, administradas en el panel SUPER ADMIN.
- **Cron**: `/api/cron/daily` (11:00 UTC = 6:00 a. m. Colombia) corre suscripciones, reintentos de cobro, facturas, escalamiento de
  acciones, notificaciones, dominios y alertas de integraciones. Cada tarea es independiente: una falla no detiene las demás.

## 2. Variables de entorno

Solo infraestructura (las credenciales de integraciones van en el panel). Ver `.env.example`.

| Variable                                                  | Obligatoria | Notas                                                                                          |
| --------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_ROOT_DOMAIN`                                 | sí          | `sst.zark.pro`; en local `localhost:3000`                                                      |
| `DATABASE_URL` / `DATABASE_URL_UNPOOLED`                  | sí          | La inyecta la integración de Neon; las migraciones usan la directa                             |
| `ENCRYPTION_MASTER_KEY`                                   | sí          | 32 bytes en base64 (`openssl rand -base64 32`). **Perderla = perder los datos cifrados**       |
| `BLIND_INDEX_KEY`                                         | sí          | Igual formato. Cambiarla invalida las búsquedas por documento (hay que recalcular los índices) |
| `AUTH_SECRET`                                             | sí          | Mínimo 32 caracteres aleatorios                                                                |
| `CRON_SECRET`                                             | sí          | Vercel lo envía como `Authorization: Bearer`                                                   |
| `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`              | 1.ª vez     | Crea el SUPER ADMIN en el seed; cambia la contraseña y activa 2FA al entrar                    |
| `RESEND_API_KEY`, `MAIL_FROM`                             | producción  | Sin la llave los correos solo se imprimen en el log                                            |
| `BLOB_READ_WRITE_TOKEN`                                   | pendiente   | Habilita fotos, planos y archivos adjuntos (hoy no hay carga de archivos)                      |
| `VAPID_PUBLIC_KEY`/`PRIVATE_KEY`/`SUBJECT`                | opcional    | Push de la PWA: `npx web-push generate-vapid-keys`                                             |
| `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` | opcional    | Dominios propios de las empresas                                                               |
| `SENTRY_DSN`                                              | pendiente   | Aún no está cableado                                                                           |

Rotación de la llave maestra: definir `ENCRYPTION_MASTER_KEY_V2` y `ENCRYPTION_KEY_VERSION=2`; los datos nuevos usan la V2 y los
viejos siguen leyéndose con la V1 (el sobre guarda su versión). Conservar ambas llaves mientras existan datos de la V1.

## 3. Despliegue (Vercel + Neon)

1. Proyecto `sst` en el equipo ZarK, repositorio `zarktec/sst` enlazado (Settings → Git), región `iad1`, Node 22.
2. Instalar la integración de Neon (inyecta `DATABASE_URL`). Cargar las variables de la sección 2 en Production y Preview.
3. **Build** = `pnpm vercel-build`: en producción aplica migraciones y un seed idempotente (SUPER ADMIN e integraciones; sin empresa
   demo) **antes** de compilar; si la migración falla, el despliegue falla y no sale código incompatible con el esquema. Preview no
   toca la base de datos (usar una rama de Neon por preview).
4. Dominios: `sst.zark.pro`, `admin.`, `auth.` y `*.sst.zark.pro`. El comodín exige delegar `sst.zark.pro` a los nameservers de
   Vercel (desde Cloudflare: registros NS del subdominio).
5. Verificar con `GET /offline` (200) y el ingreso en `admin.sst.zark.pro`.

> Cada push a una rama conectada despliega a producción mientras la rama de producción no sea `main` (revisa Settings → Git).

## 4. Base de datos

- **Migraciones**: `pnpm db:generate` crea la migración; toda tabla con `tenant_id` llama `select enable_tenant_rls('tabla')` en su
  migración (el test `rls.test.ts` falla si falta). Los registros ♻ revocan `DELETE` a `app_tenant`.
- **Respaldo**: Neon guarda historial para restauración a un punto en el tiempo (PITR); la ventana depende del plan de Neon.
- **Restaurar** (procedimiento):
  1. En la consola de Neon: rama del proyecto → _Restore_ → elegir fecha/hora anterior al incidente (se crea una rama nueva; no se
     pierde la actual).
  2. Verificar en la rama restaurada (conteos de `tenant`, `corrective_action`, `incident`).
  3. Apuntar `DATABASE_URL`/`DATABASE_URL_UNPOOLED` de Vercel a la rama restaurada, o promoverla a principal, y redesplegar.
  4. Pedir a las empresas que revisen lo registrado después del punto de restauración.
  - Ensayar este procedimiento en una rama de prueba **antes** de salir a producción y cada trimestre.
- **Retención**: los registros ♻ (Decreto 1072, art. 2.2.4.6.13: 20 años) nunca se borran físicamente. Tras cancelar una empresa debe
  quedar un archivo cifrado de solo conservación (pendiente de construir, ver `docs/PENDIENTES.md`).

## 5. Operación diaria

| Qué revisar             | Dónde                                                                            |
| ----------------------- | -------------------------------------------------------------------------------- |
| El cron corrió          | Vercel → Cron Jobs → `/api/cron/daily`; la respuesta trae `errors[]` por tarea   |
| Cobros y facturas       | Panel SUPER ADMIN → _Pagos y facturas_; conciliación diaria con Siigo            |
| Credenciales por vencer | Panel SUPER ADMIN → _Integraciones_ (alertas del cron)                           |
| Correo                  | Resend → _Logs_; sin `RESEND_API_KEY` los correos salen al log como `[mail:dev]` |
| Errores de ejecución    | Vercel → _Runtime Logs_ (Sentry pendiente)                                       |

### Procedimientos frecuentes

- **Pago rechazado**: el sistema reintenta y avisa; el cliente puede _Pagar ahora_ en `/facturacion`. Si hay mora larga, la empresa pasa a
  solo lectura (suspendida) y luego a cancelada, conservando sus datos.
- **Webhook de Wompi** (`/api/webhooks/wompi`): firma verificada e idempotente. Si no llegan eventos, revisar el secreto de eventos en
  _Integraciones_ y reenviar desde el panel de Wompi.
- **Crear otro SUPER ADMIN**: ajustar `SUPER_ADMIN_EMAIL`/`PASSWORD` y ejecutar `pnpm db:seed` (idempotente) con `DATABASE_URL` de
  producción, o invitarlo desde el panel.
- **Un usuario no ve un módulo**: revisar el rol (permisos módulo × acción) en _Usuarios y roles_; el portal y las alertas filtran por permisos.
- **Forzar el barrido de alertas**: `curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/daily`.
- **Exportar todos los datos de una empresa** (portabilidad): el administrador de la empresa en _Informes → Exportación total_.

## 6. Seguridad

- **Cabeceras**: CSP con nonce por solicitud (scripts sin `unsafe-inline`), HSTS, `X-Frame-Options: DENY`, `nosniff`,
  `Referrer-Policy`, `Permissions-Policy`. `connect-src` permite solo Wompi (tokenización desde el navegador).
- **Límites de intentos** compartidos entre instancias (tabla `rate_limit`) en asistencia por QR, votación y registro; Better Auth
  limita el inicio de sesión.
- **Datos sensibles**: cifrados; cada lectura de salud/quejas queda en `sensitive_access_log`. El acceso de soporte requiere
  autorización del tenant (impersonación pendiente).
- **Dependencias**: `pnpm audit --prod --audit-level=high` corre en el CI. Revisar mensualmente y tras cada actualización.
- **Lista previa a producción**: ver la sección 8.

## 7. Calidad y pruebas

```bash
pnpm lint && pnpm typecheck && pnpm format:check
TEST_DATABASE_URL=postgres://sst_owner:sst_owner@localhost:5432/sst_test pnpm test
pnpm build && pnpm db:migrate && pnpm db:seed && pnpm exec playwright test   # E2E
```

El E2E usa `*.localhost:3000` (Chromium lo resuelve a loopback), la empresa demo y el SUPER ADMIN del seed. Cubre escritorio y 375 px,
accesibilidad con axe (WCAG 2.1 AA), CSP y los flujos de cada módulo. Los reportes de fallos de CI quedan como artefacto.

## 8. Lista de verificación antes de salir a producción

- [ ] Variables de la sección 2 cargadas (llaves generadas y **guardadas fuera de Vercel** en un gestor de secretos).
- [ ] Repositorio enlazado, rama de producción definida, protección de `main` exigiendo `check` y `e2e`.
- [ ] DNS delegado y certificados emitidos para `sst.zark.pro`, `admin.`, `auth.` y el comodín.
- [ ] Credenciales reales de Wompi, Siigo y AUCO en _Integraciones_ y **pruebas sandbox completas** (decisión del dueño: al final).
- [ ] Planes, precios, IVA y duración del trial configurados en el panel.
- [ ] `RESEND_API_KEY` y dominio de correo verificado (SPF/DKIM).
- [ ] Catálogos oficiales cargados (estándares 0312, matriz legal, GTC 45, listas de verificación) y validación del experto SST de
      todo lo marcado `TODO-NORMA`.
- [ ] Restauración de Neon ensayada en una rama de prueba.
- [ ] `BLOB_READ_WRITE_TOKEN`, VAPID y Sentry decididos (cargarlos o aceptar la ausencia).
- [ ] Prueba de penetración externa y revisión legal del aviso de privacidad y los términos.
