CREATE TABLE "height_certificate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"level" text NOT NULL,
	"issuer" text NOT NULL,
	"issued_on" date NOT NULL,
	"expires_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "height_equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"code" text NOT NULL,
	"description" text NOT NULL,
	"certified_until" date,
	"last_inspected_on" date,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permit_type" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"checklist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"requires_certificate" boolean DEFAULT false NOT NULL,
	"requires_rescue_plan" boolean DEFAULT false NOT NULL,
	"max_hours" integer DEFAULT 8 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_permit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type_id" uuid NOT NULL,
	"type_name" text NOT NULL,
	"requires_certificate" boolean NOT NULL,
	"place" text NOT NULL,
	"work_center_id" uuid,
	"description" text NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_until" timestamp with time zone NOT NULL,
	"checklist" jsonb NOT NULL,
	"workers" jsonb NOT NULL,
	"coordinator_worker_id" uuid,
	"rescue_plan" text,
	"status" text DEFAULT 'requested' NOT NULL,
	"requested_by" text NOT NULL,
	"requested_name" text NOT NULL,
	"requester_signature" text NOT NULL,
	"requester_evidence" text NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"authorized_by" text,
	"authorized_name" text,
	"authorizer_signature" text,
	"authorizer_evidence" text,
	"authorized_at" timestamp with time zone,
	"closed_by" text,
	"closed_at" timestamp with time zone,
	"close_note" text,
	"cancel_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "height_certificate" ADD CONSTRAINT "height_certificate_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "height_certificate" ADD CONSTRAINT "height_certificate_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "height_equipment" ADD CONSTRAINT "height_equipment_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permit_type" ADD CONSTRAINT "permit_type_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_permit" ADD CONSTRAINT "work_permit_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_permit" ADD CONSTRAINT "work_permit_type_id_permit_type_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."permit_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_permit" ADD CONSTRAINT "work_permit_work_center_id_work_center_id_fk" FOREIGN KEY ("work_center_id") REFERENCES "public"."work_center"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_permit" ADD CONSTRAINT "work_permit_coordinator_worker_id_worker_id_fk" FOREIGN KEY ("coordinator_worker_id") REFERENCES "public"."worker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "height_certificate_idx" ON "height_certificate" USING btree ("tenant_id","worker_id","expires_on");--> statement-breakpoint
CREATE INDEX "height_equipment_idx" ON "height_equipment" USING btree ("tenant_id","active");--> statement-breakpoint
CREATE INDEX "permit_type_tenant_idx" ON "permit_type" USING btree ("tenant_id","active");--> statement-breakpoint
CREATE INDEX "work_permit_tenant_idx" ON "work_permit" USING btree ("tenant_id","status","valid_from");