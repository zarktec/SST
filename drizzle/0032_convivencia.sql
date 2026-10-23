CREATE TABLE "ccl_complaint" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"committee_id" uuid,
	"work_center_id" uuid,
	"complainant_worker_id" uuid,
	"respondent_worker_id" uuid,
	"narrative_encrypted" text NOT NULL,
	"stage" text DEFAULT 'received' NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stage_due_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ccl_complaint_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"complaint_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"note_encrypted" text,
	"actor_id" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "harassment_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"reporter_worker_id" uuid,
	"narrative_encrypted" text NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"note_encrypted" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ccl_complaint" ADD CONSTRAINT "ccl_complaint_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ccl_complaint" ADD CONSTRAINT "ccl_complaint_committee_id_committee_id_fk" FOREIGN KEY ("committee_id") REFERENCES "public"."committee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ccl_complaint" ADD CONSTRAINT "ccl_complaint_work_center_id_work_center_id_fk" FOREIGN KEY ("work_center_id") REFERENCES "public"."work_center"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ccl_complaint" ADD CONSTRAINT "ccl_complaint_complainant_worker_id_worker_id_fk" FOREIGN KEY ("complainant_worker_id") REFERENCES "public"."worker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ccl_complaint" ADD CONSTRAINT "ccl_complaint_respondent_worker_id_worker_id_fk" FOREIGN KEY ("respondent_worker_id") REFERENCES "public"."worker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ccl_complaint_event" ADD CONSTRAINT "ccl_complaint_event_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ccl_complaint_event" ADD CONSTRAINT "ccl_complaint_event_complaint_id_ccl_complaint_id_fk" FOREIGN KEY ("complaint_id") REFERENCES "public"."ccl_complaint"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harassment_report" ADD CONSTRAINT "harassment_report_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harassment_report" ADD CONSTRAINT "harassment_report_reporter_worker_id_worker_id_fk" FOREIGN KEY ("reporter_worker_id") REFERENCES "public"."worker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ccl_complaint_tenant_idx" ON "ccl_complaint" USING btree ("tenant_id","stage");--> statement-breakpoint
CREATE INDEX "ccl_complaint_complainant_idx" ON "ccl_complaint" USING btree ("complainant_worker_id");--> statement-breakpoint
CREATE INDEX "ccl_complaint_respondent_idx" ON "ccl_complaint" USING btree ("respondent_worker_id");--> statement-breakpoint
CREATE INDEX "ccl_complaint_event_idx" ON "ccl_complaint_event" USING btree ("complaint_id","at");--> statement-breakpoint
CREATE INDEX "harassment_report_tenant_idx" ON "harassment_report" USING btree ("tenant_id","status");