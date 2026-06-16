import { describe, it, expect } from 'vitest';
import { ChatMessage } from '../ChatMessage';

describe('ChatMessage', () => {
  it('creates a text message', () => {
    const msg = ChatMessage.create({
      id: 'evt1',
      roomId: '!room:server',
      senderId: '@alice:server',
      senderName: 'Alice',
      body: 'Hello world',
      timestamp: 1700000000000,
    });
    expect(msg.id).toBe('evt1');
    expect(msg.contentType).toBe('text');
    expect(msg.body).toBe('Hello world');
    expect(msg.isFromUser('@alice:server')).toBe(true);
    expect(msg.isFromUser('@bob:server')).toBe(false);
  });

  it('creates an image message', () => {
    const msg = ChatMessage.create({
      id: 'evt2',
      roomId: '!room:server',
      senderId: '@bob:server',
      senderName: 'Bob',
      body: 'photo.jpg',
      timestamp: 1700000001000,
      contentType: 'image',
      mediaUrl: 'https://example.com/photo.jpg',
    });
    expect(msg.contentType).toBe('image');
    expect(msg.mediaUrl).toBe('https://example.com/photo.jpg');
  });

  it('creates an agent-card message', () => {
    const msg = ChatMessage.create({
      id: 'evt3',
      roomId: '!room:server',
      senderId: '@bot:server',
      senderName: 'Factory Bot',
      body: 'Agent created',
      timestamp: 1700000002000,
      contentType: 'agent-card',
      agentCard: { name: '小明', role: '前端工程师' },
    });
    expect(msg.contentType).toBe('agent-card');
    expect(msg.agentCard?.name).toBe('小明');
  });

  it('detects bot messages', () => {
    const botMsg = ChatMessage.create({
      id: 'evt4',
      roomId: '!room:server',
      senderId: '@dcf-bot:server',
      senderName: 'DCF Bot',
      body: 'Hi',
      timestamp: 1700000003000,
    });
    expect(botMsg.isBot).toBe(true);

    const userMsg = ChatMessage.create({
      id: 'evt5',
      roomId: '!room:server',
      senderId: '@alice:server',
      senderName: 'Alice',
      body: 'Hi',
      timestamp: 1700000004000,
    });
    expect(userMsg.isBot).toBe(false);
  });

  it('formats relative time', () => {
    const msg = ChatMessage.create({
      id: 'evt6',
      roomId: '!room:server',
      senderId: '@alice:server',
      senderName: 'Alice',
      body: 'test',
      timestamp: Date.now() - 60_000, // 1 min ago
    });
    expect(msg.formattedTime).toBeDefined();
    expect(typeof msg.formattedTime).toBe('string');
  });
});
