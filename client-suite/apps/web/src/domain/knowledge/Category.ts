/**
 * Category — 系统分类常量
 *
 * 知识库的 5 个顶级分类，type 为 'system' 不可删除。
 * 用户/部门可以在这些分类下创建子文件夹。
 */

export interface SystemCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export const SYSTEM_CATEGORIES: SystemCategory[] = [
  { id: 'cat-official', name: '官方指南', icon: 'verified', description: '公司级规范、制度和使用手册' },
  { id: 'cat-standard', name: '标准流程', icon: 'account_tree', description: '标准化业务流程和操作规范' },
  { id: 'cat-department', name: '部门资产', icon: 'corporate_fare', description: '各部门的知识资产和文档' },
  { id: 'cat-personal', name: '个人空间', icon: 'person', description: '个人文档和笔记' },
  { id: 'cat-shared', name: '共享空间', icon: 'group', description: '跨部门协作文档' },
];

export function findCategoryById(id: string): SystemCategory | undefined {
  return SYSTEM_CATEGORIES.find((c) => c.id === id);
}

export function getCategoryName(id: string): string {
  return findCategoryById(id)?.name ?? id;
}
