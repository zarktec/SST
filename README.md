# SST — Plataforma SaaS del SG-SST (Colombia)

Plataforma multiempresa para montar, administrar y demostrar el cumplimiento del Sistema de Gestión de Seguridad y Salud en el
Trabajo: estándares mínimos, matrices, capacitación, comités, medicina del trabajo, accidentes e investigación, inspecciones,
indicadores, emergencias, alto riesgo, químicos, PESV, vigilancia epidemiológica, auditoría, revisión por la dirección, documentos,
informes regulatorios y portal del trabajador. Facturación con Wompi y Siigo.

## Documentación

| Documento                                                          | Para quién                       |
| ------------------------------------------------------------------ | -------------------------------- |
| [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md)                     | Qué se construye y por qué       |
| [`docs/ARQUITECTURA_PROPUESTA.md`](docs/ARQUITECTURA_PROPUESTA.md) | Arquitectura aprobada            |
| [`docs/GUIA_USUARIO.md`](docs/GUIA_USUARIO.md)                     | Usuarios de las empresas         |
| [`docs/OPERACION.md`](docs/OPERACION.md)                           | Quien despliega y opera          |
| [`docs/PENDIENTES.md`](docs/PENDIENTES.md)                         | Decisiones abiertas y pendientes |
| [`CLAUDE.md`](CLAUDE.md)                                           | Convenciones y estado por fase   |

## Inicio rápido (desarrollo)

Requisitos: Node 22, pnpm 10 y PostgreSQL 16.

```bash
pnpm install
cp .env.example .env.local     # completa NEXT_PUBLIC_ROOT_DOMAIN=localhost:3000, DATABASE_URL y las llaves (ver docs/OPERACION.md)
pnpm db:migrate && pnpm db:seed
pnpm dev                       # http://localhost:3000 · demo.localhost:3000 · admin.localhost:3000
```

La empresa demo (`demo.localhost:3000`) entra con `demo@demo.test` / `DemoClave-2026!` y el SUPER ADMIN (`admin.localhost:3000`) con
las variables `SUPER_ADMIN_EMAIL` y `SUPER_ADMIN_PASSWORD` (activa 2FA en el primer ingreso).

## Comandos

| Comando                                              | Qué hace                                                                      |
| ---------------------------------------------------- | ----------------------------------------------------------------------------- |
| `pnpm lint` · `pnpm typecheck` · `pnpm format:check` | Calidad estática                                                              |
| `pnpm test`                                          | Pruebas unitarias y de BD (requiere `TEST_DATABASE_URL`)                      |
| `pnpm build && pnpm exec playwright test`            | E2E en escritorio y 375 px, accesibilidad y seguridad (BD migrada y sembrada) |
| `pnpm db:generate`                                   | Genera una migración Drizzle tras cambiar el esquema                          |

El CI (`.github/workflows/ci.yml`) corre todo lo anterior en cada push.
