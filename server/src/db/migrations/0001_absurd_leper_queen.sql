CREATE TABLE "quota_alert_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"rule_id" integer,
	"resource_type" varchar(32) NOT NULL,
	"current_pct" real NOT NULL,
	"threshold_pct" integer NOT NULL,
	"severity" varchar(16) NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"triggered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "quota_alert_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"resource_type" varchar(32) NOT NULL,
	"threshold_pct" integer NOT NULL,
	"severity" varchar(16) DEFAULT 'warning' NOT NULL,
	"notify_channels" jsonb DEFAULT '[]'::jsonb,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quota_usage_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"resource_type" varchar(32) NOT NULL,
	"current_value" real NOT NULL,
	"limit_value" real NOT NULL,
	"usage_pct" real NOT NULL,
	"measured_at" timestamp with time zone NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "app_catalog" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"icon" varchar(64) NOT NULL,
	"icon_color" varchar(16) DEFAULT '#007AFF' NOT NULL,
	"category" varchar(64) NOT NULL,
	"description" text,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"tenant_id" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "upstream_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" varchar(32);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ksc_subject" varchar(191);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "external_subject" varchar(191);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_login_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "instances" ADD COLUMN "farm_instance_id" varchar(128);--> statement-breakpoint
ALTER TABLE "instances" ADD COLUMN "farm_pod_name" varchar(128);--> statement-breakpoint
ALTER TABLE "instances" ADD COLUMN "farm_namespace" varchar(128);--> statement-breakpoint
ALTER TABLE "llm_models" ADD COLUMN "health_status" varchar(16);--> statement-breakpoint
ALTER TABLE "llm_models" ADD COLUMN "last_health_check_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "tenant_id" varchar(64);--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "wk_knowledge_id" varchar(128);--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "wk_sync_status" varchar(32) DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "quota_alert_events" ADD CONSTRAINT "quota_alert_events_rule_id_quota_alert_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."quota_alert_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_quota_alert_events_tenant" ON "quota_alert_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_quota_alert_events_status" ON "quota_alert_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_quota_alert_rules_tenant" ON "quota_alert_rules" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_quota_usage_snapshots_tenant" ON "quota_usage_snapshots" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_quota_usage_snapshots_measured" ON "quota_usage_snapshots" USING btree ("measured_at");--> statement-breakpoint
CREATE INDEX "idx_app_catalog_category" ON "app_catalog" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_app_catalog_tenant" ON "app_catalog" USING btree ("tenant_id");--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_ksc_subject" ON "users" USING btree ("ksc_subject");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_external_subject" ON "users" USING btree ("external_subject");--> statement-breakpoint
CREATE INDEX "idx_instances_farm" ON "instances" USING btree ("farm_instance_id");--> statement-breakpoint
CREATE INDEX "idx_documents_tenant" ON "documents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_documents_wk_sync" ON "documents" USING btree ("wk_sync_status");