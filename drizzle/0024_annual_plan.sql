CREATE TABLE "annual_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"phva" text NOT NULL,
	"title" text NOT NULL,
	"objective" text,
	"responsible_name" text,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"resources" text,
	"budget_cents" bigint,
	"status" text DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp with time zone,
	"evidence" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"source_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "annual_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"employer_signed_by" text,
	"employer_signed_at" timestamp with time zone,
	"responsible_signed_by" text,
	"responsible_signed_at" timestamp with time zone,
	"content_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "annual_activity" ADD CONSTRAINT "annual_activity_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annual_activity" ADD CONSTRAINT "annual_activity_plan_id_annual_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."annual_plan"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annual_plan" ADD CONSTRAINT "annual_plan_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "annual_activity_plan_idx" ON "annual_activity" USING btree ("plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "annual_activity_source_uq" ON "annual_activity" USING btree ("plan_id","source","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "annual_plan_year_uq" ON "annual_plan" USING btree ("tenant_id","year");