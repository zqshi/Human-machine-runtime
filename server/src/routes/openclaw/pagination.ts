/**
 * openclaw 列表端点分页 helper(纯函数,route 层辅助,无业务逻辑)。
 *
 * §7.2.1 第2条硬规则:列表 API 必须支持分页,默认非空,禁止无限制全量返回。
 * T40 曾"接 limit/offset 加分页 done"实为半成品——默认值缺失(Number(x)||undefined),
 * 不传参仍走 repo.list() 全量。此 helper 统一两类列表的分页,消除全量分支:
 *
 * - pagedResponse:无 filter 列表 → repo.listPaged(DB 层 limit/offset,不全量读)
 * - filteredResponse:带 filter 列表 → repo.list + 内存 filter + slice
 *   listPaged 不支持 where filter(实体 EAV+JSONB,filter 字段在 data JSON),
 *   filter 后再分页会分页不准(total/limit 语义错乱);内存 filter+slice 保证
 *   total=filter 后真实总数、分页准确。全量读取是性能债(openclaw 元数据百级量可接受),
 *   JSONB filter 索引优化记 backlog。
 */
import type { OpenclawRepository } from '../../db/repositories/openclaw-repository.js';

/** 统一分页返回结构(与 OpenclawRepository.PagedResult 一致) */
export interface ListPageResult {
  items: Record<string, unknown>[];
  total: number;
  limit: number;
  offset: number;
}

/** 查询参数取值器(Hono c.req.query 签名) */
export type QueryGetter = (key: string) => string | undefined;

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/** 解析分页参数:limit 默认50/上限200,offset 默认0;非法值(0/负/非数字)降级默认 */
export function parsePagination(query: QueryGetter): { limit: number; offset: number } {
  const rawLimit = Number(query('limit'));
  const rawOffset = Number(query('offset'));
  const limit =
    !rawLimit || rawLimit <= 0 ? DEFAULT_LIMIT : Math.min(Math.floor(rawLimit), MAX_LIMIT);
  const offset = !rawOffset || rawOffset < 0 ? 0 : Math.floor(rawOffset);
  return { limit, offset };
}

/** 无 filter 列表:DB 层分页(listPaged),不传参默认 limit=50,永不全量返回 */
export async function pagedResponse(
  repo: OpenclawRepository,
  entityType: string,
  query: QueryGetter
): Promise<ListPageResult> {
  const { limit, offset } = parsePagination(query);
  return repo.listPaged(entityType, { limit, offset });
}

/**
 * 带 filter 列表:全量取 + 内存 filter + slice。
 * total = filter 后真实总数(非全量长度),保证前端分页 UI 正确。
 * filterFn 省略时等价无 filter(全部 slice),保留统一返回结构。
 */
export async function filteredResponse(
  repo: OpenclawRepository,
  entityType: string,
  query: QueryGetter,
  filterFn?: (items: Record<string, unknown>[]) => Record<string, unknown>[]
): Promise<ListPageResult> {
  const { limit, offset } = parsePagination(query);
  let items = await repo.list(entityType);
  if (filterFn) items = filterFn(items);
  return {
    items: items.slice(offset, offset + limit),
    total: items.length,
    limit,
    offset,
  };
}
