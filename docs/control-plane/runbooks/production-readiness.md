> ⚠️ **历史文档快照**（非当前实现）：本文档为早期架构/规划/PRD 记录，部分内容已被后续演进取代。当前实现以 `server/src` + `client-suite/apps/web/src` 代码为准（28 个限界上下文 · Hono/TS/Drizzle · PostgreSQL@5432）。

# Production Readiness Checklist

## Security
- [ ] JWT secret configured (`CONTROL_PLANE_JWT_SECRET`)
- [ ] Admin bearer token rotated (`CONTROL_PLANE_ADMIN_TOKEN`)
- [ ] Matrix webhook secret rotated (`MATRIX_WEBHOOK_SECRET`)
- [ ] Control-plane users configured by `CONTROL_PLANE_USERS_JSON` with non-plain passwords
- [ ] No plaintext API keys in repo
- [ ] HTTPS termination enforced at gateway
- [ ] Provider API keys configured in platform env (`OPENAI_API_KEY`/`ANTHROPIC_API_KEY` etc.) and **not** exposed to tenant UI

## Reliability
- [ ] Control-plane data persisted on durable storage
- [ ] Periodic backups configured
- [ ] Reconciler loop enabled and monitored
- [ ] Matrix `!create_agent` load tested for idempotent instance creation
- [ ] Kubernetes manifests reviewed and customized (`deploy/k8s/base`)
- [ ] Kubernetes manifest check passed (`npm run check:k8s-manifests`)
- [ ] Helm chart values reviewed and customized (`deploy/helm/human-machine-runtime/values-*.yaml`)
- [ ] Helm chart check passed (`npm run check:helm-chart`)
- [ ] Production config guardrail check passed (`npm run check:prod-config`)
- [ ] Release preflight matrix check passed (`npm run check:release-preflight`)

## Observability
- [ ] Audit endpoint retained with export plan
- [ ] Audit export endpoint verified (`/api/control/audits/export?format=ndjson`)
- [ ] Audit retention configured (`AUDIT_RETENTION_*`, `AUDIT_ARCHIVE_*`)
- [ ] Prometheus metrics endpoint verified (`/metrics`)
- [ ] Instance label metrics verified (`hmr_instance_state_total`, `hmr_instance_failure_reason_total`)
- [ ] Health threshold config validated (`HEALTH_UNHEALTHY_*`, `HEALTH_DEGRADED_*`)
- [ ] Prometheus alerts loaded from [prometheus-alert-rules.yaml](/Users/zqs/Downloads/project/human-machine-runtime/docs/monitoring/prometheus-alert-rules.yaml)
- [ ] Grafana dashboard imported from [grafana-dashboard-human-machine-runtime.json](/Users/zqs/Downloads/project/human-machine-runtime/docs/monitoring/grafana-dashboard-human-machine-runtime.json)
- [ ] Monitoring guide followed: [README.md](/Users/zqs/Downloads/project/human-machine-runtime/docs/monitoring/README.md)
- [ ] Local observability stack validated (`npm run observability:up` + `npm run observability:check`)
- [ ] Scripted check passed (`npm run check:platform-slo`)
- [ ] Error logs shipped to centralized sink
- [ ] Alerting configured for failed provisioning

## Operations
- [ ] OpenClaw lock commit verified
- [ ] CI green on lint + test + lock verify
- [ ] Runbooks reviewed
- [ ] Asset governance process enabled (`/api/control/assets/*`: report/review/bind)
- [ ] Multi-level review policy verified (`requiredApprovals`, reviewer opinions, pending queue)
- [ ] Review SLA policy verified (`ASSET_REVIEW_SLA_*`, escalation audit, dashboard metrics)
