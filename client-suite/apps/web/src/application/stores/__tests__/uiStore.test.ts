import { describe, it, expect, beforeEach, vi } from 'vitest';

let useUIStore: (typeof import('../uiStore'))['useUIStore'];

beforeEach(async () => {
  vi.resetModules();
  const mod = await import('../uiStore');
  useUIStore = mod.useUIStore;
});

describe('uiStore', () => {
  it('has correct defaults', () => {
    const s = useUIStore.getState();
    expect(s.currentDock).toBe('messages');
    expect(s.appMode).toBe('im');
    expect(s.drawerOpen).toBe(false);
    expect(s.sidebarWidth).toBe(320);
    expect(s.drawerWidth).toBe(0);
    expect(s.subView).toBeNull();
  });

  describe('setDock', () => {
    it('sets dock and clears subView + drawer', () => {
      useUIStore.getState().openDrawer({ type: 'doc', title: 't', data: {} });
      useUIStore.getState().setSubView('some:view');
      useUIStore.getState().setDock('knowledge');
      const s = useUIStore.getState();
      expect(s.currentDock).toBe('knowledge');
      expect(s.subView).toBeNull();
      expect(s.drawerOpen).toBe(false);
    });
  });

  describe('setAppMode', () => {
    it('openclaw mode sets dock to openclaw', () => {
      useUIStore.getState().setAppMode('openclaw');
      expect(useUIStore.getState().currentDock).toBe('openclaw');
    });

    it('im mode sets dock to messages', () => {
      useUIStore.getState().setAppMode('im');
      expect(useUIStore.getState().currentDock).toBe('messages');
    });
  });

  describe('drawer', () => {
    it('openDrawer sets content and open=true', () => {
      const content = { type: 'code' as const, title: '代码', data: { file: 'a.ts' } };
      useUIStore.getState().openDrawer(content);
      const s = useUIStore.getState();
      expect(s.drawerOpen).toBe(true);
      expect(s.drawerContent).toEqual(content);
    });

    it('closeDrawer preserves content for animation', () => {
      useUIStore.getState().openDrawer({ type: 'doc', title: 't', data: {} });
      useUIStore.getState().closeDrawer();
      const s = useUIStore.getState();
      expect(s.drawerOpen).toBe(false);
      expect(s.drawerContent).not.toBeNull();
    });
  });

  describe('sidebar/drawer width clamping', () => {
    it('setSidebarWidth clamps to [260, 400]', () => {
      useUIStore.getState().setSidebarWidth(100);
      expect(useUIStore.getState().sidebarWidth).toBe(260);
      useUIStore.getState().setSidebarWidth(500);
      expect(useUIStore.getState().sidebarWidth).toBe(400);
      useUIStore.getState().setSidebarWidth(330);
      expect(useUIStore.getState().sidebarWidth).toBe(330);
    });

    it('setDrawerWidth clamps to [360, 900]', () => {
      useUIStore.getState().setDrawerWidth(100);
      expect(useUIStore.getState().drawerWidth).toBe(360);
      useUIStore.getState().setDrawerWidth(1200);
      expect(useUIStore.getState().drawerWidth).toBe(900);
    });

    it('resetDrawerWidth sets to 0', () => {
      useUIStore.getState().setDrawerWidth(500);
      useUIStore.getState().resetDrawerWidth();
      expect(useUIStore.getState().drawerWidth).toBe(0);
    });
  });

  describe('reset', () => {
    it('restores all defaults', () => {
      useUIStore.getState().setDock('knowledge');
      useUIStore.getState().setAppMode('openclaw');
      useUIStore.getState().setSidebarWidth(400);
      useUIStore.getState().setContactsDept('engineering');
      useUIStore.getState().reset();
      const s = useUIStore.getState();
      expect(s.currentDock).toBe('messages');
      expect(s.appMode).toBe('im');
      expect(s.sidebarWidth).toBe(320);
      expect(s.contactsDept).toBe('all');
    });
  });
});
