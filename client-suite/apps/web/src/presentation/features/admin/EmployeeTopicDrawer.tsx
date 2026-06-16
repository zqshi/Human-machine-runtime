import { Drawer } from '../../components/ui/Drawer';
import type { Employee } from '../../../application/services/adminApi';

export type TopicType = 'contracts' | 'growth';

interface Props {
  open: boolean;
  employee: Employee | null;
  type: TopicType;
  onClose: () => void;
}

function TagList({ items, empty = '暂无' }: { items?: string[]; empty?: string }) {
  if (!items || items.length === 0) {
    return (
      <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-500">
        {empty}
      </span>
    );
  }
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((t, i) => (
        <span
          key={i}
          className="inline-flex px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700"
        >
          {t}
        </span>
      ))}
    </div>
  );
}

function PolicySection({
  label,
  items,
  empty = '暂无',
}: {
  label: string;
  items?: string[];
  empty?: string;
}) {
  const arr = items || [];
  return (
    <div>
      <h4 className="text-xs font-medium text-gray-700 mb-1.5">
        {label}{' '}
        <span
          className={`ml-1 inline-flex px-1.5 py-0.5 text-xs rounded-full ${arr.length > 0 ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'}`}
        >
          {arr.length}
        </span>
      </h4>
      {arr.length > 0 ? (
        <ul className="space-y-1">
          {arr.map((item, i) => (
            <li key={i} className="text-xs text-gray-700 bg-gray-50 px-2.5 py-1.5 rounded">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-gray-400">{empty}</p>
      )}
    </div>
  );
}

function ContractsView({ employee }: { employee: Employee }) {
  const policy = employee.jobPolicy;
  const approval = employee.approvalPolicy;
  const byRisk = approval?.byRisk || {};

  return (
    <div className="space-y-4">
      <PolicySection label="Allow 列表" items={policy?.allow} empty="暂无 Allow 条目" />
      <PolicySection label="Deny 列表" items={policy?.deny} empty="暂无 Deny 条目" />

      <div>
        <h4 className="text-xs font-medium text-gray-700 mb-1.5">KPI 指标</h4>
        <TagList items={policy?.kpi} empty="暂无 KPI" />
      </div>

      <div>
        <h4 className="text-xs font-medium text-gray-700 mb-1.5">上报 / 熔断规则</h4>
        <div className="space-y-1 text-xs text-gray-600">
          <div className="bg-gray-50 px-2.5 py-1.5 rounded">
            上报：{policy?.escalationRule || '未设置'}
          </div>
          <div className="bg-gray-50 px-2.5 py-1.5 rounded">
            熔断：{policy?.shutdownRule || '未设置'}
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-xs font-medium text-gray-700 mb-2">审批策略</h4>
        {Object.keys(byRisk).length > 0 ? (
          <div className="space-y-1.5">
            {Object.entries(byRisk).map(([level, p]) => (
              <div
                key={level}
                className="text-xs bg-gray-50 px-2.5 py-1.5 rounded border border-gray-100"
              >
                <span className="font-medium">{level}</span>
                {' — '}需 {p.requiredApprovals} 人审批
                {p.requiredAnyRoles.length > 0 && `（角色：${p.requiredAnyRoles.join(', ')}）`}
                {p.distinctRoles && ' [去重]'}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400">暂无审批策略</p>
        )}
      </div>
    </div>
  );
}

function GrowthView({ employee }: { employee: Employee }) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-xs font-medium text-gray-700 mb-1.5">能力标签</h4>
        <TagList items={employee.capabilities} empty="暂无能力标签" />
      </div>

      <div>
        <h4 className="text-xs font-medium text-gray-700 mb-1.5">知识领域</h4>
        <TagList items={employee.knowledge} empty="暂无知识领域" />
      </div>

      <div>
        <h4 className="text-xs font-medium text-gray-700 mb-1.5">关联技能</h4>
        {employee.linkedSkillIds && employee.linkedSkillIds.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {employee.linkedSkillIds.map((id, i) => (
              <span
                key={i}
                className="inline-flex px-2 py-0.5 text-xs rounded-full bg-green-50 text-green-700 font-mono"
              >
                {id}
              </span>
            ))}
          </div>
        ) : (
          <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-500">
            暂无关联技能
          </span>
        )}
      </div>

      <div>
        <h4 className="text-xs font-medium text-gray-700 mb-1.5">认证与路径</h4>
        <div className="space-y-1 text-xs text-gray-600">
          <div className="bg-gray-50 px-2.5 py-1.5 rounded">
            认证：
            {employee.certifications && employee.certifications.length > 0
              ? employee.certifications.join(', ')
              : '暂无'}
          </div>
          <div className="bg-gray-50 px-2.5 py-1.5 rounded">
            成长路径：{employee.careerPath || '-'}
          </div>
        </div>
      </div>
    </div>
  );
}

export function EmployeeTopicDrawer({ open, employee, type, onClose }: Props) {
  if (!employee) return null;
  const title = `${employee.displayName || employee.name} · ${type === 'growth' ? '成长档案' : '契约概览'}`;

  return (
    <Drawer open={open} onClose={onClose} title={title} width="w-[460px]">
      {type === 'contracts' ? (
        <ContractsView employee={employee} />
      ) : (
        <GrowthView employee={employee} />
      )}
    </Drawer>
  );
}
