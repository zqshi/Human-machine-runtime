/**
 * WpsImAdapter — WPS IM (claw-farm) 适配器
 * WebSocket 连接 claw-farm 实时通信，BFF 代理路由收发消息
 */
import type {
  IMatrixClient,
  UserProfile,
  LoginResult,
  SearchUserResult,
  SyncCallback,
  TimelineCallback,
  TypingCallback,
  ConnectionCallback,
} from './MatrixClientAdapter';
import { ChatMessage } from '../../domain/chat/ChatMessage';
import { ChatRoom } from '../../domain/chat/ChatRoom';
import type {
  RoomId,
  UserId,
  ConnectionState,
  MessageContentType,
} from '../../domain/shared/types';
import { NotImplementedError } from '../../domain/shared/errors';

/** WPS WebSocket 协议类型 */
interface WpsMessageContent {
  type: 'text' | 'image' | 'file' | 'rich_text' | 'card';
  text?: { content: string };
  image?: { url: string; width: number; height: number };
  file?: { name: string; url: string; size: number };
  elements?: { type: string; text?: string; [k: string]: unknown }[];
  [k: string]: unknown;
}

interface WpsMessageEvent {
  type: 'message';
  roomId: string;
  sender: string;
  senderName: string;
  content: WpsMessageContent;
  timestamp: number;
}

interface WpsRoomItem {
  id: string;
  name: string;
  type: 'group' | 'dm' | 'bot';
  unread: number;
  lastMessage: string;
  lastTimestamp: number;
}

type WpsEvent =
  | WpsMessageEvent
  | { type: 'rooms'; rooms: WpsRoomItem[] }
  | { type: 'typing'; roomId: string; userId: string; typing: boolean }
  | { type: 'connected'; userId: string };

const BFF_SEND_MESSAGE = '/api/proxy/farm/send-message';
const BFF_PROFILE = '/api/proxy/portal/profile';

function mapContentType(t: WpsMessageContent['type']): MessageContentType {
  if (t === 'image') return 'image';
  if (t === 'file') return 'file';
  if (t === 'card') return 'agent-card';
  return 'text';
}

function extractBody(c: WpsMessageContent): string {
  switch (c.type) {
    case 'text':
      return c.text?.content ?? '';
    case 'image':
      return '[图片]';
    case 'file':
      return `[文件: ${c.file?.name ?? '未知'}]`;
    case 'rich_text':
      return c.elements?.map((el) => el.text ?? '').join('') ?? '';
    case 'card':
      return JSON.stringify(c);
    default:
      return '';
  }
}

function extractMediaUrl(c: WpsMessageContent): string | undefined {
  if (c.type === 'image') return c.image?.url;
  if (c.type === 'file') return c.file?.url;
  return undefined;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export class WpsImAdapter implements IMatrixClient {
  private farmBaseUrl: string;
  private ws: WebSocket | null = null;
  private user: UserProfile | null = null;
  private _ready = false;
  private _connState: ConnectionState = 'disconnected';
  private _rooms = new Map<RoomId, ChatRoom>();
  private _msgs = new Map<RoomId, ChatMessage[]>();
  private syncCbs: SyncCallback[] = [];
  private timelineCbs: TimelineCallback[] = [];
  private typingCbs: TypingCallback[] = [];
  private connCbs: ConnectionCallback[] = [];
  private reconTimer: ReturnType<typeof setTimeout> | null = null;
  private reconAttempts = 0;
  private disposed = false;

  constructor(farmBaseUrl: string) {
    this.farmBaseUrl = farmBaseUrl.replace(/\/+$/, '');
  }

  // --- Auth / lifecycle ---

  async login(_hs: string, username: string, _pw: string): Promise<LoginResult> {
    this.user = { userId: username, displayName: username, avatarUrl: null };
    await this.fetchProfile(username);
    this.connectWs(username);
    this._ready = true;
    return { userId: username, accessToken: `wps-token-${username}` };
  }

  async loginWithToken(_hs: string, token: string): Promise<LoginResult> {
    return this.login('', token, '');
  }

  async initFromSession(_hs: string, _tok: string, userId: UserId, _dev?: string): Promise<void> {
    this.user = { userId, displayName: userId, avatarUrl: null };
    await this.fetchProfile(userId);
    this.connectWs(userId);
    this._ready = true;
  }

  async logout(): Promise<void> {
    this.disposed = true;
    this._ready = false;
    if (this.reconTimer) {
      clearTimeout(this.reconTimer);
      this.reconTimer = null;
    }
    if (this.ws) {
      this.ws.onopen = this.ws.onclose = this.ws.onerror = this.ws.onmessage = null;
      this.ws.close();
      this.ws = null;
    }
    this._rooms.clear();
    this._msgs.clear();
    this.user = null;
    this.setConnState('disconnected');
  }

  // --- Profile ---

  getUserProfile(): UserProfile | null {
    return this.user;
  }

  private async fetchProfile(userId: string): Promise<void> {
    try {
      const res = await fetch(`${BFF_PROFILE}/${encodeURIComponent(userId)}`);
      if (res.ok) {
        const d = await res.json();
        this.user = {
          userId,
          displayName: d.displayName ?? d.name ?? userId,
          avatarUrl: d.avatarUrl ?? null,
          org: d.org,
          department: d.department,
          role: d.role,
        };
      }
    } catch {
      /* keep default */
    }
  }

  // --- Rooms ---

  getRooms(): ChatRoom[] {
    return Array.from(this._rooms.values()).sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return (b.lastMessageTs ?? 0) - (a.lastMessageTs ?? 0);
    });
  }

  getMessages(roomId: RoomId): ChatMessage[] {
    return this._msgs.get(roomId) ?? [];
  }

  async selectRoom(roomId: RoomId): Promise<void> {
    const r = this._rooms.get(roomId);
    if (r && r.unreadCount > 0) this._rooms.set(roomId, r.withUnread(0));
  }

  async loadOlderMessages(_rid: RoomId, _lim?: number): Promise<boolean> {
    return false;
  }

  // --- Send ---

  async sendMessage(roomId: RoomId, body: string, _reply?: string): Promise<void> {
    const res = await fetch(BFF_SEND_MESSAGE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId,
        sender: this.user?.userId,
        content: { type: 'text', text: { content: body } },
      }),
    });
    if (!res.ok) throw new Error(`发送消息失败: ${res.status}`);
  }

  async editMessage(_rid: RoomId, _eid: string, _body: string): Promise<void> {
    throw new NotImplementedError('WpsImAdapter.editMessage');
  }

  async redactMessage(_rid: RoomId, _eid: string): Promise<void> {
    throw new NotImplementedError('WpsImAdapter.redactMessage');
  }

  async sendFile(roomId: RoomId, file: File): Promise<void> {
    const fd = new FormData();
    fd.append('roomId', roomId);
    fd.append('sender', this.user?.userId ?? '');
    fd.append('file', file);
    const res = await fetch(BFF_SEND_MESSAGE, { method: 'POST', body: fd });
    if (!res.ok) throw new Error(`发送文件失败: ${res.status}`);
  }

  sendTyping(roomId: RoomId, typing: boolean): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'typing', roomId, userId: this.user?.userId, typing }));
    }
  }

  // --- Room management stubs ---

  async createDmRoom(userId: UserId): Promise<RoomId | null> {
    for (const r of this._rooms.values()) {
      if (r.isDm && r.id.includes(userId)) return r.id;
    }
    throw new NotImplementedError('WpsImAdapter.createDmRoom');
  }

  async searchUsers(_t: string): Promise<SearchUserResult[]> {
    return [];
  }
  getKnownUsers(): SearchUserResult[] {
    return [];
  }
  getRoomMembers(_rid: RoomId): SearchUserResult[] {
    return [];
  }

  async inviteToRoom(_rid: RoomId, _uid: UserId): Promise<void> {
    throw new NotImplementedError('WpsImAdapter.inviteToRoom');
  }

  async createGroupRoom(_name: string, _uids: UserId[]): Promise<RoomId | null> {
    throw new NotImplementedError('WpsImAdapter.createGroupRoom');
  }

  async joinRoom(_alias: string): Promise<RoomId | null> {
    throw new NotImplementedError('WpsImAdapter.joinRoom');
  }

  async leaveRoom(_rid: RoomId): Promise<void> {
    throw new NotImplementedError('WpsImAdapter.leaveRoom');
  }

  // --- Connection state ---

  getConnectionState(): ConnectionState {
    return this._connState;
  }
  isReady(): boolean {
    return this._ready;
  }
  getUnderlyingClient(): unknown {
    return this.ws;
  }

  // --- Event callbacks ---

  onSync(cb: SyncCallback): void {
    this.syncCbs.push(cb);
  }
  offSync(cb: SyncCallback): void {
    this.syncCbs = this.syncCbs.filter((c) => c !== cb);
  }
  onTimeline(cb: TimelineCallback): void {
    this.timelineCbs.push(cb);
  }
  offTimeline(cb: TimelineCallback): void {
    this.timelineCbs = this.timelineCbs.filter((c) => c !== cb);
  }
  onTyping(cb: TypingCallback): void {
    this.typingCbs.push(cb);
  }
  offTyping(cb: TypingCallback): void {
    this.typingCbs = this.typingCbs.filter((c) => c !== cb);
  }
  onConnection(cb: ConnectionCallback): void {
    this.connCbs.push(cb);
  }
  offConnection(cb: ConnectionCallback): void {
    this.connCbs = this.connCbs.filter((c) => c !== cb);
  }

  // --- WebSocket internals ---

  private connectWs(userId: string): void {
    if (this.disposed) return;
    this.setConnState('connecting');
    const wsUrl = this.farmBaseUrl.replace(/^http/, 'ws') + '/ws';
    this.ws = new WebSocket(`${wsUrl}?userId=${encodeURIComponent(userId)}`);
    this.ws.onopen = () => {
      this.reconAttempts = 0;
      this.setConnState('connected');
      this.fireSyncCbs();
    };
    this.ws.onmessage = (ev: MessageEvent) => {
      try {
        this.handleWsEvent(JSON.parse(ev.data as string) as WpsEvent);
      } catch {
        /* ignore */
      }
    };
    this.ws.onclose = () => {
      if (!this.disposed) {
        this.setConnState('reconnecting');
        this.scheduleRecon(userId);
      }
    };
    this.ws.onerror = () => {
      /* onclose fires after onerror */
    };
  }

  private scheduleRecon(userId: string): void {
    if (this.disposed || this.reconAttempts >= 10) {
      this.setConnState('error');
      return;
    }
    const delay = Math.min(1000 * 2 ** this.reconAttempts, 30000);
    this.reconAttempts++;
    this.reconTimer = setTimeout(() => this.connectWs(userId), delay);
  }

  private setConnState(s: ConnectionState): void {
    if (this._connState === s) return;
    this._connState = s;
    for (const cb of this.connCbs) cb(s);
  }

  private fireSyncCbs(): void {
    for (const cb of this.syncCbs) cb();
  }

  // --- WPS event handling ---

  private handleWsEvent(evt: WpsEvent): void {
    switch (evt.type) {
      case 'message':
        this.handleMsg(evt);
        break;
      case 'rooms':
        this.handleRoomList(evt.rooms);
        break;
      case 'typing':
        for (const cb of this.typingCbs) cb(evt.roomId, evt.userId, evt.typing);
        break;
      case 'connected':
        this.fireSyncCbs();
        break;
    }
  }

  private handleMsg(evt: WpsMessageEvent): void {
    const contentType = mapContentType(evt.content.type);
    const body = extractBody(evt.content);
    const msg = ChatMessage.create({
      id: `wps-${evt.roomId}-${evt.timestamp}-${Math.random().toString(36).slice(2, 6)}`,
      roomId: evt.roomId,
      senderId: evt.sender,
      senderName: evt.senderName,
      body,
      timestamp: evt.timestamp,
      contentType,
      mediaUrl: extractMediaUrl(evt.content),
      fileSize:
        evt.content.type === 'file' && evt.content.file
          ? fmtBytes(evt.content.file.size)
          : undefined,
    });
    const msgs = this._msgs.get(evt.roomId) ?? [];
    msgs.push(msg);
    this._msgs.set(evt.roomId, msgs);

    const room = this._rooms.get(evt.roomId);
    if (room) {
      const isSelf = evt.sender === this.user?.userId;
      this._rooms.set(
        evt.roomId,
        room
          .withLastMessage(body, evt.timestamp)
          .withUnread(isSelf ? room.unreadCount : room.unreadCount + 1)
      );
    }
    for (const cb of this.timelineCbs) cb(evt.roomId);
    this.fireSyncCbs();
  }

  private handleRoomList(rooms: WpsRoomItem[]): void {
    for (const r of rooms) {
      const roomType = r.type === 'group' ? 'group' : r.type === 'bot' ? 'bot' : 'dm';
      const existing = this._rooms.get(r.id);
      this._rooms.set(
        r.id,
        ChatRoom.create({
          id: r.id,
          name: r.name,
          type: roomType,
          unreadCount: r.unread,
          lastMessage: r.lastMessage,
          lastMessageTs: r.lastTimestamp,
          pinned: existing?.pinned,
        })
      );
    }
    this.fireSyncCbs();
  }
}
