"use client";

import React, { useMemo, useState } from 'react';
import { ChevronRight, FileStack, Plus, Sparkles } from 'lucide-react';
import DataStatusBanner from '@/components/ui/DataStatusBanner';
import { useCachedApi } from '@/lib/useCachedApi';
import { toastError, toastSuccess } from '@/lib/toast';

type TaskTemplateItem = {
  key: string;
  title: string;
  description?: string;
  steps: string[];
  isSystem?: boolean;
};

export default function TaskTemplatesPage() {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    stepsText: '',
  });

  const templatesApi = useCachedApi<TaskTemplateItem[]>({
    cacheKey: 'task-templates:v1',
    initialData: [],
    fetcher: async () => {
      const res = await fetch('/api/task-templates', { cache: 'no-store' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load templates');
      return json.data as TaskTemplateItem[];
    },
    ttlMs: 20_000,
  });

  const templates = templatesApi.data;
  const hasCustomTemplates = useMemo(() => templates.some((template) => !template.isSystem), [templates]);

  const createTemplate = async (event: React.FormEvent) => {
    event.preventDefault();
    const title = form.title.trim();
    if (!title) return;

    const steps = form.stepsText
      .split('\n')
      .map((line) => line.trim().replace(/^[-*]\s*/, ''))
      .filter(Boolean);

    setSaving(true);
    try {
      const res = await fetch('/api/task-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: form.description.trim(),
          steps,
        }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to create template');

      toastSuccess('Task template created');
      setForm({ title: '', description: '', stepsText: '' });
      await templatesApi.refresh();
    } catch (error: unknown) {
      toastError(error instanceof Error ? error.message : 'Failed to create template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-wrapper animate-in">
      <nav className="breadcrumb" style={{ marginBottom: 14 }}>
        <span>DreamShift</span>
        <ChevronRight size={13} />
        <span className="breadcrumb-active">Task Templates</span>
      </nav>

      <div className="card" style={{ padding: 18, marginBottom: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileStack size={20} /> Task Templates
        </h1>
        <p className="text-sm text-muted" style={{ marginTop: 6 }}>
          Reusable workflows you can apply when creating projects and tasks. Create your own templates below.
        </p>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <form onSubmit={createTemplate} style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Create Task Template</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) minmax(280px, 1.2fr)', gap: 10 }}>
            <div style={{ display: 'grid', gap: 10 }}>
              <label className="field-label">
                Template name
                <input
                  className="input"
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Quarterly Client Onboarding"
                  required
                />
              </label>

              <label className="field-label">
                Description
                <textarea
                  className="input"
                  style={{ minHeight: 82, resize: 'vertical' }}
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="When to use this template and what it covers"
                />
              </label>
            </div>

            <label className="field-label">
              Checklist steps (one per line)
              <textarea
                className="input"
                style={{ minHeight: 182, resize: 'vertical' }}
                value={form.stepsText}
                onChange={(event) => setForm((prev) => ({ ...prev, stepsText: event.target.value }))}
                placeholder={'Kickoff meeting\nGather requirements\nInternal review\nStakeholder sign-off'}
              />
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              <Plus size={14} /> {saving ? 'Creating...' : 'Create Template'}
            </button>
          </div>
        </form>
      </div>

      <DataStatusBanner
        loading={templatesApi.loading}
        error={templatesApi.error}
        isRefreshing={templatesApi.isRefreshing}
        lastUpdated={templatesApi.lastUpdated}
        onRetry={templatesApi.refresh}
        onRefresh={templatesApi.refresh}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        {templates.map((template) => {
          return (
            <div key={template.key} className="card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Sparkles size={16} />
                  <span style={{ fontWeight: 600 }}>{template.title}</span>
                </div>
                <span className="badge">{template.key}</span>
              </div>

              {template.description ? (
                <p className="text-sm text-muted" style={{ marginTop: 8 }}>{template.description}</p>
              ) : null}

              <ul style={{ marginTop: 10, paddingLeft: 16 }}>
                {template.steps.map((step) => (
                  <li key={step} className="text-sm text-muted" style={{ marginBottom: 4 }}>{step}</li>
                ))}
              </ul>

              {!template.isSystem ? (
                <div className="text-xs text-muted" style={{ marginTop: 8 }}>Custom template</div>
              ) : null}
            </div>
          );
        })}
      </div>

      {!templatesApi.loading && templates.length === 0 ? (
        <div className="card" style={{ marginTop: 12, padding: 14 }}>
          <p className="text-sm text-muted">No templates available yet. Create your first task template above.</p>
        </div>
      ) : null}

      {hasCustomTemplates ? null : (
        <div className="card" style={{ marginTop: 12, padding: 12 }}>
          <p className="text-xs text-muted">Tip: custom templates will also appear in your project template dropdowns.</p>
        </div>
      )}
    </div>
  );
}
