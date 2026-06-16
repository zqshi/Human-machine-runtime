> ⚠️ **历史文档快照**（非当前实现）：本文档为早期架构/规划/PRD 记录，部分内容已被后续演进取代。当前实现以 `server/src` + `client-suite/apps/web/src` 代码为准（28 个限界上下文 · Hono/TS/Drizzle · PostgreSQL@5432）。

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
