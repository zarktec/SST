CREATE TYPE "public"."payment_status" AS ENUM('pending', 'approved', 'declined', 'voided', 'error');--> statement-breakpoint
CREATE TABLE "payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"period" "billing_period" NOT NULL,
	"period_key" text NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"source_role" text DEFAULT 'default' NOT NULL,
	"payment_source_id" uuid,
	"reference" text NOT NULL,
	"provider" text DEFAULT 'wompi' NOT NULL,
	"provider_tx_id" text,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"net_cents" bigint NOT NULL,
	"vat_cents" bigint NOT NULL,
	"total_cents" bigint NOT NULL,
	"discount_cents" bigint DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'COP' NOT NULL,
	"coupon_id" uuid,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"decline_reason" text,
	"next_retry_at" timestamp with time zone,
	"provider_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_source" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"provider" text DEFAULT 'wompi' NOT NULL,
	"provider_source_id" text NOT NULL,
	"type" text NOT NULL,
	"brand" text,
	"last4" text,
	"exp_month" integer,
	"exp_year" integer,
	"holder" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "webhook_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"event_key" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_subscription_id_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscription"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_plan_id_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plan"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_payment_source_id_payment_source_id_fk" FOREIGN KEY ("payment_source_id") REFERENCES "public"."payment_source"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_coupon_id_coupon_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupon"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_source" ADD CONSTRAINT "payment_source_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_reference_uq" ON "payment" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_cycle_attempt_uq" ON "payment" USING btree ("subscription_id","period_key","attempt");--> statement-breakpoint
CREATE INDEX "payment_tenant_idx" ON "payment" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "payment_retry_idx" ON "payment" USING btree ("status","next_retry_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_provider_tx_uq" ON "payment" USING btree ("provider","provider_tx_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_source_provider_uq" ON "payment_source" USING btree ("provider","provider_source_id");--> statement-breakpoint
CREATE INDEX "payment_source_tenant_idx" ON "payment_source" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_event_uq" ON "webhook_event" USING btree ("provider","event_key");--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_default_payment_source_id_payment_source_id_fk" FOREIGN KEY ("default_payment_source_id") REFERENCES "public"."payment_source"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_backup_payment_source_id_payment_source_id_fk" FOREIGN KEY ("backup_payment_source_id") REFERENCES "public"."payment_source"("id") ON DELETE no action ON UPDATE no action;