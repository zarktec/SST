CREATE TYPE "public"."invoice_kind" AS ENUM('invoice', 'credit_note');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('pending', 'processing', 'issued', 'accepted', 'rejected', 'error');--> statement-breakpoint
CREATE TABLE "billing_profile" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"person_type" text NOT NULL,
	"id_type" text NOT NULL,
	"identification" text NOT NULL,
	"check_digit" text,
	"legal_name" text NOT NULL,
	"address" text NOT NULL,
	"state_code" text NOT NULL,
	"city_code" text NOT NULL,
	"postal_code" text,
	"phone" text NOT NULL,
	"invoice_email" text NOT NULL,
	"fiscal_responsibilities" text[] DEFAULT '{}' NOT NULL,
	"vat_responsible" boolean DEFAULT false NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"kind" "invoice_kind" DEFAULT 'invoice' NOT NULL,
	"ref_invoice_id" uuid,
	"provider" text DEFAULT 'siigo' NOT NULL,
	"provider_id" text,
	"number" text,
	"cufe" text,
	"status" "invoice_status" DEFAULT 'pending' NOT NULL,
	"dian_status" text,
	"reason" text,
	"total_cents" bigint NOT NULL,
	"errors" jsonb,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp with time zone,
	"pdf" "bytea",
	"pdf_size" integer,
	"issued_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_profile" ADD CONSTRAINT "billing_profile_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_payment_kind_uq" ON "invoice" USING btree ("payment_id","kind");--> statement-breakpoint
CREATE INDEX "invoice_tenant_idx" ON "invoice" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "invoice_status_idx" ON "invoice" USING btree ("status","next_retry_at");