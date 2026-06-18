> ⚠️ **历史文档快照**（非当前实现）：本文档为早期架构/规划/PRD 记录，部分内容已被后续演进取代。当前实现以 `server/src` + `client-suite/apps/web/src` 代码为准（28 个限界上下文 · Hono/TS/Drizzle · PostgreSQL@5435）。

# Monitoring Assets

## Files
- Alert rules: [prometheus-alert-rules.yaml](./prometheus-alert-rules.yaml)
- Grafana dashboard: [grafana-dashboard-human-machine-runtime.json](./grafana-dashboard-human-machine-runtime.json)

## Import Dashboard
1. Open Grafana.
2. Go to `Dashboards -> New -> Import`.
3. Upload `grafana-dashboard-human-machine-runtime.json`.
4. Select your Prometheus data source for variable `DS_PROMETHEUS`.
5. Save dashboard.

## Local Observability Stack
1. Start stack:
   - `npm run observability:up`
2. Check stack:
   - `npm run observability:check`
3. Stop stack:
   - `npm run observability:down`

Services:
- Prometheus: `http://127.0.0.1:9090`
- Alertmanager: `http://127.0.0.1:9093`
- Grafana: `http://127.0.0.1:3001` (`admin/admin`)

## Recommended Alert Wiring
1. Load alert rules into Prometheus rule files.
2. Reload Prometheus.
3. Configure Alertmanager route by `labels.service = human-machine-runtime`.
4. Wire notifications to on-call channel.

## Verification
1. Check `/metrics` has:
   - `hmr_health_state`
   - `hmr_instance_state_total`
   - `hmr_instance_failure_reason_total`
2. Run `npm run check:platform-slo` against a running environment.
