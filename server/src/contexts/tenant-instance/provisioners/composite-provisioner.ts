import type { IInstanceProvisioner } from '../instance-service.js';
import type { Instance } from '../domain/instance.js';

export class CompositeProvisioner implements IInstanceProvisioner {
  private provisioners: IInstanceProvisioner[];

  constructor(provisioners: IInstanceProvisioner[]) {
    this.provisioners = provisioners;
  }

  async provision(instance: Instance): Promise<Record<string, unknown>> {
    const results: Record<string, unknown> = {};
    for (const p of this.provisioners) {
      // 任一 provisioner 失败即整体失败——避免部分资源未就绪却将实例标记为 RUNNING。
      // （teardown 保持尽力清理语义，见下方 errors 收集。）
      const r = await p.provision(instance);
      Object.assign(results, r);
    }
    return results;
  }

  async teardown(instance: Instance): Promise<void> {
    const errors: Error[] = [];
    for (const p of this.provisioners) {
      try {
        await p.teardown(instance);
      } catch (err) {
        errors.push(err instanceof Error ? err : new Error(String(err)));
      }
    }
    if (errors.length === this.provisioners.length) {
      throw errors[0];
    }
  }
}
