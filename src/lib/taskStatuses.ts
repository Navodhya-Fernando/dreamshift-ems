export type ProjectTaskStatus = {
  key: string;
  label: string;
};

export const DEFAULT_PROJECT_TASK_STATUSES: ProjectTaskStatus[] = [
  { key: 'TODO', label: 'To Do' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'IN_REVIEW', label: 'In Review' },
  { key: 'BLOCKED', label: 'Blocked' },
  { key: 'DONE', label: 'Done' },
];

function toStatusKey(value: string) {
  const cleaned = String(value || '').trim();
  if (!cleaned) return '';
  return cleaned.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
}

function toStatusLabel(value: string) {
  const cleaned = String(value || '').trim();
  if (!cleaned) return '';
  return cleaned
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function canonicalStatusKey(value: string) {
  const normalized = toStatusKey(value);
  const aliasMap: Record<string, string> = {
    TODO: 'TODO',
    TO_DO: 'TODO',
    INPROGRESS: 'IN_PROGRESS',
    IN_PROGRESS: 'IN_PROGRESS',
    IN_REVIEW: 'IN_REVIEW',
    BLOCKED: 'BLOCKED',
    DONE: 'DONE',
    COMPLETED: 'DONE',
  };

  return aliasMap[normalized] || normalized;
}

export function normalizeProjectTaskStatuses(input: unknown): ProjectTaskStatus[] {
  const raw = Array.isArray(input) ? input : [];
  const result: ProjectTaskStatus[] = [];
  const seen = new Set<string>();

  raw.forEach((item) => {
    if (typeof item === 'string') {
      const key = canonicalStatusKey(item);
      if (!key || seen.has(key)) return;
      seen.add(key);
      result.push({ key, label: toStatusLabel(item) || toStatusLabel(key) });
      return;
    }

    if (!item || typeof item !== 'object') return;
    const maybe = item as { key?: unknown; label?: unknown };
    const key = canonicalStatusKey(String(maybe.key || maybe.label || ''));
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push({
      key,
      label: toStatusLabel(String(maybe.label || maybe.key || '')) || toStatusLabel(key),
    });
  });

  const required = [
    { key: 'TODO', label: 'To Do' },
    { key: 'IN_PROGRESS', label: 'In Progress' },
    { key: 'DONE', label: 'Done' },
  ];

  required.forEach((requiredStatus) => {
    if (seen.has(requiredStatus.key)) return;
    seen.add(requiredStatus.key);
    result.push(requiredStatus);
  });

  if (result.length === 0) return DEFAULT_PROJECT_TASK_STATUSES;
  return result;
}

export function normalizeTaskStatusForProject(status: unknown, projectTaskStatuses: ProjectTaskStatus[]) {
  const allowed = normalizeProjectTaskStatuses(projectTaskStatuses).map((item) => item.key);
  const normalized = canonicalStatusKey(String(status || 'TODO')) || 'TODO';
  if (allowed.includes(normalized)) return normalized;
  return allowed[0] || 'TODO';
}

export function toTaskStatusLabel(status: string, projectTaskStatuses?: ProjectTaskStatus[]) {
  const normalized = canonicalStatusKey(status || '');
  const list = normalizeProjectTaskStatuses(projectTaskStatuses || DEFAULT_PROJECT_TASK_STATUSES);
  const found = list.find((item) => item.key === normalized);
  return found?.label || toStatusLabel(normalized || status || 'TODO');
}
