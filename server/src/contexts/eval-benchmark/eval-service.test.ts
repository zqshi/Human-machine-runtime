import { EvalService } from './eval-service.js';
import { PRESET_SUITES } from './eval-preset-data.js';
import type { EvalBenchmarkRepository } from '../../db/repositories/eval-benchmark-repository.js';
import type { EvalEvaluatorRepository } from '../../db/repositories/eval-evaluator-repository.js';

/** 构造仅含 importPresets 所需方法的 repo mock。 */
function makeMockRepo(existingNames: string[]): EvalBenchmarkRepository {
  return {
    listSuites: vi.fn(async () => existingNames.map((name) => ({ name }))),
    createSuite: vi.fn(async () => ({})),
    batchCreateCases: vi.fn(async (cases: { id: string }[]) => cases.map((c) => ({ id: c.id }))),
  } as unknown as EvalBenchmarkRepository;
}

describe('EvalService.importPresets', () => {
  it('全新导入：全部预设集导入，无跳过', async () => {
    const repo = makeMockRepo([]);
    const service = new EvalService(repo, {} as EvalEvaluatorRepository);
    const result = await service.importPresets(undefined);

    expect(result.skipped).toEqual([]);
    expect(result.imported).toHaveLength(PRESET_SUITES.length);
    expect(repo.createSuite).toHaveBeenCalledTimes(PRESET_SUITES.length);
    expect(repo.batchCreateCases).toHaveBeenCalledTimes(PRESET_SUITES.length);
    expect(result.totalCases).toBeGreaterThan(0);
  });

  it('幂等去重：已存在的预设集跳过，tenantId 透传到 listSuites', async () => {
    const dup = PRESET_SUITES[0].name;
    const repo = makeMockRepo([dup]);
    const service = new EvalService(repo, {} as EvalEvaluatorRepository);
    const result = await service.importPresets('tenant-1');

    expect(result.skipped).toEqual([dup]);
    expect(result.imported).toHaveLength(PRESET_SUITES.length - 1);
    expect(repo.createSuite).toHaveBeenCalledTimes(PRESET_SUITES.length - 1);
    expect(repo.listSuites).toHaveBeenCalledWith('tenant-1');
  });

  it('全部已存在：不创建任何记录，imported 为空', async () => {
    const repo = makeMockRepo(PRESET_SUITES.map((p) => p.name));
    const service = new EvalService(repo, {} as EvalEvaluatorRepository);
    const result = await service.importPresets(undefined);

    expect(result.imported).toEqual([]);
    expect(result.skipped).toHaveLength(PRESET_SUITES.length);
    expect(result.totalCases).toBe(0);
    expect(repo.createSuite).not.toHaveBeenCalled();
    expect(repo.batchCreateCases).not.toHaveBeenCalled();
  });
});
