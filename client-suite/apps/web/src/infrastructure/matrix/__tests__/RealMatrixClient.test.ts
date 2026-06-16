/**
 * RealMatrixClient — 单元测试
 * 验证 IMatrixClient 接口实现正确性（使用 mock SDK）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock matrix-js-sdk before importing RealMatrixClient
const mockClient = {
  login: vi.fn(),
  getProfileInfo: vi.fn(),
  on: vi.fn(),
  startClient: vi.fn(),
  stopClient: vi.fn(),
  logout: vi.fn(),
  getRooms: vi.fn().mockReturnValue([]),
  getUserId: vi.fn().mockReturnValue('@test:example.com'),
  getRoom: vi.fn(),
  sendMessage: vi.fn(),
  uploadContent: vi.fn(),
  sendTyping: vi.fn().mockReturnValue(Promise.resolve()),
  sendReadReceipt: vi.fn(),
  createRoom: vi.fn(),
  searchUserDirectory: vi.fn(),
  mxcUrlToHttp: vi.fn().mockReturnValue('https://example.com/avatar.jpg'),
};

vi.mock('matrix-js-sdk', () => ({
  createClient: vi.fn(() => mockClient),
  ClientEvent: { Sync: 'sync' },
  RoomEvent: { Timeline: 'Room.timeline' },
  RoomMemberEvent: { Typing: 'RoomMember.typing' },
  Preset: { TrustedPrivateChat: 'trusted_private_chat' },
  SyncState: {
    Error: 'ERROR',
    Prepared: 'PREPARED',
    Stopped: 'STOPPED',
    Syncing: 'SYNCING',
    Catchup: 'CATCHUP',
    Reconnecting: 'RECONNECTING',
  },
}));

vi.mock('matrix-js-sdk/lib/@types/event', () => ({
  MsgType: { Text: 'm.text', Image: 'm.image', File: 'm.file' },
}));

vi.mock('matrix-js-sdk/lib/models/room', () => ({
  NotificationCountType: { Total: 'total' },
}));

import { RealMatrixClient } from '../RealMatrixClient';

describe('RealMatrixClient', () => {
  let client: RealMatrixClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.login.mockResolvedValue({
      user_id: '@test:example.com',
      access_token: 'real-token-123',
    });
    mockClient.getProfileInfo.mockResolvedValue({
      displayname: 'Test User',
      avatar_url: null,
    });
    mockClient.startClient.mockResolvedValue(undefined);
    client = new RealMatrixClient();
  });

  it('login returns userId and accessToken', async () => {
    const result = await client.login('https://matrix.example.com', 'test', 'pass');
    expect(result.userId).toBe('@test:example.com');
    expect(result.accessToken).toBe('real-token-123');
  });

  it('login returns deviceId when server provides one', async () => {
    mockClient.login.mockResolvedValue({
      user_id: '@test:example.com',
      access_token: 'real-token-123',
      device_id: 'DEVICE_ABC',
    });
    const result = await client.login('https://matrix.example.com', 'test', 'pass');
    expect(result.deviceId).toBe('DEVICE_ABC');
  });

  it('login initializes user profile', async () => {
    await client.login('https://matrix.example.com', 'test', 'pass');
    const profile = client.getUserProfile();
    expect(profile).not.toBeNull();
    expect(profile!.userId).toBe('@test:example.com');
    expect(profile!.displayName).toBe('Test User');
  });

  it('login registers SDK event listeners', async () => {
    await client.login('https://matrix.example.com', 'test', 'pass');
    // on() should be called for Sync, Timeline, Typing
    expect(mockClient.on).toHaveBeenCalledTimes(3);
  });

  it('login starts the client with initialSyncLimit', async () => {
    await client.login('https://matrix.example.com', 'test', 'pass');
    expect(mockClient.startClient).toHaveBeenCalledWith({ initialSyncLimit: 20 });
  });

  it('initFromSession works without login call', async () => {
    await client.initFromSession('https://matrix.example.com', 'token', '@test:example.com');
    const profile = client.getUserProfile();
    expect(profile!.userId).toBe('@test:example.com');
    expect(client.isReady()).toBe(false); // Ready set by sync callback
  });

  it('logout stops the SDK client', async () => {
    await client.login('https://matrix.example.com', 'test', 'pass');
    await client.logout();
    expect(mockClient.stopClient).toHaveBeenCalled();
    expect(client.getUserProfile()).toBeNull();
    expect(client.isReady()).toBe(false);
  });

  it('sendMessage calls sdk sendMessage with MsgType.Text', async () => {
    await client.login('https://matrix.example.com', 'test', 'pass');
    mockClient.sendMessage.mockResolvedValue({});
    await client.sendMessage('!room:example.com', 'hello');
    expect(mockClient.sendMessage).toHaveBeenCalledWith('!room:example.com', {
      msgtype: 'm.text',
      body: 'hello',
    });
  });

  it('sendTyping calls sdk sendTyping', async () => {
    await client.login('https://matrix.example.com', 'test', 'pass');
    client.sendTyping('!room:example.com', true);
    expect(mockClient.sendTyping).toHaveBeenCalledWith('!room:example.com', true, 5000);
  });

  it('createDmRoom calls sdk createRoom', async () => {
    await client.login('https://matrix.example.com', 'test', 'pass');
    mockClient.createRoom.mockResolvedValue({ room_id: '!new:example.com' });
    const roomId = await client.createDmRoom('@other:example.com');
    expect(roomId).toBe('!new:example.com');
    expect(mockClient.createRoom).toHaveBeenCalledWith({
      preset: 'trusted_private_chat',
      invite: ['@other:example.com'],
      is_direct: true,
    });
  });

  it('onSync callback fires on PREPARED state', async () => {
    const syncFn = vi.fn();
    client.onSync(syncFn);
    await client.login('https://matrix.example.com', 'test', 'pass');

    // Find the sync handler and call it
    const syncHandler = mockClient.on.mock.calls.find(([event]) => event === 'sync')?.[1];
    expect(syncHandler).toBeDefined();
    syncHandler('PREPARED');
    expect(syncFn).toHaveBeenCalled();
    expect(client.isReady()).toBe(true);
  });
});
