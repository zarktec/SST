CREATE TABLE "brigade_member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"role" text NOT NULL,
	"joined_on" date NOT NULL,
	"last_training_on" date,
	"dotation" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drill" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"work_center_id" uuid,
	"scenario" text NOT NULL,
	"planned_on" date NOT NULL,
	"performed_on" date,
	"participants" integer,
	"evacuation_minutes" integer,
	"evaluation" text,
	"status" text DEFAULT 'planned' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emergency_asset" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"code" text NOT NULL,
	"location" text NOT NULL,
	"work_center_id" uuid,
	"detail" text,
	"expires_on" date,
	"last_inspected_on" date,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emergency_asset_inspection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"performed_on" date NOT NULL,
	"ok" boolean NOT NULL,
	"note" text,
	"inspector_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emergency_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"work_center_id" uuid,
	"vulnerability" text DEFAULT 'medium' NOT NULL,
	"vulnerability_analysis" text NOT NULL,
	"pon" text,
	"evacuation_routes" text,
	"reviewed_on" date NOT NULL,
	"next_review_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brigade_member" ADD CONSTRAINT "brigade_member_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brigade_member" ADD CONSTRAINT "brigade_member_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drill" ADD CONSTRAINT "drill_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drill" ADD CONSTRAINT "drill_work_center_id_work_center_id_fk" FOREIGN KEY ("work_center_id") REFERENCES "public"."work_center"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emergency_asset" ADD CONSTRAINT "emergency_asset_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emergency_asset" ADD CONSTRAINT "emergency_asset_work_center_id_work_center_id_fk" FOREIGN KEY ("work_center_id") REFERENCES "public"."work_center"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emergency_asset_inspection" ADD CONSTRAINT "emergency_asset_inspection_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emergency_asset_inspection" ADD CONSTRAINT "emergency_asset_inspection_asset_id_emergency_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."emergency_asset"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emergency_plan" ADD CONSTRAINT "emergency_plan_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emergency_plan" ADD CONSTRAINT "emergency_plan_work_center_id_work_center_id_fk" FOREIGN KEY ("work_center_id") REFERENCES "public"."work_center"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "brigade_member_tenant_idx" ON "brigade_member" USING btree ("tenant_id","active");--> statement-breakpoint
CREATE INDEX "drill_tenant_idx" ON "drill" USING btree ("tenant_id","planned_on");--> statement-breakpoint
CREATE INDEX "emergency_asset_tenant_idx" ON "emergency_asset" USING btree ("tenant_id","active","kind");--> statement-breakpoint
CREATE INDEX "emergency_asset_inspection_idx" ON "emergency_asset_inspection" USING btree ("asset_id","performed_on");--> statement-breakpoint
CREATE INDEX "emergency_plan_tenant_idx" ON "emergency_plan" USING btree ("tenant_id","work_center_id");