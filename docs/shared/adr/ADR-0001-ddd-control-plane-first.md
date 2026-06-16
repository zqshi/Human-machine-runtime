# ADR-0001: Control-Plane-First DDD Architecture

## Status
Accepted

## Context
Legacy model mixed governance logic and runtime execution in one service.

## Decision
Adopt three-plane architecture:
1. Control Plane for lifecycle, auth, audit, assets.
2. Runtime Plane for isolated tenant OpenClaw pods.
3. Asset Plane for shared skills/tools/knowledge.

## Consequences
- Cleaner boundaries and testability.
- Requires explicit adapter contracts for K8s and Matrix.
