import { eq, asc } from 'drizzle-orm';
import type { Database } from '../client.js';
import { appCatalog } from '../schema/app-catalog.js';

export interface AppCatalogItem {
  id: number;
  name: string;
  icon: string;
  iconColor: string;
  category: string;
  description: string | null;
  status: string;
  sortOrder: number;
  visible: boolean;
  tenantId: string | null;
}

export class AppCatalogRepository {
  constructor(private db: Database) {}

  async list(category?: string): Promise<AppCatalogItem[]> {
    if (category) {
      return this.db
        .select()
        .from(appCatalog)
        .where(eq(appCatalog.category, category))
        .orderBy(asc(appCatalog.sortOrder));
    }
    return this.db.select().from(appCatalog).orderBy(asc(appCatalog.sortOrder));
  }

  async get(id: number): Promise<AppCatalogItem | null> {
    const [row] = await this.db.select().from(appCatalog).where(eq(appCatalog.id, id)).limit(1);
    return row ?? null;
  }

  async create(data: Omit<AppCatalogItem, 'id'>): Promise<AppCatalogItem> {
    const [row] = await this.db.insert(appCatalog).values(data).returning();
    return row;
  }

  async update(
    id: number,
    data: Partial<Omit<AppCatalogItem, 'id'>>
  ): Promise<AppCatalogItem | null> {
    const [row] = await this.db
      .update(appCatalog)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(appCatalog.id, id))
      .returning();
    return row ?? null;
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.db.delete(appCatalog).where(eq(appCatalog.id, id)).returning();
    return result.length > 0;
  }
}
