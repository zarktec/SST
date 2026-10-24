CREATE TABLE "data_consent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"version" text NOT NULL,
	"general" boolean NOT NULL,
	"sensitive" boolean NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "data_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"user_name" text NOT NULL,
	"user_email" text NOT NULL,
	"type" text NOT NULL,
	"detail" text NOT NULL,
	"due_on" date NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolution" text,
	"resolved_by" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "data_consent" ADD CONSTRAINT "data_consent_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_request" ADD CONSTRAINT "data_request_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "data_consent_uq" ON "data_consent" USING btree ("tenant_id","user_id","version");--> statement-breakpoint
CREATE INDEX "data_request_tenant_idx" ON "data_request" USING btree ("tenant_id","status","created_at");