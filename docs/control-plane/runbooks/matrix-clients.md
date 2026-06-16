# Matrix 客户端接入与分发（Desktop / Mobile）

## 1. 目标
为企业用户提供统一 Matrix 客户端接入方式，默认连接本项目 Matrix 服务端：
- Homeserver: `http://127.0.0.1:8008`（本地）
- Web: `http://127.0.0.1:8081`

## 2. Desktop（Element Desktop）

### 2.1 安装
- macOS/Windows/Linux 安装 Element Desktop 官方客户端。

### 2.2 首次登录
1. 打开客户端 -> 登录。
2. 选择自定义 homeserver。
3. 输入 `http://127.0.0.1:8008`（生产环境填写企业域名）。
4. 使用 Matrix 账号登录。

### 2.3 企业分发建议
- 通过 MDM 或软件中心分发安装包。
- 统一下发客户端配置模板（homeserver、品牌、帮助链接）。
- 每季度做一次客户端版本升级窗口。

## 3. Mobile（Element iOS / Android）

### 3.1 登录
1. 安装 Element。
2. 选择“使用自定义 homeserver”。
3. 填写 `http://127.0.0.1:8008`（或生产域名）。
4. 登录 Matrix 账号。

### 3.2 移动端安全建议
- 启用系统生物识别解锁。
- 开启通知脱敏（锁屏不显示明文）。
- 丢失设备时由管理员吊销会话。

## 4. 用户无感 OpenClaw 原则
- 客户端只展示“数字员工”和会话。
- OpenClaw 只作为平台后端执行引擎，不在客户端暴露配置入口。

## 5. 验证清单
- 能在客户端加入房间并发送 `!create_agent <name>`。
- 能收到结构化状态反馈（action/phase/traceId）。
- 管理后台“渠道运营/通知中心”可看到对应事件。
