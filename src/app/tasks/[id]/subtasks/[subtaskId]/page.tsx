"use client";

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronRight, Calendar, CheckSquare } from 'lucide-react';
import DataStatusBanner from '@/components/ui/DataStatusBanner';
import { useCachedApi } from '@/lib/useCachedApi';

type Subtask = {
  id: string;
  title: string;
  isCompleted: boolean;
  dueDate?: string;
};

type TaskDetail = {
  _id: string;
  title: string;
  subtasks?: Subtask[];
};

export default function SubtaskDetailPage() {
  const params = useParams<{ id: string; subtaskId: string }>();
  const taskId = params.id;
  const subtaskId = params.subtaskId;

  const {
    data,
    loading,
    error,
    isRefreshing,
    lastUpdated,
    refresh,
  } = useCachedApi<TaskDetail | null>({
    cacheKey: `task-subtask-detail-${taskId}`,
    initialData: null,
    fetcher: async () => {
      const res = await fetch(`/api/tasks/${taskId}`, { cache: 'no-store' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load task');
      return json.data as TaskDetail;
    },
    enabled: Boolean(taskId),
    ttlMs: 45_000,
  });

  const subtask = data?.subtasks?.find((item) => String(item.id) === String(subtaskId));

  return (
    <div className="page-wrapper animate-in">
      <nav className="breadcrumb" style={{ marginBottom: 14 }}>
        <span>DreamShift</span>
        <ChevronRight size={13} />
        <Link href="/tasks">My Tasks</Link>
        <ChevronRight size={13} />
        <Link href={`/tasks/${taskId}`}>Task Detail</Link>
        <ChevronRight size={13} />
        <span className="breadcrumb-active">Subtask</span>
      </nav>

      <DataStatusBanner
        loading={loading}
        error={error}
        isRefreshing={isRefreshing}
        lastUpdated={lastUpdated}
        onRetry={refresh}
        onRefresh={refresh}
      />

      {!subtask ? (
        <div className="card" style={{ padding: 16, marginTop: 12 }}>
          {loading ? 'Loading subtask...' : 'Subtask not found.'}
        </div>
      ) : (
        <section className="card" style={{ padding: 18, marginTop: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{subtask.title}</h1>

          <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
            <div className="card" style={{ padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="text-sm text-muted">Completion</span>
              <span className="badge" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <CheckSquare size={12} /> {subtask.isCompleted ? 'Completed' : 'Pending'}
              </span>
            </div>

            <div className="card" style={{ padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="text-sm text-muted">Due Date</span>
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <Calendar size={12} /> {subtask.dueDate ? new Date(subtask.dueDate).toLocaleDateString() : 'No due date'}
              </span>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
