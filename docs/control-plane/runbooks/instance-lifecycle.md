# Runbook: Instance Lifecycle

## Create Instance
1. Matrix command `!create_agent <name>` or POST `/api/control/instances`.
2. Include `Authorization: Bearer <CONTROL_PLANE_ADMIN_TOKEN>` for control API.
3. Check audit entry `instance.requested` then `instance.provisioned`.
4. Validate returned card has `chatUrl`.
5. Confirm runtime config contains tenant `sharedAssets` (from `/api/control/assets/bindings`).
6. If some assets are incompatible, check audit `instance.asset.mount.degraded` (instance still starts).

## Matrix Webhook
1. Call `POST /api/integrations/matrix/commands`.
2. Include header `x-matrix-webhook-secret`.
3. Body: `{ sender, roomId, text }`.

## Stop Instance
1. POST `/api/control/instances/{id}/stop` with admin bearer.
2. Confirm state becomes `stopped`.

## Start Instance
1. POST `/api/control/instances/{id}/start` with admin bearer.
2. Confirm state becomes `running`.

## Invoke Runtime
1. POST `/api/control/runtime/instances/{id}/invoke` with JWT bearing `control:instance:invoke`.
2. In simulation mode, response returns `mode=simulation`.
3. In kubernetes mode, proxy forwards to runtime endpoint + `RUNTIME_PROXY_INVOKE_PATH`.
4. If upstream fails repeatedly, circuit breaker opens and returns `mode=degraded`.

## Audit Traceability
1. Send `x-request-id` / `x-trace-id` / `x-correlation-id` on control-plane requests.
2. Verify audit events include these fields plus `actor`.
3. Export for SIEM ingestion via `GET /api/control/audits/export?format=ndjson`.
4. For incremental pull use `sinceId` or `sinceAt` and page with `cursor/nextCursor`.

## Asset Review Governance
1. Create report with optional `requiredApprovals` (`POST /api/control/assets/reports`).
2. Reviewer checks queue: `GET /api/control/assets/reviews/pending`.
3. Submit review with opinion: `POST /api/control/assets/reports/{reportId}/reviews`.
4. Query full opinion trail: `GET /api/control/assets/reports/{reportId}/reviews`.
5. Monitor backlog/overdue metrics: `GET /api/control/assets/reviews/dashboard`.
6. Manual SLA escalation run: `POST /api/control/assets/reviews/escalate`.
