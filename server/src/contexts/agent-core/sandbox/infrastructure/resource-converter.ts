/**
 * 沙箱资源转换(v1.3)。
 *
 * 把 HMR 的 ResourceConfig.compute(CPU '1000m'/memory '512Mi' K8s 风格)
 * 转换为 docker run 参数(--cpus/--memory)。
 *
 * 纯函数,无副作用,便于单测。转换失败(无法识别的格式)返回 null,
 * 调用方用默认值兜底,不阻断执行。
 */

/** '1000m' → 1.0; '500m' → 0.5; 无法识别 → null */
export function cpuToDockerCpus(cpu: string): number | null {
  const m = cpu.match(/^(\d+)m$/);
  if (m) return parseInt(m[1], 10) / 1000;
  // 纯数字视为核数
  if (/^\d+(\.\d+)?$/.test(cpu)) return parseFloat(cpu);
  return null;
}

/** '512Mi' → '512m'; '1Gi' → '1024m'; '2G' → '2000m'; 无法识别 → null */
export function memoryToDockerMemory(memory: string): string | null {
  const m = memory.match(/^(\d+(?:\.\d+)?)\s*(Ki|Mi|Gi|Ti|K|M|G|T)?$/i);
  if (!m) return null;
  const value = parseFloat(m[1]);
  const unit = (m[2] || '').toUpperCase();

  // docker 接受 m(MB)单位;K8s 的 Ki/Mi/Gi 需换算
  switch (unit) {
    case 'KI':
      return `${Math.round(value / 1024)}m`; // KiB→MB 近似
    case 'MI':
      return `${Math.round(value)}m`; // MiB≈MB
    case 'GI':
      return `${Math.round(value * 1024)}m`; // GiB→MB
    case 'TI':
      return `${Math.round(value * 1024 * 1024)}m`;
    case 'K':
      return `${Math.round(value / 1000)}m`;
    case 'M':
      return `${Math.round(value)}m`;
    case 'G':
      return `${Math.round(value * 1000)}m`;
    case 'T':
      return `${Math.round(value * 1000 * 1000)}m`;
    case '':
      return `${Math.round(value)}m`;
    default:
      return null;
  }
}

export interface DockerResourceArgs {
  cpus: string;
  memory: string;
}

/**
 * 转换 ResourceConfig.compute 为 docker 资源参数。
 * 转换失败的字段用 fallback 兜底(不阻断)。
 */
export function toDockerResourceArgs(
  compute: { cpu: string; memory: string },
  fallback: DockerResourceArgs = { cpus: '1.0', memory: '2g' }
): DockerResourceArgs {
  const cpus = cpuToDockerCpus(compute.cpu);
  const memory = memoryToDockerMemory(compute.memory);
  return {
    cpus: cpus !== null ? String(cpus) : fallback.cpus,
    memory: memory !== null ? memory : fallback.memory,
  };
}
