import type { RoomId, RoomType } from '../shared/types';

export interface ChatRoomProps {
  id: RoomId;
  name: string;
  type: RoomType;
  avatarLetter?: string;
  memberCount?: number;
  lastMessage?: string;
  lastMessageTs?: number;
  unreadCount?: number;
  pinned?: boolean;
  category?: 'system' | 'integration' | 'normal';
}

export class ChatRoom {
  readonly id: RoomId;
  readonly name: string;
  readonly type: RoomType;
  readonly avatarLetter: string;
  readonly memberCount: number;
  readonly lastMessage?: string;
  readonly lastMessageTs?: number;
  readonly unreadCount: number;
  readonly pinned: boolean;
  readonly category: 'system' | 'integration' | 'normal';

  private constructor(props: ChatRoomProps) {
    this.id = props.id;
    this.name = props.name;
    this.type = props.type;
    this.avatarLetter = props.avatarLetter ?? props.name.charAt(0).toUpperCase();
    this.memberCount = props.memberCount ?? 0;
    this.lastMessage = props.lastMessage;
    this.lastMessageTs = props.lastMessageTs;
    this.unreadCount = props.unreadCount ?? 0;
    this.pinned = props.pinned ?? false;
    this.category = props.category ?? 'normal';
  }

  static create(props: ChatRoomProps): ChatRoom {
    return new ChatRoom(props);
  }

  get isDm(): boolean {
    return this.type === 'dm';
  }

  get isBot(): boolean {
    return this.type === 'bot';
  }

  withLastMessage(message: string, ts: number): ChatRoom {
    return new ChatRoom({
      id: this.id,
      name: this.name,
      type: this.type,
      avatarLetter: this.avatarLetter,
      memberCount: this.memberCount,
      lastMessage: message,
      lastMessageTs: ts,
      unreadCount: this.unreadCount,
      pinned: this.pinned,
      category: this.category,
    });
  }

  withUnread(count: number): ChatRoom {
    return new ChatRoom({
      id: this.id,
      name: this.name,
      type: this.type,
      avatarLetter: this.avatarLetter,
      memberCount: this.memberCount,
      lastMessage: this.lastMessage,
      lastMessageTs: this.lastMessageTs,
      unreadCount: count,
      pinned: this.pinned,
      category: this.category,
    });
  }

  withPinned(pinned: boolean): ChatRoom {
    return new ChatRoom({
      id: this.id,
      name: this.name,
      type: this.type,
      avatarLetter: this.avatarLetter,
      memberCount: this.memberCount,
      lastMessage: this.lastMessage,
      lastMessageTs: this.lastMessageTs,
      unreadCount: this.unreadCount,
      pinned,
      category: this.category,
    });
  }

  matchesSearch(query: string): boolean {
    if (!query) return true;
    return this.name.toLowerCase().includes(query.toLowerCase());
  }
}

/** Actions available in room context menu */
export type RoomAction = 'pin' | 'unpin' | 'markRead' | 'markUnread' | 'leave';

const ACTIONS_BY_TYPE: Record<RoomType, RoomAction[]> = {
  dm: ['pin', 'unpin', 'markRead', 'markUnread'],
  bot: ['pin', 'unpin', 'markRead', 'markUnread'],
  group: ['pin', 'unpin', 'markRead', 'markUnread', 'leave'],
  system: ['pin', 'unpin', 'markRead'],
  subscription: ['pin', 'unpin', 'markRead', 'markUnread', 'leave'],
};

/** Get applicable context-menu actions for a room based on its current state */
export function getRoomActions(room: ChatRoom): RoomAction[] {
  const allowed = ACTIONS_BY_TYPE[room.type] ?? [];
  return allowed.filter((a) => {
    if (a === 'pin') return !room.pinned;
    if (a === 'unpin') return room.pinned;
    if (a === 'markRead') return room.unreadCount > 0;
    if (a === 'markUnread') return room.unreadCount === 0;
    return true;
  });
}
