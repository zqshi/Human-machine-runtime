# Helm Deploy Guide

Chart path: `deploy/helm/human-machine-runtime`

## Validate
1. Ensure `helm` is installed (`helm version`)
2. Render and lint:
   - `npm run check:helm-chart`
3. Validate production guardrails:
   - `npm run check:prod-config`
4. Validate release matrix preflight:
   - `npm run check:release-preflight`

## Install/Upgrade
```bash
helm upgrade --install human-machine-runtime deploy/helm/human-machine-runtime \
  --namespace hmr-system \
  --create-namespace \
  -f deploy/helm/human-machine-runtime/values-prod.yaml
```

## Environment Values
- Default: `values.yaml`
- Development: `values-dev.yaml`
- Production: `values-prod.yaml`

## Secret Strategy
- Default uses in-chart `Secret` (`secrets.create=true`)
- If external secret manager is used:
  - set `secrets.create=false`
  - set `secrets.name=<existing-secret-name>`
- `values-prod.yaml` uses external secret by default (`secrets.create=false`).
