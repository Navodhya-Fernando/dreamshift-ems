"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Check, CheckCheck, Hash, Plus, Reply, Search, Send, Smile, Sparkles, Trash2, Users, X } from 'lucide-react';
import { useCachedApi } from '@/lib/useCachedApi';
import { toastError } from '@/lib/toast';
import './messages.css';

type PresenceStatus = 'ONLINE' | 'AWAY' | 'OFFLINE';

type UserContact = {
  _id: string;
  name: string;
  image?: string;
  linkedinProfilePicUrl?: string;
  role?: string;
  designation?: string;
  presenceStatus?: PresenceStatus;
  lastSeenAt?: string | null;
  activeAt?: string | null;
};

type ConversationItem = {
  id: string;
  name: string;
  isGroup: boolean;
  participantIds: string[];
  createdBy: string;
  lastMessage: string;
  lastMessageAt: string | null;
};

type SummaryItem =
  | {
      type: 'direct';
      userId: string;
      userName: string;
      lastMessage: string;
      lastMessageAt: string | null;
      unreadCount: number;
    }
  | {
      type: 'group';
      conversationId: string;
      conversationName: string;
      lastMessage: string;
      lastMessageAt: string | null;
      unreadCount: number;
    };

type TaskItem = {
  _id: string;
  title?: string;
  status?: string;
  projectId?: { _id: string; name: string };
};

type ProjectItem = {
  _id: string;
  name?: string;
};

type MessageItem = {
  _id: string;
  conversationId: string | null;
  senderId: string;
  recipientId: string;
  recipientIds: string[];
  content: string;
  status: 'SENT' | 'DELIVERED' | 'READ';
  readAt: string | null;
  deliveredAt: string | null;
  editedAt: string | null;
  deletedAt: string | null;
  replyToMessageId: string | null;
  reactions: Array<{ emoji: string; userId: string; createdAt: string | null }>;
  createdAt: string;
  updatedAt: string;
};

type ApiReaction = {
  emoji?: unknown;
  userId?: unknown;
  createdAt?: unknown;
};

type ApiMessage = {
  _id?: unknown;
  conversationId?: unknown;
  senderId?: unknown;
  recipientId?: unknown;
  recipientIds?: unknown[];
  content?: unknown;
  status?: unknown;
  readAt?: unknown;
  deliveredAt?: unknown;
  editedAt?: unknown;
  deletedAt?: unknown;
  replyToMessageId?: unknown;
  reactions?: ApiReaction[];
  createdAt?: unknown;
  updatedAt?: unknown;
};

type MessageEvent = {
  type?: 'message' | 'read';
  userId?: string;
  conversationId?: string;
};

type CommandEntry = {
  kind: 'task' | 'project';
  id: string;
  label: string;
  detail: string;
  token: string;
};

const INITIAL_USERS: UserContact[] = [];
const INITIAL_CONVERSATIONS: ConversationItem[] = [];
const INITIAL_SUMMARIES: SummaryItem[] = [];
const INITIAL_TASKS: TaskItem[] = [];
const INITIAL_PROJECTS: ProjectItem[] = [];
const EMOJIS = ['👍', '❤️', '😂', '🎉', '🙏'];

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function avatarTone(value: string) {
  const charCode = value.charCodeAt(0) || 0;
  return charCode % 2 === 0 ? '#1D4ED8' : '#0F766E';
}

function resolveAvatarUrl(user?: Pick<UserContact, 'image' | 'linkedinProfilePicUrl'> | null) {
  if (!user) return '';
  return String(user.linkedinProfilePicUrl || user.image || '').trim();
}

function Avatar({ className, name, url, icon }: { className: string; name: string; url?: string; icon?: React.ReactNode }) {
  const [hasError, setHasError] = useState(false);
  const source = String(url || '').trim();

  if (source && !hasError) {
    return (
      <div className={className}>
        <img
          src={source}
          alt={name}
          className="avatar-image"
          loading="lazy"
          onError={() => setHasError(true)}
        />
      </div>
    );
  }

  return (
    <div className={className} style={{ background: avatarTone(name) }}>
      {icon || initials(name)}
    </div>
  );
}

function formatClock(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatRelativeTime(value: string | null) {
  if (!value) return 'No activity yet';
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(diff / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function toNullableString(value: unknown): string | null {
  return value == null ? null : String(value);
}

function presenceLabel(status?: PresenceStatus) {
  if (status === 'ONLINE') return 'Active now';
  if (status === 'AWAY') return 'Away';
  return 'Last seen recently';
}

function presenceDotColor(status?: PresenceStatus) {
  if (status === 'ONLINE') return '#16A34A';
  if (status === 'AWAY') return '#F59E0B';
  return '#64748B';
}

function buildThreadKey(selection: { userId?: string; conversationId?: string }) {
  return selection.conversationId ? `conversation:${selection.conversationId}` : selection.userId ? `user:${selection.userId}` : '';
}

function replaceComposerToken(input: string, replacement: string) {
  const tokens = input.trimEnd().split(/\s+/);
  if (tokens.length === 0) return replacement;
  tokens[tokens.length - 1] = replacement;
  return tokens.join(' ');
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripMentionMarkup(value: string) {
  return String(value || '')
    .replace(/\[([^\]]+)\]\(\/(?:tasks|projects)\/[A-Za-z0-9_-]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function renderMessageStatus(message: MessageItem) {
  if (message.deletedAt) return 'Deleted';
  if (message.readAt || message.status === 'READ') return 'Read';
  if (message.deliveredAt || message.status === 'DELIVERED') return 'Delivered';
  return 'Sent';
}

function renderMessageContent(content: string) {
  const tokenPattern = /\[([^\]]+)\]\((\/(?:tasks|projects)\/[A-Za-z0-9_-]+)\)/g;
  const lines = content.split('\n');

  return lines.map((line, lineIndex) => {
    const segments: React.ReactNode[] = [];
    let cursor = 0;
    let match = tokenPattern.exec(line);

    while (match) {
      const matchIndex = match.index;
      const fullMatch = match[0];
      const label = match[1];
      const href = match[2];

      if (matchIndex > cursor) {
        segments.push(line.slice(cursor, matchIndex));
      }

      segments.push(
        <a key={`${lineIndex}-${matchIndex}-${href}`} href={href} className="message-link">
          {label}
        </a>
      );

      cursor = matchIndex + fullMatch.length;
      match = tokenPattern.exec(line);
    }

    if (cursor < line.length) {
      segments.push(line.slice(cursor));
    }

    return (
      <React.Fragment key={`line-${lineIndex}`}>
        {segments.length > 0 ? segments : line}
        {lineIndex < lines.length - 1 ? <br /> : null}
      </React.Fragment>
    );
  });
}

export default function MessagesPage() {
  const { data: session } = useSession();
  const currentUserId = String(session?.user?.id || '');
  const currentUserName = String(session?.user?.name || 'You');
  const endRef = useRef<HTMLDivElement>(null);
  const threadContainerRef = useRef<HTMLElement | null>(null);
  const shouldAutoScrollRef = useRef(true);

  const [search, setSearch] = useState('');
  const [input, setInput] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [thread, setThread] = useState<MessageItem[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadRefreshing, setThreadRefreshing] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [threadLastUpdated, setThreadLastUpdated] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [replyTarget, setReplyTarget] = useState<MessageItem | null>(null);
  const [editingMessage, setEditingMessage] = useState<MessageItem | null>(null);
  const [reactionTarget, setReactionTarget] = useState<string | null>(null);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([]);
  const [streamHealthy, setStreamHealthy] = useState(true);
  const refreshTimerRef = useRef<number | null>(null);
  const queuedRefreshRef = useRef({ summaries: false, conversations: false, thread: false });

  const usersApi = useCachedApi<UserContact[]>({
    cacheKey: 'messages-users-v2',
    initialData: INITIAL_USERS,
    enabled: Boolean(currentUserId),
    fetcher: async () => {
      const res = await fetch('/api/users', { cache: 'no-store' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load users');
      return (json.data || []) as UserContact[];
    },
    ttlMs: 60_000,
  });

  const summariesApi = useCachedApi<SummaryItem[]>({
    cacheKey: 'messages-summary-v2',
    initialData: INITIAL_SUMMARIES,
    enabled: Boolean(currentUserId),
    fetcher: async () => {
      const res = await fetch('/api/messages/summary', { cache: 'no-store' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load messages');
      return (json.data || []) as SummaryItem[];
    },
    ttlMs: 20_000,
  });

  const conversationsApi = useCachedApi<ConversationItem[]>({
    cacheKey: 'messages-conversations-v1',
    initialData: INITIAL_CONVERSATIONS,
    enabled: Boolean(currentUserId),
    fetcher: async () => {
      const res = await fetch('/api/messages/conversations', { cache: 'no-store' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load conversations');
      return (json.data || []) as ConversationItem[];
    },
    ttlMs: 20_000,
  });

  const tasksApi = useCachedApi<TaskItem[]>({
    cacheKey: 'messages-tasks-v1',
    initialData: INITIAL_TASKS,
    enabled: Boolean(currentUserId),
    fetcher: async () => {
      const res = await fetch('/api/tasks?scope=all', { cache: 'no-store' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load tasks');
      return (json.data || []) as TaskItem[];
    },
    ttlMs: 60_000,
  });

  const projectsApi = useCachedApi<ProjectItem[]>({
    cacheKey: 'messages-projects-v1',
    initialData: INITIAL_PROJECTS,
    enabled: Boolean(currentUserId),
    fetcher: async () => {
      const res = await fetch('/api/projects', { cache: 'no-store' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load projects');
      return (json.data || []) as ProjectItem[];
    },
    ttlMs: 60_000,
  });

  const users = usersApi.data;
  const summaries = summariesApi.data;
  const conversations = conversationsApi.data;
  const tasks = tasksApi.data;
  const projects = projectsApi.data;

  const usersById = useMemo(() => new Map(users.map((user) => [String(user._id), user])), [users]);
  const directSummariesById = useMemo(() => new Map(summaries.filter((item) => item.type === 'direct').map((item) => [item.userId, item])), [summaries]);
  const groupSummariesById = useMemo(() => new Map(summaries.filter((item) => item.type === 'group').map((item) => [item.conversationId, item])), [summaries]);
  const conversationById = useMemo(() => new Map(conversations.map((conversation) => [conversation.id, conversation])), [conversations]);
  const activeThreadKey = buildThreadKey({ userId: selectedUserId, conversationId: selectedConversationId });

  const taskMentionMap = useMemo(() => {
    const map = new Map<string, string>();
    tasks.forEach((task) => {
      const title = String(task.title || '').trim();
      const id = String(task._id || '').trim();
      if (!title || !id) return;
      map.set(title.toLowerCase(), id);
    });
    return map;
  }, [tasks]);

  const projectMentionMap = useMemo(() => {
    const map = new Map<string, string>();
    projects.forEach((project) => {
      const name = String(project.name || '').trim();
      const id = String(project._id || '').trim();
      if (!name || !id) return;
      map.set(name.toLowerCase(), id);
    });
    return map;
  }, [projects]);

  const people = useMemo(() => {
    return users
      .filter((user) => String(user._id) !== currentUserId)
      .map((user) => {
        const summary = directSummariesById.get(String(user._id));
        return {
          id: String(user._id),
          name: user.name,
          avatarUrl: resolveAvatarUrl(user),
          subtitle: user.designation || user.role || 'Team member',
          status: user.presenceStatus || 'OFFLINE',
          unread: summary?.unreadCount || 0,
          lastMessage: stripMentionMarkup(summary?.lastMessage || ''),
          lastMessageAt: summary?.lastMessageAt || null,
        };
      })
      .sort((left, right) => {
        const leftTime = left.lastMessageAt ? new Date(left.lastMessageAt).getTime() : 0;
        const rightTime = right.lastMessageAt ? new Date(right.lastMessageAt).getTime() : 0;
        return rightTime - leftTime;
      });
  }, [currentUserId, directSummariesById, users]);

  const chatEntries = useMemo(() => {
    const directEntries = people
      .filter((person) => Boolean(person.lastMessageAt) || person.unread > 0)
      .map((person) => ({
      type: 'direct' as const,
      id: person.id,
      title: person.name,
      avatarUrl: person.avatarUrl,
      subtitle: person.subtitle,
      unread: person.unread,
      lastMessage: person.lastMessage,
      lastMessageAt: person.lastMessageAt,
      status: person.status,
      }));

    const groupEntries = conversations.map((conversation) => {
      const summary = groupSummariesById.get(conversation.id);
      return {
        type: 'group' as const,
        id: conversation.id,
        title: conversation.name || 'Group chat',
        subtitle: `${conversation.participantIds.length} members`,
        unread: summary?.unreadCount || 0,
        lastMessage: stripMentionMarkup(summary?.lastMessage || conversation.lastMessage || ''),
        lastMessageAt: summary?.lastMessageAt || conversation.lastMessageAt || null,
        status: 'ONLINE' as PresenceStatus,
      };
    }).filter((entry) => Boolean(entry.lastMessageAt) || entry.unread > 0);

    return [...groupEntries, ...directEntries].filter((entry) => {
      const term = search.trim().toLowerCase();
      if (!term) return true;
      return [entry.title, entry.subtitle, entry.lastMessage].some((value) => String(value).toLowerCase().includes(term));
    });
  }, [conversations, groupSummariesById, people, search]);

  const contentWithResolvedMentions = useCallback((value: string) => {
    let output = value;

    const taskLabels = Array.from(taskMentionMap.keys()).sort((left, right) => right.length - left.length);
    taskLabels.forEach((lowerLabel) => {
      const taskId = taskMentionMap.get(lowerLabel);
      if (!taskId) return;
      const originalLabel = tasks.find((task) => String(task.title || '').trim().toLowerCase() === lowerLabel)?.title || lowerLabel;
      const pattern = new RegExp(`(^|\\s)#${escapeRegExp(String(originalLabel))}(?=$|\\s|[.,!?])`, 'gi');
      output = output.replace(pattern, (_match, prefix: string) => `${prefix}[${String(originalLabel)}](/tasks/${taskId})`);
    });

    const projectLabels = Array.from(projectMentionMap.keys()).sort((left, right) => right.length - left.length);
    projectLabels.forEach((lowerLabel) => {
      const projectId = projectMentionMap.get(lowerLabel);
      if (!projectId) return;
      const originalLabel = projects.find((project) => String(project.name || '').trim().toLowerCase() === lowerLabel)?.name || lowerLabel;
      const pattern = new RegExp(`(^|\\s)\\/${escapeRegExp(String(originalLabel))}(?=$|\\s|[.,!?])`, 'gi');
      output = output.replace(pattern, (_match, prefix: string) => `${prefix}[${String(originalLabel)}](/projects/${projectId})`);
    });

    return output;
  }, [projectMentionMap, projects, taskMentionMap, tasks]);

  const activeUser = selectedUserId ? usersById.get(selectedUserId) || null : null;
  const activeConversation = selectedConversationId ? conversationById.get(selectedConversationId) || null : null;
  const activeThreadTitle = activeConversation ? activeConversation.name || 'Group chat' : activeUser ? activeUser.name : 'Messages';
  const activeThreadSubtitle = activeConversation
    ? `${activeConversation.participantIds.length} people in this room`
    : activeUser
      ? `${presenceLabel(activeUser.presenceStatus)}${activeUser.lastSeenAt ? ` · last seen ${formatRelativeTime(activeUser.lastSeenAt)}` : ''}`
      : 'Select a conversation';

  const threadPayload = useCallback((message: ApiMessage): MessageItem => ({
    _id: String(message._id),
    conversationId: message.conversationId ? String(message.conversationId) : null,
    senderId: String(message.senderId || ''),
    recipientId: String(message.recipientId || ''),
    recipientIds: Array.isArray(message.recipientIds) ? message.recipientIds.map((id: unknown) => String(id)) : [],
    content: String(message.content || ''),
    status: (message.status || 'SENT') as MessageItem['status'],
    readAt: toNullableString(message.readAt),
    deliveredAt: toNullableString(message.deliveredAt),
    editedAt: toNullableString(message.editedAt),
    deletedAt: toNullableString(message.deletedAt),
    replyToMessageId: message.replyToMessageId ? String(message.replyToMessageId) : null,
    reactions: Array.isArray(message.reactions)
      ? message.reactions.map((reaction: ApiReaction) => ({
          emoji: String(reaction.emoji || ''),
          userId: String(reaction.userId || ''),
          createdAt: reaction.createdAt ? String(reaction.createdAt) : null,
        }))
      : [],
    createdAt: String(message.createdAt || new Date().toISOString()),
    updatedAt: String(message.updatedAt || new Date().toISOString()),
  }), []);

  const loadThread = useCallback(async () => {
    if (!activeThreadKey) {
      setThread([]);
      setHasMore(false);
      setThreadError(null);
      setThreadLastUpdated(null);
      return;
    }

    setThreadLoading(true);
    setThreadRefreshing(false);
    setThreadError(null);

    try {
      const endpoint = selectedConversationId
        ? `/api/messages?conversationId=${encodeURIComponent(selectedConversationId)}&limit=40&markRead=1`
        : `/api/messages?userId=${encodeURIComponent(selectedUserId)}&limit=40&markRead=1`;
      const res = await fetch(endpoint, { cache: 'no-store' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load thread');

      const mapped = Array.isArray(json.data) ? json.data.map(threadPayload) : [];
      setThread(mapped);
      setHasMore(Boolean(json.hasMore));
      setThreadLastUpdated(new Date().toISOString());
    } catch (error: unknown) {
      setThreadError(error instanceof Error ? error.message : 'Failed to load thread');
    } finally {
      setThreadLoading(false);
      setThreadRefreshing(false);
    }
  }, [activeThreadKey, selectedConversationId, selectedUserId, threadPayload]);

  useEffect(() => {
    void loadThread();
  }, [loadThread]);

  const refreshThread = useCallback(async () => {
    setThreadRefreshing(true);
    await loadThread();
  }, [loadThread]);

  const isThreadNearBottom = useCallback(() => {
    const node = threadContainerRef.current;
    if (!node) return true;
    const remaining = node.scrollHeight - node.scrollTop - node.clientHeight;
    return remaining < 80;
  }, []);

  const onThreadScroll = useCallback(() => {
    shouldAutoScrollRef.current = isThreadNearBottom();
  }, [isThreadNearBottom]);

  const flushQueuedRefreshes = useCallback(() => {
    const queued = queuedRefreshRef.current;
    queuedRefreshRef.current = { summaries: false, conversations: false, thread: false };

    if (queued.summaries) {
      summariesApi.refresh().catch(() => {});
    }
    if (queued.conversations) {
      conversationsApi.refresh().catch(() => {});
    }
    if (queued.thread) {
      refreshThread().catch(() => {});
    }
  }, [conversationsApi, refreshThread, summariesApi]);

  const queueLiveRefresh = useCallback((options: { summaries?: boolean; conversations?: boolean; thread?: boolean }) => {
    queuedRefreshRef.current = {
      summaries: queuedRefreshRef.current.summaries || Boolean(options.summaries),
      conversations: queuedRefreshRef.current.conversations || Boolean(options.conversations),
      thread: queuedRefreshRef.current.thread || Boolean(options.thread),
    };

    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
    }

    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      flushQueuedRefreshes();
    }, 350);
  }, [flushQueuedRefreshes]);

  const loadOlder = useCallback(async () => {
    if (!activeThreadKey || !hasMore || loadingOlder || thread.length === 0) return;

    const oldest = thread[0];
    if (!oldest.createdAt) return;

    setLoadingOlder(true);
    try {
      const endpoint = selectedConversationId
        ? `/api/messages?conversationId=${encodeURIComponent(selectedConversationId)}&limit=40&before=${encodeURIComponent(oldest.createdAt)}`
        : `/api/messages?userId=${encodeURIComponent(selectedUserId)}&limit=40&before=${encodeURIComponent(oldest.createdAt)}`;
      const res = await fetch(endpoint, { cache: 'no-store' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load older messages');

      const older: MessageItem[] = Array.isArray(json.data) ? (json.data as ApiMessage[]).map(threadPayload) : [];
      setThread((prev) => {
        const seen = new Set(prev.map((message) => message._id));
        const merged = older.filter((message: MessageItem) => !seen.has(message._id));
        return [...merged, ...prev];
      });
      setHasMore(Boolean(json.hasMore));
    } catch (error: unknown) {
      setThreadError(error instanceof Error ? error.message : 'Failed to load older messages');
    } finally {
      setLoadingOlder(false);
    }
  }, [activeThreadKey, hasMore, loadingOlder, selectedConversationId, selectedUserId, thread, threadPayload]);

  useEffect(() => {
    const stream = new EventSource('/api/messages/events');

    stream.onopen = () => setStreamHealthy(true);
    stream.onerror = () => setStreamHealthy(false);

    const onUpdate = (event: Event) => {
      const messageEvent = event as globalThis.MessageEvent<string>;
      let payload: MessageEvent = {};

      try {
        payload = messageEvent?.data ? (JSON.parse(messageEvent.data) as MessageEvent) : {};
      } catch {
        payload = {};
      }

      const payloadConversationId = String(payload.conversationId || '');
      const payloadUserId = String(payload.userId || '');
      const isConversationMatch = Boolean(selectedConversationId) && payloadConversationId === selectedConversationId;
      const isDirectMatch = Boolean(selectedUserId) && !payloadConversationId && payloadUserId === selectedUserId;
      const isOwnSend = payload.type === 'message' && payloadUserId === currentUserId;

      queueLiveRefresh({
        summaries: true,
        conversations: payload.type === 'message',
        thread: Boolean(activeThreadKey) && (isConversationMatch || isDirectMatch || isOwnSend),
      });
    };

    stream.addEventListener('update', onUpdate);

    return () => {
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      stream.removeEventListener('update', onUpdate);
      stream.close();
    };
  }, [activeThreadKey, currentUserId, queueLiveRefresh, selectedConversationId, selectedUserId]);

  useEffect(() => {
    if (streamHealthy) return;

    const fallback = window.setInterval(() => {
      if (document.hidden) return;
      queueLiveRefresh({ summaries: true, conversations: true, thread: Boolean(activeThreadKey) });
    }, 15_000);

    return () => window.clearInterval(fallback);
  }, [activeThreadKey, queueLiveRefresh, streamHealthy]);

  useEffect(() => {
    shouldAutoScrollRef.current = true;
  }, [activeThreadKey]);

  useEffect(() => {
    if (!thread.length) return;

    const shouldScroll = shouldAutoScrollRef.current || isThreadNearBottom();
    if (!shouldScroll) return;

    endRef.current?.scrollIntoView({ behavior: 'auto' });
    shouldAutoScrollRef.current = true;
  }, [isThreadNearBottom, thread]);

  const commandContext = useMemo(() => {
    const trimmed = input.trimEnd();
    const lastToken = trimmed.split(/\s+/).pop() || '';
    if (lastToken.startsWith('#')) {
      const query = lastToken.slice(1).toLowerCase();
      const results: CommandEntry[] = tasks
        .filter((task) => String(task.title || '').toLowerCase().includes(query) || String(task.projectId?.name || '').toLowerCase().includes(query))
        .slice(0, 6)
        .map((task) => ({
          kind: 'task' as const,
          id: String(task._id),
          label: String(task.title || 'Untitled task'),
          detail: task.projectId?.name || 'Task reference',
          token: `#${String(task.title || 'Untitled task')}`,
        }));
      return { trigger: '#', results };
    }
    if (lastToken.startsWith('/')) {
      const query = lastToken.slice(1).toLowerCase();
      const results: CommandEntry[] = projects
        .filter((project) => String(project.name || '').toLowerCase().includes(query))
        .slice(0, 6)
        .map((project) => ({
          kind: 'project' as const,
          id: String(project._id),
          label: String(project.name || 'Untitled project'),
          detail: 'Project reference',
          token: `/${String(project.name || 'Untitled project')}`,
        }));
      return { trigger: '/', results };
    }
    return null;
  }, [input, projects, tasks]);

  const replyLookup = useMemo(() => new Map(thread.map((message) => [message._id, message])), [thread]);

  const selectChat = useCallback((item: { type: 'direct' | 'group'; id: string }) => {
    if (item.type === 'group') {
      setSelectedConversationId(item.id);
      setSelectedUserId('');
    } else {
      setSelectedUserId(item.id);
      setSelectedConversationId('');
    }
    setReplyTarget(null);
    setEditingMessage(null);
    setReactionTarget(null);
  }, []);

  const startGroupChat = useCallback(() => {
    setGroupName('');
    setGroupMemberIds([]);
    setGroupModalOpen(true);
  }, []);

  const createGroupChat = useCallback(async () => {
    if (!groupMemberIds.length) {
      toastError('Pick at least one teammate for the group.');
      return;
    }

    try {
      const res = await fetch('/api/messages/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: groupName,
          participantIds: groupMemberIds,
          isGroup: true,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to create group');

      setGroupModalOpen(false);
      setSelectedConversationId(String(json.data.id));
      setSelectedUserId('');
      await conversationsApi.refresh();
      await summariesApi.refresh();
    } catch (error: unknown) {
      toastError(error instanceof Error ? error.message : 'Unable to create the group chat.');
    }
  }, [conversationsApi, groupMemberIds, groupName, summariesApi]);

  const selectCommand = useCallback((entry: CommandEntry) => {
    setInput((current) => replaceComposerToken(current, entry.token));
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || !activeThreadKey) return;
    const resolvedContent = contentWithResolvedMentions(text);

    setSending(true);
    const payload = editingMessage
      ? { action: 'edit', content: resolvedContent }
      : selectedConversationId
        ? { conversationId: selectedConversationId, content: resolvedContent, replyToMessageId: replyTarget?._id }
        : { recipientId: selectedUserId, content: resolvedContent, replyToMessageId: replyTarget?._id };

    try {
      if (editingMessage) {
        const res = await fetch(`/api/messages/${editingMessage._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to edit message');
      } else {
        const res = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to send message');
      }

      setInput('');
      setReplyTarget(null);
      setEditingMessage(null);
      await refreshThread();
    } catch (error: unknown) {
      toastError(error instanceof Error ? error.message : 'Unable to send this message right now.');
    } finally {
      setSending(false);
    }
  }, [activeThreadKey, contentWithResolvedMentions, editingMessage, input, refreshThread, replyTarget, selectedConversationId, selectedUserId, sending]);

  const editMessage = useCallback((message: MessageItem) => {
    setEditingMessage(message);
    setReplyTarget(null);
    setInput(message.content);
  }, []);

  const deleteMessage = useCallback(async (messageId: string) => {
    try {
      const res = await fetch(`/api/messages/${messageId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to delete message');
      await refreshThread();
    } catch (error: unknown) {
      toastError(error instanceof Error ? error.message : 'Unable to delete this message.');
    }
  }, [refreshThread]);

  const addReaction = useCallback(async (messageId: string, emoji: string) => {
    try {
      const res = await fetch(`/api/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'react', emoji }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to react to message');
      setReactionTarget(null);
      await refreshThread();
    } catch (error: unknown) {
      toastError(error instanceof Error ? error.message : 'Unable to add this reaction.');
    }
  }, [refreshThread]);

  const filteredCommandCount = commandContext?.results.length || 0;

  const selectedCount = groupMemberIds.length;
  const syncLabel = threadLastUpdated ? `Last synced ${formatClock(threadLastUpdated)}` : 'Waiting for first sync';

  return (
    <div className="messages-shell">
      <aside className="messages-rail">
        <div className="messages-rail-header">
          <div>
            <div className="section-kicker">Messaging</div>
            <h1>Conversations</h1>
          </div>
          <button className="icon-button" onClick={startGroupChat} type="button" aria-label="Create group chat">
            <Plus size={16} />
          </button>
        </div>

        <div className="messages-search-wrap">
          <Search size={14} className="messages-search-icon" />
          <input
            className="input messages-search"
            placeholder="Search chats, people, tasks"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="messages-rail-actions">
          <button className="chip-button" type="button" onClick={startGroupChat}>
            <Users size={14} /> New group
          </button>
        </div>

        <div className="messages-section">
          <div className="messages-section-title">Recent chats</div>
          <div className="messages-list">
            {chatEntries.length === 0 ? (
              <div className="empty-panel">
                <p>Start a conversation to populate this space.</p>
              </div>
            ) : (
              chatEntries.map((entry) => {
                const isActive = entry.type === 'group' ? selectedConversationId === entry.id : selectedUserId === entry.id;
                const title = entry.title;
                const status = entry.type === 'group' ? 'ONLINE' : entry.status;

                return (
                  <button key={`${entry.type}:${entry.id}`} className={`chat-card ${isActive ? 'active' : ''}`} type="button" onClick={() => selectChat(entry)}>
                    <div className="chat-avatar-wrap">
                      <Avatar
                        className="chat-avatar"
                        name={title}
                        url={entry.type === 'direct' ? entry.avatarUrl : ''}
                        icon={entry.type === 'group' ? <Users size={14} /> : undefined}
                      />
                      <span className="chat-dot" style={{ background: presenceDotColor(status) }} />
                    </div>
                    <div className="chat-copy">
                      <div className="chat-title-row">
                        <span className="chat-title">{title}</span>
                        <span className="chat-time">{formatClock(entry.lastMessageAt)}</span>
                      </div>
                      <div className="chat-subtitle">{entry.subtitle}</div>
                      <div className="chat-preview">{entry.lastMessage}</div>
                    </div>
                    {entry.unread > 0 ? <span className="chat-badge">{entry.unread}</span> : null}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="messages-section">
          <div className="messages-section-title">People</div>
          <div className="messages-list people-list">
            {people.filter((person) => person.name.toLowerCase().includes(search.toLowerCase())).slice(0, 8).map((person) => (
              <button key={person.id} className="person-chip" type="button" onClick={() => selectChat({ type: 'direct', id: person.id })}>
                <Avatar className="person-avatar" name={person.name} url={person.avatarUrl} />
                <span className="person-copy">
                  <span className="person-name">{person.name}</span>
                  <span className="person-meta">{presenceLabel(person.status)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <main className="messages-thread-panel">
        <div className="thread-sync-bar">
          <span className={`thread-sync-text ${threadError ? 'error' : ''}`}>
            {threadError || (threadLoading ? 'Loading messages...' : threadRefreshing ? 'Refreshing...' : syncLabel)}
          </span>
          <button className="thread-sync-refresh" type="button" onClick={() => refreshThread()} disabled={threadLoading || threadRefreshing}>
            {threadError ? 'Retry' : 'Refresh'}
          </button>
        </div>

        <header className="thread-hero">
          <div className="thread-hero-copy">
            <div className="thread-hero-topline">
              <span className="section-kicker">Live chat</span>
              <span className={`connection-pill ${streamHealthy ? 'ok' : 'warn'}`}>{streamHealthy ? 'Live sync' : 'Polling fallback'}</span>
            </div>
            <div className="thread-hero-title-row">
              <Avatar
                className="thread-avatar"
                name={activeThreadTitle}
                url={activeConversation ? '' : resolveAvatarUrl(activeUser)}
                icon={activeConversation ? <Users size={16} /> : undefined}
              />
              <div>
                <h2>{activeThreadTitle}</h2>
                <p>{activeThreadSubtitle}</p>
              </div>
            </div>
          </div>
        </header>

        <section ref={threadContainerRef} className="thread-messages" onScroll={onThreadScroll}>
          {hasMore ? (
            <div className="load-more-row">
              <button className="chip-button" type="button" onClick={loadOlder} disabled={loadingOlder}>
                {loadingOlder ? 'Loading...' : 'Load older messages'}
              </button>
            </div>
          ) : null}

          <div className={`thread-stack ${activeThreadKey && thread.length > 0 ? 'has-thread' : ''}`}>
            {!activeThreadKey ? (
              <div className="empty-thread card-shell">
                <Sparkles size={22} />
                <h3>Pick a conversation</h3>
                <p>Choose a teammate or a group to start messaging. Use # for tasks and / for projects while composing.</p>
              </div>
            ) : thread.length === 0 ? (
              <div className="empty-thread card-shell">
                <Hash size={22} />
                <h3>No messages yet</h3>
                <p>This thread is empty. Send the first note to open the flow.</p>
              </div>
            ) : (
              thread.map((message) => {
                const isSelf = String(message.senderId) === currentUserId;
                const senderProfile = usersById.get(message.senderId);
                const sender = isSelf ? currentUserName : senderProfile?.name || 'Teammate';
                const replySource = message.replyToMessageId ? replyLookup.get(message.replyToMessageId) : null;

                return (
                  <article key={message._id} className={`message-row ${isSelf ? 'self' : 'other'}`}>
                    {!isSelf ? <Avatar className="message-avatar" name={sender} url={resolveAvatarUrl(senderProfile)} /> : null}
                    <div className={`message-bubble ${isSelf ? 'self' : 'other'} ${message.deletedAt ? 'deleted' : ''}`}>
                      <div className="message-meta-row">
                        <span className="message-sender">{sender}</span>
                        <span className="message-time">{formatClock(message.createdAt)}</span>
                      </div>

                      {replySource ? (
                        <div className="reply-card">
                          <span className="reply-label">Replying to {String(replySource.senderId) === currentUserId ? 'you' : usersById.get(replySource.senderId)?.name || 'teammate'}</span>
                          <span className="reply-preview">{replySource.deletedAt ? 'Deleted message' : replySource.content}</span>
                        </div>
                      ) : null}

                      <div className="message-content">{message.deletedAt ? 'This message was deleted.' : renderMessageContent(message.content)}</div>

                      {message.reactions.length > 0 ? (
                        <div className="reaction-row">
                          {message.reactions.map((reaction, index) => (
                            <span key={`${reaction.emoji}-${index}`} className="reaction-pill">
                              {reaction.emoji}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      <div className="message-footer">
                        {message.editedAt ? <span className="message-footnote">Edited</span> : <span className="message-footnote">{renderMessageStatus(message)}</span>}
                        {isSelf ? (
                          <span className="delivery-state">
                            {message.readAt ? <CheckCheck size={14} /> : <Check size={14} />}
                            {renderMessageStatus(message)}
                          </span>
                        ) : null}
                      </div>

                      <div className="message-actions">
                        <button className="message-action-button" type="button" onClick={() => setReplyTarget(message)} aria-label="Reply">
                          <Reply size={13} />
                        </button>
                        <button className="message-action-button" type="button" onClick={() => setReactionTarget(reactionTarget === message._id ? null : message._id)} aria-label="React">
                          <Smile size={13} />
                        </button>
                        {isSelf ? (
                          <>
                            <button className="message-action-button" type="button" onClick={() => editMessage(message)} aria-label="Edit">
                              <Sparkles size={13} />
                            </button>
                            <button className="message-action-button danger" type="button" onClick={() => deleteMessage(message._id)} aria-label="Delete">
                              <Trash2 size={13} />
                            </button>
                          </>
                        ) : null}
                      </div>

                      {reactionTarget === message._id ? (
                        <div className="reaction-picker">
                          {EMOJIS.map((emoji) => (
                            <button key={emoji} className="reaction-choice" type="button" onClick={() => addReaction(message._id, emoji)}>
                              {emoji}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })
            )}
            <div ref={endRef} />
          </div>
        </section>

        <footer className="composer-shell">
          {replyTarget ? (
            <div className="composer-context">
              <div>
                <span className="composer-context-label">Replying to {String(replyTarget.senderId) === currentUserId ? 'you' : usersById.get(replyTarget.senderId)?.name || 'teammate'}</span>
                <p>{replyTarget.deletedAt ? 'Deleted message' : replyTarget.content}</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setReplyTarget(null)} aria-label="Clear reply">
                <X size={14} />
              </button>
            </div>
          ) : null}

          {editingMessage ? (
            <div className="composer-context editing">
              <div>
                <span className="composer-context-label">Editing message</span>
                <p>Update the message and send to replace the original content.</p>
              </div>
              <button className="icon-button" type="button" onClick={() => { setEditingMessage(null); setInput(''); }} aria-label="Cancel edit">
                <X size={14} />
              </button>
            </div>
          ) : null}

          <div className="composer-row">
            <div className="composer-main">
              <textarea
                className="composer-input"
                placeholder={activeThreadKey ? `Message ${activeThreadTitle}... use # for tasks or / for projects` : 'Select a conversation to start typing'}
                value={input}
                disabled={!activeThreadKey || sending}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                rows={3}
              />

              {commandContext ? (
                <div className="command-panel">
                  <div className="command-panel-head">
                    <span>{commandContext.trigger === '#' ? 'Tasks' : 'Projects'}</span>
                    <span>{filteredCommandCount} matches</span>
                  </div>
                  <div className="command-list">
                    {commandContext.results.length === 0 ? (
                      <div className="command-empty">No matches found.</div>
                    ) : (
                      commandContext.results.map((entry) => (
                        <button key={`${entry.kind}:${entry.id}`} className="command-item" type="button" onClick={() => selectCommand(entry)}>
                          <span className="command-prefix">{commandContext.trigger}</span>
                          <span className="command-copy">
                            <strong>{entry.label}</strong>
                            <small>{entry.detail}</small>
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="composer-actions">
              <button className="chip-button" type="button" onClick={() => setInput((current) => `${current}${current ? ' ' : ''}#`)}>
                <Hash size={14} /> Task
              </button>
              <button className="chip-button" type="button" onClick={() => setInput((current) => `${current}${current ? ' ' : ''}/`)}>
                / Project
              </button>
              <button className="send-button" type="button" onClick={() => void sendMessage()} disabled={!input.trim() || !activeThreadKey || sending}>
                <Send size={15} />
              </button>
            </div>
          </div>

          <div className="composer-hint">
            <span>No file uploads.</span>
            <span>Enter sends, Shift+Enter adds a new line.</span>
          </div>
        </footer>
      </main>

      {groupModalOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="group-modal card-shell">
            <div className="group-modal-header">
              <div>
                <div className="section-kicker">New group</div>
                <h3>Create a group chat</h3>
              </div>
              <button className="icon-button" type="button" onClick={() => setGroupModalOpen(false)} aria-label="Close group modal">
                <X size={14} />
              </button>
            </div>

            <label className="field-label">
              Group name
              <input className="input" value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Optional group title" />
            </label>

            <div className="group-member-count">{selectedCount} selected</div>

            <div className="group-member-grid">
              {people.map((person) => {
                const checked = groupMemberIds.includes(person.id);
                return (
                  <label key={person.id} className={`group-member ${checked ? 'checked' : ''}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setGroupMemberIds((current) =>
                          current.includes(person.id)
                            ? current.filter((id) => id !== person.id)
                            : [...current, person.id]
                        );
                      }}
                    />
                    <Avatar className="person-avatar" name={person.name} url={person.avatarUrl} />
                    <span className="person-copy">
                      <span className="person-name">{person.name}</span>
                      <span className="person-meta">{presenceLabel(person.status)}</span>
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="group-modal-actions">
              <button className="chip-button" type="button" onClick={() => setGroupModalOpen(false)}>
                Cancel
              </button>
              <button className="send-button" type="button" onClick={() => void createGroupChat()} disabled={!groupMemberIds.length}>
                Create group
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
