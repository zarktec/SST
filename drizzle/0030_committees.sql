CREATE TABLE "committee" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"work_center_id" uuid,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"regulations" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "committee_commitment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"minutes_id" uuid NOT NULL,
	"description" text NOT NULL,
	"responsible_name" text,
	"due_date" date,
	"status" text DEFAULT 'open' NOT NULL,
	"closure_note" text,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "committee_member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"committee_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"representation" text NOT NULL,
	"seat" text DEFAULT 'principal' NOT NULL,
	"role" text DEFAULT 'miembro' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"confidentiality_at" timestamp with time zone,
	"confidentiality_signature" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "committee_minutes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"committee_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"date" date NOT NULL,
	"agenda" text,
	"content" text NOT NULL,
	"attendee_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "election" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"work_center_id" uuid,
	"principal_seats" integer NOT NULL,
	"alternate_seats" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"registration_opens_on" date,
	"voting_opens_on" date,
	"voting_closes_on" date,
	"result" jsonb,
	"resolution_note" text,
	"closed_at" timestamp with time zone,
	"applied_committee_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "election_ballot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"election_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "election_candidate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"election_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "election_voter" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"election_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"voted_on" date
);
--> statement-breakpoint
ALTER TABLE "committee" ADD CONSTRAINT "committee_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committee" ADD CONSTRAINT "committee_work_center_id_work_center_id_fk" FOREIGN KEY ("work_center_id") REFERENCES "public"."work_center"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committee_commitment" ADD CONSTRAINT "committee_commitment_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committee_commitment" ADD CONSTRAINT "committee_commitment_minutes_id_committee_minutes_id_fk" FOREIGN KEY ("minutes_id") REFERENCES "public"."committee_minutes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committee_member" ADD CONSTRAINT "committee_member_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committee_member" ADD CONSTRAINT "committee_member_committee_id_committee_id_fk" FOREIGN KEY ("committee_id") REFERENCES "public"."committee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committee_member" ADD CONSTRAINT "committee_member_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committee_minutes" ADD CONSTRAINT "committee_minutes_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committee_minutes" ADD CONSTRAINT "committee_minutes_committee_id_committee_id_fk" FOREIGN KEY ("committee_id") REFERENCES "public"."committee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election" ADD CONSTRAINT "election_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election" ADD CONSTRAINT "election_work_center_id_work_center_id_fk" FOREIGN KEY ("work_center_id") REFERENCES "public"."work_center"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election" ADD CONSTRAINT "election_applied_committee_id_committee_id_fk" FOREIGN KEY ("applied_committee_id") REFERENCES "public"."committee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_ballot" ADD CONSTRAINT "election_ballot_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_ballot" ADD CONSTRAINT "election_ballot_election_id_election_id_fk" FOREIGN KEY ("election_id") REFERENCES "public"."election"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_ballot" ADD CONSTRAINT "election_ballot_candidate_id_election_candidate_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."election_candidate"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_candidate" ADD CONSTRAINT "election_candidate_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_candidate" ADD CONSTRAINT "election_candidate_election_id_election_id_fk" FOREIGN KEY ("election_id") REFERENCES "public"."election"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_candidate" ADD CONSTRAINT "election_candidate_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_voter" ADD CONSTRAINT "election_voter_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_voter" ADD CONSTRAINT "election_voter_election_id_election_id_fk" FOREIGN KEY ("election_id") REFERENCES "public"."election"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_voter" ADD CONSTRAINT "election_voter_worker_id_worker_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."worker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "committee_tenant_idx" ON "committee" USING btree ("tenant_id","kind","status");--> statement-breakpoint
CREATE INDEX "committee_commitment_idx" ON "committee_commitment" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "committee_member_uq" ON "committee_member" USING btree ("committee_id","worker_id");--> statement-breakpoint
CREATE INDEX "committee_member_worker_idx" ON "committee_member" USING btree ("worker_id");--> statement-breakpoint
CREATE INDEX "committee_minutes_idx" ON "committee_minutes" USING btree ("committee_id","date");--> statement-breakpoint
CREATE INDEX "election_tenant_idx" ON "election" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "election_ballot_idx" ON "election_ballot" USING btree ("election_id","candidate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "election_candidate_uq" ON "election_candidate" USING btree ("election_id","worker_id");--> statement-breakpoint
CREATE UNIQUE INDEX "election_voter_uq" ON "election_voter" USING btree ("election_id","worker_id");--> statement-breakpoint
CREATE UNIQUE INDEX "election_voter_token_uq" ON "election_voter" USING btree ("token_hash");