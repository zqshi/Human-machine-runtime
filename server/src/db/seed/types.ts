export type SeedProfileName = 'production' | 'showcase';

export interface SeedUser {
  username: string;
  password: string;
  role: string;
  scope: string;
  displayName: string;
  email: string;
  tenantId: string | null;
  source?: string;
}

export interface SeedTenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  industry: string;
  companySize: string;
  contactName: string;
  contactEmail: string;
  description: string;
  quotas: Record<string, unknown>;
  features: Record<string, boolean>;
  modelAccess: { allowedProviders: string[] };
}

export interface SeedInstance {
  id: string;
  tenantId: string;
  name: string;
  source: string;
  type: string;
  state: string;
  creator: string;
  employeeNo: string;
  employeeId: string;
  jobTitle: string;
  department: string;
}

export interface SeedConfig {
  key: string;
  value: string;
  description: string;
}

export interface SeedData {
  users: SeedUser[];
  tenant: SeedTenant;
  instances: SeedInstance[];
  systemConfigs: SeedConfig[];
}

export interface SeedProfile {
  name: SeedProfileName;
  seed: SeedData;
}
