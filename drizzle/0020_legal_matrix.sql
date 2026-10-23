CREATE TABLE "legal_matrix_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"code" text NOT NULL,
	"applies" text NOT NULL,
	"justification" text,
	"compliance" text DEFAULT 'pending' NOT NULL,
	"evidence" text,
	"responsible_name" text,
	"next_review_date" date,
	"notes" text,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "legal_matrix_entry" ADD CONSTRAINT "legal_matrix_entry_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "legal_matrix_entry_uq" ON "legal_matrix_entry" USING btree ("tenant_id","kind","code");--> statement-breakpoint
CREATE INDEX "legal_matrix_entry_tenant_idx" ON "legal_matrix_entry" USING btree ("tenant_id");