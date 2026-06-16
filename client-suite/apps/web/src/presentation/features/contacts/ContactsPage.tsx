import { useState, useEffect } from 'react';
import { Icon } from '../../components/ui/Icon';
import { SearchInput } from '../../components/ui/SearchInput';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { Avatar } from '../../components/ui/Avatar';
import { useUIStore } from '../../../application/stores/uiStore';
import { useAuthStore } from '../../../application/stores/authStore';
import { useToastStore } from '../../../application/stores/toastStore';
import { useChatStore } from '../../../application/stores/chatStore';
import { globalSelectRoom, getMatrixClient } from '../../../application/hooks/useMatrixClient';
import { employeeApi } from '../../../application/services/apiGateway';
import type { SearchUserResult } from '../../../domain/shared/types';

interface Contact {
  id: string;
  name: string;
  letter: string;
  title: string;
  department: string;
  departmentId: string;
  status: 'online' | 'busy' | 'offline';
  email: string;
  matrixUserId?: string;
}

const STATUS_MAP: Record<Contact['status'], { color: string; label: string }> = {
  online: { color: 'bg-green-400', label: '在线' },
  busy: { color: 'bg-amber-400', label: '忙碌' },
  offline: { color: 'bg-slate-400', label: '离线' },
};

/** Map backend status to UI status */
function mapStatus(backendStatus: string): Contact['status'] {
  const s = (backendStatus || '').toLowerCase();
  if (s === 'running' || s === 'active') return 'online';
  if (s === 'degraded' || s === 'busy') return 'busy';
  return 'offline';
}

/** Get department ID from department name */
function deptId(dept: string): string {
  const map: Record<string, string> = {
    operations: 'ops',
    engineering: 'product',
    finance: 'finance',
    marketing: 'marketing',
    hr: 'hr',
    product: 'product',
    design: 'design',
  };
  return map[dept?.toLowerCase()] || dept?.toLowerCase() || 'other';
}

/** Convert backend employee to Contact */
function toContact(emp: Record<string, unknown>): Contact {
  const name = String(emp.displayName || emp.name || emp.id || '');
  return {
    id: String(emp.id ?? ''),
    name,
    letter: name.charAt(0),
    title: String(emp.jobTitle || emp.role || ''),
    department: String(emp.department || ''),
    departmentId: deptId(String(emp.department || '')),
    status: mapStatus(String(emp.status || '')),
    email: String(emp.email || ''),
    matrixUserId:
      emp.matrixUserId || emp.userId ? String(emp.matrixUserId || emp.userId) : undefined,
  };
}

/** Shared hook for loading contacts from backend */
function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Step 1: Try DCF backend API
      try {
        const rows = await employeeApi.list();
        if (!cancelled) {
          const mapped = (Array.isArray(rows) ? rows : []).map(toContact);
          if (mapped.length > 0) {
            setContacts(mapped);
            return;
          }
        }
      } catch {
        // Backend unreachable — continue to Matrix fallback
      }

      // Step 2: Try Matrix user directory (real Synapse users)
      // Synapse rejects empty search — use single-char prefix searches to discover all users
      if (!cancelled) {
        const client = getMatrixClient();
        if (client) {
          const myUserId = useAuthStore.getState().user?.userId;

          const mapUsers = (users: { userId: string; displayName: string }[]): Contact[] =>
            users
              .filter((u) => u.userId !== myUserId)
              .map((u) => ({
                id: u.userId,
                name: u.displayName || u.userId.split(':')[0].slice(1),
                letter: (u.displayName || u.userId)[0],
                title: '',
                department: '组织成员',
                departmentId: 'org',
                status: 'online' as const,
                email: '',
                matrixUserId: u.userId,
              }));

          // 2a: Try user directory search
          try {
            const prefixes = 'abcdefghijklmnopqrstuvwxyz'.split('');
            const results = await Promise.all(
              prefixes.map((ch) => client.searchUsers(ch).catch((): SearchUserResult[] => []))
            );
            const seen = new Set<string>();
            const allUsers: (typeof results)[0] = [];
            for (const batch of results) {
              for (const u of batch) {
                if (!seen.has(u.userId)) {
                  seen.add(u.userId);
                  allUsers.push(u);
                }
              }
            }
            if (!cancelled && allUsers.length > 0) {
              const mapped = mapUsers(allUsers);
              if (mapped.length > 0) {
                setContacts(mapped);
                setLoading(false);
                return;
              }
            }
          } catch {
            // Directory search failed — fall through to room members
          }

          // 2b: Fallback — extract users from joined rooms (no network call)
          if (!cancelled) {
            const known = client.getKnownUsers();
            const mapped = mapUsers(known);
            if (mapped.length > 0) {
              setContacts(mapped);
              setLoading(false);
              return;
            }
          }
        }
      }
    })().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { contacts, loading };
}

/** Build department list from actual contact data */
function buildDepartments(contacts: Contact[]) {
  const deptMap = new Map<string, { id: string; label: string; count: number }>();
  for (const c of contacts) {
    const did = c.departmentId;
    const existing = deptMap.get(did);
    if (existing) {
      existing.count++;
    } else {
      deptMap.set(did, { id: did, label: c.department || did, count: 1 });
    }
  }
  const sorted = Array.from(deptMap.values()).sort((a, b) => b.count - a.count);
  return [{ id: 'all', label: '全部成员', count: contacts.length }, ...sorted];
}

export function ContactsSidebar() {
  const [search, setSearch] = useState('');
  const activeDept = useUIStore((s) => s.contactsDept);
  const setDept = useUIStore((s) => s.setContactsDept);
  const { contacts } = useContacts();
  const departments = buildDepartments(contacts);

  return (
    <div className="p-4 flex flex-col gap-4">
      <h3 className="text-lg font-semibold text-text-primary">通讯录</h3>
      <SearchInput value={search} onChange={setSearch} placeholder="搜索联系人..." />
      <div className="space-y-0.5">
        <SectionLabel>组织架构</SectionLabel>
        {departments
          .filter((d) => !search || d.label.includes(search))
          .map((dept) => (
            <button
              key={dept.id}
              type="button"
              onClick={() => setDept(dept.id)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                activeDept === dept.id
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'hover:bg-bg-hover text-text-primary font-medium'
              }`}
            >
              <Icon
                name="folder"
                size={16}
                className={activeDept === dept.id ? 'text-primary' : 'text-text-secondary'}
              />
              <span className="flex-1 text-left">{dept.label}</span>
              <span className="text-[10px] text-text-muted">{dept.count}</span>
            </button>
          ))}
      </div>
    </div>
  );
}

export function ContactsPage() {
  const activeDept = useUIStore((s) => s.contactsDept);
  const [search, setSearch] = useState('');
  const { contacts, loading } = useContacts();

  const filtered = contacts.filter((c) => {
    if (activeDept !== 'all' && c.departmentId !== activeDept) return false;
    if (search && !c.name.includes(search) && !c.title.includes(search)) return false;
    return true;
  });

  const handleStartChat = async (contact: Contact) => {
    const rooms = useChatStore.getState().rooms;

    // Try to find existing DM by matrixUserId or by room name
    const existingRoom = rooms.find(
      (r) =>
        r.type === 'dm' &&
        (r.name === contact.name || r.name === contact.matrixUserId?.split(':')[0].slice(1))
    );

    if (existingRoom) {
      useUIStore.getState().setDock('messages');
      await globalSelectRoom(existingRoom.id);
      useToastStore.getState().addToast(`已打开与 ${contact.name} 的对话`, 'success');
      return;
    }

    if (!contact.matrixUserId) {
      useToastStore.getState().addToast(`${contact.name} 暂无 IM 账号`, 'info');
      return;
    }

    const client = getMatrixClient();
    if (!client) {
      useToastStore.getState().addToast('未连接到服务器', 'error');
      return;
    }

    try {
      const roomId = await client.createDmRoom(contact.matrixUserId);
      if (roomId) {
        useUIStore.getState().setDock('messages');
        await globalSelectRoom(roomId);
        useToastStore.getState().addToast(`已创建与 ${contact.name} 的对话`, 'success');
      } else {
        useToastStore.getState().addToast('创建对话失败，请稍后重试', 'error');
      }
    } catch {
      useToastStore.getState().addToast('创建对话失败', 'error');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">
            {activeDept === 'all'
              ? '全部成员'
              : (buildDepartments(contacts).find((d) => d.id === activeDept)?.label ?? activeDept)}
          </h2>
          <SearchInput value={search} onChange={setSearch} placeholder="搜索..." className="w-48" />
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        )}

        <div className="space-y-1">
          {!loading &&
            filtered.map((contact) => {
              const st = STATUS_MAP[contact.status];
              return (
                <div
                  key={contact.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-bg-hover transition-colors cursor-pointer"
                  onClick={() => handleStartChat(contact)}
                >
                  <div className="relative">
                    <Avatar letter={contact.letter} size={40} />
                    <span
                      className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${st.color}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">{contact.name}</span>
                      <span className="text-[10px] text-text-muted">{st.label}</span>
                    </div>
                    <p className="text-xs text-text-secondary">
                      {contact.title} · {contact.department}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartChat(contact);
                      }}
                      className="p-1.5 rounded-lg hover:bg-bg-hover text-text-muted transition-colors"
                      title="发消息"
                    >
                      <Icon name="chat" size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`mailto:${contact.email}`);
                      }}
                      className="p-1.5 rounded-lg hover:bg-bg-hover text-text-muted transition-colors"
                      title="发邮件"
                    >
                      <Icon name="email" size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          {filtered.length === 0 && (
            <p className="text-sm text-text-muted text-center py-12">暂无匹配的联系人</p>
          )}
        </div>
      </div>
    </div>
  );
}
