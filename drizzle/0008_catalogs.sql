CREATE TYPE "public"."catalog_status" AS ENUM('draft', 'published', 'retired');--> statement-breakpoint
CREATE TABLE "catalog_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" uuid NOT NULL,
	"code" text NOT NULL,
	"data" jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"catalog" text NOT NULL,
	"version" integer NOT NULL,
	"status" "catalog_status" DEFAULT 'draft' NOT NULL,
	"effective_from" date,
	"effective_to" date,
	"source_norm" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_by" text,
	"published_by" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "catalog_item" ADD CONSTRAINT "catalog_item_version_id_catalog_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."catalog_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_item_code_uq" ON "catalog_item" USING btree ("version_id","code");--> statement-breakpoint
CREATE INDEX "catalog_item_version_idx" ON "catalog_item" USING btree ("version_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_version_uq" ON "catalog_version" USING btree ("catalog","version");--> statement-breakpoint
CREATE INDEX "catalog_version_status_idx" ON "catalog_version" USING btree ("catalog","status");