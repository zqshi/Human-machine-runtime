CREATE TABLE "external_identities" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"provider_type" varchar(32) NOT NULL,
	"external_id" varchar(256) NOT NULL,
	"email" varchar(255),
	"display_name" varchar(128),
	"avatar_url" text,
	"raw_claims" jsonb,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"provider_type" varchar(32) NOT NULL,
	"external_id" varchar(256),
	"ip_address" varchar(64),
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tenant_auth_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"provider_type" varchar(32) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_role_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"role_id" integer NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"assigned_by" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"display_name" varchar(128) NOT NULL,
	"permissions" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(64) NOT NULL,
	"email" varchar(255),
	"password_hash" text NOT NULL,
	"role" varchar(32) DEFAULT 'user' NOT NULL,
	"scope" varchar(32) DEFAULT 'tenant' NOT NULL,
	"tenant_id" varchar(64),
	"display_name" varchar(128),
	"is_active" boolean DEFAULT true NOT NULL,
	"source" varchar(32) DEFAULT 'env' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"slug" varchar(64) NOT NULL,
	"plan" varchar(32) DEFAULT 'free' NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"industry" varchar(64),
	"company_size" varchar(32),
	"contact_name" varchar(64),
	"contact_email" varchar(255),
	"contact_phone" varchar(32),
	"description" text,
	"quotas" jsonb DEFAULT '{}'::jsonb,
	"features" jsonb DEFAULT '{}'::jsonb,
	"model_access" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "user_quotas" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"max_instances" integer DEFAULT 10 NOT NULL,
	"max_cpu_cores" integer DEFAULT 16 NOT NULL,
	"max_memory_gb" real DEFAULT 16 NOT NULL,
	"max_storage_gb" real DEFAULT 100 NOT NULL,
	"max_gpu_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_quotas_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "instances" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text,
	"source" varchar(32) DEFAULT 'api' NOT NULL,
	"type" varchar(32) DEFAULT 'openclaw' NOT NULL,
	"state" varchar(32) DEFAULT 'requested' NOT NULL,
	"creator" varchar(128),
	"enterprise_user_id" varchar(128),
	"employee_no" varchar(32),
	"employee_id" varchar(64),
	"email" varchar(255),
	"job_code" varchar(64),
	"job_title" varchar(128),
	"department" varchar(128),
	"matrix_room_id" varchar(128),
	"permission_template_id" varchar(64),
	"permission_template" jsonb,
	"resources" jsonb DEFAULT '{}'::jsonb,
	"runtime" jsonb DEFAULT '{}'::jsonb,
	"policy" jsonb DEFAULT '{}'::jsonb,
	"approval_policy" jsonb DEFAULT '{}'::jsonb,
	"request_id" varchar(64),
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_flow_nodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"trace_id" varchar(64) NOT NULL,
	"node_id" varchar(64) NOT NULL,
	"kind" varchar(32) NOT NULL,
	"title" varchar(255),
	"model" varchar(64),
	"status" varchar(32),
	"summary" text,
	"input_payload" jsonb,
	"output_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_flow_nodes_node_id_unique" UNIQUE("node_id")
);
--> statement-breakpoint
CREATE TABLE "ai_risk_hits" (
	"id" serial PRIMARY KEY NOT NULL,
	"trace_id" varchar(64) NOT NULL,
	"rule_id" varchar(64) NOT NULL,
	"rule_name" varchar(128) NOT NULL,
	"severity" varchar(16) NOT NULL,
	"action" varchar(32) NOT NULL,
	"match_summary" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_traces" (
	"id" serial PRIMARY KEY NOT NULL,
	"trace_id" varchar(64) NOT NULL,
	"session_id" varchar(64) NOT NULL,
	"request_id" varchar(64) NOT NULL,
	"user_id" varchar(64),
	"instance_id" varchar(64),
	"requested_model" varchar(64) DEFAULT 'auto' NOT NULL,
	"actual_model" varchar(64),
	"provider_type" varchar(32),
	"status" varchar(32) NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"input_cost" real DEFAULT 0 NOT NULL,
	"output_cost" real DEFAULT 0 NOT NULL,
	"estimated_cost" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "ai_traces_trace_id_unique" UNIQUE("trace_id")
);
--> statement-breakpoint
CREATE TABLE "cost_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"trace_id" varchar(64) NOT NULL,
	"user_id" varchar(64),
	"model" varchar(64) NOT NULL,
	"provider_type" varchar(32) NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"input_price" real DEFAULT 0 NOT NULL,
	"output_price" real DEFAULT 0 NOT NULL,
	"currency" varchar(8) DEFAULT 'CNY' NOT NULL,
	"exchange_rate" real DEFAULT 1 NOT NULL,
	"cost_original" real DEFAULT 0 NOT NULL,
	"cost_cny" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovered_models" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"display_name" varchar(128) NOT NULL,
	"provider_type" varchar(32) NOT NULL,
	"provider_model_name" varchar(128) NOT NULL,
	"input_price" real,
	"output_price" real,
	"currency" varchar(8),
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"provider_id" integer
);
--> statement-breakpoint
CREATE TABLE "exchange_rates" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_currency" varchar(8) NOT NULL,
	"to_currency" varchar(8) DEFAULT 'CNY' NOT NULL,
	"rate" real DEFAULT 1 NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "llm_models" (
	"id" serial PRIMARY KEY NOT NULL,
	"display_name" varchar(128) NOT NULL,
	"description" text,
	"provider_type" varchar(32) NOT NULL,
	"protocol_type" varchar(32) NOT NULL,
	"base_url" text NOT NULL,
	"provider_model_name" varchar(128),
	"api_key" text,
	"api_key_secret_ref" text,
	"is_secure" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"input_price" real DEFAULT 0 NOT NULL,
	"output_price" real DEFAULT 0 NOT NULL,
	"currency" varchar(8) DEFAULT 'CNY' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "llm_models_display_name_unique" UNIQUE("display_name")
);
--> statement-breakpoint
CREATE TABLE "risk_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule_id" varchar(64) NOT NULL,
	"display_name" varchar(128) NOT NULL,
	"description" text,
	"pattern" text NOT NULL,
	"severity" varchar(16) NOT NULL,
	"action" varchar(32) NOT NULL,
	"category" varchar(32) DEFAULT 'custom' NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "risk_rules_rule_id_unique" UNIQUE("rule_id")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"scope" varchar(32) NOT NULL,
	"module" varchar(64),
	"operation" varchar(64) NOT NULL,
	"status" varchar(32),
	"actor_id" varchar(128),
	"actor_name" varchar(128),
	"resource_id" varchar(128),
	"resource_type" varchar(64),
	"details" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_versions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"document_id" varchar(64) NOT NULL,
	"version_number" integer NOT NULL,
	"title" varchar(512) NOT NULL,
	"edited_by" varchar(128) NOT NULL,
	"content_snapshot" jsonb,
	"status" varchar(32) DEFAULT 'auto' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"room_id" varchar(128),
	"type" varchar(32) DEFAULT 'doc' NOT NULL,
	"title" varchar(512) NOT NULL,
	"content" jsonb DEFAULT '{}'::jsonb,
	"status" varchar(32) DEFAULT 'draft' NOT NULL,
	"category_id" varchar(64),
	"department_id" varchar(64),
	"owner_id" varchar(128) NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb,
	"created_by" varchar(128) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"published_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"reviewed_by" varchar(128),
	"review_comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_audits" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"operation_type" varchar(64) NOT NULL,
	"operator_id" varchar(128) NOT NULL,
	"operator_name" varchar(128) NOT NULL,
	"target_id" varchar(128) NOT NULL,
	"target_name" varchar(512),
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_bindings" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"skill_id" varchar(64),
	"asset_id" varchar(64),
	"asset_type" varchar(32) DEFAULT 'skill' NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"created_by" varchar(128) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shared_assets" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"asset_type" varchar(32) DEFAULT 'skill' NOT NULL,
	"source_report_id" varchar(64) NOT NULL,
	"source_tenant_id" varchar(64) NOT NULL,
	"source_instance_id" varchar(64) NOT NULL,
	"name" varchar(256) NOT NULL,
	"description" text,
	"content_ref" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"version" varchar(32) DEFAULT '1.0.0' NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"published_by" varchar(128) NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_reports" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"asset_type" varchar(32) DEFAULT 'skill' NOT NULL,
	"source_tenant_id" varchar(64) NOT NULL,
	"source_instance_id" varchar(64) NOT NULL,
	"source_skill_id" varchar(64),
	"name" varchar(256) NOT NULL,
	"description" text,
	"content_ref" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"version" varchar(32) DEFAULT '1.0.0' NOT NULL,
	"status" varchar(32) DEFAULT 'pending_review' NOT NULL,
	"required_approvals" integer DEFAULT 1 NOT NULL,
	"approvals" jsonb DEFAULT '[]'::jsonb,
	"review_history" jsonb DEFAULT '[]'::jsonb,
	"reviewed_by" varchar(128),
	"reviewed_at" timestamp with time zone,
	"reject_reason" text,
	"sla_due_at" timestamp with time zone,
	"review_escalation_level" integer DEFAULT 0 NOT NULL,
	"last_escalated_at" timestamp with time zone,
	"escalation_history" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_configs" (
	"key" varchar(255) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_configs" (
	"key" varchar(255) PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_providers" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"auth_type" varchar(32) NOT NULL,
	"tenant_id" varchar(64),
	"enabled" boolean DEFAULT true NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_providers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "credential_leases" (
	"id" serial PRIMARY KEY NOT NULL,
	"lease_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"provider_id" integer NOT NULL,
	"scope" varchar(256),
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "credential_leases_lease_id_unique" UNIQUE("lease_id")
);
--> statement-breakpoint
CREATE TABLE "credential_secrets" (
	"id" serial PRIMARY KEY NOT NULL,
	"authorization_id" integer NOT NULL,
	"secret_type" varchar(32) NOT NULL,
	"ciphertext" text NOT NULL,
	"key_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_states" (
	"id" serial PRIMARY KEY NOT NULL,
	"state" varchar(128) NOT NULL,
	"user_id" integer NOT NULL,
	"provider_code" varchar(64) NOT NULL,
	"redirect_uri" text NOT NULL,
	"code_verifier" varchar(128),
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_states_state_unique" UNIQUE("state")
);
--> statement-breakpoint
CREATE TABLE "user_authorizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"provider_id" integer NOT NULL,
	"external_account_id" varchar(256),
	"scope" varchar(256),
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"app_id" varchar(64) NOT NULL,
	"xspace_app_id" varchar(64),
	"tenant_id" varchar(64) NOT NULL,
	"submitter" varchar(128) NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"reviewer" varchar(128),
	"review_note" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "mcp_tool_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"tool_name" varchar(128) NOT NULL,
	"user_id" varchar(128),
	"instance_id" varchar(64),
	"called_at" timestamp with time zone DEFAULT now() NOT NULL,
	"duration_ms" integer,
	"status" varchar(32) DEFAULT 'success' NOT NULL,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "tenant_mcp_policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"mcp_group_id" varchar(64) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"max_calls_per_day" integer,
	"requires_approval" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instance_health_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"instance_id" varchar(64) NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"status" varchar(32) NOT NULL,
	"cpu_usage" real,
	"memory_usage" real,
	"uptime_seconds" integer,
	"last_activity_at" timestamp with time zone,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "token_usage_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"user_uid" varchar(128),
	"model" varchar(128),
	"time_bucket" timestamp with time zone NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"total_cost" real DEFAULT 0 NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_budgets" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_failover_chains" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"title" varchar(256),
	"type" varchar(32),
	"read" integer DEFAULT 0 NOT NULL,
	"escalated" integer DEFAULT 0 NOT NULL,
	"snoozed_until" timestamp with time zone,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "openclaw_entities" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"entity_type" varchar(32) NOT NULL,
	"tenant_id" varchar(64),
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_channels" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(128),
	"type" varchar(32),
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_configs" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"category" varchar(32) NOT NULL,
	"name" varchar(128),
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(256) NOT NULL,
	"type" varchar(32) DEFAULT 'personal' NOT NULL,
	"owner_id" varchar(128) NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"description" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_profiles" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"instance_id" varchar(64) NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"display_name" varchar(128),
	"avatar" text,
	"know_me" text,
	"skills_digest" text,
	"personality" text,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"milestones" jsonb DEFAULT '[]'::jsonb,
	"synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "external_identities" ADD CONSTRAINT "external_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_role_id_user_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."user_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_quotas" ADD CONSTRAINT "user_quotas_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instances" ADD CONSTRAINT "instances_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_flow_nodes" ADD CONSTRAINT "ai_flow_nodes_trace_id_ai_traces_trace_id_fk" FOREIGN KEY ("trace_id") REFERENCES "public"."ai_traces"("trace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_risk_hits" ADD CONSTRAINT "ai_risk_hits_trace_id_ai_traces_trace_id_fk" FOREIGN KEY ("trace_id") REFERENCES "public"."ai_traces"("trace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_records" ADD CONSTRAINT "cost_records_trace_id_ai_traces_trace_id_fk" FOREIGN KEY ("trace_id") REFERENCES "public"."ai_traces"("trace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovered_models" ADD CONSTRAINT "discovered_models_provider_id_llm_models_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."llm_models"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "external_identities_unique" ON "external_identities" USING btree ("provider_type","external_id");--> statement-breakpoint
CREATE INDEX "idx_external_identities_user" ON "external_identities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_user" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_expires" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_auth_configs_unique" ON "tenant_auth_configs" USING btree ("tenant_id","provider_type");--> statement-breakpoint
CREATE INDEX "idx_tenant_auth_configs_tenant" ON "tenant_auth_configs" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_role_assignments_unique" ON "user_role_assignments" USING btree ("user_id","role_id");--> statement-breakpoint
CREATE INDEX "idx_users_role" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_tenant" ON "users" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_tenants_status" ON "tenants" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_tenants_plan" ON "tenants" USING btree ("plan");--> statement-breakpoint
CREATE INDEX "idx_instances_tenant" ON "instances" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_instances_state" ON "instances" USING btree ("state");--> statement-breakpoint
CREATE INDEX "idx_flow_nodes_trace" ON "ai_flow_nodes" USING btree ("trace_id");--> statement-breakpoint
CREATE INDEX "idx_risk_hits_trace" ON "ai_risk_hits" USING btree ("trace_id");--> statement-breakpoint
CREATE INDEX "idx_ai_traces_user" ON "ai_traces" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ai_traces_status" ON "ai_traces" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ai_traces_created" ON "ai_traces" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_cost_records_user" ON "cost_records" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_cost_records_created" ON "cost_records" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_exchange_rates_unique" ON "exchange_rates" USING btree ("from_currency","to_currency","fetched_at");--> statement-breakpoint
CREATE INDEX "idx_llm_models_provider" ON "llm_models" USING btree ("provider_type");--> statement-breakpoint
CREATE INDEX "idx_llm_models_active" ON "llm_models" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_risk_rules_category" ON "risk_rules" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_risk_rules_enabled" ON "risk_rules" USING btree ("is_enabled");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_scope" ON "audit_logs" USING btree ("scope");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_module" ON "audit_logs" USING btree ("module");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_created" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_doc_versions_doc" ON "document_versions" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_documents_room" ON "documents" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "idx_documents_status" ON "documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_documents_owner" ON "documents" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_knowledge_audits_op" ON "knowledge_audits" USING btree ("operation_type");--> statement-breakpoint
CREATE INDEX "idx_knowledge_audits_time" ON "knowledge_audits" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_asset_bindings_tenant" ON "asset_bindings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_asset_bindings_type" ON "asset_bindings" USING btree ("asset_type");--> statement-breakpoint
CREATE INDEX "idx_shared_assets_type" ON "shared_assets" USING btree ("asset_type");--> statement-breakpoint
CREATE INDEX "idx_shared_assets_status" ON "shared_assets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_skill_reports_status" ON "skill_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_skill_reports_tenant" ON "skill_reports" USING btree ("source_tenant_id");--> statement-breakpoint
CREATE INDEX "idx_skill_reports_asset_type" ON "skill_reports" USING btree ("asset_type");--> statement-breakpoint
CREATE INDEX "idx_auth_providers_tenant" ON "auth_providers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_auth_providers_type" ON "auth_providers" USING btree ("auth_type");--> statement-breakpoint
CREATE INDEX "idx_cred_leases_user" ON "credential_leases" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_cred_leases_lease" ON "credential_leases" USING btree ("lease_id");--> statement-breakpoint
CREATE INDEX "idx_cred_leases_expires" ON "credential_leases" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_cred_secrets_authz" ON "credential_secrets" USING btree ("authorization_id");--> statement-breakpoint
CREATE INDEX "idx_oauth_states_expires" ON "oauth_states" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_user_authz_user" ON "user_authorizations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_authz_provider" ON "user_authorizations" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "idx_app_reviews_tenant" ON "app_reviews" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_app_reviews_status" ON "app_reviews" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_app_reviews_app" ON "app_reviews" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "idx_mcp_usage_tenant" ON "mcp_tool_usage" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_mcp_usage_tool" ON "mcp_tool_usage" USING btree ("tool_name");--> statement-breakpoint
CREATE INDEX "idx_mcp_usage_called_at" ON "mcp_tool_usage" USING btree ("called_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_mcp_policies_unique" ON "tenant_mcp_policies" USING btree ("tenant_id","mcp_group_id");--> statement-breakpoint
CREATE INDEX "idx_tenant_mcp_policies_tenant" ON "tenant_mcp_policies" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_instance_health_instance" ON "instance_health_snapshots" USING btree ("instance_id");--> statement-breakpoint
CREATE INDEX "idx_instance_health_tenant" ON "instance_health_snapshots" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_instance_health_checked" ON "instance_health_snapshots" USING btree ("checked_at");--> statement-breakpoint
CREATE INDEX "idx_token_usage_tenant" ON "token_usage_snapshots" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_token_usage_bucket" ON "token_usage_snapshots" USING btree ("time_bucket");--> statement-breakpoint
CREATE INDEX "idx_token_usage_model" ON "token_usage_snapshots" USING btree ("model");--> statement-breakpoint
CREATE INDEX "idx_agent_profiles_instance" ON "agent_profiles" USING btree ("instance_id");--> statement-breakpoint
CREATE INDEX "idx_agent_profiles_tenant" ON "agent_profiles" USING btree ("tenant_id");