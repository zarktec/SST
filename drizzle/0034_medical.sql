CREATE TABLE "absence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"cause" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"estimated_cost_cents" bigint,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_adaptation_task" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"evaluation_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"due_date" date NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"done_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medical_evaluation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"type" text NOT NULL,
	"scheduled_date" date,
	"performed_date" date,
	"ips_name" text,
	"concept" text,
	"restrictions_encrypted" text,
	"recommendations_encrypted" text,
	"cost_cents" bigint,
	"next_due_date" date,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "absence" ADD CONSTRAINT "absence_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "absence" ADD CONSTRAINT "absence_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_adaptation_task" ADD CONSTRAINT "job_adaptation_task_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_adaptation_task" ADD CONSTRAINT "job_adaptation_task_evaluation_id_medical_evaluation_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."medical_evaluation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_adaptation_task" ADD CONSTRAINT "job_adaptation_task_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_evaluation" ADD CONSTRAINT "medical_evaluation_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_evaluation" ADD CONSTRAINT "medical_evaluation_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "absence_tenant_idx" ON "absence" USING btree ("tenant_id","start_date");--> statement-breakpoint
CREATE INDEX "absence_worker_idx" ON "absence" USING btree ("worker_id");--> statement-breakpoint
CREATE INDEX "job_adaptation_tenant_idx" ON "job_adaptation_task" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "medical_evaluation_tenant_idx" ON "medical_evaluation" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "medical_evaluation_worker_idx" ON "medical_evaluation" USING btree ("worker_id","type");