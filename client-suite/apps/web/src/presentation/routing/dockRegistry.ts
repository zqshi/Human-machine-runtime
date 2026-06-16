import type { ComponentType } from 'react';
import type { DockTab } from '../../domain/shared/types';

export interface DockRoute {
  key: DockTab;
  icon: string;
  label: string;
  Sidebar: ComponentType | null;
  Main: ComponentType;
  position: 'top' | 'bottom';
}

const registry: DockRoute[] = [];

export function registerDockRoute(route: DockRoute) {
  const idx = registry.findIndex((r) => r.key === route.key);
  if (idx >= 0) registry[idx] = route;
  else registry.push(route);
}

export function getDockRoutes(): readonly DockRoute[] {
  return registry;
}

export function getDockRoute(key: DockTab): DockRoute | undefined {
  return registry.find((r) => r.key === key);
}

