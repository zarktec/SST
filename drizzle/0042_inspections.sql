CREATE TABLE "inspection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"offline_id" text NOT NULL,
	"template_id" uuid,
	"template_name" text NOT NULL,
	"category" text NOT NULL,
	"place" text NOT NULL,
	"work_center_id" uuid,
	"inspector_name" text NOT NULL,
	"inspector_id" text,
	"performed_at" timestamp with time zone NOT NULL,
	"results" jsonb NOT NULL,
	"ok_count" integer DEFAULT 0 NOT NULL,
	"fail_count" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inspection_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"items" jsonb NOT NULL,
	"catalog_code" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inspection" ADD CONSTRAINT "inspection_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection" ADD CONSTRAINT "inspection_template_id_inspection_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."inspection_template"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection" ADD CONSTRAINT "inspection_work_center_id_work_center_id_fk" FOREIGN KEY ("work_center_id") REFERENCES "public"."work_center"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_template" ADD CONSTRAINT "inspection_template_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inspection_offline_uq" ON "inspection" USING btree ("tenant_id","offline_id");--> statement-breakpoint
CREATE INDEX "inspection_tenant_idx" ON "inspection" USING btree ("tenant_id","performed_at");--> statement-breakpoint
CREATE INDEX "inspection_template_tenant_idx" ON "inspection_template" USING btree ("tenant_id","active");