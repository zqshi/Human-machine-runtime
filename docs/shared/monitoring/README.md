# Monitoring Assets

## Files
- Alert rules: [prometheus-alert-rules.yaml](/Users/zqs/Downloads/project/dcf-light-bot/docs/monitoring/prometheus-alert-rules.yaml)
- Grafana dashboard: [grafana-dashboard-dcf-light-bot.json](/Users/zqs/Downloads/project/dcf-light-bot/docs/monitoring/grafana-dashboard-dcf-light-bot.json)

## Import Dashboard
1. Open Grafana.
2. Go to `Dashboards -> New -> Import`.
3. Upload `grafana-dashboard-dcf-light-bot.json`.
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
3. Configure Alertmanager route by `labels.service = dcf-light-bot`.
4. Wire notifications to on-call channel.

## Verification
1. Check `/metrics` has:
   - `dcf_health_state`
   - `dcf_instance_state_total`
   - `dcf_instance_failure_reason_total`
2. Run `npm run check:platform-slo` against a running environment.
