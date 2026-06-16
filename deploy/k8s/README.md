# Kubernetes Deployment Templates

## Structure
- Base manifests: `deploy/k8s/base`
- Includes: namespace, configmap, secret template, deployment, service, ingress, hpa, networkpolicy, pdb.

## Quick Apply
1. Copy `secret.example.yaml` to `secret.yaml` and fill real secrets.
2. Replace image in `deployment.yaml` with your released image tag.
3. Replace host/tls values in `ingress.yaml`.
4. Apply:
   - `kubectl apply -k deploy/k8s/base`
5. Validate manifests:
   - `npm run check:k8s-manifests`

## Remove
- `kubectl delete -k deploy/k8s/base`

## Environment Mapping
- ConfigMap: non-sensitive env vars from `.env.example`
- Secret: credentials and keys:
  - `CONTROL_PLANE_ADMIN_TOKEN`
  - `CONTROL_PLANE_JWT_SECRET`
  - `CONTROL_PLANE_USERS_JSON`
  - `MATRIX_WEBHOOK_SECRET`
  - `MATRIX_ACCESS_TOKEN`
  - `POSTGRES_URL`
  - provider api keys
  - `RUNTIME_PROXY_SHARED_TOKEN`

## Notes
- `secret.example.yaml` is a template only; do not use as-is in production.
- To avoid accidental apply of placeholder values, prefer creating secret via CI/CD.
