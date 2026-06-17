/**
 * RealMatrixClient — 真实 matrix-js-sdk 适配器
 * 实现 IMatrixClient 接口，封装官方 SDK 调用
 */
import * as sdk from 'matrix-js-sdk';
import { MsgType } from 'matrix-js-sdk/lib/@types/event';
import { NotificationCountType } from 'matrix-js-sdk/lib/models/room';
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
import type { RoomId, UserId, ConnectionState } from '../../domain/shared/types';

const BOT_PATTERNS = [/^@hmr-bot/, /^@factory/, /^@agent-/];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function guessDmUserId(room: sdk.Room, myUserId: string): string | null {
  const members = room.getJoinedMembers();
  if (members.length === 2) {
    return members.find((m) => m.userId !== myUserId)?.userId ?? null;
  }
  return null;
}

function guessRoomType(dmUserId: string | null): 'dm' | 'bot' | 'group' {
  if (!dmUserId) return 'group';
  return BOT_PATTERNS.some((p) => p.test(dmUserId)) ? 'bot' : 'dm';
}

function getEventText(event: sdk.MatrixEvent): string {
  if (event.getType() === 'm.room.message') {
    const content = event.getContent();
    switch (content.msgtype) {
      case 'm.text':
        return content.body?.slice(0, 80) ?? '';
      case 'm.image':
        return '[图片]';
      case 'm.file':
        return `[文件] ${content.body ?? ''}`;
      case 'm.audio':
        return '[语音]';
      case 'm.video':
        return '[视频]';
      default:
        return content.body?.slice(0, 80) ?? '';
    }
  }
  if (event.getType() === 'm.room.member') return '成员变动';
  return '';
}

export class RealMatrixClient implements IMatrixClient {
  private client: sdk.MatrixClient | null = null;
  private user: UserProfile | null = null;
  private ready = false;

  private connectionState: ConnectionState = 'connecting';
  private syncCbs: SyncCallback[] = [];
  private timelineCbs: TimelineCallback[] = [];
  private typingCbs: TypingCallback[] = [];
  private connectionCbs: ConnectionCallback[] = [];

  async loginWithToken(homeserverUrl: string, loginToken: string): Promise<LoginResult> {
    const tempClient = sdk.createClient({ baseUrl: homeserverUrl });
    const resp = await tempClient.login('m.login.token', {
      token: loginToken,
    });
    const userId = resp.user_id;
    const accessToken = resp.access_token;
    const deviceId = resp.device_id;
    this.user = {
      userId,
      displayName: userId.split(':')[0].slice(1),
      avatarUrl: null,
      org: '数字员工',
    };
    await this.initClient(homeserverUrl, accessToken, userId, deviceId);
    return { userId, accessToken, deviceId };
  }

  async login(homeserverUrl: string, username: string, password: string): Promise<LoginResult> {
    const tempClient = sdk.createClient({ baseUrl: homeserverUrl });
    const resp = await tempClient.login('m.login.password', {
      user: username,
      password,
    });

    const userId = resp.user_id;
    const accessToken = resp.access_token;
    const deviceId = resp.device_id;

    this.user = {
      userId,
      displayName: userId.split(':')[0].slice(1),
      avatarUrl: null,
      org: '数字员工',
    };

    await this.initClient(homeserverUrl, accessToken, userId, deviceId);

    return { userId, accessToken, deviceId };
  }

  async initFromSession(
    homeserverUrl: string,
    accessToken: string,
    userId: UserId,
    deviceId?: string
  ): Promise<void> {
    this.user = {
      userId,
      displayName: userId.split(':')[0].slice(1),
      avatarUrl: null,
      org: '数字员工',
    };
    await this.initClient(homeserverUrl, accessToken, userId, deviceId);
  }

  async logout(): Promise<void> {
    if (this.client) {
      try {
        await this.client.logout(true);
      } catch {
        /* ignore */
      }
      this.client.stopClient();
      this.client = null;
    }
    this.user = null;
    this.ready = false;
  }

  getUserProfile(): UserProfile | null {
    return this.user;
  }

  getRooms(): ChatRoom[] {
    if (!this.client) return [];
    const myUserId = this.client.getUserId() ?? '';

    return this.client
      .getRooms()
      .filter((r) => {
        const me = r.getMember(myUserId);
        return me && me.membership === 'join';
      })
      .map((r) => {
        const lastEvent = r.timeline?.[r.timeline.length - 1];
        const dmUserId = guessDmUserId(r, myUserId);
        return ChatRoom.create({
          id: r.roomId,
          name: r.name || '未命名',
          type: guessRoomType(dmUserId),
          lastMessage: lastEvent ? getEventText(lastEvent) : '',
          lastMessageTs: lastEvent?.getTs() ?? 0,
          unreadCount: r.getUnreadNotificationCount(NotificationCountType.Total) ?? 0,
          memberCount: r.getJoinedMemberCount(),
        });
      })
      .sort((a, b) => (b.lastMessageTs ?? 0) - (a.lastMessageTs ?? 0));
  }

  getMessages(roomId: RoomId): ChatMessage[] {
    if (!this.client) return [];
    const room = this.client.getRoom(roomId);
    if (!room) return [];
    return room.timeline
      .filter((ev) => {
        const t = ev.getType();
        if (t === 'm.room.message' || t === 'm.room.encrypted') return true;
        if (t === 'm.room.redaction') return false;
        return false;
      })
      .filter((ev) => {
        if (ev.isRedacted()) return true;
        const rel = ev.getContent()?.['m.relates_to'];
        if (rel?.rel_type === 'm.replace') return false;
        return true;
      })
      .map((ev) => {
        if (ev.isRedacted()) {
          const senderId = ev.getSender() ?? '';
          const member = room.getMember(senderId);
          return ChatMessage.create({
            id: ev.getId() ?? `evt-${ev.getTs()}`,
            roomId,
            senderId,
            senderName: member?.name ?? senderId.split(':')[0].slice(1),
            body: '此消息已撤回',
            timestamp: ev.getTs(),
            contentType: 'redacted',
          });
        }
        if (ev.getType() === 'm.room.encrypted') {
          const senderId = ev.getSender() ?? '';
          const member = room.getMember(senderId);
          return ChatMessage.create({
            id: ev.getId() ?? `evt-${ev.getTs()}`,
            roomId,
            senderId,
            senderName: member?.name ?? senderId.split(':')[0].slice(1),
            body: '🔒 无法解密此消息（E2EE 未启用）',
            timestamp: ev.getTs(),
            contentType: 'encrypted',
          });
        }

        const replacingEvent = ev.replacingEvent();
        const content = replacingEvent
          ? ((replacingEvent.getContent()['m.new_content'] as Record<string, unknown>) ??
            ev.getContent())
          : ev.getContent();
        const edited = !!replacingEvent;

        const senderId = ev.getSender() ?? '';
        const member = room.getMember(senderId);
        const agentCard = content['hmr.agent_card'] ?? null;
        const drawerContent = content['hmr.drawer_content'] ?? null;

        let contentType: ChatMessage['contentType'] = 'text';
        if (agentCard) contentType = 'agent-card';
        else if (drawerContent) contentType = 'drawer-content';
        else if (content.msgtype === 'm.image') contentType = 'image';
        else if (content.msgtype === 'm.file') contentType = 'file';
        else if (content.msgtype === 'm.audio') contentType = 'audio';
        else if (content.msgtype === 'm.video') contentType = 'video';

        const url = content.url
          ? (this.client!.mxcUrlToHttp(content.url as string) ?? undefined)
          : undefined;
        const info = content.info as Record<string, unknown> | undefined;
        const fileSize = info?.size ? formatBytes(info.size as number) : undefined;

        // Parse reply-to
        const relates = ev.getContent()['m.relates_to'] as Record<string, unknown> | undefined;
        const inReplyToId = (relates?.['m.in_reply_to'] as Record<string, unknown> | undefined)
          ?.event_id as string | undefined;
        let replyTo: ChatMessage['replyTo'];
        if (inReplyToId) {
          const origEvent = room.findEventById(inReplyToId);
          if (origEvent) {
            const origSender = origEvent.getSender() ?? '';
            const origMember = room.getMember(origSender);
            replyTo = {
              eventId: inReplyToId,
              senderId: origSender,
              senderName: origMember?.name ?? origSender.split(':')[0].slice(1),
              body: ((origEvent.getContent().body as string) ?? '').slice(0, 100),
            };
          }
        }

        return ChatMessage.create({
          id: ev.getId() ?? `evt-${ev.getTs()}`,
          roomId,
          senderId,
          senderName: member?.name ?? senderId.split(':')[0].slice(1),
          body: (content.body as string) ?? '',
          timestamp: ev.getTs(),
          contentType,
          edited,
          replyTo,
          agentCard,
          drawerContent,
          mediaUrl: url,
          fileSize,
        });
      });
  }

  async selectRoom(roomId: RoomId): Promise<void> {
    if (!this.client) return;
    const room = this.client.getRoom(roomId);
    if (!room) return;
    const lastEvent = room.timeline?.[room.timeline.length - 1];
    if (lastEvent) {
      try {
        await this.client.sendReadReceipt(lastEvent);
      } catch {
        /* ignore */
      }
    }
  }

  async sendMessage(roomId: RoomId, body: string, replyToEventId?: string): Promise<void> {
    if (!this.client) return;
    const content: Record<string, unknown> = {
      msgtype: MsgType.Text,
      body,
    };
    if (replyToEventId) {
      content['m.relates_to'] = {
        'm.in_reply_to': { event_id: replyToEventId },
      };
    }
    await (
      this.client.sendMessage as unknown as (
        r: string,
        c: Record<string, unknown>
      ) => Promise<unknown>
    )(roomId, content);
  }

  async editMessage(roomId: RoomId, eventId: string, newBody: string): Promise<void> {
    if (!this.client) return;
    const content: Record<string, unknown> = {
      msgtype: MsgType.Text,
      body: `* ${newBody}`,
      'm.new_content': {
        msgtype: MsgType.Text,
        body: newBody,
      },
      'm.relates_to': {
        rel_type: 'm.replace',
        event_id: eventId,
      },
    };
    await (
      this.client.sendMessage as unknown as (
        r: string,
        c: Record<string, unknown>
      ) => Promise<unknown>
    )(roomId, content);
  }

  async redactMessage(roomId: RoomId, eventId: string): Promise<void> {
    if (!this.client) return;
    await this.client.redactEvent(roomId, eventId);
  }

  async sendFile(roomId: RoomId, file: File): Promise<void> {
    if (!this.client) return;
    const upload = await this.client.uploadContent(file, {
      name: file.name,
      type: file.type,
    });
    const msgtype = file.type.startsWith('image/') ? MsgType.Image : MsgType.File;
    const content = {
      msgtype,
      body: file.name,
      url: upload.content_uri,
      info: { mimetype: file.type, size: file.size },
    };
    // SDK overload types require explicit cast for file messages
    await (
      this.client.sendMessage as unknown as (
        roomId: string,
        content: Record<string, unknown>
      ) => Promise<unknown>
    )(roomId, content);
  }

  sendTyping(roomId: RoomId, typing: boolean): void {
    if (!this.client) return;
    this.client.sendTyping(roomId, typing, 5000).catch(() => {});
  }

  async createDmRoom(userId: UserId): Promise<RoomId | null> {
    if (!this.client) return null;
    const result = await this.client.createRoom({
      preset: sdk.Preset.TrustedPrivateChat,
      invite: [userId],
      is_direct: true,
    });
    return result.room_id;
  }

  async searchUsers(term: string): Promise<SearchUserResult[]> {
    if (!this.client) return [];
    try {
      const resp = await this.client.searchUserDirectory({ term, limit: 20 });
      return resp.results.map((u) => ({
        userId: u.user_id,
        displayName: u.display_name ?? u.user_id,
        avatarUrl: u.avatar_url
          ? (this.client!.mxcUrlToHttp(u.avatar_url, 64, 64, 'crop') ?? null)
          : null,
      }));
    } catch {
      return [];
    }
  }

  getKnownUsers(): SearchUserResult[] {
    if (!this.client) return [];
    const myUserId = this.client.getUserId() ?? '';
    const seen = new Set<string>();
    const users: SearchUserResult[] = [];
    for (const room of this.client.getRooms()) {
      for (const member of room.getJoinedMembers()) {
        if (member.userId === myUserId || seen.has(member.userId)) continue;
        if (BOT_PATTERNS.some((p) => p.test(member.userId))) continue;
        seen.add(member.userId);
        users.push({
          userId: member.userId,
          displayName: member.name || member.userId.split(':')[0].slice(1),
          avatarUrl: null,
        });
      }
    }
    return users;
  }

  getRoomMembers(roomId: RoomId): SearchUserResult[] {
    if (!this.client) return [];
    const room = this.client.getRoom(roomId);
    if (!room) return [];
    const myUserId = this.client.getUserId() ?? '';
    return room
      .getJoinedMembers()
      .filter((m) => m.userId !== myUserId && !BOT_PATTERNS.some((p) => p.test(m.userId)))
      .map((m) => ({
        userId: m.userId,
        displayName: m.name || m.userId.split(':')[0].slice(1),
        avatarUrl: null,
      }));
  }

  async inviteToRoom(roomId: RoomId, userId: UserId): Promise<void> {
    if (!this.client) return;
    await this.client.invite(roomId, userId);
  }

  async createGroupRoom(name: string, inviteUserIds: UserId[]): Promise<RoomId | null> {
    if (!this.client) return null;
    const result = await this.client.createRoom({
      preset: sdk.Preset.PrivateChat,
      name,
      invite: inviteUserIds,
    });
    return result.room_id;
  }

  async joinRoom(roomIdOrAlias: string): Promise<RoomId | null> {
    if (!this.client) return null;
    try {
      const result = await this.client.joinRoom(roomIdOrAlias);
      return result.roomId;
    } catch {
      return null;
    }
  }

  async leaveRoom(roomId: RoomId): Promise<void> {
    if (!this.client) return;
    await this.client.leave(roomId);
  }

  async loadOlderMessages(roomId: RoomId, limit = 30): Promise<boolean> {
    if (!this.client) return false;
    const room = this.client.getRoom(roomId);
    if (!room) return false;
    const tl = room.getLiveTimeline();
    const canPaginate =
      room.oldState?.paginationToken != null ||
      tl.getState(sdk.EventTimeline.BACKWARDS)?.paginationToken != null;
    if (!canPaginate) return false;
    try {
      await this.client.paginateEventTimeline(tl, { backwards: true, limit });
      return tl.getState(sdk.EventTimeline.BACKWARDS)?.paginationToken != null;
    } catch {
      return false;
    }
  }

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState === state) return;
    this.connectionState = state;
    this.connectionCbs.forEach((cb) => cb(state));
  }

  onSync(cb: SyncCallback): void {
    this.syncCbs.push(cb);
  }
  onTimeline(cb: TimelineCallback): void {
    this.timelineCbs.push(cb);
  }
  onTyping(cb: TypingCallback): void {
    this.typingCbs.push(cb);
  }
  onConnection(cb: ConnectionCallback): void {
    this.connectionCbs.push(cb);
  }

  offSync(cb: SyncCallback): void {
    this.syncCbs = this.syncCbs.filter((c) => c !== cb);
  }
  offTimeline(cb: TimelineCallback): void {
    this.timelineCbs = this.timelineCbs.filter((c) => c !== cb);
  }
  offTyping(cb: TypingCallback): void {
    this.typingCbs = this.typingCbs.filter((c) => c !== cb);
  }
  offConnection(cb: ConnectionCallback): void {
    this.connectionCbs = this.connectionCbs.filter((c) => c !== cb);
  }

  isReady(): boolean {
    return this.ready;
  }

  getUnderlyingClient(): unknown {
    return this.client;
  }

  // --- private ---

  private async initClient(
    homeserverUrl: string,
    accessToken: string,
    userId: string,
    deviceId?: string
  ): Promise<void> {
    this.client = sdk.createClient({
      baseUrl: homeserverUrl,
      accessToken,
      userId,
      deviceId,
      timelineSupport: true,
    });

    // Recover deviceId via whoami if not provided (needed for VoIP calls)
    if (!deviceId) {
      try {
        const whoami = await this.client.whoami();
        if (whoami.device_id) {
          this.client.deviceId = whoami.device_id;
        }
      } catch {
        /* whoami failed — calls will be unavailable */
      }
    }

    // Fetch profile (non-blocking — don't let it stall init)
    try {
      const profilePromise = this.client.getProfileInfo(userId);
      let timerId: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, rej) => {
        timerId = setTimeout(() => rej(new Error('timeout')), 5000);
      });
      let profile;
      try {
        profile = await Promise.race([profilePromise, timeout]);
      } finally {
        if (timerId) clearTimeout(timerId);
      }
      if (this.user) {
        this.user = {
          ...this.user,
          displayName: profile.displayname ?? this.user.displayName,
          avatarUrl: profile.avatar_url
            ? (this.client.mxcUrlToHttp(profile.avatar_url, 96, 96, 'crop') ?? null)
            : null,
        };
      }
    } catch {
      /* profile fetch optional */
    }

    // Wire up SDK events → our callbacks
    this.client.on(sdk.ClientEvent.Sync, (syncState, _prev, data) => {
      switch (syncState) {
        case sdk.SyncState.Prepared:
        case sdk.SyncState.Syncing:
          if (!this.ready) this.ready = true;
          this.setConnectionState('connected');
          this.syncCbs.forEach((cb) => cb());
          break;
        case sdk.SyncState.Reconnecting:
          this.setConnectionState('reconnecting');
          break;
        case sdk.SyncState.Error: {
          const err = data?.error as Record<string, unknown> | undefined;
          if (err?.['httpStatus'] === 401) {
            this.setConnectionState('error');
          } else {
            this.setConnectionState('reconnecting');
          }
          break;
        }
        case sdk.SyncState.Stopped:
          this.ready = false;
          this.setConnectionState('disconnected');
          break;
      }
    });

    this.client.on(
      sdk.RoomEvent.Timeline,
      (_event: sdk.MatrixEvent, room: sdk.Room | undefined) => {
        if (!room) return;
        this.syncCbs.forEach((cb) => cb());
        this.timelineCbs.forEach((cb) => cb(room.roomId));
      }
    );

    this.client.on(
      sdk.RoomMemberEvent.Typing,
      (_event: sdk.MatrixEvent, member: sdk.RoomMember) => {
        this.typingCbs.forEach((cb) => cb(member.roomId, member.userId, member.typing));
      }
    );

    await this.client.startClient({ initialSyncLimit: 20 });
  }
}
