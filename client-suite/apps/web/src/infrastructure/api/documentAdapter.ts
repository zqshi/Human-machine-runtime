/**
 * Document DTO ↔ Domain adapter
 *
 * Converts between backend DocumentDTO and frontend Document domain model.
 */
import type { DocumentDTO } from './dcfApiClient';
import type { DocumentType, DocumentProps } from '../../domain/knowledge/Document';
import { Document } from '../../domain/knowledge/Document';

const VALID_TYPES: DocumentType[] = ['doc', 'sheet', 'slide', 'markdown'];

function toFrontendType(raw: string): DocumentType {
  if (VALID_TYPES.includes(raw as DocumentType)) return raw as DocumentType;
  if (raw === 'code') return 'markdown';
  return 'doc';
}

export function fromDTO(dto: DocumentDTO): Document {
  const rawMeta = dto.content?._meta ?? {};
  const meta = rawMeta as { folderId?: string; tags?: string[]; starred?: boolean };
  const htmlContent = typeof dto.content?.html === 'string' ? dto.content.html : '';

  const props: DocumentProps = {
    id: dto.id,
    title: dto.title,
    content: htmlContent,
    folderId: meta.folderId ?? '',
    type: toFrontendType(dto.type),
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    author: { name: dto.createdBy || 'system' },
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    starred: Boolean(meta.starred),
    size:
      htmlContent.length > 1024
        ? `${Math.round(htmlContent.length / 1024)} KB`
        : `${htmlContent.length} B`,
    // New fields from backend
    status: (((dto as unknown as Record<string, unknown>).status as string) ||
      'draft') as DocumentProps['status'],
    categoryId:
      ((dto as unknown as Record<string, unknown>).categoryId as string) || meta.folderId || '',
    departmentId: ((dto as unknown as Record<string, unknown>).departmentId as string) || '',
    ownerId:
      ((dto as unknown as Record<string, unknown>).ownerId as string) || dto.createdBy || 'system',
    permissions: Array.isArray((dto as unknown as Record<string, unknown>).permissions)
      ? ((dto as unknown as Record<string, unknown>).permissions as DocumentProps['permissions'])
      : [],
  };

  return Document.create(props);
}

export function toCreateDTO(doc: {
  title: string;
  type?: DocumentType;
  content?: string;
  folderId?: string;
  tags?: string[];
  starred?: boolean;
}): Partial<DocumentDTO> {
  return {
    title: doc.title,
    type: doc.type ?? 'doc',
    content: {
      html: doc.content ?? '',
      _meta: {
        folderId: doc.folderId ?? null,
        tags: doc.tags ?? [],
        starred: doc.starred ?? false,
      },
    },
  };
}

export function toUpdateDTO(doc: {
  title?: string;
  content?: string;
  folderId?: string;
  tags?: string[];
  starred?: boolean;
  version?: number;
}): Partial<DocumentDTO> {
  const payload: Partial<DocumentDTO> = {};
  if (doc.title !== undefined) payload.title = doc.title;
  if (doc.version !== undefined) payload.version = doc.version;

  const meta: Record<string, unknown> = {};
  if (doc.folderId !== undefined) meta.folderId = doc.folderId;
  if (doc.tags !== undefined) meta.tags = doc.tags;
  if (doc.starred !== undefined) meta.starred = doc.starred;

  payload.content = {
    ...(doc.content !== undefined ? { html: doc.content } : {}),
    _meta: meta,
  };

  return payload;
}
