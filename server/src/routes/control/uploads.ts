import { Hono } from 'hono';
import { mkdirSync, createWriteStream } from 'node:fs';
import { join, extname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { newId } from '../../shared/utils.js';
import { config } from '../../config/index.js';

const uploadDir = config.upload.dir;
mkdirSync(uploadDir, { recursive: true });

export function createUploadRoutes() {
  const app = new Hono();

  app.post('/', async (c) => {
    const body = await c.req.parseBody();
    const file = body['file'];
    if (!(file instanceof File)) {
      return c.json({ error: 'Missing file field' }, 400);
    }

    const maxBytes = config.upload.maxSizeMb * 1024 * 1024;
    if (file.size > maxBytes) {
      return c.json({ error: `File exceeds ${config.upload.maxSizeMb}MB limit` }, 413);
    }

    const id = newId('file');
    const ext = extname(file.name) || '';
    const storedName = `${id}${ext}`;
    const dest = join(uploadDir, storedName);

    const buf = Buffer.from(await file.arrayBuffer());
    await pipeline(Readable.from(buf), createWriteStream(dest));

    return c.json({
      file: {
        id,
        url: `/api/control/uploads/${id}`,
        originalName: file.name,
        size: file.size,
        mimetype: file.type || 'application/octet-stream',
        storedName,
      },
    });
  });

  app.get('/:id', async (c) => {
    const id = c.req.param('id');
    const { readdirSync, createReadStream, statSync } = await import('node:fs');
    const match = readdirSync(uploadDir).find((f) => f.startsWith(id));
    if (!match) return c.json({ error: 'File not found' }, 404);

    const filePath = join(uploadDir, match);
    const stat = statSync(filePath);
    const ext = extname(match).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.json': 'application/json',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.csv': 'text/csv',
    };
    const contentType = mimeMap[ext] || 'application/octet-stream';

    c.header('Content-Type', contentType);
    c.header('Content-Length', String(stat.size));
    c.header('Cache-Control', 'public, max-age=86400');

    const stream = createReadStream(filePath);
    return new Response(stream as unknown as ReadableStream, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(stat.size),
        'Cache-Control': 'public, max-age=86400',
      },
    });
  });

  return app;
}
