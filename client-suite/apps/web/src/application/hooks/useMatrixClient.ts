/**
 * useMatrixClient — 管理 IMatrixClient 实例的单例 hook
 *
 * Login flow:
 * 1. Try HMR backend auth (/api/auth/login) → sets cookie session
 * 2. Connect to real Matrix homeserver via RealMatrixClient
 */
import { useRef, useCallback, useState } from 'react';
import type { IMatrixClient } from '../../infrastructure/matrix/MatrixClientAdapter';
import { RealMatrixClient } from '../../infrastructure/matrix/RealMatrixClient';
import { WpsImAdapter } from '../../infrastructure/matrix/WpsImAdapter';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { useToastStore } from '../stores/toastStore';
import { useUIStore } from '../stores/uiStore';
import { useAgentStore } from '../stores/agentStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useKnowledgeStore } from '../stores/knowledgeStore';
import { useTodoStore } from '../stores/todoStore';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import { useCallStore } from '../stores/callStore';
import { authApi } from '../../infrastructure/api/hmrApiClient';
import { navigateTo, getCurrentOrigin } from '../../infrastructure/navigation';

let clientInstance: IMatrixClient | null = null;
let loginInProgress = false;
let selectRoomSeq = 0;

import type { ConnectionState } from '../../domain/shared/types';

let registeredSyncCb: (() => void) | null = null;
let registeredTimelineCb: ((roomId: string) => void) | null = null;
let registeredTypingCb: ((roomId: string, userId: string, typing: boolean) => void) | null = null;
let registeredConnectionCb: ((state: ConnectionState) => void) | null = null;

function cleanupCallbacks(client: IMatrixClient | null) {
  if (!client) return;
  if (registeredSyncCb) client.offSync(registeredSyncCb);
  if (registeredTimelineCb) client.offTimeline(registeredTimelineCb);
  if (registeredTypingCb) client.offTyping(registeredTypingCb);
  if (registeredConnectionCb) client.offConnection(registeredConnectionCb);
  registeredSyncCb = null;
  registeredTimelineCb = null;
  registeredTypingCb = null;
  registeredConnectionCb = null;
}

export function getMatrixClient(): IMatrixClient | null {
  return clientInstance;
}

/**
 * Module-level selectRoom — full flow: set current room + load messages + clear unread + refresh rooms.
 * Use this from event handlers outside of React component context.
 */
export async function globalSelectRoom(roomId: string): Promise<void> {
  const client = clientInstance;
  if (!client) return;
  const seq = ++selectRoomSeq;
  const { setCurrentRoom, setMessages, clearUnread, setRooms } = useChatStore.getState();
  setCurrentRoom(roomId);
  try {
    await client.selectRoom(roomId);
    // Abort if another selectRoom was called while we awaited
    if (seq !== selectRoomSeq) return;
    setMessages(client.getMessages(roomId));
    clearUnread(roomId);
    setRooms(client.getRooms());
  } catch {
    // Client may have been logged out during await
  }
}

export function useMatrixClient() {
  const clientRef = useRef<IMatrixClient | null>(clientInstance);
  const [client, setClient] = useState<IMatrixClient | null>(clientInstance);
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const persistAuth = useAuthStore((s) => s.persistAuth);
  const loadPersistedAuth = useAuthStore((s) => s.loadPersistedAuth);
  const setRooms = useChatStore((s) => s.setRooms);
  const setMessages = useChatStore((s) => s.setMessages);
  const setCurrentRoom = useChatStore((s) => s.setCurrentRoom);
  const setTyping = useChatStore((s) => s.setTyping);
  const clearUnread = useChatStore((s) => s.clearUnread);

  const wireUpCallbacks = useCallback(
    (client: IMatrixClient) => {
      cleanupCallbacks(client);

      const { setConnectionState, setSyncing } = useChatStore.getState();
      setSyncing(true);

      const syncCb = () => {
        const store = useChatStore.getState();
        if (store.syncing) setSyncing(false);
        setRooms(client.getRooms());
      };
      const timelineCb = (roomId: string) => {
        setRooms(client.getRooms());
        const currentRoomId = useChatStore.getState().currentRoomId;
        if (roomId === currentRoomId) {
          setMessages(client.getMessages(roomId));
        }
      };
      const typingCb = (roomId: string, userId: string, typing: boolean) => {
        setTyping(roomId, userId, typing);
      };
      const connectionCb = (state: ConnectionState) => {
        setConnectionState(state);
        if (state === 'error') {
          useToastStore.getState().addToast('Matrix 连接失败，请重新登录', 'error');
          useAuthStore.getState().clearAuth();
        }
      };

      client.onSync(syncCb);
      client.onTimeline(timelineCb);
      client.onTyping(typingCb);
      client.onConnection(connectionCb);

      registeredSyncCb = syncCb;
      registeredTimelineCb = timelineCb;
      registeredTypingCb = typingCb;
      registeredConnectionCb = connectionCb;
    },
    [setRooms, setMessages, setTyping]
  );

  const loginWps = useCallback(
    async (farmBaseUrl: string, userId: string) => {
      if (loginInProgress) return;
      loginInProgress = true;
      try {
        const client = new WpsImAdapter(farmBaseUrl);
        const result = await client.login('', userId, '');

        clientInstance = client;
        clientRef.current = client;
        setClient(client);
        wireUpCallbacks(client);

        const profile = client.getUserProfile()!;
        setAuth(profile, result.accessToken, farmBaseUrl);
        useAuthStore.getState().setChannelMode('wps');
        persistAuth();
      } finally {
        loginInProgress = false;
      }
    },
    [wireUpCallbacks, setAuth, persistAuth]
  );

  const login = useCallback(
    async (homeserver: string, username: string, password: string) => {
      if (loginInProgress) return;
      loginInProgress = true;
      try {
        const setHmrUser = useAuthStore.getState().setHmrUser;

        // Step 1: Try HMR backend auth (cookie session)
        try {
          const res = await authApi.login(username, password);
          if (res.authenticated && res.user) {
            setHmrUser(res.user);
          }
        } catch {
          // Backend unreachable — proceed with direct Matrix login
        }

        // Step 2: Connect to real Matrix homeserver
        const real = new RealMatrixClient();
        try {
          const result = await real.login(homeserver, username, password);
          clientInstance = real;
          clientRef.current = real;
          setClient(real);
          wireUpCallbacks(real);
          const profile = real.getUserProfile()!;
          setAuth(profile, result.accessToken, homeserver, result.deviceId);
          useAuthStore.getState().setChannelMode('matrix');
          persistAuth();
        } catch (e) {
          const msg = (e as Error)?.message ?? '';
          if (msg.includes('fetch') || msg.includes('ECONNREFUSED') || msg.includes('Failed')) {
            throw new Error('无法连接到服务器，请检查 Homeserver 地址是否正确', { cause: e });
          }
          if (msg.includes('403') || msg.includes('Forbidden')) {
            throw new Error('用户名或密码错误', { cause: e });
          }
          if (msg.includes('500')) {
            throw new Error('服务器内部错误 (500)，请确认 Matrix 服务已启动', { cause: e });
          }
          throw new Error(msg || '登录失败，请重试', { cause: e });
        }
      } finally {
        loginInProgress = false;
      }
    },
    [wireUpCallbacks, setAuth, persistAuth]
  );

  const selectRoom = useCallback(
    async (roomId: string) => {
      const client = clientRef.current;
      if (!client) return;
      setCurrentRoom(roomId);
      await client.selectRoom(roomId);
      setMessages(client.getMessages(roomId));
      clearUnread(roomId);
      setRooms(client.getRooms());
    },
    [setCurrentRoom, setMessages, clearUnread, setRooms]
  );

  const sendMessage = useCallback(async (roomId: string, body: string, replyToEventId?: string) => {
    const client = clientRef.current;
    if (!client) return;
    const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const profile = client.getUserProfile();
    const { ChatMessage } = await import('../../domain/chat/ChatMessage');
    const pending = ChatMessage.create({
      id: tempId,
      roomId,
      senderId: profile?.userId ?? '',
      senderName: profile?.displayName ?? '',
      body,
      timestamp: Date.now(),
      contentType: 'text',
      sendStatus: 'sending',
    });
    useChatStore.getState().setMessages([...useChatStore.getState().messages, pending]);
    try {
      await client.sendMessage(roomId, body, replyToEventId);
      useChatStore.getState().updateMessageStatus(tempId, 'sent');
    } catch {
      useChatStore.getState().updateMessageStatus(tempId, 'failed');
      throw new Error('发送失败');
    }
  }, []);

  const editMessage = useCallback(async (roomId: string, eventId: string, newBody: string) => {
    const client = clientRef.current;
    if (!client) return;
    await client.editMessage(roomId, eventId, newBody);
  }, []);

  const redactMessage = useCallback(async (roomId: string, eventId: string) => {
    const client = clientRef.current;
    if (!client) return;
    await client.redactMessage(roomId, eventId);
  }, []);

  const sendFile = useCallback(async (roomId: string, file: File) => {
    const client = clientRef.current;
    if (!client) return;
    await client.sendFile(roomId, file);
  }, []);

  const sendTyping = useCallback((roomId: string, typing: boolean) => {
    const client = clientRef.current;
    if (!client) return;
    client.sendTyping(roomId, typing);
  }, []);

  const logout = useCallback(async () => {
    const client = clientRef.current;
    cleanupCallbacks(client);
    clientInstance = null;
    clientRef.current = null;
    clearAuth();
    useChatStore.getState().reset();
    useUIStore.getState().reset();
    useAgentStore.getState().reset();
    useNotificationStore.getState().reset();
    useKnowledgeStore.getState().reset();
    useTodoStore.getState().reset();
    useSubscriptionStore.getState().reset();
    useCallStore.getState().reset();

    // Fire-and-forget: network cleanup after UI already shows login
    if (client) {
      Promise.resolve()
        .then(() => authApi.logout())
        .catch(() => {})
        .then(() => client.logout())
        .catch(() => {});
    }
  }, [clearAuth]);

  const restoreSession = useCallback(async () => {
    const setHmrUser = useAuthStore.getState().setHmrUser;

    // Step 1: Quick check HMR backend session (short timeout — don't block UI)
    const persisted = loadPersistedAuth();

    try {
      const mePromise = authApi.me();
      const timeout = new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error('timeout')), 3000)
      );
      const meRes = await Promise.race([mePromise, timeout]);
      if (meRes.authenticated && meRes.user) {
        setHmrUser(meRes.user);
      }
    } catch {
      // Backend unreachable or slow — proceed with Matrix session
    }

    // Step 2: Restore Matrix session from localStorage
    if (!persisted) {
      return;
    }

    try {
      const { homeserverUrl, accessToken, userId, deviceId } = persisted;

      if (accessToken.startsWith('wps-token-')) {
        await loginWps(homeserverUrl, userId);
        return;
      }

      const client = new RealMatrixClient();
      clientInstance = client;
      clientRef.current = client;

      wireUpCallbacks(client);

      // Timeout the session init — if server is unreachable, fail fast
      const initPromise = client.initFromSession(homeserverUrl, accessToken, userId, deviceId);
      const timeout = new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error('timeout')), 8000)
      );
      await Promise.race([initPromise, timeout]);

      const profile = client.getUserProfile()!;
      setAuth(profile, accessToken, homeserverUrl, deviceId);
    } catch {
      // Cleanup on failure
      if (clientInstance instanceof RealMatrixClient) {
        try {
          clientInstance.logout();
        } catch {
          /* ignore */
        }
      }
      clientInstance = null;
      clientRef.current = null;
      useToastStore.getState().addToast('会话恢复失败，请重新登录', 'error');
      clearAuth();
    }
  }, [loadPersistedAuth, loginWps, wireUpCallbacks, setAuth, clearAuth]);

  const buildSsoRedirectUrl = useCallback((homeserver: string) => {
    const redirectUrl = location.origin + location.pathname;
    return `${homeserver}/_matrix/client/v3/login/sso/redirect?redirectUrl=${encodeURIComponent(redirectUrl)}`;
  }, []);

  const loginWithToken = useCallback(
    async (homeserver: string, loginToken: string) => {
      const client = new RealMatrixClient();
      clientInstance = client;
      clientRef.current = client;
      wireUpCallbacks(client);
      const result = await client.loginWithToken(homeserver, loginToken);
      const profile = client.getUserProfile()!;
      setAuth(profile, result.accessToken, homeserver, result.deviceId);
      persistAuth();
    },
    [wireUpCallbacks, setAuth, persistAuth]
  );

  const createDmRoom = useCallback(async (userId: string): Promise<string | null> => {
    const client = clientRef.current;
    if (!client) return null;
    return client.createDmRoom(userId);
  }, []);

  const searchUsers = useCallback(async (term: string) => {
    const client = clientRef.current;
    if (!client) return [];
    return client.searchUsers(term);
  }, []);

  const joinRoom = useCallback(
    async (roomIdOrAlias: string): Promise<string | null> => {
      const client = clientRef.current;
      if (!client) return null;
      const roomId = await client.joinRoom(roomIdOrAlias);
      if (roomId) setRooms(client.getRooms());
      return roomId;
    },
    [setRooms]
  );

  const leaveRoom = useCallback(
    async (roomId: string) => {
      const client = clientRef.current;
      if (!client) return;
      await client.leaveRoom(roomId);
      setRooms(client.getRooms());
      const { currentRoomId, setCurrentRoom: setCur } = useChatStore.getState();
      if (currentRoomId === roomId) setCur(null);
    },
    [setRooms]
  );

  const loadOlderMessages = useCallback(async (roomId: string): Promise<boolean> => {
    const client = clientRef.current;
    if (!client) return false;
    const { setLoadingOlder, prependMessages } = useChatStore.getState();
    setLoadingOlder(true);
    try {
      const hasMore = await client.loadOlderMessages(roomId);
      prependMessages(client.getMessages(roomId));
      return hasMore;
    } finally {
      setLoadingOlder(false);
    }
  }, []);

  const initiateHmrSso = useCallback(async (provider?: string) => {
    try {
      const { redirectUrl } = await authApi.ssoAuthorize(provider);
      const url = new URL(redirectUrl);
      const state = url.searchParams.get('state');
      if (state) {
        useAuthStore.getState().saveSsoState(state);
      }
      navigateTo(redirectUrl);
    } catch (e) {
      throw new Error((e as Error)?.message || 'SSO 初始化失败', { cause: e });
    }
  }, []);

  const handleHmrSsoCallback = useCallback(
    async (code: string, state: string) => {
      const res = await authApi.ssoCallback(code, state);
      if (!res.authenticated || !res.user) {
        throw new Error(res.error || 'SSO 认证失败');
      }
      const hmrUser = res.user;
      useAuthStore.getState().setHmrUser(hmrUser);
      useAuthStore.getState().setAuthMethod('sso');

      const fakeProfile = {
        userId: hmrUser.username,
        displayName: hmrUser.username,
        avatarUrl: null,
      };
      setAuth(fakeProfile, 'hmr-session', getCurrentOrigin());
      useAuthStore.getState().setChannelMode('matrix');
      persistAuth();
    },
    [setAuth, persistAuth]
  );

  return {
    client,
    login,
    loginWps,
    restoreSession,
    selectRoom,
    sendMessage,
    sendFile,
    sendTyping,
    logout,
    ssoRedirect: buildSsoRedirectUrl,
    loginWithToken,
    createDmRoom,
    searchUsers,
    joinRoom,
    leaveRoom,
    loadOlderMessages,
    editMessage,
    redactMessage,
    initiateHmrSso,
    handleHmrSsoCallback,
  };
}
