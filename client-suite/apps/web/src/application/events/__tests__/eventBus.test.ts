import { describe, it, expect, vi, beforeEach } from 'vitest';

let appEvents: (typeof import('../eventBus'))['appEvents'];

beforeEach(async () => {
  vi.resetModules();
  const mod = await import('../eventBus');
  appEvents = mod.appEvents;
});

describe('EventBus', () => {
  it('on + emit delivers payload to handler', () => {
    const handler = vi.fn();
    appEvents.on('navigate:chat', handler);
    appEvents.emit('navigate:chat', { roomId: 'room-1' });
    expect(handler).toHaveBeenCalledWith({ roomId: 'room-1' });
  });

  it('unsubscribe stops delivery', () => {
    const handler = vi.fn();
    const unsub = appEvents.on('navigate:chat', handler);
    unsub();
    appEvents.emit('navigate:chat', { roomId: 'room-1' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('off removes specific handler', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    appEvents.on('navigate:chat', h1);
    appEvents.on('navigate:chat', h2);
    appEvents.off('navigate:chat', h1);
    appEvents.emit('navigate:chat', { roomId: 'room-1' });
    expect(h1).not.toHaveBeenCalled();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('multiple handlers for same event all fire', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    appEvents.on('decision:created', h1);
    appEvents.on('decision:created', h2);
    appEvents.emit('decision:created', {
      decisionId: 'd1',
      agentId: 'a1',
      urgency: 'high',
    });
    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('handler for one event does not fire for another', () => {
    const handler = vi.fn();
    appEvents.on('navigate:chat', handler);
    appEvents.emit('navigate:knowledge', { subView: 'docs' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('emit with no subscribers does not throw', () => {
    expect(() => {
      appEvents.emit('approval:resolved', {
        documentId: 'd1',
        documentName: 'doc',
        approved: true,
      });
    }).not.toThrow();
  });

  it('signalBus is accessible', () => {
    expect(appEvents.signalBus).toBeDefined();
  });
});
