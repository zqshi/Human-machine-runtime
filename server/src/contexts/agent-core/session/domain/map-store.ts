/**
 * IMapStore — 简单 KV 存储抽象,供 SessionStore / AgentExecutor 等依赖。
 *
 * 从 agent-simulator-types.ts 迁出(Simulator 删除后此接口仍是必需的)。
 * 实现:DbMapStore(落 cockpitEntities 表)/ 内存 Map(测试用)。
 *
 * 本接口故意最小化:不含 delete/list/load 方法。扩展能力由具体实现挂接(DbMapStore
 * 自身有 delete/load),保持 domain 抽象最简。
 */
export interface IMapStore<V> {
  get(key: string): V | undefined;
  set(key: string, value: V): void;
  values(): IterableIterator<V>;
  entries(): IterableIterator<[string, V]>;
}
