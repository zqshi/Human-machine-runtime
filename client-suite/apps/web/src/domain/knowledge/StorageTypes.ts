export interface StorageStats {
  totalGB: number;
  usedGB: number;
  usedPercent: number;
  fileCount: number;
  trend30d: number;
}

export interface DeptStorage {
  departmentId: string;
  departmentName: string;
  usedGB: number;
  fileCount: number;
  color: string;
}

export interface LargeFile {
  id: string;
  name: string;
  departmentName: string;
  sizeMB: number;
  updatedAt: string;
  owner: string;
}
