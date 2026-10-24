CREATE TABLE "pesv_crash" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"vehicle_id" uuid,
	"driver_name" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"place" text NOT NULL,
	"description" text NOT NULL,
	"injured" integer DEFAULT 0 NOT NULL,
	"fatalities" integer DEFAULT 0 NOT NULL,
	"at_fault" text DEFAULT 'unknown' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pesv_driver" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"license_category" text NOT NULL,
	"license_expires_on" date NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pesv_preop" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"driver_name" text NOT NULL,
	"performed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"odometer" integer,
	"results" jsonb NOT NULL,
	"fail_count" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pesv_vehicle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"plate" text NOT NULL,
	"kind" text NOT NULL,
	"ownership" text DEFAULT 'own' NOT NULL,
	"description" text,
	"soat_expires_on" date,
	"rtm_expires_on" date,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pesv_crash" ADD CONSTRAINT "pesv_crash_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pesv_crash" ADD CONSTRAINT "pesv_crash_vehicle_id_pesv_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."pesv_vehicle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pesv_driver" ADD CONSTRAINT "pesv_driver_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pesv_driver" ADD CONSTRAINT "pesv_driver_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pesv_preop" ADD CONSTRAINT "pesv_preop_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pesv_preop" ADD CONSTRAINT "pesv_preop_vehicle_id_pesv_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."pesv_vehicle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pesv_vehicle" ADD CONSTRAINT "pesv_vehicle_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pesv_crash_idx" ON "pesv_crash" USING btree ("tenant_id","occurred_at");--> statement-breakpoint
CREATE INDEX "pesv_driver_tenant_idx" ON "pesv_driver" USING btree ("tenant_id","active");--> statement-breakpoint
CREATE INDEX "pesv_preop_idx" ON "pesv_preop" USING btree ("tenant_id","vehicle_id","performed_at");--> statement-breakpoint
CREATE INDEX "pesv_vehicle_tenant_idx" ON "pesv_vehicle" USING btree ("tenant_id","active");