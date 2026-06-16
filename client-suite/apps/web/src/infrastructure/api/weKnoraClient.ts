/**
 * WeKnora RAG API Client
 *
 * All requests go through HMR backend proxy: /api/control/knowledge/*
 * The backend injects WeKnora service-account auth automatically.
 * Backend requires tenantId — derived from auth session (injected server-side).
 */

const BASE = '/api/control/knowledge';

async function wkRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (!res.ok) {
    let body: Record<string, unknown> | undefined;
    try {
      body = await res.json();
    } catch {
      /* ignore */
    }
    const msg =
      (body?.error as Record<string, unknown>)?.message ??
      body?.message ??
      body?.error ??
      `WeKnora ${res.status}: ${res.statusText}`;
    throw new Error(String(msg));
  }
  const text = await res.text();
  return text ? JSON.parse(text) : (undefined as T);
}

/**
 * Get current tenant ID from auth session.
 * Falls back to 'default' for dev environments.
 */
function getTenantId(): string {
  try {
    const raw = document.cookie.split(';').find((c) => c.trim().startsWith('tenantId='));
    if (raw) return raw.split('=')[1].trim();
  } catch {
    /* ignore */
  }
  return 'default';
}

// ─── Types ──────────────────────────────────────────────────────────

export interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  documentCount?: number;
  createdAt?: string;
}

export interface SearchResult {
  id: string;
  title: string;
  content: string;
  score: number;
  knowledgeBaseId?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: { title: string; id: string }[];
}

// ─── API ────────────────────────────────────────────────────────────

export const weKnoraApi = {
  listKnowledgeBases(): Promise<{ data: KnowledgeBase[] }> {
    return wkRequest(`/bases?tenantId=${encodeURIComponent(getTenantId())}`);
  },

  search(query: string, kbIds?: string[]): Promise<{ data: SearchResult[] }> {
    return wkRequest('/search', {
      method: 'POST',
      body: JSON.stringify({
        tenantId: getTenantId(),
        query,
        knowledgeBaseIds: kbIds,
      }),
    });
  },

  /**
   * Sync a document to WeKnora knowledge base via HMR backend.
   * kbId is optional — defaults to 'default' for general document sync.
   */
  syncDocument(doc: {
    id?: string;
    title: string;
    content: string;
    type?: string;
    kbId?: string;
  }): Promise<{ success: boolean }> {
    const kbId = doc.kbId || 'default';
    return wkRequest(`/bases/${kbId}/documents`, {
      method: 'POST',
      body: JSON.stringify({
        tenantId: getTenantId(),
        id: doc.id,
        title: doc.title,
        content: doc.content,
        type: doc.type,
      }),
    });
  },

  /**
   * Non-streaming question answering.
   */
  async ask(
    query: string,
    kbIds?: string[]
  ): Promise<{ answer: string; sources: { title: string; id: string }[] }> {
    const result = await wkRequest<{
      data: { answer: string; sources: { title: string; id: string }[] };
    }>('/query', {
      method: 'POST',
      body: JSON.stringify({
        tenantId: getTenantId(),
        query,
        knowledgeBaseIds: kbIds,
      }),
    });
    return result.data;
  },

  /**
   * Stream chat completion via SSE through HMR backend proxy.
   * Calls onChunk for each token, onDone when complete.
   */
  async chat(
    sessionId: string,
    query: string,
    opts: {
      kbIds?: string[];
      onChunk: (text: string) => void;
      onSources?: (sources: { title: string; id: string }[]) => void;
      onDone: () => void;
      onError: (err: Error) => void;
      signal?: AbortSignal;
    }
  ): Promise<void> {
    const body = JSON.stringify({
      tenantId: getTenantId(),
      query,
      knowledgeBaseIds: opts.kbIds ?? [],
      sessionId,
    });

    let res: Response;
    try {
      const controller = opts.signal ? undefined : new AbortController();
      const timeoutId = controller ? setTimeout(() => controller.abort(), 60000) : undefined;

      res = await fetch(`${BASE}/query/stream`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: opts.signal ?? controller?.signal,
      });

      if (timeoutId) clearTimeout(timeoutId);
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') opts.onError(err);
      else if (!(err instanceof Error)) opts.onError(new Error(String(err)));
      return;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      opts.onError(new Error(`WeKnora chat ${res.status}: ${text}`));
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      opts.onError(new Error('No response body'));
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    const readTimeoutMs = 30000;

    try {
      while (true) {
        const timeout = new Promise<{ done: true; value: undefined }>((_, reject) =>
          setTimeout(() => reject(new Error('SSE read timeout')), readTimeoutMs)
        );
        const { done, value } = await Promise.race([reader.read(), timeout]);
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              opts.onDone();
              return;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.error) {
                opts.onError(new Error(parsed.error));
                return;
              }
              if (parsed.choices?.[0]?.delta?.content) {
                opts.onChunk(parsed.choices[0].delta.content);
              }
              if (parsed.sources && opts.onSources) {
                opts.onSources(parsed.sources);
              }
            } catch {
              // non-JSON SSE line, skip
            }
          }
        }
      }
      opts.onDone();
    } catch (err: unknown) {
      reader.cancel().catch(() => {});
      if (err instanceof Error && err.name !== 'AbortError') {
        opts.onError(err);
      } else if (!(err instanceof Error)) {
        opts.onError(new Error(String(err)));
      }
    }
  },
};
