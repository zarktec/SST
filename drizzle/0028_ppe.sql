CREATE TABLE "ppe_delivery" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"size" text,
	"reason" text DEFAULT 'first' NOT NULL,
	"delivered_at" date NOT NULL,
	"due_date" date,
	"signature_data" text,
	"signed_at" timestamp with time zone,
	"ip" text,
	"user_agent" text,
	"evidence_hash" text NOT NULL,
	"note" text,
	"registered_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ppe_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"useful_life_months" integer,
	"requires_size" boolean DEFAULT false NOT NULL,
	"min_stock" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ppe_requirement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"position" text NOT NULL,
	"item_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ppe_stock_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"entry_date" date NOT NULL,
	"supplier" text,
	"note" text,
	"registered_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ppe_delivery" ADD CONSTRAINT "ppe_delivery_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ppe_delivery" ADD CONSTRAINT "ppe_delivery_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ppe_delivery" ADD CONSTRAINT "ppe_delivery_item_id_ppe_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."ppe_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ppe_item" ADD CONSTRAINT "ppe_item_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ppe_requirement" ADD CONSTRAINT "ppe_requirement_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ppe_requirement" ADD CONSTRAINT "ppe_requirement_item_id_ppe_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."ppe_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ppe_stock_entry" ADD CONSTRAINT "ppe_stock_entry_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ppe_stock_entry" ADD CONSTRAINT "ppe_stock_entry_item_id_ppe_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."ppe_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ppe_delivery_worker_idx" ON "ppe_delivery" USING btree ("worker_id","item_id");--> statement-breakpoint
CREATE INDEX "ppe_delivery_tenant_idx" ON "ppe_delivery" USING btree ("tenant_id","delivered_at");--> statement-breakpoint
CREATE INDEX "ppe_item_tenant_idx" ON "ppe_item" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ppe_requirement_uq" ON "ppe_requirement" USING btree ("tenant_id","position","item_id");--> statement-breakpoint
CREATE INDEX "ppe_stock_entry_item_idx" ON "ppe_stock_entry" USING btree ("item_id");