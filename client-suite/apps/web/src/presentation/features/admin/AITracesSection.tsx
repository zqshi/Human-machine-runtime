import { TracesTab } from './AIGatewayTracesTab';

export function AITracesSection() {
  return (
    <div className="p-6 h-full flex flex-col gap-4 overflow-hidden">
      <div className="shrink-0">
        <h1 className="text-lg font-semibold text-gray-800">调用追踪</h1>
        <p className="text-xs text-gray-400 mt-0.5">LLM 调用明细、Token 消耗与任务链路追踪</p>
      </div>
      <TracesTab />
    </div>
  );
}
