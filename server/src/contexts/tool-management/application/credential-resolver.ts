/**
 * credential-resolver — 凭证解密共享 helper(纯函数)。
 *
 * 横切关注点:被 ToolSourceService(sync/introspect/testConnection)与
 * ToolExecutionService(executeTool)共用。提为独立纯函数,避免子 service 互相耦合
 * (Execution 不应调 Source 的方法取 credential),保持委托拆分后子 service 间无依赖。
 *
 * credentialId 在 tool source/instance 是 varchar string,credential-vault authz.id
 * 是 serial number——此处 Number() 转换,非整数返回 undefined(调用方报错,不静默)。
 * DB 工具约定 secretType='username'/'password' 两个 secret。
 */
import type { CredentialSecretProvider, DecryptedCredential } from '../types.js';

export async function resolveCredential(
  provider: CredentialSecretProvider,
  credentialId: string
): Promise<DecryptedCredential | undefined> {
  const id = Number(credentialId);
  if (!Number.isInteger(id)) return undefined;
  const username = await provider.getCredentialSecret(id, 'username');
  const password = await provider.getCredentialSecret(id, 'password');
  if (username === null && password === null) return undefined;
  return { type: 'basic', username: username ?? undefined, password: password ?? undefined };
}
