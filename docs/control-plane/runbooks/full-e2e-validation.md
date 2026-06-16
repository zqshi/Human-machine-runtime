# 全链路验收 Runbook（Matrix + OpenClaw + 管理后台）

## 1. 目标
- 验证 `Matrix -> 数字工厂Bot -> 创建数字员工实例 -> 管理后台可观测` 的完整链路。
- 验证实例详情包含 `checks.matrix.status/issues`。
- 验证共享Agent页面可访问。
- 验证身份映射人工维护接口已禁用（仅保留 SSO 自动写入链路）。

## 2. 执行命令
```bash
npm run e2e:full
```

## 3. 环境变量（可选）
- `BASE_URL` 默认 `http://127.0.0.1:3010`
- `ADMIN_USERNAME` 默认 `admin`
- `ADMIN_PASSWORD` 默认 `admin123`

示例：
```bash
BASE_URL=http://127.0.0.1:3010 ADMIN_USERNAME=admin ADMIN_PASSWORD=admin123 npm run e2e:full
```

## 4. 成功标准
- 输出 `[ok] full validation passed`
- 输出 `instance_id=<...>` 和 `room_id=<...>`
- 生成报告文件：`runtime/e2e/full-validation-<timestamp>.md`
- 报告中以下项均为 `PASS`：
  - OpenClaw/Matrix 栈健康
  - Matrix 创建数字员工
  - 管理后台实例详情 `checks.matrix`
  - 共享Agent页面可访问
  - 身份映射人工维护接口禁用（410）

## 5. 常见失败
- 管理员登录失败：检查 `ADMIN_USERNAME/ADMIN_PASSWORD` 是否正确。
- Matrix 创建失败：先执行 `npm run openclaw:check` 查看 Synapse/relay 状态。
- 详情字段缺失：检查实例详情接口 `GET /api/admin/instances/:id` 是否返回 `checks.matrix`。
- 接口非410：说明身份映射人工维护接口未下线完成。

