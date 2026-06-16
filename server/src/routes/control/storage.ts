import { Hono } from 'hono';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { config } from '../../config/index.js';

export function createStorageRoutes() {
  const app = new Hono();

  app.get('/stats', (c) => {
    const dir = config.upload.dir;
    const { totalSize, totalFiles } = scanDir(dir);
    const quotaGB = 100;
    const usedGB = totalSize / (1024 * 1024 * 1024);
    return c.json({
      stats: {
        totalSize,
        totalFiles,
        usedPercentage: quotaGB > 0 ? Math.round((usedGB / quotaGB) * 10000) / 100 : 0,
        quotaGB,
        usedGB: Math.round(usedGB * 100) / 100,
      },
    });
  });

  app.get('/departments', (c) => {
    const dir = config.upload.dir;
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      const departments = entries
        .filter((e) => e.isDirectory())
        .map((e) => {
          const sub = scanDir(join(dir, e.name));
          return { name: e.name, totalFiles: sub.totalFiles, totalSize: sub.totalSize };
        });
      return c.json({ departments });
    } catch {
      return c.json({ departments: [] });
    }
  });

  app.get('/large-files', (c) => {
    const dir = config.upload.dir;
    const files = listFiles(dir)
      .sort((a, b) => b.size - a.size)
      .slice(0, 20);
    return c.json({ files });
  });

  return app;
}

function scanDir(dir: string): { totalSize: number; totalFiles: number } {
  let totalSize = 0;
  let totalFiles = 0;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        totalFiles++;
        totalSize += statSync(join(dir, entry.name)).size;
      }
    }
  } catch {
    // dir doesn't exist yet — return zeros
  }
  return { totalSize, totalFiles };
}

function listFiles(dir: string): { name: string; size: number; createdAt: string }[] {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile())
      .map((e) => {
        const st = statSync(join(dir, e.name));
        return { name: e.name, size: st.size, createdAt: st.birthtime.toISOString() };
      });
  } catch {
    return [];
  }
}
