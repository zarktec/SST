CREATE TABLE "improvement_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"assessment_id" uuid NOT NULL,
	"item_code" text NOT NULL,
	"description" text NOT NULL,
	"responsible_name" text,
	"due_date" date,
	"status" text DEFAULT 'open' NOT NULL,
	"closure_note" text,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "self_assessment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"standards_group" integer NOT NULL,
	"catalog_version_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"score_pct" numeric(6, 2),
	"rating_level" text,
	"closed_at" timestamp with time zone,
	"closed_by" text,
	"registered_ministry_at" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "self_assessment_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"assessment_id" uuid NOT NULL,
	"item_code" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"weight" numeric(8, 3) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"justification" text,
	"responsible_name" text,
	"observations" text,
	"evidence" text,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "improvement_item" ADD CONSTRAINT "improvement_item_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "improvement_item" ADD CONSTRAINT "improvement_item_assessment_id_self_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."self_assessment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "self_assessment" ADD CONSTRAINT "self_assessment_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "self_assessment" ADD CONSTRAINT "self_assessment_catalog_version_id_catalog_version_id_fk" FOREIGN KEY ("catalog_version_id") REFERENCES "public"."catalog_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "self_assessment_item" ADD CONSTRAINT "self_assessment_item_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "self_assessment_item" ADD CONSTRAINT "self_assessment_item_assessment_id_self_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."self_assessment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "improvement_item_uq" ON "improvement_item" USING btree ("assessment_id","item_code");--> statement-breakpoint
CREATE INDEX "improvement_item_tenant_idx" ON "improvement_item" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "self_assessment_year_uq" ON "self_assessment" USING btree ("tenant_id","year");--> statement-breakpoint
CREATE INDEX "self_assessment_tenant_idx" ON "self_assessment" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "self_assessment_item_uq" ON "self_assessment_item" USING btree ("assessment_id","item_code");--> statement-breakpoint
CREATE INDEX "self_assessment_item_asm_idx" ON "self_assessment_item" USING btree ("assessment_id");