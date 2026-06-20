import { BaseGatewayClient } from './base-client.js';

export interface ClusterInstance {
  appKey: string;
  userId: string;
  employeeNumber: number;
  name: string;
  podName: string;
  pvcName: string;
  svcName: string;
  status: string;
  managedBy: string;
  cluster?: string;
  nodeName?: string;
  lastActive: string;
  createdAt: string;
  isActive: boolean;
  restarts?: number;
  runtimeTemplate?: string;
  agentRevision?: string;
  runMode?: 'single' | 'persistent';
}

export interface ClusterInstanceListResult {
  items: ClusterInstance[];
  total: number;
  page: number;
  pageSize: number;
}

export class ClusterInstanceClient extends BaseGatewayClient {
  async listInstances(page = 1, pageSize = 100): Promise<ClusterInstanceListResult> {
    return this.request<ClusterInstanceListResult>(
      `/api/v1/instances?page=${page}&pageSize=${pageSize}`
    );
  }

  async healthCheck(): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      await this.request('/healthz', { skipRetry: true });
      return true;
    } catch {
      return false;
    }
  }
}
