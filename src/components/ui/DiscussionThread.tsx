"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { MessageSquare, Send, RefreshCw } from 'lucide-react';
import { toastError, toastSuccess } from '@/lib/toast';
import styles from './DiscussionThread.module.css';

type MentionUser = {
  _id: string;
  name?: string;
  email?: string;
};

type ReactionSummary = {
  emoji: string;
  count: number;
  reacted: boolean;
};

type DiscussionNode = {
  _id: string;
  parentCommentId?: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  author: { _id: string; name?: string; email?: string; image?: string };
  mentions?: MentionUser[];
  mentionHandles?: string[];
  reactions?: ReactionSummary[];
  canEdit: boolean;
  canDelete: boolean;
  task?: { id: string; title: string } | null;
  replies?: DiscussionNode[];
};

type DiscussionPayload = {
  threads: DiscussionNode[];
  tasks?: Array<{ _id: string; title: string }>;
};

type Props = {
  title?: string;
  endpoint: string;
  showTaskPicker?: boolean;
  emptyMessage?: string;
};

const QUICK_REACTIONS = ['👍', '❤️', '🔥', '🎯', '👀'];

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'just now';
  return d.toLocaleString();
}

function renderTextWithMentions(content: string) {
  const parts = content.split(/(\s+)/);
  return parts.map((part, idx) => {
    if (/^@[a-zA-Z0-9._-]+$/.test(part)) {
      return (
        <span key={`${part}-${idx}`} className={styles.mentions}>
          {part}
        </span>
      );
    }
    return <React.Fragment key={`${part}-${idx}`}>{part}</React.Fragment>;
  });
}

export default function DiscussionThread({ title = 'Discussion', endpoint, showTaskPicker = false, emptyMessage = 'No discussion yet.' }: Props) {
  const [payload, setPayload] = useState<DiscussionPayload>({ threads: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [participants, setParticipants] = useState<MentionUser[]>([]);

  const [content, setContent] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);

  const [mentionQuery, setMentionQuery] = useState('');
  const [replyMentionQuery, setReplyMentionQuery] = useState('');
  const [editMentionQuery, setEditMentionQuery] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [discussionRes, usersRes] = await Promise.all([
        fetch(endpoint, { cache: 'no-store' }),
        fetch('/api/users', { cache: 'no-store' }),
      ]);

      const [discussionJson, usersJson] = await Promise.all([discussionRes.json(), usersRes.json()]);

      if (!discussionJson.success) {
        throw new Error(discussionJson.error || 'Failed to load discussion');
      }

      setPayload(discussionJson.data || { threads: [] });
      if (showTaskPicker && discussionJson.data?.tasks?.length && !selectedTaskId) {
        setSelectedTaskId(discussionJson.data.tasks[0]._id);
      }

      if (usersJson.success) {
        setParticipants((usersJson.data || []).map((user: MentionUser) => ({ _id: String(user._id), name: user.name, email: user.email })));
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load discussion';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  const mentionOptions = useMemo(() => {
    if (!mentionQuery) return [];
    const needle = mentionQuery.toLowerCase();
    return participants
      .filter((user) => {
        const email = String(user.email || '').toLowerCase();
        const name = String(user.name || '').toLowerCase().replace(/[^a-z0-9._-]/g, '');
        const local = email.includes('@') ? email.split('@')[0] : email;
        return email.includes(needle) || local.includes(needle) || name.includes(needle);
      })
      .slice(0, 6);
  }, [mentionQuery, participants]);

  const replyMentionOptions = useMemo(() => {
    if (!replyMentionQuery) return [];
    const needle = replyMentionQuery.toLowerCase();
    return participants
      .filter((user) => {
        const email = String(user.email || '').toLowerCase();
        const name = String(user.name || '').toLowerCase().replace(/[^a-z0-9._-]/g, '');
        const local = email.includes('@') ? email.split('@')[0] : email;
        return email.includes(needle) || local.includes(needle) || name.includes(needle);
      })
      .slice(0, 6);
  }, [replyMentionQuery, participants]);

  const editMentionOptions = useMemo(() => {
    if (!editMentionQuery) return [];
    const needle = editMentionQuery.toLowerCase();
    return participants
      .filter((user) => {
        const email = String(user.email || '').toLowerCase();
        const name = String(user.name || '').toLowerCase().replace(/[^a-z0-9._-]/g, '');
        const local = email.includes('@') ? email.split('@')[0] : email;
        return email.includes(needle) || local.includes(needle) || name.includes(needle);
      })
      .slice(0, 6);
  }, [editMentionQuery, participants]);

  const captureMentionQuery = (value: string, setter: (query: string) => void) => {
    const match = value.match(/(?:^|\s)@([a-zA-Z0-9._-]*)$/);
    setter(match ? match[1] : '');
  };

  const applyMention = (original: string, user: MentionUser) => {
    const handle = String(user.email || user.name || '').toLowerCase();
    const normalizedHandle = handle.includes('@') ? handle.split('@')[0] : handle.replace(/[^a-z0-9._-]/g, '');
    return original.replace(/(?:^|\s)@([a-zA-Z0-9._-]*)$/, (full) => {
      const prefix = full.startsWith(' ') ? ' ' : '';
      return `${prefix}@${normalizedHandle} `;
    });
  };

  const createComment = async (text: string, parentCommentId?: string) => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: text,
          parentCommentId,
          taskId: showTaskPicker ? selectedTaskId || undefined : undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to send comment');
      toastSuccess('Comment posted');
      setContent('');
      setReplyContent('');
      setReplyTo(null);
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to send comment';
      toastError(message);
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!editId) return;
    setSaving(true);
    try {
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'edit', commentId: editId, content: editContent }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to edit comment');
      toastSuccess('Comment edited');
      setEditId(null);
      setEditContent('');
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to edit comment';
      toastError(message);
    } finally {
      setSaving(false);
    }
  };

  const deleteComment = async (commentId: string) => {
    setSaving(true);
    try {
      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to delete comment');
      toastSuccess('Comment deleted');
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to delete comment';
      toastError(message);
    } finally {
      setSaving(false);
    }
  };

  const react = async (commentId: string, emoji: string) => {
    try {
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'react', commentId, emoji }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to react');
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to react';
      toastError(message);
    }
  };

  const renderNode = (node: DiscussionNode) => {
    const hasReplies = Boolean(node.replies && node.replies.length > 0);

    return (
      <div key={node._id} className={styles.node}>
        <div className={styles.nodeHeader}>
          <div>
            <span className={styles.nodeAuthor}>{node.author?.name || node.author?.email || 'Unknown user'}</span>
            {' · '}
            <span>{formatWhen(node.createdAt)}</span>
            {node.editedAt ? ' · edited' : ''}
          </div>
          {node.task?.title ? <span className={styles.metaTag}>{node.task.title}</span> : null}
        </div>

        <div className={`${styles.nodeBody} ${node.deletedAt ? styles.deleted : ''}`}>{renderTextWithMentions(node.content)}</div>

        <div className={styles.nodeActions}>
          <div className={styles.reactions}>
            {(node.reactions || []).map((reaction) => (
              <button
                key={`${node._id}-${reaction.emoji}`}
                type="button"
                className={`${styles.reactionBtn} ${reaction.reacted ? styles.reacted : ''}`}
                onClick={() => react(node._id, reaction.emoji)}
              >
                {reaction.emoji} {reaction.count}
              </button>
            ))}
          </div>

          {!node.deletedAt && QUICK_REACTIONS.map((emoji) => (
            <button key={`${node._id}-quick-${emoji}`} type="button" className={styles.actionBtn} onClick={() => react(node._id, emoji)}>
              {emoji}
            </button>
          ))}

          {!node.deletedAt ? (
            <button type="button" className={styles.actionBtn} onClick={() => setReplyTo(replyTo === node._id ? null : node._id)}>
              Reply
            </button>
          ) : null}

          {node.canEdit ? (
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => {
                setEditId(node._id);
                setEditContent(node.content === '[deleted]' ? '' : node.content);
              }}
            >
              Edit
            </button>
          ) : null}

          {node.canDelete ? (
            <button type="button" className={styles.actionBtn} onClick={() => deleteComment(node._id)}>
              Delete
            </button>
          ) : null}
        </div>

        {editId === node._id ? (
          <div className={styles.replyBox}>
            <textarea
              className={styles.textarea}
              value={editContent}
              onChange={(e) => {
                setEditContent(e.target.value);
                captureMentionQuery(e.target.value, setEditMentionQuery);
              }}
              placeholder="Edit your comment"
            />
            {editMentionOptions.length ? (
              <div className={styles.suggestions}>
                {editMentionOptions.map((user) => (
                  <button
                    key={`edit-${user._id}`}
                    type="button"
                    className={styles.suggestion}
                    onClick={() => {
                      setEditContent((prev) => applyMention(prev, user));
                      setEditMentionQuery('');
                    }}
                  >
                    {user.name || user.email} ({user.email})
                  </button>
                ))}
              </div>
            ) : null}
            <div className={styles.composerRow}>
              <button type="button" className="btn btn-primary" onClick={saveEdit} disabled={saving || !editContent.trim()}>
                Save Edit
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setEditId(null);
                  setEditContent('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {replyTo === node._id ? (
          <div className={styles.replyBox}>
            <textarea
              className={styles.textarea}
              value={replyContent}
              onChange={(e) => {
                setReplyContent(e.target.value);
                captureMentionQuery(e.target.value, setReplyMentionQuery);
              }}
              placeholder="Write a reply... use @handle to mention"
            />
            {replyMentionOptions.length ? (
              <div className={styles.suggestions}>
                {replyMentionOptions.map((user) => (
                  <button
                    key={`reply-${user._id}`}
                    type="button"
                    className={styles.suggestion}
                    onClick={() => {
                      setReplyContent((prev) => applyMention(prev, user));
                      setReplyMentionQuery('');
                    }}
                  >
                    {user.name || user.email} ({user.email})
                  </button>
                ))}
              </div>
            ) : null}
            <div className={styles.composerRow}>
              <button type="button" className="btn btn-primary" onClick={() => createComment(replyContent, node._id)} disabled={saving || !replyContent.trim()}>
                Reply
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setReplyTo(null)}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {hasReplies ? <div className={styles.children}>{(node.replies || []).map((child) => renderNode(child))}</div> : null}
      </div>
    );
  };

  return (
    <section className={styles.discussion}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 className="text-sm font-bold uppercase text-muted" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <MessageSquare size={15} /> {title}
        </h3>
        <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div className={styles.composer}>
        {showTaskPicker ? (
          <select className={styles.input} value={selectedTaskId} onChange={(e) => setSelectedTaskId(e.target.value)}>
            {(payload.tasks || []).map((task) => (
              <option key={task._id} value={task._id}>
                {task.title}
              </option>
            ))}
          </select>
        ) : null}

        <textarea
          className={styles.textarea}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            captureMentionQuery(e.target.value, setMentionQuery);
          }}
          placeholder="Start a thread... use @handle to mention"
        />

        {mentionOptions.length ? (
          <div className={styles.suggestions}>
            {mentionOptions.map((user) => (
              <button
                key={`mention-${user._id}`}
                type="button"
                className={styles.suggestion}
                onClick={() => {
                  setContent((prev) => applyMention(prev, user));
                  setMentionQuery('');
                }}
              >
                {user.name || user.email} ({user.email})
              </button>
            ))}
          </div>
        ) : null}

        <div className={styles.composerRow}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving || !content.trim() || (showTaskPicker && !selectedTaskId)}
            onClick={() => createComment(content)}
          >
            <Send size={13} /> Post
          </button>
        </div>
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}

      {loading ? (
        <div className="text-sm text-muted">Loading discussion...</div>
      ) : payload.threads?.length ? (
        <div className={styles.threadList}>{payload.threads.map((node) => renderNode(node))}</div>
      ) : (
        <div className="text-sm text-muted">{emptyMessage}</div>
      )}
    </section>
  );
}
