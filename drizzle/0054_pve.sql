CREATE TABLE "psychosocial_assessment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"applied_on" date NOT NULL,
	"psychologist_name" text NOT NULL,
	"license_number" text NOT NULL,
	"risk_level" text NOT NULL,
	"scope" text,
	"next_due_on" date NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pve_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"description" text NOT NULL,
	"planned_on" date NOT NULL,
	"performed_on" date,
	"participants" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pve_case" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"opened_on" date NOT NULL,
	"risk_level" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"next_follow_up_on" date,
	"notes_encrypted" text,
	"closed_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pve_followup" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"performed_on" date NOT NULL,
	"note_encrypted" text NOT NULL,
	"next_follow_up_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pve_program" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"objective" text,
	"population" text,
	"started_on" date NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "psychosocial_assessment" ADD CONSTRAINT "psychosocial_assessment_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pve_activity" ADD CONSTRAINT "pve_activity_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pve_activity" ADD CONSTRAINT "pve_activity_program_id_pve_program_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."pve_program"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pve_case" ADD CONSTRAINT "pve_case_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pve_case" ADD CONSTRAINT "pve_case_program_id_pve_program_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."pve_program"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pve_case" ADD CONSTRAINT "pve_case_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pve_followup" ADD CONSTRAINT "pve_followup_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pve_followup" ADD CONSTRAINT "pve_followup_case_id_pve_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."pve_case"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pve_program" ADD CONSTRAINT "pve_program_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "psychosocial_assessment_idx" ON "psychosocial_assessment" USING btree ("tenant_id","applied_on");--> statement-breakpoint
CREATE INDEX "pve_activity_idx" ON "pve_activity" USING btree ("program_id","planned_on");--> statement-breakpoint
CREATE INDEX "pve_case_idx" ON "pve_case" USING btree ("tenant_id","program_id","status");--> statement-breakpoint
CREATE INDEX "pve_followup_idx" ON "pve_followup" USING btree ("case_id","performed_on");--> statement-breakpoint
CREATE INDEX "pve_program_tenant_idx" ON "pve_program" USING btree ("tenant_id","active");