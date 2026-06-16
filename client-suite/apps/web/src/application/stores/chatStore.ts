import { create } from 'zustand';
import type { ChatRoom } from '../../domain/chat/ChatRoom';
import { ChatMessage } from '../../domain/chat/ChatMessage';
import type { RoomId, RoomFilter, ConnectionState } from '../../domain/shared/types';

export interface RoomGroup {
  id: string;
  name: string;
}

interface TypingInfo {
  userId: string;
  typing: boolean;
}

const typingTimers: Record<string, ReturnType<typeof setTimeout>> = {};

const LS_GROUPS_KEY = 'dcf_room_groups';
const LS_GROUP_MAP_KEY = 'dcf_room_group_map';

function loadGroups(): RoomGroup[] {
  try {
    const raw = localStorage.getItem(LS_GROUPS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function loadGroupMap(): Record<RoomId, string> {
  try {
    const raw = localStorage.getItem(LS_GROUP_MAP_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persistGroups(groups: RoomGroup[], map: Record<RoomId, string>): void {
  try {
    localStorage.setItem(LS_GROUPS_KEY, JSON.stringify(groups));
    localStorage.setItem(LS_GROUP_MAP_KEY, JSON.stringify(map));
  } catch {
    /* quota exceeded */
  }
}

interface ChatState {
  rooms: ChatRoom[];
  currentRoomId: RoomId | null;
  messages: ChatMessage[];
  roomFilter: RoomFilter;
  searchQuery: string;
  typingUsers: Record<RoomId, TypingInfo[]>;
  connectionState: ConnectionState;
  syncing: boolean;
  loadingOlder: boolean;
  roomGroups: RoomGroup[];
  roomGroupMap: Record<RoomId, string>;

  setRooms(rooms: ChatRoom[]): void;
  setCurrentRoom(roomId: RoomId | null): void;
  setMessages(messages: ChatMessage[]): void;
  prependMessages(messages: ChatMessage[]): void;
  setRoomFilter(filter: RoomFilter): void;
  setSearchQuery(query: string): void;
  setTyping(roomId: RoomId, userId: string, typing: boolean): void;
  setConnectionState(state: ConnectionState): void;
  setSyncing(syncing: boolean): void;
  setLoadingOlder(loading: boolean): void;
  updateMessageStatus(msgId: string, status: 'sent' | 'failed'): void;
  clearUnread(roomId: RoomId): void;
  togglePin(roomId: RoomId): void;
  toggleUnread(roomId: RoomId): void;
  addRoomGroup(name: string): void;
  removeRoomGroup(groupId: string): void;
  renameRoomGroup(groupId: string, name: string): void;
  setRoomGroup(roomId: RoomId, groupId: string | null): void;
  reset(): void;
}

export const useChatStore = create<ChatState>((set, _get) => ({
  rooms: [],
  currentRoomId: null,
  messages: [],
  roomFilter: 'all',
  searchQuery: '',
  typingUsers: {},
  connectionState: 'connecting',
  syncing: false,
  loadingOlder: false,
  roomGroups: loadGroups(),
  roomGroupMap: loadGroupMap(),

  setRooms(rooms) {
    set({ rooms });
  },

  setCurrentRoom(roomId) {
    set({ currentRoomId: roomId });
  },

  setMessages(messages) {
    set({ messages });
  },

  prependMessages(older) {
    set((state) => {
      const existingIds = new Set(state.messages.map((m) => m.id));
      const unique = older.filter((m) => !existingIds.has(m.id));
      return { messages: [...unique, ...state.messages] };
    });
  },

  setRoomFilter(filter) {
    set({ roomFilter: filter });
  },

  setSearchQuery(query) {
    set({ searchQuery: query });
  },

  setConnectionState(connectionState) {
    set({ connectionState });
  },

  setSyncing(syncing) {
    set({ syncing });
  },

  setLoadingOlder(loadingOlder) {
    set({ loadingOlder });
  },

  updateMessageStatus(msgId, status) {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === msgId ? ChatMessage.create({ ...m, sendStatus: status }) : m
      ),
    }));
  },

  setTyping(roomId, userId, typing) {
    set((state) => {
      const roomTyping = (state.typingUsers[roomId] ?? []).filter((t) => t.userId !== userId);
      if (typing) roomTyping.push({ userId, typing: true });
      return { typingUsers: { ...state.typingUsers, [roomId]: roomTyping } };
    });

    const timerKey = `${roomId}:${userId}`;
    if (typingTimers[timerKey]) clearTimeout(typingTimers[timerKey]);
    if (typing) {
      typingTimers[timerKey] = setTimeout(() => {
        set((state) => {
          const updated = (state.typingUsers[roomId] ?? []).filter((t) => t.userId !== userId);
          return { typingUsers: { ...state.typingUsers, [roomId]: updated } };
        });
        delete typingTimers[timerKey];
      }, 10_000);
    } else {
      delete typingTimers[timerKey];
    }
  },

  clearUnread(roomId) {
    set((state) => ({
      rooms: state.rooms.map((r) => (r.id === roomId ? r.withUnread(0) : r)),
    }));
  },

  togglePin(roomId) {
    set((state) => ({
      rooms: state.rooms.map((r) => (r.id === roomId ? r.withPinned(!r.pinned) : r)),
    }));
  },

  toggleUnread(roomId) {
    set((state) => ({
      rooms: state.rooms.map((r) =>
        r.id === roomId ? r.withUnread(r.unreadCount > 0 ? 0 : 1) : r
      ),
    }));
  },

  addRoomGroup(name) {
    const group: RoomGroup = { id: `grp-${Date.now()}`, name };
    set((state) => {
      const groups = [...state.roomGroups, group];
      persistGroups(groups, state.roomGroupMap);
      return { roomGroups: groups };
    });
  },

  removeRoomGroup(groupId) {
    set((state) => {
      const groups = state.roomGroups.filter((g) => g.id !== groupId);
      const map = Object.fromEntries(
        Object.entries(state.roomGroupMap).filter(([, gid]) => gid !== groupId)
      );
      persistGroups(groups, map);
      return {
        roomGroups: groups,
        roomGroupMap: map,
        roomFilter: state.roomFilter === groupId ? 'all' : state.roomFilter,
      };
    });
  },

  renameRoomGroup(groupId, name) {
    set((state) => {
      const groups = state.roomGroups.map((g) => (g.id === groupId ? { ...g, name } : g));
      persistGroups(groups, state.roomGroupMap);
      return { roomGroups: groups };
    });
  },

  setRoomGroup(roomId, groupId) {
    set((state) => {
      const map = { ...state.roomGroupMap };
      if (groupId) map[roomId] = groupId;
      else delete map[roomId];
      persistGroups(state.roomGroups, map);
      return { roomGroupMap: map };
    });
  },

  reset() {
    for (const key of Object.keys(typingTimers)) {
      clearTimeout(typingTimers[key]);
      delete typingTimers[key];
    }
    set({
      rooms: [],
      currentRoomId: null,
      messages: [],
      roomFilter: 'all',
      searchQuery: '',
      typingUsers: {},
      connectionState: 'connecting',
      syncing: false,
      loadingOlder: false,
      roomGroups: loadGroups(),
      roomGroupMap: loadGroupMap(),
    });
  },
}));
