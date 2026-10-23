CREATE TABLE "sst_responsible" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"id_type" text NOT NULL,
	"id_number" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"profile" text NOT NULL,
	"license_number" text,
	"license_issuer" text,
	"license_valid_until" date,
	"course50h_date" date,
	"course50h_entity" text,
	"refresher20h_date" date,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_alert" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"message" text NOT NULL,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "workers_count" integer;--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "standards_group" integer;--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "onboarding_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sst_responsible" ADD CONSTRAINT "sst_responsible_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_alert" ADD CONSTRAINT "tenant_alert_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sst_responsible_tenant_idx" ON "sst_responsible" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sst_responsible_active_uq" ON "sst_responsible" USING btree ("tenant_id") WHERE active;--> statement-breakpoint
CREATE INDEX "tenant_alert_tenant_idx" ON "tenant_alert" USING btree ("tenant_id","resolved_at");