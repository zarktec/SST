CREATE TABLE "hazard_matrix" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"reason" text DEFAULT 'initial' NOT NULL,
	"participation" text,
	"scales_version_id" uuid,
	"created_by" text,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hazard_row" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"matrix_id" uuid NOT NULL,
	"process" text NOT NULL,
	"activity" text NOT NULL,
	"task" text NOT NULL,
	"routine" boolean DEFAULT true NOT NULL,
	"work_center_id" uuid,
	"hazard_family" text NOT NULL,
	"hazard_name" text NOT NULL,
	"description" text,
	"effects" text,
	"existing_source" text,
	"existing_medium" text,
	"existing_person" text,
	"exposed_workers" integer DEFAULT 0 NOT NULL,
	"deficiency" text NOT NULL,
	"exposure" text NOT NULL,
	"consequence" text NOT NULL,
	"np" integer,
	"nr" integer,
	"probability_level" text,
	"risk_level" text,
	"acceptability" text,
	"ctrl_elimination" text,
	"ctrl_substitution" text,
	"ctrl_engineering" text,
	"ctrl_admin" text,
	"ctrl_epp" text,
	"legal_requirement" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hazard_matrix" ADD CONSTRAINT "hazard_matrix_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hazard_matrix" ADD CONSTRAINT "hazard_matrix_scales_version_id_catalog_version_id_fk" FOREIGN KEY ("scales_version_id") REFERENCES "public"."catalog_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hazard_row" ADD CONSTRAINT "hazard_row_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hazard_row" ADD CONSTRAINT "hazard_row_matrix_id_hazard_matrix_id_fk" FOREIGN KEY ("matrix_id") REFERENCES "public"."hazard_matrix"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hazard_row" ADD CONSTRAINT "hazard_row_work_center_id_work_center_id_fk" FOREIGN KEY ("work_center_id") REFERENCES "public"."work_center"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "hazard_matrix_version_uq" ON "hazard_matrix" USING btree ("tenant_id","version");--> statement-breakpoint
CREATE INDEX "hazard_matrix_tenant_idx" ON "hazard_matrix" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "hazard_row_matrix_idx" ON "hazard_row" USING btree ("matrix_id");--> statement-breakpoint
CREATE INDEX "hazard_row_tenant_idx" ON "hazard_row" USING btree ("tenant_id");