CREATE TYPE "public"."billing_period" AS ENUM('monthly', 'annual');--> statement-breakpoint
CREATE TYPE "public"."coupon_kind" AS ENUM('percent', 'amount');--> statement-breakpoint
CREATE TABLE "coupon" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"kind" "coupon_kind" NOT NULL,
	"value" bigint NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_to" timestamp with time zone,
	"max_uses" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"plan_ids" uuid[] DEFAULT '{}' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupon_code_unique" UNIQUE("code"),
	CONSTRAINT "coupon_value_positive" CHECK ("coupon"."value" > 0),
	CONSTRAINT "coupon_percent_max" CHECK ("coupon"."kind" <> 'percent' OR "coupon"."value" <= 10000)
);
--> statement-breakpoint
CREATE TABLE "plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"is_trial" boolean DEFAULT false NOT NULL,
	"trial_days" integer,
	"vat_enabled" boolean DEFAULT false NOT NULL,
	"vat_included" boolean DEFAULT false NOT NULL,
	"vat_rate_bp" integer DEFAULT 0 NOT NULL,
	"limits" jsonb NOT NULL,
	"modules" text[] DEFAULT '{}' NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "plan_key_unique" UNIQUE("key"),
	CONSTRAINT "plan_vat_rate_range" CHECK ("plan"."vat_rate_bp" BETWEEN 0 AND 10000),
	CONSTRAINT "plan_trial_days_range" CHECK ("plan"."trial_days" IS NULL OR "plan"."trial_days" BETWEEN 0 AND 365)
);
--> statement-breakpoint
CREATE TABLE "plan_price" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"period" "billing_period" NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" text DEFAULT 'COP' NOT NULL,
	"siigo_product_code" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_price_non_negative" CHECK ("plan_price"."amount_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "plan_price" ADD CONSTRAINT "plan_price_plan_id_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plan"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coupon_active_idx" ON "coupon" USING btree ("active");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_single_trial_uq" ON "plan" USING btree ("is_trial") WHERE "plan"."is_trial" AND "plan"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "plan_price_plan_period_uq" ON "plan_price" USING btree ("plan_id","period");