/**
 * MatrixClientAdapter — 定义 Matrix 客户端的端口接口
 */
import type { ChatMessage } from '../../domain/chat/ChatMessage';
import type { ChatRoom } from '../../domain/chat/ChatRoom';
import type { UserId, RoomId, ConnectionState, SearchUserResult } from '../../domain/shared/types';

export type { SearchUserResult } from '../../domain/shared/types';

export interface UserProfile {
  userId: UserId;
  displayName: string;
  avatarUrl: string | null;
  org?: string;
  department?: string;
  role?: string;
}

export interface LoginResult {
  userId: UserId;
  accessToken: string;
  deviceId?: string;
}

export type SyncCallback = () => void;
export type TimelineCallback = (roomId: RoomId) => void;
export type TypingCallback = (roomId: RoomId, userId: UserId, typing: boolean) => void;
export type ConnectionCallback = (state: ConnectionState) => void;

/** Port interface — all Matrix operations go through this */
export interface IMatrixClient {
  /** Login with credentials */
  login(homeserverUrl: string, username: string, password: string): Promise<LoginResult>;

  /** Login with SSO token (m.login.token) */
  loginWithToken(homeserverUrl: string, loginToken: string): Promise<LoginResult>;

  /** Initialize client from persisted session */
  initFromSession(
    homeserverUrl: string,
    accessToken: string,
    userId: UserId,
    deviceId?: string
  ): Promise<void>;

  /** Logout and cleanup */
  logout(): Promise<void>;

  /** Get current user profile */
  getUserProfile(): UserProfile | null;

  /** Get all joined rooms */
  getRooms(): ChatRoom[];

  /** Load messages for a room */
  getMessages(roomId: RoomId): ChatMessage[];

  /** Select room (mark as read) */
  selectRoom(roomId: RoomId): Promise<void>;

  /** Send text message (optionally as a reply) */
  sendMessage(roomId: RoomId, body: string, replyToEventId?: string): Promise<void>;

  /** Edit a previously sent message */
  editMessage(roomId: RoomId, eventId: string, newBody: string): Promise<void>;

  /** Redact (delete) a message */
  redactMessage(roomId: RoomId, eventId: string): Promise<void>;

  /** Send file */
  sendFile(roomId: RoomId, file: File): Promise<void>;

  /** Send typing indicator */
  sendTyping(roomId: RoomId, typing: boolean): void;

  /** Create DM room with user */
  createDmRoom(userId: UserId): Promise<RoomId | null>;

  /** Search users */
  searchUsers(term: string): Promise<SearchUserResult[]>;

  /** Get all known users from joined rooms (no network call needed) */
  getKnownUsers(): SearchUserResult[];

  /** Get members of a specific room (excluding self and bots) */
  getRoomMembers(roomId: RoomId): SearchUserResult[];

  /** Invite a user to a room */
  inviteToRoom(roomId: RoomId, userId: UserId): Promise<void>;

  /** Create a group room with a name and invited users */
  createGroupRoom(name: string, inviteUserIds: UserId[]): Promise<RoomId | null>;

  /** Join a room by ID or alias */
  joinRoom(roomIdOrAlias: string): Promise<RoomId | null>;

  /** Leave a room */
  leaveRoom(roomId: RoomId): Promise<void>;

  /** Load older messages for pagination. Returns true if more history exists. */
  loadOlderMessages(roomId: RoomId, limit?: number): Promise<boolean>;

  /** Get current connection state */
  getConnectionState(): ConnectionState;

  /** Register event callbacks */
  onSync(cb: SyncCallback): void;
  onTimeline(cb: TimelineCallback): void;
  onTyping(cb: TypingCallback): void;
  onConnection(cb: ConnectionCallback): void;

  /** Remove event callbacks */
  offSync(cb: SyncCallback): void;
  offTimeline(cb: TimelineCallback): void;
  offTyping(cb: TypingCallback): void;
  offConnection(cb: ConnectionCallback): void;

  /** Whether client is ready */
  isReady(): boolean;

  /** Expose underlying SDK client for advanced features (e.g., VoIP calls) */
  getUnderlyingClient(): unknown;
}
