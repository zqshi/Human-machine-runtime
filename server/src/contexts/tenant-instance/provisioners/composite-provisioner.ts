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
      try {
        const r = await p.provision(instance);
        Object.assign(results, r);
      } catch (err) {
        results[`${(p as { constructor: { name: string } }).constructor.name}_error`] =
          err instanceof Error ? err.message : String(err);
      }
    }
    if (Object.keys(results).length === 0) {
      throw new Error('all provisioners failed');
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
