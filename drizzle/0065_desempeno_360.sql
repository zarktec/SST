CREATE TABLE "perf_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"cycle_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"level" text NOT NULL,
	"evaluator_worker_id" uuid NOT NULL,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "perf_assignment_uq" UNIQUE("subject_id","level","evaluator_worker_id")
);
--> statement-breakpoint
CREATE TABLE "perf_cycle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"due_on" date NOT NULL,
	"anonymous" boolean NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"competencies" jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "perf_response" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"cycle_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"level" text NOT NULL,
	"evaluator_worker_id" uuid,
	"ratings" jsonb NOT NULL,
	"comment" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "perf_settings" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"anonymous" boolean DEFAULT true NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "perf_subject" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"cycle_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"position" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "perf_subject_uq" UNIQUE("cycle_id","worker_id")
);
--> statement-breakpoint
ALTER TABLE "perf_assignment" ADD CONSTRAINT "perf_assignment_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perf_assignment" ADD CONSTRAINT "perf_assignment_cycle_id_perf_cycle_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."perf_cycle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perf_assignment" ADD CONSTRAINT "perf_assignment_subject_id_perf_subject_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."perf_subject"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perf_assignment" ADD CONSTRAINT "perf_assignment_evaluator_worker_id_worker_id_fk" FOREIGN KEY ("evaluator_worker_id") REFERENCES "public"."worker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perf_cycle" ADD CONSTRAINT "perf_cycle_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perf_response" ADD CONSTRAINT "perf_response_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perf_response" ADD CONSTRAINT "perf_response_cycle_id_perf_cycle_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."perf_cycle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perf_response" ADD CONSTRAINT "perf_response_subject_id_perf_subject_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."perf_subject"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perf_response" ADD CONSTRAINT "perf_response_evaluator_worker_id_worker_id_fk" FOREIGN KEY ("evaluator_worker_id") REFERENCES "public"."worker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perf_settings" ADD CONSTRAINT "perf_settings_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perf_subject" ADD CONSTRAINT "perf_subject_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perf_subject" ADD CONSTRAINT "perf_subject_cycle_id_perf_cycle_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."perf_cycle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perf_subject" ADD CONSTRAINT "perf_subject_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "perf_assignment_evaluator_idx" ON "perf_assignment" USING btree ("tenant_id","evaluator_worker_id");--> statement-breakpoint
CREATE INDEX "perf_cycle_tenant_idx" ON "perf_cycle" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "perf_response_subject_idx" ON "perf_response" USING btree ("tenant_id","subject_id");