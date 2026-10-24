CREATE TABLE "chemical_substance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"cas_number" text,
	"supplier" text,
	"work_center_id" uuid,
	"location" text NOT NULL,
	"quantity" text,
	"pictograms" text[] DEFAULT '{}' NOT NULL,
	"signal_word" text DEFAULT 'none' NOT NULL,
	"h_statements" text,
	"sds_revised_on" date,
	"label_checked_on" date,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chemical_substance" ADD CONSTRAINT "chemical_substance_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chemical_substance" ADD CONSTRAINT "chemical_substance_work_center_id_work_center_id_fk" FOREIGN KEY ("work_center_id") REFERENCES "public"."work_center"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chemical_substance_tenant_idx" ON "chemical_substance" USING btree ("tenant_id","active","location");