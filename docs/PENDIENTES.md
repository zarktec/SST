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

## Resuelto

- [x] Enlace repo–Vercel, Neon, SUPER_ADMIN, DNS en Cloudflare.
