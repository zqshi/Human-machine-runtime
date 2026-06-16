import { useState, useMemo } from 'react';
import type { GrantInstanceDTO } from '../../../application/services/adminApi';
import {
  MOCK_DEPTS,
  MOCK_DEPT_INSTANCES,
  mockListDeptSelection,
  mockSetDeptSelection,
  resolveGrantedInstanceIds,
  userGrantSource,
  instanceGrantSource,
  instanceAuthLabel,
  deptCascadeState,
  toggleDeptCascade,
  deptSubtreeIds,
  isSharedInstance,
  type MockDept,
  type DeptGrantSelection,
} from '../../../application/mock/aiGatewayMock';
import { Drawer } from '../../components/ui/Drawer';
import { Icon } from '../../components/ui/Icon';
import { useToastStore } from '../../../application/stores/toastStore';

interface Props {
  /** 模型 id；null 表示抽屉关闭 */
  modelId: string | null;
  modelName: string;
  onClose: () => void;
  onSaved?: (grantedCount: number) => void;
}

/**
 * 部门级授权原型 —— 「组织结构 + 级联勾选 + 显示成员开关」（demo 原型）。
 *
 * 部门勾选采用标准级联：勾父级→整棵子树勾选；取消父级→子树清空；
 * 子级全勾→父级自动全选，部分→父级半选(indeterminate)。
 * 「显示成员」开关控制是否钻取到成员层：开启后成员按「用户」归类，
 * 用户名是可勾选节点（用户级授权，名下 Agent 继承、灰禁单独取消）。
 *
 * 三维授权主体：部门（级联勾选）/ 用户（按人，名下继承）/ 实例（兜底）。
 * 共享 Agent 是组织级资源，独立分组，不归属部门、不被继承，只能单独授权。
 *
 * 后端未就绪（departments 无 parent_id、无 model_grants 表），仅 demo 用 mock 跑通。
 */
export function DeptGrantDrawer({ modelId, modelName, onClose, onSaved }: Props) {
  const [instances] = useState<GrantInstanceDTO[]>(MOCK_DEPT_INSTANCES);
  const [selection, setSelection] = useState<DeptGrantSelection>(() =>
    modelId
      ? mockListDeptSelection(modelId)
      : { depts: new Set(), users: new Set(), instances: new Set() }
  );
  const [showMembers, setShowMembers] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['dept-root']));
  const [keyword, setKeyword] = useState('');
  const [saving, setSaving] = useState(false);

  // modelId 变化时同步该模型的授权选择：在 render 期调整 state（React 支持，
  // 会立即丢弃当前渲染输出并重渲染，而非 effect 级联），避免 effect 内 setState 告警。
  // 同 AIModelEditor 的 prevModel 调整模式。当前为同步 mock 加载。
  const [prevModelId, setPrevModelId] = useState<string | null>(modelId);
  if (modelId !== prevModelId) {
    setPrevModelId(modelId);
    setSelection(
      modelId
        ? mockListDeptSelection(modelId)
        : { depts: new Set(), users: new Set(), instances: new Set() }
    );
  }

  // 父子结构
  const childrenOf = useMemo(() => {
    const map = new Map<string, MockDept[]>();
    for (const d of MOCK_DEPTS) {
      if (d.parentId) {
        const arr = map.get(d.parentId) ?? [];
        arr.push(d);
        map.set(d.parentId, arr);
      }
    }
    for (const arr of map.values()) arr.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
    return map;
  }, []);

  // 部门 → 该部门直属（非共享）instance
  const instancesByDept = useMemo(() => {
    const map = new Map<string, GrantInstanceDTO[]>();
    for (const i of instances) {
      if (isSharedInstance(i.ownerName)) continue; // 共享 Agent 独立分组
      const key = i.departmentId || '__none__';
      const arr = map.get(key) ?? [];
      arr.push(i);
      map.set(key, arr);
    }
    return map;
  }, [instances]);

  // 组织共享 Agent（独立分组）
  const sharedInstances = useMemo(
    () => instances.filter((i) => isSharedInstance(i.ownerName)),
    [instances]
  );

  // 部门 → 该部门下按用户归类的 instance（成员层用）
  const usersByDept = useMemo(() => {
    const map = new Map<string, Array<[string, GrantInstanceDTO[]]>>();
    for (const [deptId, insts] of instancesByDept) {
      const umap = new Map<string, GrantInstanceDTO[]>();
      for (const i of insts) {
        const owner = i.ownerName || '未指定';
        const arr = umap.get(owner) ?? [];
        arr.push(i);
        umap.set(owner, arr);
      }
      map.set(
        deptId,
        Array.from(umap.entries()).sort((a, b) => a[0].localeCompare(b[0], 'zh'))
      );
    }
    return map;
  }, [instancesByDept]);

  const grantedSet = useMemo(
    () => resolveGrantedInstanceIds(selection, MOCK_DEPTS, instances),
    [selection, instances]
  );

  // ── 勾选操作（级联）──
  const deptNodeState = (deptId: string): 'all' | 'some' | 'none' =>
    deptCascadeState(deptId, selection, MOCK_DEPTS);

  // 部门级联勾选：all→清空子树，some/none→勾选整个子树（父↔子自动联动）
  const toggleDept = (deptId: string) => {
    setSelection((prev) => toggleDeptCascade(deptId, prev, MOCK_DEPTS));
  };

  // 用户勾选：继承自部门时锁定（与 toggleInstance 一致，须到部门节点取消）；
  // 否则切换用户级授权。
  const toggleUser = (userName: string, deptId: string) => {
    if (userGrantSource(userName, deptId, selection) === 'dept') return;
    setSelection((prev) => {
      const next = { ...prev, users: new Set(prev.users) };
      if (next.users.has(userName)) next.users.delete(userName);
      else next.users.add(userName);
      return next;
    });
  };

  const toggleExpand = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  /**
   * 切换「显示成员」：
   * - 开启时一次性展开整棵部门树，使成员层立即可见（满足"开了能看到成员"）；
   * - 但不强制锁定展开——折叠开合始终由 expanded 控制，故开启后仍可逐个折叠（见 renderDept 的 isOpen）。
   */
  const toggleShowMembers = () => {
    const next = !showMembers;
    setShowMembers(next);
    if (next) setExpanded(new Set(MOCK_DEPTS.map((d) => d.id)));
  };

  const toggleInstance = (instId: string, instDeptId: string | null, instOwner: string | null) => {
    const src = instanceGrantSource(instId, instDeptId, instOwner, selection);
    // 来自部门或用户的授权不可单独取消（灰禁），需到对应部门/用户节点取消
    if (src === 'dept' || src === 'user') return;
    setSelection((prev) => {
      const next = { ...prev, instances: new Set(prev.instances) };
      if (next.instances.has(instId)) next.instances.delete(instId);
      else next.instances.add(instId);
      return next;
    });
  };

  const clearAll = () =>
    setSelection({ depts: new Set(), users: new Set(), instances: new Set() });

  const save = async () => {
    if (!modelId) return;
    setSaving(true);
    try {
      mockSetDeptSelection(modelId, selection);
      useToastStore.getState().addToast(`已保存授权：${grantedSet.size} 人可用`, 'success');
      onSaved?.(grantedSet.size);
      onClose();
    } catch {
      useToastStore.getState().addToast('保存失败，请重试', 'error');
    } finally {
      setSaving(false);
    }
  };

  const deptRuleCount = selection.depts.size;
  const userRuleCount = selection.users.size;
  const instanceRuleCount = selection.instances.size;

  // ── 渲染单个 instance（成员层 / 共享分组共用）──
  const renderInstance = (inst: GrantInstanceDTO, depthPx: number) => {
    const src = instanceGrantSource(inst.id, inst.departmentId, inst.ownerName, selection);
    const from = instanceAuthLabel(inst.departmentId, inst.ownerName, selection, MOCK_DEPTS);
    const granted = grantedSet.has(inst.id);
    // dept/user 来源：来自部门或用户授权，灰禁不可单独取消；direct/none：可勾选
    const locked = src === 'dept' || src === 'user';
    const fromLabel = from ? (from.kind === 'user' ? `继承自用户 ${from.name}` : `来自 ${from.name}`) : null;
    return (
      <label
        key={inst.id}
        className={`flex items-center gap-2 py-1 pr-2 rounded-md transition-colors ${
          locked ? 'opacity-70' : 'hover:bg-gray-50 cursor-pointer'
        }`}
        style={{ paddingLeft: depthPx }}
        title={locked ? `${fromLabel}，不可单独取消` : undefined}
      >
        <input
          type="checkbox"
          checked={granted}
          disabled={locked}
          onChange={() => toggleInstance(inst.id, inst.departmentId, inst.ownerName)}
          className="w-3 h-3 accent-[#007AFF] shrink-0"
        />
        <span className="text-[12px] text-gray-600 truncate">{inst.name}</span>
        {fromLabel && (
          <span
            className={`shrink-0 text-[9px] px-1 py-px rounded inline-flex items-center gap-0.5 ${
              from?.kind === 'user' ? 'bg-teal-50 text-teal-600' : 'bg-[#007AFF]/10 text-[#007AFF]'
            }`}
          >
            <Icon name="auto_awesome" size={9} />
            {from!.name}
          </span>
        )}
        <span
          className={`ml-auto shrink-0 text-[9px] px-1.5 py-px rounded-full ${
            inst.state === 'running' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {inst.state === 'running' ? '运行' : '停止'}
        </span>
      </label>
    );
  };

  // 成员层：某部门下的用户节点 + 其名下 instance
  const renderMemberLayer = (deptId: string, depthPx: number) => {
    const users = usersByDept.get(deptId) ?? [];
    if (users.length === 0) return null;
    return users.map(([userName, insts]) => {
      // 用户节点是派生状态：dept=继承自部门(锁定) / user=用户级(可取消) / none=未授权
      const src = userGrantSource(userName, deptId, selection);
      const inherited = src === 'dept';
      const userGranted = src !== 'none';
      const grantedCount = insts.filter((i) => grantedSet.has(i.id)).length;
      return (
        <div key={userName} className="ml-1 border-l border-gray-100 pl-1">
          <label
            className={`flex items-center gap-2 py-1 pr-2 rounded-md ${
              inherited
                ? 'opacity-70'
                : userGranted
                  ? 'bg-teal-50/40'
                  : 'hover:bg-gray-50 cursor-pointer'
            }`}
            style={{ paddingLeft: depthPx }}
            title={inherited ? '继承自部门授权，不可单独取消（请到部门节点取消）' : undefined}
          >
            <input
              type="checkbox"
              checked={userGranted}
              disabled={inherited}
              onChange={() => toggleUser(userName, deptId)}
              className="w-3.5 h-3.5 accent-teal-500 shrink-0"
            />
            <Icon name="person" size={12} className="text-gray-400 shrink-0" />
            <span className="text-[13px] text-gray-700 truncate">{userName}</span>
            <span className="text-[10px] text-gray-400 shrink-0">{grantedCount}/{insts.length}</span>
            {userGranted && (
              <span
                className={`shrink-0 text-[9px] px-1.5 py-px rounded-full ${
                  inherited ? 'bg-[#007AFF]/10 text-[#007AFF]' : 'bg-teal-50 text-teal-600'
                }`}
              >
                {inherited ? '继承自部门' : '用户级'}
              </span>
            )}
          </label>
          {insts.map((inst) => renderInstance(inst, depthPx + 14))}
        </div>
      );
    });
  };

  // ── 部门树 ──
  const matchedDeptIds = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return null;
    const hit = new Set<string>();
    for (const d of MOCK_DEPTS) {
      if (d.name.toLowerCase().includes(kw)) {
        for (const id of deptSubtreeIds(MOCK_DEPTS, d.id)) hit.add(id);
        if (d.parentId) hit.add(d.parentId);
      }
    }
    for (const i of instances) {
      if (i.name.toLowerCase().includes(kw) || (i.ownerName || '').toLowerCase().includes(kw)) {
        if (i.departmentId) hit.add(i.departmentId);
        for (const aid of ancestors(MOCK_DEPTS, i.departmentId)) hit.add(aid);
      }
    }
    return hit;
  }, [keyword, instances]);

  // 搜索时强制展开成员层
  const effectiveShowMembers = showMembers || !!keyword.trim();

  const renderDept = (dept: MockDept, depth: number): React.ReactNode => {
    if (matchedDeptIds && !matchedDeptIds.has(dept.id)) return null;
    const kids = childrenOf.get(dept.id) ?? [];
    const insts = instancesByDept.get(dept.id) ?? [];
    const state = deptNodeState(dept.id);
    // 折叠开合只受 expanded 控制（可手动折叠/展开）；仅搜索时强制展开命中路径。
    // 注意：切勿用 showMembers 强制展开——否则开启「显示成员」后 isOpen 恒为 true，部门无法折叠。
    const isOpen = !!keyword.trim() || expanded.has(dept.id);
    const instGrantedHere = insts.filter((i) => grantedSet.has(i.id)).length;
    return (
      <div key={dept.id}>
        <div
          className="flex items-center gap-1.5 py-1.5 px-1 rounded-md hover:bg-gray-50"
          style={{ paddingLeft: depth * 16 + 4 }}
        >
          {kids.length > 0 ? (
            <button
              onClick={() => toggleExpand(dept.id)}
              className="p-0.5 text-gray-400 hover:text-gray-600 shrink-0"
            >
              <Icon name={isOpen ? 'expand_more' : 'chevron_right'} size={14} />
            </button>
          ) : (
            <span className="w-[18px] shrink-0" />
          )}
          <DeptCheckbox state={state} onClick={() => toggleDept(dept.id)} />
          <Icon name="groups" size={13} className="text-gray-400 shrink-0" />
          <span className="text-sm text-gray-700 truncate flex-1">{dept.name}</span>
          <span className="text-[10px] text-gray-400 shrink-0">{instGrantedHere}/{insts.length}</span>
          {state !== 'none' && (
            <span
              className={`text-[9px] px-1.5 py-px rounded-full shrink-0 ${
                state === 'all' ? 'bg-[#007AFF]/10 text-[#007AFF]' : 'bg-amber-50 text-amber-600'
              }`}
              title={state === 'all' ? '本部门及所有下属已全选' : '部分下属已选'}
            >
              {state === 'all' ? '全选' : '部分'}
            </span>
          )}
        </div>
        {isOpen && (
          <div>
            {effectiveShowMembers && renderMemberLayer(dept.id, (depth + 1) * 16 + 8)}
            {kids.map((k) => renderDept(k, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const roots = childrenOf.get('') ?? MOCK_DEPTS.filter((d) => d.parentId === null);

  return (
    <Drawer
      open={!!modelId}
      onClose={onClose}
      title={`部门级授权 · ${modelName}`}
      width="w-[600px]"
    >
      <div className="flex flex-col h-full">
        {/* 顶部说明 + 开关 + 搜索 */}
        <div className="px-1 pb-3 border-b border-gray-100">
          <div className="flex items-start gap-2 p-2 rounded-lg bg-violet-50/60 border border-violet-100 text-[11px] text-violet-700 mb-3">
            <Icon name="account_tree" size={14} className="shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              声明式授权：勾部门/用户，其名下成员自动继承，调岗/入职自动跟随。
              <span className="block text-violet-500 mt-0.5">
                关闭「显示成员」仅做部门级授权（最快）；开启后钻取到成员，可按用户授权
              </span>
            </div>
            <span className="ml-auto text-violet-600 font-medium shrink-0">演示原型</span>
          </div>

          <div className="flex items-center gap-2 mb-2">
            {/* 显示成员开关 */}
            <button
              onClick={toggleShowMembers}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition-colors shrink-0 ${
                showMembers
                  ? 'border-[#007AFF]/30 bg-[#007AFF]/5 text-[#007AFF]'
                  : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
              title="开启后在部门下显示成员，可按用户授权"
            >
              <Icon name={showMembers ? 'visibility' : 'visibility_off'} size={13} />
              显示成员
            </button>
            <div className="relative flex-1">
              <Icon
                name="search"
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="搜索部门 / 员工"
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* 列表 */}
        <div className="flex-1 overflow-y-auto py-2">
          {/* 组织共享 Agent（独立分组，始终显示） */}
          {sharedInstances.length > 0 && (
            <div className="mb-3 pb-2 border-b border-dashed border-gray-200">
              <div className="flex items-center gap-1.5 px-1 py-1 mb-0.5 text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                <Icon name="domain" size={12} />
                组织共享 Agent
              </div>
              <div className="text-[10px] text-gray-400 px-1 mb-1">
                组织级资源，单独授权，不归属任何部门
              </div>
              {sharedInstances.map((inst) => renderInstance(inst, 8))}
            </div>
          )}

          {/* 部门树 */}
          {roots.map((r) => renderDept(r, 0))}
        </div>

        {/* 底部 */}
        <div className="pt-3 border-t border-gray-100 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-gray-500">
            <span>
              规则：{deptRuleCount} 部门 + {userRuleCount} 用户 + {instanceRuleCount} 单独 ={' '}
              <span className="font-semibold text-[#007AFF]">{grantedSet.size}</span> 人可用
            </span>
            <button onClick={clearAll} className="text-gray-500 hover:underline">
              清空全部规则
            </button>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              取消
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-[#007AFF] rounded-lg hover:bg-[#0066DD] disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存授权'}
            </button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}

/** 部门级联三态勾选框：all 全选 / some 半选(indeterminate) / none 未选 */
function DeptCheckbox({
  state,
  onClick,
}: {
  state: 'all' | 'some' | 'none';
  onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="shrink-0 w-3.5 h-3.5 rounded flex items-center justify-center"
      title={
        state === 'all'
          ? '本部门及所有下属已全选，点击清空'
          : state === 'some'
            ? '部分下属已选，点击全选'
            : '未授权，点击全选本部门及下属'
      }
    >
      {state === 'none' ? (
        <span className="w-3 h-3 rounded border border-gray-300" />
      ) : (
        <span
          className={`w-3.5 h-3.5 rounded flex items-center justify-center text-white ${
            state === 'all' ? 'bg-[#007AFF]' : 'bg-amber-400'
          }`}
        >
          {state === 'all' ? (
            <Icon name="check" size={11} filled />
          ) : (
            <span className="w-1.5 h-[3px] bg-white rounded-full" />
          )}
        </span>
      )}
    </button>
  );
}

/** 部门祖先链（含自身） */
function ancestors(depts: MockDept[], deptId: string | null): string[] {
  if (!deptId) return [];
  const byId = new Map(depts.map((d) => [d.id, d]));
  const out: string[] = [];
  let cur: string | null = deptId;
  while (cur) {
    out.push(cur);
    cur = byId.get(cur)?.parentId ?? null;
  }
  return out;
}
