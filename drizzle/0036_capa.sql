CREATE TABLE "corrective_action" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" text NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"source_id" text,
	"title" text NOT NULL,
	"description" text,
	"root_cause" text,
	"responsible_name" text,
	"due_date" date NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"closure_evidence" text,
	"closed_at" timestamp with time zone,
	"effective" text,
	"effectiveness_note" text,
	"verified_at" timestamp with time zone,
	"escalation_level" integer DEFAULT 0 NOT NULL,
	"escalated_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "corrective_action" ADD CONSTRAINT "corrective_action_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "corrective_action_tenant_idx" ON "corrective_action" USING btree ("tenant_id","status","due_date");--> statement-breakpoint
CREATE INDEX "corrective_action_source_idx" ON "corrective_action" USING btree ("tenant_id","source","source_id");