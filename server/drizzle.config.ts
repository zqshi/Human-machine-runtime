import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: [
    "./src/db/schema/identity.ts",
    "./src/db/schema/tenant.ts",
    "./src/db/schema/instance.ts",
    "./src/db/schema/department.ts",
    "./src/db/schema/ai-gateway.ts",
    "./src/db/schema/audit.ts",
    "./src/db/schema/document.ts",
    "./src/db/schema/skill.ts",
    "./src/db/schema/config.ts",
    "./src/db/schema/credential.ts",
    "./src/db/schema/app-review.ts",
    "./src/db/schema/mcp.ts",
    "./src/db/schema/observability.ts",
    "./src/db/schema/operational.ts",
    "./src/db/schema/agent-profile.ts",
    "./src/db/schema/app-catalog.ts",
    "./src/db/schema/knowledge.ts",
    "./src/db/schema/plan.ts",
    "./src/db/schema/tool-registry.ts",
    "./src/db/schema/eval-benchmark.ts",
    "./src/db/schema/employee-memory.ts",
  ],
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://dcf:dcf@localhost:5432/dcf",
  },
});
