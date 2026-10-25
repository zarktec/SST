ALTER TABLE "tenant_branding" ALTER COLUMN "primary" SET DEFAULT '#001953';--> statement-breakpoint
ALTER TABLE "tenant_branding" ALTER COLUMN "secondary" SET DEFAULT '#001953';--> statement-breakpoint
ALTER TABLE "tenant_branding" ALTER COLUMN "accent" SET DEFAULT '#ff5800';
--> statement-breakpoint
-- Identidad ZarK: las empresas que nunca cambiaron la paleta por defecto (verde/gris/ámbar) pasan a la de ZarK.
UPDATE "tenant_branding" SET "primary" = '#001953', "secondary" = '#001953', "accent" = '#ff5800'
WHERE "primary" = '#0f766e' AND "secondary" = '#1e293b' AND "accent" = '#f59e0b';
