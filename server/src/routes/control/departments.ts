import { Hono } from 'hono';
import { z } from 'zod';
import { DepartmentService } from '../../contexts/department/department-service.js';
import { parseBody, badRequest } from '../../shared/validation.js';

const createDepartmentSchema = z.object({
  tenantId: z.string().min(1),
  name: z.string().min(1).max(128),
  slug: z.string().optional(),
  description: z.string().optional(),
});

const updateDepartmentSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  description: z.string().optional(),
});

export function createDepartmentRoutes(departmentService: DepartmentService) {
  const app = new Hono();

  app.get('/', async (c) => {
    const tenantId = c.req.query('tenantId');
    const data = await departmentService.list(tenantId);
    return c.json({ success: true, data, total: data.length });
  });

  app.get('/:id', async (c) => {
    const data = await departmentService.get(c.req.param('id'));
    return c.json({ success: true, data });
  });

  app.post('/', async (c) => {
    const parsed = await parseBody(c, createDepartmentSchema);
    if ('error' in parsed) return badRequest(c, parsed.error);
    const data = await departmentService.create(parsed.data);
    return c.json({ success: true, data }, 201);
  });

  app.put('/:id', async (c) => {
    const parsed = await parseBody(c, updateDepartmentSchema);
    if ('error' in parsed) return badRequest(c, parsed.error);
    const data = await departmentService.update(c.req.param('id'), parsed.data);
    return c.json({ success: true, data });
  });

  app.delete('/:id', async (c) => {
    const data = await departmentService.remove(c.req.param('id'));
    return c.json({ success: true, data });
  });

  return app;
}
