CREATE TABLE "indicator_note" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"indicator_code" text NOT NULL,
	"period_key" text NOT NULL,
	"analysis" text NOT NULL,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "indicator_target" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"indicator_code" text NOT NULL,
	"target" numeric(14, 4) NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "indicator_note" ADD CONSTRAINT "indicator_note_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indicator_target" ADD CONSTRAINT "indicator_target_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "indicator_note_uq" ON "indicator_note" USING btree ("tenant_id","indicator_code","period_key");--> statement-breakpoint
CREATE UNIQUE INDEX "indicator_target_uq" ON "indicator_target" USING btree ("tenant_id","indicator_code");