CREATE TABLE "audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"title" text NOT NULL,
	"scope" text,
	"planned_on" date NOT NULL,
	"performed_on" date,
	"auditor_name" text,
	"committee_participant" text,
	"checklist" jsonb NOT NULL,
	"report" text,
	"status" text DEFAULT 'planned' NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "management_review" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"held_on" date NOT NULL,
	"attendees" text NOT NULL,
	"inputs" jsonb NOT NULL,
	"legal_changes" text,
	"stakeholder_comms" text,
	"objectives_compliance" text,
	"conclusions" text,
	"decisions" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"signed_by" text,
	"signed_name" text,
	"signature" text,
	"evidence_hash" text,
	"signed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit" ADD CONSTRAINT "audit_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "management_review" ADD CONSTRAINT "management_review_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_tenant_idx" ON "audit" USING btree ("tenant_id","year","status");--> statement-breakpoint
CREATE INDEX "management_review_tenant_idx" ON "management_review" USING btree ("tenant_id","year");