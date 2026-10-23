CREATE TABLE "contractor_ss_check" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"period" text NOT NULL,
	"paid" boolean NOT NULL,
	"note" text,
	"verified_by" text,
	"verified_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "worker" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"id_type" text NOT NULL,
	"id_encrypted" text NOT NULL,
	"id_blind" text NOT NULL,
	"id_last4" text NOT NULL,
	"full_name" text NOT NULL,
	"email" text,
	"phone" text,
	"position" text,
	"area" text,
	"work_center_id" uuid,
	"contract_type" text,
	"start_date" date NOT NULL,
	"end_date" date,
	"eps" text,
	"afp" text,
	"arl" text,
	"arl_risk_class" integer,
	"ccf" text,
	"contractor_company" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "contractor_ss_check" ADD CONSTRAINT "contractor_ss_check_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractor_ss_check" ADD CONSTRAINT "contractor_ss_check_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker" ADD CONSTRAINT "worker_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker" ADD CONSTRAINT "worker_work_center_id_work_center_id_fk" FOREIGN KEY ("work_center_id") REFERENCES "public"."work_center"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contractor_ss_check_uq" ON "contractor_ss_check" USING btree ("worker_id","period");--> statement-breakpoint
CREATE UNIQUE INDEX "worker_tenant_id_uq" ON "worker" USING btree ("tenant_id","id_blind") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "worker_tenant_idx" ON "worker" USING btree ("tenant_id","kind");