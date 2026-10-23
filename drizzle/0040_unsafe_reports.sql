CREATE TABLE "unsafe_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"description" text NOT NULL,
	"place" text,
	"work_center_id" uuid,
	"severity" text DEFAULT 'medium' NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"anonymous" boolean DEFAULT false NOT NULL,
	"reported_by" text,
	"status" text DEFAULT 'new' NOT NULL,
	"review_note" text,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"action_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "unsafe_report" ADD CONSTRAINT "unsafe_report_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unsafe_report" ADD CONSTRAINT "unsafe_report_work_center_id_work_center_id_fk" FOREIGN KEY ("work_center_id") REFERENCES "public"."work_center"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unsafe_report" ADD CONSTRAINT "unsafe_report_action_id_corrective_action_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."corrective_action"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "unsafe_report_tenant_idx" ON "unsafe_report" USING btree ("tenant_id","status","created_at");