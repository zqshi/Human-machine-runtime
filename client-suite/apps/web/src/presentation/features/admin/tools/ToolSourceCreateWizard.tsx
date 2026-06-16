/**
 * ToolSourceCreateWizard — 创建工具源的步骤向导
 * 支持 OpenAPI / Database / Gateway / MCP Native 四种模式
 */
import { useState } from 'react';
import { toolApi } from '../../../../application/services/adminApi';
import { Icon } from '../../../components/ui/Icon';

type SourceType = 'openapi' | 'database' | 'gateway' | 'mcp_native';

interface Props {
  onCreated: () => void;
}

const SOURCE_OPTIONS: { type: SourceType; icon: string; label: string; desc: string }[] = [
  { type: 'openapi', icon: 'api', label: 'OpenAPI 规范', desc: '上传或拉取 Swagger/OpenAPI 文档' },
  {
    type: 'database',
    icon: 'storage',
    label: '数据库直连',
    desc: '连接 PostgreSQL/MySQL 自动生成查询工具',
  },
  { type: 'gateway', icon: 'router', label: 'API 网关', desc: '从 Higress/Kong 自动发现路由' },
  { type: 'mcp_native', icon: 'terminal', label: 'MCP 原生', desc: '直接注册 MCP Server 端点' },
];

export function ToolSourceCreateWizard({ onCreated }: Props) {
  const [step, setStep] = useState<'type' | 'form'>('type');
  const [selectedType, setSelectedType] = useState<SourceType | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  // OpenAPI
  const [specMode, setSpecMode] = useState<'url' | 'upload'>('url');
  const [specUrl, setSpecUrl] = useState('');
  const [specContent, setSpecContent] = useState('');
  const [preview, setPreview] = useState<{
    specVersion: string;
    title: string;
    toolCount: number;
  } | null>(null);
  // Database
  const [dbType, setDbType] = useState('postgresql');
  const [dbHost, setDbHost] = useState('');
  const [dbPort, setDbPort] = useState('5432');
  const [dbName, setDbName] = useState('');
  const [dbSchema, setDbSchema] = useState('public');
  const [dbUser, setDbUser] = useState('');
  const [dbPassword, setDbPassword] = useState('');
  // Gateway
  const [gatewayType, setGatewayType] = useState('higress');
  const [gatewayUrl, setGatewayUrl] = useState('');
  // MCP Native
  const [mcpTransport, setMcpTransport] = useState('stdio');
  const [mcpEndpoint, setMcpEndpoint] = useState('');

  const handleSelectType = (type: SourceType) => {
    setSelectedType(type);
    setStep('form');
  };

  const handlePreviewSpec = async () => {
    const content = specMode === 'upload' ? specContent : '';
    if (specMode === 'url' && !specUrl) return;
    if (specMode === 'upload' && !specContent) return;

    try {
      if (specMode === 'upload') {
        const result = await toolApi.uploadSpec(content);
        setPreview(result);
      }
    } catch {
      setError('Spec 解析失败');
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || !selectedType) return;
    setSaving(true);
    setError('');

    try {
      const base = { sourceType: selectedType, name, description };
      let data: object;

      switch (selectedType) {
        case 'openapi':
          data = {
            ...base,
            specUrl: specMode === 'url' ? specUrl : undefined,
            specContent: specMode === 'upload' ? specContent : undefined,
          };
          break;
        case 'database':
          data = {
            ...base,
            dbType,
            dbHost,
            dbPort: Number(dbPort),
            dbName,
            dbSchemaName: dbSchema,
            credentialId: dbUser,
          };
          break;
        case 'gateway':
          data = { ...base, gatewayType, gatewayUrl };
          break;
        case 'mcp_native':
          data = { ...base, mcpTransport, mcpEndpoint };
          break;
        default:
          data = base;
      }

      const source = await toolApi.createSource(data);
      // 自动触发同步
      await toolApi.syncSource(source.id);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    }
    setSaving(false);
  };

  if (step === 'type') {
    return (
      <div className="space-y-3">
        <p className="text-xs text-gray-500 mb-4">选择工具源类型，将存量系统接入 Agent 工具生态</p>
        {SOURCE_OPTIONS.map((opt) => (
          <button
            key={opt.type}
            onClick={() => handleSelectType(opt.type)}
            className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-[#007AFF] hover:bg-blue-50/30 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
              <Icon name={opt.icon} size={22} className="text-gray-500" />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-800">{opt.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">{opt.desc}</div>
            </div>
            <Icon name="chevron_right" size={18} className="ml-auto text-gray-300" />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => setStep('type')}
        className="text-xs text-gray-400 hover:text-[#007AFF] flex items-center gap-1"
      >
        <Icon name="arrow_back" size={14} /> 返回选择
      </button>

      {/* 通用字段 */}
      <div>
        <label className="text-xs text-gray-500 mb-0.5 block">名称 *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如：用户中心 API"
          className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
        />
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-0.5 block">描述</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-y"
        />
      </div>

      {/* 类型特定字段 — 统一最小高度避免切换跳动 */}
      <div className="min-h-[260px] border-t border-gray-100 pt-3">
        {selectedType === 'openapi' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <button
                onClick={() => setSpecMode('url')}
                className={`px-3 py-1 text-xs rounded ${specMode === 'url' ? 'bg-[#007AFF] text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                URL 拉取
              </button>
              <button
                onClick={() => setSpecMode('upload')}
                className={`px-3 py-1 text-xs rounded ${specMode === 'upload' ? 'bg-[#007AFF] text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                文本粘贴
              </button>
            </div>
            {specMode === 'url' ? (
              <div className="space-y-3">
                <input
                  type="url"
                  value={specUrl}
                  onChange={(e) => setSpecUrl(e.target.value)}
                  placeholder="https://example.com/openapi.json"
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg font-mono"
                />
                <p className="text-xs text-gray-400">
                  支持 Swagger 2.0 和 OpenAPI 3.x 格式，JSON 或 YAML
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={specContent}
                  onChange={(e) => setSpecContent(e.target.value)}
                  rows={6}
                  placeholder="粘贴 OpenAPI JSON 或 YAML 内容..."
                  className="w-full px-3 py-2 text-xs font-mono border border-gray-200 rounded-lg resize-y"
                />
                <button
                  onClick={handlePreviewSpec}
                  className="text-xs text-[#007AFF] hover:underline"
                >
                  预览解析结果
                </button>
                {preview && (
                  <div className="text-xs bg-green-50 text-green-700 p-2 rounded">
                    ✓ {preview.title} (v{preview.specVersion}) — 共 {preview.toolCount} 个工具
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {selectedType === 'database' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-0.5 block">数据库类型</label>
                <select
                  value={dbType}
                  onChange={(e) => setDbType(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
                >
                  <option value="postgresql">PostgreSQL</option>
                  <option value="mysql">MySQL</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-0.5 block">Schema</label>
                <input
                  type="text"
                  value={dbSchema}
                  onChange={(e) => setDbSchema(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-gray-500 mb-0.5 block">Host</label>
                <input
                  type="text"
                  value={dbHost}
                  onChange={(e) => setDbHost(e.target.value)}
                  placeholder="localhost"
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-0.5 block">Port</label>
                <input
                  type="text"
                  value={dbPort}
                  onChange={(e) => setDbPort(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg font-mono"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">数据库名</label>
              <input
                type="text"
                value={dbName}
                onChange={(e) => setDbName(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-0.5 block">用户名</label>
                <input
                  type="text"
                  value={dbUser}
                  onChange={(e) => setDbUser(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-0.5 block">密码</label>
                <input
                  type="password"
                  value={dbPassword}
                  onChange={(e) => setDbPassword(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
                />
              </div>
            </div>
          </div>
        )}

        {selectedType === 'gateway' && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">网关类型</label>
              <select
                value={gatewayType}
                onChange={(e) => setGatewayType(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
              >
                <option value="higress">Higress</option>
                <option value="kong">Kong</option>
                <option value="apisix">APISIX</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">Admin API 地址</label>
              <input
                type="url"
                value={gatewayUrl}
                onChange={(e) => setGatewayUrl(e.target.value)}
                placeholder="http://higress-admin:8080"
                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg font-mono"
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">
              系统将调用网关 Admin API 自动发现已注册路由并生成工具定义
            </p>
          </div>
        )}

        {selectedType === 'mcp_native' && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">传输协议</label>
              <select
                value={mcpTransport}
                onChange={(e) => setMcpTransport(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
              >
                <option value="stdio">stdio</option>
                <option value="sse">SSE</option>
                <option value="streamable-http">Streamable HTTP</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">端点</label>
              <input
                type="text"
                value={mcpEndpoint}
                onChange={(e) => setMcpEndpoint(e.target.value)}
                placeholder="./tools/xxx 或 https://..."
                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg font-mono"
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">
              直接注册已实现 MCP 协议的原生 Server，无需额外转换
            </p>
          </div>
        )}
      </div>

      {/* Error */}
      {error && <div className="text-xs text-red-500 bg-red-50 rounded p-2">{error}</div>}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={saving || !name.trim()}
        className="w-full py-2.5 text-sm bg-[#007AFF] text-white rounded-lg hover:bg-[#0066DD] disabled:opacity-50"
      >
        {saving ? '创建并同步中...' : '创建工具源'}
      </button>
    </div>
  );
}
