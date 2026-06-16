# Runbook: Release

## Pre-Release Checklist
1. `npm ci`
2. `npm run lint`
3. `npm test`
4. `npm run verify:openclaw-lock`
5. `npm run check:k8s-manifests`
6. `npm run check:helm-chart`
7. `npm run check:prod-config`
8. `npm run check:release-preflight`
9. Validate `.env` production secrets:
   - `CONTROL_PLANE_ADMIN_TOKEN`
   - `MATRIX_WEBHOOK_SECRET`
   - at least one provider API key
10. Validate persistence backend:
   - `PERSISTENCE_BACKEND=file` with writable `CONTROL_PLANE_STORE`, or
   - `PERSISTENCE_BACKEND=postgres` with valid `POSTGRES_URL`
11. If `postgres`, run migration [001_control_plane_store.sql](/Users/zqs/Downloads/project/dcf-light-bot/scripts/migrations/001_control_plane_store.sql).
12. Confirm reconcile flags:
   - `KUBERNETES_RECONCILE_ENABLED=true`
   - `KUBERNETES_ROLLBACK_ON_PROVISION_FAILURE=true`
13. Confirm audit retention policy:
   - `AUDIT_RETENTION_ENABLED=true`
   - `AUDIT_RETENTION_TTL_DAYS` / `AUDIT_RETENTION_MAX_ROWS`
   - `AUDIT_ARCHIVE_ENABLED` / `AUDIT_ARCHIVE_MAX_ROWS`
14. Confirm asset review SLA policy:
   - `ASSET_REVIEW_SLA_ENABLED=true`
   - `ASSET_REVIEW_SLA_HOURS` / `ASSET_REVIEW_SLA_INTERVAL_MS`
   - `ASSET_REVIEW_ESCALATION_MAX_LEVEL` / `ASSET_REVIEW_ESCALATION_COOLDOWN_HOURS`
15. Confirm metrics exposure:
   - `METRICS_ENABLED=true`
   - `METRICS_REFRESH_INTERVAL_MS`
16. Confirm health thresholds:
   - `HEALTH_UNHEALTHY_*` and `HEALTH_DEGRADED_*`

## Release Steps
1. Update `versions.lock.json` if OpenClaw dependency changed.
2. Tag and push.
3. Deploy control plane.
   - `npm run k8s:apply`
   - or `helm upgrade --install dcf-light-bot deploy/helm/dcf-light-bot --namespace dcf-system --create-namespace -f deploy/helm/dcf-light-bot/values-prod.yaml`
4. Run smoke checks:
   - `GET /health`
   - `GET /status`
   - `GET /metrics`
   - create instance via matrix webhook
5. Run scripted platform check:
   - `npm run check:platform-slo`
6. Ensure alert rules are loaded:
   - [prometheus-alert-rules.yaml](/Users/zqs/Downloads/project/dcf-light-bot/docs/monitoring/prometheus-alert-rules.yaml)
7. Import Grafana dashboard:
   - [grafana-dashboard-dcf-light-bot.json](/Users/zqs/Downloads/project/dcf-light-bot/docs/monitoring/grafana-dashboard-dcf-light-bot.json)
8. Follow monitoring setup:
   - [monitoring README](/Users/zqs/Downloads/project/dcf-light-bot/docs/monitoring/README.md)
9. Optional local validation stack:
   - `npm run observability:up`
   - `npm run observability:check`

## Rollback
1. Redeploy previous tag.
2. Verify `versions.lock.json` still matches dependency commit.
3. Replay failed operations from audit log if needed.
4. If needed, rollback k8s resources:
   - `npm run k8s:delete`
