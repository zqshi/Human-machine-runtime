import { lazy, type LazyExoticComponent, type ComponentType } from 'react';
import type { DrawerContentType } from '../../../domain/shared/types';

export interface PanelProps {
  data: Record<string, unknown>;
  onChange?: (data: Record<string, unknown>) => void;
  readOnly?: boolean;
}

interface PanelRegistration {
  component: LazyExoticComponent<ComponentType<PanelProps>>;
  label: string;
  icon: string;
  /** Check if this panel is available for given data */
  available: (data: Record<string, unknown>, type: DrawerContentType) => boolean;
}

export type PanelKey = 'doc' | 'code' | 'preview' | 'markdown' | 'spreadsheet' | 'location';

export const panelRegistry: Record<PanelKey, PanelRegistration> = {
  doc: {
    component: lazy(() => import('./panels/DocPanel')),
    label: '文档',
    icon: 'description',
    available: (data, type) => data.html !== undefined || type === 'doc',
  },
  code: {
    component: lazy(() => import('./panels/CodePanel')),
    label: '代码',
    icon: 'code',
    available: (data, type) => data.code !== undefined || type === 'code',
  },
  preview: {
    component: lazy(() => import('./panels/PreviewPanel')),
    label: '预览',
    icon: 'preview',
    available: (data, type) => data.previewHtml !== undefined || type === 'preview',
  },
  markdown: {
    component: lazy(() => import('./panels/MarkdownPanel')),
    label: 'Markdown',
    icon: 'markdown',
    available: (data, type) => data.markdown !== undefined || type === 'markdown',
  },
  spreadsheet: {
    component: lazy(() => import('./panels/SpreadsheetPanel')),
    label: '表格',
    icon: 'table_chart',
    available: (data, type) => data.spreadsheet !== undefined || type === 'spreadsheet',
  },
  location: {
    component: lazy(() => import('./panels/LocationPanel')),
    label: '位置',
    icon: 'location_on',
    available: (data, type) => data.location !== undefined || type === 'location',
  },
};

export const PANEL_KEYS = Object.keys(panelRegistry) as PanelKey[];

export function getAvailablePanels(data: Record<string, unknown>, type: DrawerContentType): PanelKey[] {
  const keys = PANEL_KEYS.filter((k) => panelRegistry[k].available(data, type));
  if (keys.length === 0) keys.push('doc');
  return keys;
}
