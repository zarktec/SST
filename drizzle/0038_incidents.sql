CREATE TABLE "incident" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"worker_id" uuid,
	"affected_name" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"place" text NOT NULL,
	"work_center_id" uuid,
	"activity" text,
	"description" text NOT NULL,
	"body_part" text,
	"injury_type" text,
	"severity" text DEFAULT 'none' NOT NULL,
	"witnesses" text,
	"known_at" timestamp with time zone DEFAULT now() NOT NULL,
	"arl_deadline" date,
	"arl_reported_at" date,
	"eps_reported_at" date,
	"arl_report_number" text,
	"status" text DEFAULT 'reported' NOT NULL,
	"reported_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incident_investigation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"incident_id" uuid NOT NULL,
	"deadline" date NOT NULL,
	"team" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"method" text DEFAULT 'five_whys' NOT NULL,
	"analysis" jsonb,
	"immediate_causes" text,
	"basic_causes" text,
	"conclusions" text,
	"completed_at" timestamp with time zone,
	"remitted_arl_at" date,
	"lessons_learned" text,
	"lessons_disclosed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "occupational_disease" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"diagnosis" text NOT NULL,
	"detected_on" date NOT NULL,
	"qualification" text DEFAULT 'pending' NOT NULL,
	"qualified_on" date,
	"qualified_by" text,
	"follow_up" text,
	"is_new" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "incident" ADD CONSTRAINT "incident_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident" ADD CONSTRAINT "incident_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident" ADD CONSTRAINT "incident_work_center_id_work_center_id_fk" FOREIGN KEY ("work_center_id") REFERENCES "public"."work_center"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_investigation" ADD CONSTRAINT "incident_investigation_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_investigation" ADD CONSTRAINT "incident_investigation_incident_id_incident_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incident"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational_disease" ADD CONSTRAINT "occupational_disease_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational_disease" ADD CONSTRAINT "occupational_disease_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "incident_tenant_idx" ON "incident" USING btree ("tenant_id","status","occurred_at");--> statement-breakpoint
CREATE INDEX "incident_worker_idx" ON "incident" USING btree ("worker_id");--> statement-breakpoint
CREATE UNIQUE INDEX "incident_investigation_uq" ON "incident_investigation" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "occupational_disease_tenant_idx" ON "occupational_disease" USING btree ("tenant_id","detected_on");