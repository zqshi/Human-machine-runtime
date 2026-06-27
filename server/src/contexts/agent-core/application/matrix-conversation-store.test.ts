import { describe, it, expect } from 'vitest';
import { MatrixConversationStore } from './matrix-conversation-store.js';

describe('MatrixConversationStore', () => {
  it('空房间 getHistory 返空数组', () => {
    const s = new MatrixConversationStore();
    expect(s.getHistory('room_1')).toEqual([]);
  });

  it('append user+assistant 后 getHistory 追加顺序正确', () => {
    const s = new MatrixConversationStore();
    s.append('room_1', 'user', '我叫张三');
    s.append('room_1', 'assistant', '已记录');
    expect(s.getHistory('room_1')).toEqual([
      { role: 'user', content: '我叫张三' },
      { role: 'assistant', content: '已记录' },
    ]);
  });

  it('不同 roomId 隔离', () => {
    const s = new MatrixConversationStore();
    s.append('room_1', 'user', 'a');
    s.append('room_2', 'user', 'b');
    expect(s.getHistory('room_1')).toEqual([{ role: 'user', content: 'a' }]);
    expect(s.getHistory('room_2')).toEqual([{ role: 'user', content: 'b' }]);
  });

  it('超 40 条截断保留最近 40', () => {
    const s = new MatrixConversationStore();
    for (let i = 0; i < 50; i++) {
      s.append('room_1', 'user', `m${i}`);
    }
    const h = s.getHistory('room_1');
    expect(h).toHaveLength(40);
    expect(h[0].content).toBe('m10');
    expect(h[39].content).toBe('m49');
  });

  it('空 content 不追加', () => {
    const s = new MatrixConversationStore();
    s.append('room_1', 'user', '');
    s.append('room_1', 'assistant', '   ');
    expect(s.getHistory('room_1')).toEqual([]);
  });

  it('clear 清空房间历史', () => {
    const s = new MatrixConversationStore();
    s.append('room_1', 'user', 'a');
    s.clear('room_1');
    expect(s.getHistory('room_1')).toEqual([]);
  });

  it('size 反映跟踪房间数', () => {
    const s = new MatrixConversationStore();
    expect(s.size).toBe(0);
    s.append('room_1', 'user', 'a');
    expect(s.size).toBe(1);
    s.append('room_2', 'user', 'b');
    expect(s.size).toBe(2);
    s.clear('room_1');
    expect(s.size).toBe(1);
  });
});
