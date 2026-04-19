"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import {
  Activity,
  BarChart3,
  Building2,
  ChevronRight,
  Edit3,
  Plus,
  RefreshCw,
  Shield,
  Sparkles,
  UserCheck,
  UserPlus,
  UserX,
  Users,
} from 'lucide-react';
import DataStatusBanner from '@/components/ui/DataStatusBanner';
import { parseDisplayDate, formatDisplayDate } from '@/lib/date';
import { useCachedApi } from '@/lib/useCachedApi';
import { toastError, toastSuccess } from '@/lib/toast';
import { normalizePlatformRole, type PlatformRole } from '@/lib/roles';
import './admin.css';

type WorkspaceReport = {
  workspaceId: string;
  workspaceName: string;
  ownerName: string;
  projects: number;
  tasks: number;
  openTasks: number;
  completionRate: number;
  members: number;
  activeMembers: number;
  leftMembers: number;
  overdueTasks: number;
  healthScore: number;
};

type EmployeeReport = {
  userId: string;
  name: string;
  email: string;
  designation: string;
  role: PlatformRole;
  employmentStatus: 'ACTIVE' | 'LEFT';
  contractExpiry: string | null;
  contractRemainingDays: number | null;
  leftAt: string | null;
  leftReason: string;
  totalAssigned: number;
  completed: number;
  completionRate: number;
  completionDelta: number;
  completionTrend7: number[];
  averageTimeSpentHours: number;
  efficiencyScore: number;
  productivityScore: number;
  burnoutRisk: number;
  workloadState: 'BALANCED' | 'STRETCHED' | 'OVERLOADED';
  overdueTasks: number;
  overdueDelta: number;
  overdueTrend7: number[];
  openTasks: number;
  workspaceCount: number;
  workspaceNames: string[];
  lastSeenAt: string | null;
  presenceStatus: 'ONLINE' | 'AWAY' | 'OFFLINE';
  healthScore: number;
};

type AdminReportsPayload = {
  generatedAt: string;
  windowDays?: number;
  summary?: {
    current: {
      avgWorkspaceHealth: number;
      avgEmployeeHealth: number;
      completionRate: number;
      overdueTasks: number;
      openTasks: number;
    };
    previous: {
      avgWorkspaceHealth: number;
      avgEmployeeHealth: number;
      completionRate: number;
      overdueTasks: number;
      openTasks: number;
    };
    delta: {
      avgWorkspaceHealth: number;
      avgEmployeeHealth: number;
      completionRate: number;
      overdueTasks: number;
      openTasks: number;
    };
  };
  workspaceReports: WorkspaceReport[];
  employeeReports: EmployeeReport[];
};

type AdminUserRecord = {
  _id: string;
  name: string;
  email: string;
  designation?: string;
  role: PlatformRole;
  employmentStatus: 'ACTIVE' | 'LEFT';
  contractExpiry?: string | null;
  dateJoined?: string | null;
  leftAt?: string | null;
  leftReason?: string;
  linkedinProfileUrl?: string;
  linkedinProfilePicUrl?: string;
  image?: string;
  presenceStatus?: 'ONLINE' | 'AWAY' | 'OFFLINE';
  lastSeenAt?: string | null;
  activeAt?: string | null;
  workspaceCount?: number;
  workspaces?: Array<{ id: string; name: string; role: string }>;
  employmentHistory?: Array<{
    title: string;
    startedAt: string | Date;
    endedAt?: string | Date | null;
    note?: string;
  }>;
};

type AdminPayload = {
  reports: AdminReportsPayload | null;
  users: AdminUserRecord[];
};

type UserFormState = {
  name: string;
  email: string;
  password: string;
  designation: string;
  role: PlatformRole;
  employmentStatus: 'ACTIVE' | 'LEFT';
  contractExpiry: string;
  dateJoined: string;
  leftAt: string;
  leftReason: string;
  linkedinProfileUrl: string;
  linkedinProfilePicUrl: string;
  employmentHistory: Array<{
    id: string;
    title: string;
    startedAt: string;
    endedAt: string;
    note: string;
  }>;
};

const ROLE_OPTIONS: Array<{ value: PlatformRole; label: string }> = [
  { value: 'EMPLOYEE', label: 'Employee' },
  { value: 'WORKSPACE_ADMIN', label: 'Workspace Admin' },
  { value: 'Admin', label: 'Platform Admin' },
  { value: 'OWNER', label: 'Owner' },
];

const EMPTY_FORM: UserFormState = {
  name: '',
  email: '',
  password: '',
  designation: '',
  role: 'EMPLOYEE',
  employmentStatus: 'ACTIVE',
  contractExpiry: '',
  dateJoined: '',
  leftAt: '',
  leftReason: '',
  linkedinProfileUrl: '',
  linkedinProfilePicUrl: '',
  employmentHistory: [],
};

function toApiDate(value: string) {
  if (!value.trim()) return '';

  const parsed = parseDisplayDate(value);
  if (!parsed) {
    throw new Error('Use DD-MM-YYYY for date fields');
  }

  return parsed;
}

function toInputDate(value?: string | Date | null) {
  if (!value) return '';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';

  return parsed.toISOString().slice(0, 10);
}

function initials(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';
}

function createHistoryRow(history?: Partial<UserFormState['employmentHistory'][number]>) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: `history-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: history?.title || '',
    startedAt: history?.startedAt ? toInputDate(history.startedAt) : today,
    endedAt: history?.endedAt ? toInputDate(history.endedAt) : '',
    note: history?.note || '',
  };
}

function normalizeHistoryRows(history?: AdminUserRecord['employmentHistory']) {
  if (!Array.isArray(history) || history.length === 0) return [];

  return history.map((entry, index) => ({
    id: `history-${index}-${String(entry.title || 'role').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    title: String(entry.title || ''),
    startedAt: toInputDate(entry.startedAt),
    endedAt: entry.endedAt ? toInputDate(entry.endedAt) : '',
    note: String(entry.note || ''),
  })).filter((row) => row.title || row.startedAt || row.endedAt || row.note);
}

function makeDefaultHistory(title = 'Employee', startedAt = new Date().toISOString().slice(0, 10), endedAt = '', note = '') {
  return createHistoryRow({ title, startedAt, endedAt, note });
}

function fromUser(user?: AdminUserRecord | null): UserFormState {
  if (!user) return EMPTY_FORM;

  return {
    name: user.name || '',
    email: user.email || '',
    password: '',
    designation: user.designation || '',
    role: user.role || 'EMPLOYEE',
    employmentStatus: user.employmentStatus || 'ACTIVE',
    contractExpiry: toInputDate(user.contractExpiry),
    dateJoined: toInputDate(user.dateJoined),
    leftAt: toInputDate(user.leftAt),
    leftReason: user.leftReason || '',
    linkedinProfileUrl: user.linkedinProfileUrl || '',
    linkedinProfilePicUrl: user.linkedinProfilePicUrl || user.image || '',
    employmentHistory: normalizeHistoryRows(user.employmentHistory),
  };
}

function scoreTone(score: number) {
  if (score >= 80) return { label: 'Excellent', className: 'tone-good' };
  if (score >= 60) return { label: 'Watch', className: 'tone-warn' };
  return { label: 'At risk', className: 'tone-bad' };
}

function statusTone(status: 'ACTIVE' | 'LEFT') {
  return status === 'ACTIVE' ? 'tone-good' : 'tone-bad';
}

function roleLabel(role: PlatformRole) {
  return role
    .split('_')
    .map((part) => part[0] + part.slice(1).toLowerCase())
    .join(' ');
}

function formatDelta(value: number, suffix = '') {
  const rounded = Math.round(value * 10) / 10;
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded}${suffix}`;
}

function deltaTone(value: number, positiveIsGood = true) {
  if (value === 0) return 'tone-warn';
  if (positiveIsGood) {
    return value > 0 ? 'tone-good' : 'tone-bad';
  }
  return value > 0 ? 'tone-bad' : 'tone-good';
}

function renderSparklinePath(values: number[], width: number, height: number) {
  if (!values.length) return '';
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(1, max - min);
  return values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

function formatTenure(startDate?: string | null) {
  if (!startDate) return 'Not available';

  const startedAt = new Date(startDate);
  if (Number.isNaN(startedAt.getTime())) return 'Not available';

  const now = new Date();
  let months = (now.getFullYear() - startedAt.getFullYear()) * 12 + (now.getMonth() - startedAt.getMonth());
  if (now.getDate() < startedAt.getDate()) months -= 1;
  months = Math.max(0, months);

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (years === 0) return `${remainingMonths} month${remainingMonths === 1 ? '' : 's'}`;
  if (remainingMonths === 0) return `${years} year${years === 1 ? '' : 's'}`;
  return `${years}y ${remainingMonths}m`;
}

function normalizeRoleHistory(user: AdminUserRecord | null) {
  if (!user) return [];

  if (Array.isArray(user.employmentHistory) && user.employmentHistory.length > 0) {
    return user.employmentHistory.map((entry, index) => ({
      id: `history-${user._id}-${index}`,
      title: String(entry.title || 'Role'),
      startedAt: new Date(entry.startedAt),
      endedAt: entry.endedAt ? new Date(entry.endedAt) : null,
      note: String(entry.note || ''),
    })).filter((entry) => !Number.isNaN(entry.startedAt.getTime()));
  }

  return [{
    id: `history-${user._id}-current`,
    title: user.designation || 'Employee',
    startedAt: user.dateJoined ? new Date(user.dateJoined) : new Date(),
    endedAt: null,
    note: '',
  }];
}

export default function AdminConsolePage() {
  const { data: session, status } = useSession();
  const canAccessAdmin = !session?.user?.role || ['OWNER', 'ADMIN', 'WORKSPACE_ADMIN'].includes(normalizePlatformRole(session.user.role));
  const [windowDays, setWindowDays] = useState<0 | 7 | 30 | 90>(0);
  const [densityMode, setDensityMode] = useState<'expanded' | 'compact'>('expanded');
  const [openInterventionId, setOpenInterventionId] = useState<string | null>(null);

  const {
    data,
    loading,
    error,
    isRefreshing,
    lastUpdated,
    refresh,
  } = useCachedApi<AdminPayload>({
    cacheKey: `admin-console-v3-${windowDays}`,
    initialData: { reports: null, users: [] },
    enabled: canAccessAdmin,
    fetcher: async () => {
      const [reportsRes, usersRes] = await Promise.all([
        fetch(`/api/admin/reports?windowDays=${windowDays}`, { cache: 'no-store' }),
        fetch('/api/admin/users', { cache: 'no-store' }),
      ]);

      const [reportsJson, usersJson] = await Promise.all([reportsRes.json(), usersRes.json()]);
      if (!reportsJson.success || !usersJson.success) {
        throw new Error(reportsJson.error || usersJson.error || 'Failed to load admin telemetry');
      }

      return {
        reports: reportsJson.data as AdminReportsPayload,
        users: usersJson.data as AdminUserRecord[],
      };
    },
    ttlMs: 45_000,
  });

  const reports = data.reports;
  const users = data.users;

  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [editorUserId, setEditorUserId] = useState<string | null>(null);
  const [deepDiveOpen, setDeepDiveOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | PlatformRole>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'LEFT'>('ALL');
  const [saving, setSaving] = useState(false);

  const workspaceReports = useMemo(() => reports?.workspaceReports || [], [reports]);
  const employeeReports = useMemo(() => reports?.employeeReports || [], [reports]);

  const reportByUserId = useMemo(
    () => new Map(employeeReports.map((report) => [report.userId, report])),
    [employeeReports]
  );

  const reportByWorkspaceId = useMemo(
    () => new Map(workspaceReports.map((report) => [report.workspaceId, report])),
    [workspaceReports]
  );

  const activeUsers = users.filter((user) => user.employmentStatus !== 'LEFT').length;
  const leftUsers = Math.max(0, users.length - activeUsers);
  const avgWorkspaceHealth = workspaceReports.length
    ? Math.round(workspaceReports.reduce((sum, workspace) => sum + workspace.healthScore, 0) / workspaceReports.length)
    : 0;
  const avgEmployeeHealth = employeeReports.length
    ? Math.round(employeeReports.reduce((sum, person) => sum + person.healthScore, 0) / employeeReports.length)
    : 0;
  const completionRate = workspaceReports.length
    ? Math.round(workspaceReports.reduce((sum, workspace) => sum + workspace.completionRate, 0) / workspaceReports.length)
    : 0;
  const totalTasks = workspaceReports.reduce((sum, workspace) => sum + workspace.tasks, 0);
  const totalOpenTasks = workspaceReports.reduce((sum, workspace) => sum + workspace.openTasks, 0);
  const totalOverdueTasks = workspaceReports.reduce((sum, workspace) => sum + workspace.overdueTasks, 0);
  const healthyWorkspaces = workspaceReports.filter((workspace) => workspace.healthScore >= 80 && workspace.overdueTasks === 0).length;
  const contractsExpiringSoon = employeeReports.filter((person) => person.contractRemainingDays !== null && person.contractRemainingDays <= 30 && person.employmentStatus === 'ACTIVE').length;
  const offlineActiveUsers = employeeReports.filter((person) => person.presenceStatus === 'OFFLINE' && person.employmentStatus === 'ACTIVE').length;
  const turnoverRate = users.length > 0 ? Math.round((leftUsers / users.length) * 100) : 0;
  const overdueIntensity = totalTasks > 0 ? Math.round((totalOverdueTasks / totalTasks) * 100) : 0;

  const scoredWorkspaces = useMemo(
    () => [...workspaceReports]
      .map((workspace) => ({
        ...workspace,
        riskScore:
          (100 - workspace.healthScore) +
          workspace.overdueTasks * 16 +
          workspace.openTasks * 1.5 +
          (workspace.members === 0 ? 22 : 0) +
          (workspace.activeMembers === 0 && workspace.members > 0 ? 10 : 0) +
          (workspace.completionRate < 60 ? 8 : 0),
      }))
      .sort((left, right) => right.riskScore - left.riskScore),
    [workspaceReports]
  );
  const scoredPeople = useMemo(
    () => [...employeeReports]
      .map((person) => ({
        ...person,
        riskScore:
          (100 - person.healthScore) +
          person.overdueTasks * 14 +
          (person.completionRate < 60 ? 14 : 0) +
          (person.contractRemainingDays !== null && person.contractRemainingDays < 30 ? 18 : 0) +
          (person.presenceStatus === 'OFFLINE' ? 6 : 0) +
          (person.employmentStatus === 'LEFT' ? 50 : 0),
      }))
      .sort((left, right) => right.riskScore - left.riskScore),
    [employeeReports]
  );
  const atRiskPeople = scoredPeople.slice(0, 4);
  const workspacesWithOverdue = workspaceReports.filter((workspace) => workspace.overdueTasks > 0).length;
  const activeWatchlistCount = scoredWorkspaces.filter((workspace) => workspace.riskScore >= 25).length;
  const filteredWorkspaces = workspaceReports.filter((workspace) => {
    const haystack = `${workspace.workspaceName} ${workspace.ownerName}`.toLowerCase();
    return haystack.includes(searchQuery.toLowerCase());
  });

  const filteredUsers = users.filter((user) => {
    const haystack = `${user.name} ${user.email} ${user.designation || ''} ${user.workspaces?.map((workspace) => workspace.name).join(' ') || ''}`.toLowerCase();
    const matchesSearch = haystack.includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'ALL' ? true : user.role === roleFilter;
    const matchesStatus = statusFilter === 'ALL' ? true : user.employmentStatus === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const selectedWorkspace = reportByWorkspaceId.get(selectedWorkspaceId) || filteredWorkspaces[0] || workspaceReports[0] || null;
  const selectedUser = users.find((user) => user._id === selectedUserId) || filteredUsers[0] || users[0] || null;
  const selectedUserReport = selectedUser ? reportByUserId.get(selectedUser._id) || null : null;
  const selectedUserAvatar = selectedUser?.linkedinProfilePicUrl || selectedUser?.image || '';
  const selectedUserRoleHistory = normalizeRoleHistory(selectedUser);
  const selectedUserTenure = selectedUser ? formatTenure(selectedUser.dateJoined) : 'Not available';

  useEffect(() => {
    if (!selectedWorkspaceId && workspaceReports.length > 0) {
      setSelectedWorkspaceId(workspaceReports[0].workspaceId);
    }
  }, [selectedWorkspaceId, workspaceReports]);

  useEffect(() => {
    if (!selectedUserId && users.length > 0) {
      const fallbackUser = users.find((user) => user.employmentStatus !== 'LEFT') || users[0];
      setSelectedUserId(fallbackUser._id);
      setForm(fromUser(fallbackUser));
    }
  }, [selectedUserId, users]);

  useEffect(() => {
    if (editorOpen) {
      return;
    }

    if (selectedUser) {
      setForm(fromUser(selectedUser));
    }
  }, [selectedUser, editorOpen]);

  const startCreateUser = () => {
    setDeepDiveOpen(false);
    setEditorUserId(null);
    setForm(EMPTY_FORM);
    setEditorOpen(true);
  };

  const openUserEditor = () => {
    if (!selectedUser) {
      startCreateUser();
      return;
    }

    const next = fromUser(selectedUser);
    setDeepDiveOpen(false);
    setEditorUserId(selectedUser._id);
    setForm(next.employmentHistory.length > 0 ? next : { ...next, employmentHistory: [makeDefaultHistory(selectedUser.designation || 'Employee', selectedUser.dateJoined || new Date().toISOString().slice(0, 10), selectedUser.employmentStatus === 'LEFT' ? selectedUser.leftAt || '' : '', selectedUser.leftReason || '')] });
    setEditorOpen(true);
  };

  const selectUser = (user: AdminUserRecord) => {
    setSelectedUserId(user._id);
    setForm(fromUser(user));
  };

  const saveUser = async (overrides: Partial<UserFormState> = {}) => {
    const payload = {
      ...form,
      ...overrides,
    };

    if (!payload.name.trim() || !payload.email.trim()) {
      toastError('Name and email are required');
      return;
    }

    if (!editorUserId && !payload.password.trim()) {
      toastError('Password is required for new accounts');
      return;
    }

    setSaving(true);
    try {
      const contractExpiry = toApiDate(payload.contractExpiry);
      const dateJoined = toApiDate(payload.dateJoined);
      const leftAt = toApiDate(payload.leftAt);
      const employmentHistory = payload.employmentHistory
        .filter((entry) => entry.title.trim() || entry.startedAt || entry.endedAt || entry.note.trim())
        .map((entry) => ({
          title: entry.title.trim(),
          startedAt: toApiDate(entry.startedAt),
          endedAt: toApiDate(entry.endedAt),
          note: entry.note.trim(),
        }));

      const method = editorUserId ? 'PUT' : 'POST';
      const endpoint = editorUserId ? `/api/admin/users/${editorUserId}` : '/api/admin/users';
      const body: Record<string, unknown> = {
        name: payload.name,
        email: payload.email,
        designation: payload.designation,
        role: payload.role,
        employmentStatus: payload.employmentStatus,
        contractExpiry,
        dateJoined,
        leftAt,
        leftReason: payload.leftReason,
        linkedinProfileUrl: payload.linkedinProfileUrl,
        linkedinProfilePicUrl: payload.linkedinProfilePicUrl,
        employmentHistory,
      };

      if (payload.password.trim()) {
        body.password = payload.password;
      }

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await response.json();

      if (!json.success) {
        throw new Error(json.error || 'Failed to save user');
      }

      toastSuccess(editorUserId ? 'User updated' : 'User created');
      await refresh();
      if (json.data?._id) {
        setSelectedUserId(String(json.data._id));
      }
      setEditorUserId(null);
      setForm((current) => ({ ...current, password: '' }));
      setEditorOpen(false);
    } catch (saveError) {
      toastError(saveError instanceof Error ? saveError.message : 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const setEmploymentStatus = async (employmentStatus: 'ACTIVE' | 'LEFT') => {
    if (!selectedUser) return;
    const nextHistory = form.employmentHistory.length > 0 ? [...form.employmentHistory] : [makeDefaultHistory(selectedUser.designation || 'Employee', selectedUser.dateJoined || new Date().toISOString().slice(0, 10), '', '')];
    if (employmentStatus === 'LEFT' && nextHistory.length > 0) {
      const lastIndex = nextHistory.length - 1;
      if (!nextHistory[lastIndex].endedAt) {
        nextHistory[lastIndex] = {
          ...nextHistory[lastIndex],
          endedAt: form.leftAt || new Date().toISOString().slice(0, 10),
          note: nextHistory[lastIndex].note || form.leftReason || 'Resigned',
        };
      }
    }
    await saveUser({
      employmentStatus,
      leftAt: employmentStatus === 'LEFT' ? form.leftAt || new Date().toISOString().slice(0, 10) : '',
      leftReason: employmentStatus === 'LEFT' ? form.leftReason || 'Resigned' : '',
      employmentHistory: nextHistory,
    });
  };

  if (status === 'loading') {
    return <div className="page-wrapper">Loading admin access...</div>;
  }

  if (!canAccessAdmin) {
    return (
      <div className="page-wrapper animate-in">
        <div className="card admin-access-card">
          <div className="admin-access-icon"><Shield size={18} /></div>
          <h2>Admin access required</h2>
          <p className="text-muted text-sm">Your current role does not permit viewing the premium admin console.</p>
        </div>
      </div>
    );
  }

  const selectedWorkspaceHealth = selectedWorkspace ? scoreTone(selectedWorkspace.healthScore) : null;
  const selectedUserHealth = selectedUserReport ? scoreTone(selectedUserReport.healthScore) : null;
  const riskTone = scoreTone(Math.max(0, avgWorkspaceHealth - workspacesWithOverdue * 8));
  const topWorkspaceRisk = scoredWorkspaces[0] || null;
  const topPeopleRisk = scoredPeople[0] || null;
  const highPerformers = scoredPeople.filter((person) => person.employmentStatus === 'ACTIVE' && person.completionRate >= 85 && person.overdueTasks === 0);
  const overloadedPeople = scoredPeople.filter((person) => person.employmentStatus === 'ACTIVE' && (person.openTasks >= 6 || person.overdueTasks >= 2));
  const rescuePeople = scoredPeople.filter((person) => person.employmentStatus === 'ACTIVE' && person.healthScore < 60);
  const contractRiskPeople = scoredPeople.filter((person) => person.employmentStatus === 'ACTIVE' && person.contractRemainingDays !== null && person.contractRemainingDays <= 30);
  const coverageGapWorkspaces = scoredWorkspaces.filter((workspace) => workspace.activeMembers === 0 || workspace.members === 0);
  const singlePointFailureWorkspaces = scoredWorkspaces.filter((workspace) => workspace.activeMembers <= 1 && workspace.tasks >= 8);
  const taskConcentrationRatio = totalTasks > 0 && topWorkspaceRisk ? Math.round((topWorkspaceRisk.tasks / totalTasks) * 100) : 0;
  const deliveryVolatility = Math.max(0, Math.round((overdueIntensity * 0.55) + ((100 - avgWorkspaceHealth) * 0.45)));
  const operationalPosture = deliveryVolatility < 30 ? 'Stable' : deliveryVolatility < 55 ? 'Guarded' : 'Fragile';
  const operationalTone = operationalPosture === 'Stable' ? 'tone-good' : operationalPosture === 'Guarded' ? 'tone-warn' : 'tone-bad';
  const reportSummary = reports?.summary;
  const summaryDelta = reportSummary?.delta || {
    avgWorkspaceHealth: 0,
    avgEmployeeHealth: 0,
    completionRate: 0,
    overdueTasks: 0,
    openTasks: 0,
  };

  const interventionQueue = [
    ...scoredWorkspaces.slice(0, 4).map((workspace) => ({
      id: `workspace-${workspace.workspaceId}`,
      subject: workspace.workspaceName,
      owner: workspace.ownerName,
      type: 'Workspace',
      urgency: Math.round(workspace.riskScore),
      insight: `${workspace.overdueTasks} overdue • ${workspace.openTasks} open • ${workspace.activeMembers}/${workspace.members} active`,
      playbook: workspace.overdueTasks > 0 ? 'Run unblock session and rebalance ownership within 24h.' : 'Increase throughput by reducing open backlog.',
      why: [
        workspace.overdueTasks > 0 ? `Overdue work is already present (${workspace.overdueTasks}).` : 'Overdue work is currently under control.',
        workspace.openTasks >= 10 ? `Backlog size is high (${workspace.openTasks} open tasks).` : `Backlog size is moderate (${workspace.openTasks} open tasks).`,
        workspace.activeMembers <= 1 ? 'Delivery continuity is fragile because active coverage is minimal.' : `Coverage has ${workspace.activeMembers} active member(s).`,
      ],
    })),
    ...scoredPeople
      .filter((person) => person.employmentStatus === 'ACTIVE')
      .slice(0, 5)
      .map((person) => ({
        id: `person-${person.userId}`,
        subject: person.name,
        owner: person.designation || 'Employee',
        type: 'Person',
        urgency: Math.round(person.riskScore),
        insight: `${person.overdueTasks} overdue • ${person.openTasks} open • ${person.completionRate}% completion`,
        playbook: person.overdueTasks > 0 ? 'Reduce active queue and assign a support partner this sprint.' : 'Protect focus window to sustain delivery quality.',
        why: [
          person.overdueTasks > 0 ? `Overdue queue exists (${person.overdueTasks}).` : 'No overdue tasks currently assigned.',
          person.openTasks >= 6 ? `Open task queue is high (${person.openTasks}).` : `Open task queue is ${person.openTasks}.`,
          person.contractRemainingDays !== null && person.contractRemainingDays <= 30 ? `Contract window is short (${person.contractRemainingDays} days remaining).` : 'No immediate contract expiry pressure.',
        ],
      })),
  ]
    .sort((left, right) => right.urgency - left.urgency)
    .slice(0, 6);

  const burnoutDrivers = selectedUserReport ? [
    { label: 'Open load pressure', value: Math.min(40, selectedUserReport.openTasks * 6), context: `${selectedUserReport.openTasks} open tasks` },
    { label: 'Overdue burden', value: Math.min(35, selectedUserReport.overdueTasks * 10), context: `${selectedUserReport.overdueTasks} overdue tasks` },
    { label: 'Cycle-time strain', value: selectedUserReport.averageTimeSpentHours > 6 ? 14 : selectedUserReport.averageTimeSpentHours > 4 ? 8 : 3, context: `${selectedUserReport.averageTimeSpentHours.toFixed(1)}h average per task` },
    { label: 'Delivery trend drag', value: selectedUserReport.completionDelta < 0 ? Math.min(20, Math.round(Math.abs(selectedUserReport.completionDelta) * 0.7)) : 0, context: `${formatDelta(selectedUserReport.completionDelta, 'pp')} completion trend` },
  ].sort((left, right) => right.value - left.value) : [];

  const selectedUserPlan = selectedUserReport ? [
    selectedUserReport.burnoutRisk >= 70
      ? 'Rebalance 2-3 tasks from this user within this sprint and assign a support owner.'
      : selectedUserReport.burnoutRisk >= 45
        ? 'Protect a no-meeting focus block and cap new assignments until overdue is cleared.'
        : 'Maintain current load and preserve focus hours.',
    selectedUserReport.efficiencyScore < 55
      ? 'Investigate blockers causing low throughput per hour and simplify task scope.'
      : 'Efficiency is healthy; capture working patterns as team playbook examples.',
    selectedUserReport.contractRemainingDays !== null && selectedUserReport.contractRemainingDays <= 30
      ? `Start renewal/succession workflow now (${selectedUserReport.contractRemainingDays} days remaining).`
      : 'No near-term contract risk detected.',
  ] : [];
  const selectedUserWorkspaceNames = selectedUserReport?.workspaceNames || selectedUser?.workspaces?.map((workspace) => workspace.name) || [];

  return (
    <div className={`page-wrapper animate-in admin-page ${densityMode === 'compact' ? 'is-compact' : ''}`}>
      <header className="admin-hero card">
        <div className="admin-hero-copy">
          <nav className="breadcrumb" style={{ marginBottom: 10 }}>
            <span>DreamShift</span>
            <ChevronRight size={13} />
            <span className="breadcrumb-active">Admin Console</span>
          </nav>
          <h1 className="page-title" style={{ marginBottom: 10 }}>Premium Admin Console</h1>
          <p className="admin-hero-subtitle">
            Deep workspace telemetry, employee intelligence, and secure account operations for operators who need to see the whole system.
          </p>
          <div className="admin-hero-tags">
            <span className="badge"><Shield size={12} /> Platform access</span>
            <span className="badge badge-soft"><Sparkles size={12} /> Insightful dashboards</span>
            <span className="badge badge-soft"><Activity size={12} /> Live telemetry</span>
          </div>
        </div>
        <div className="admin-hero-actions">
          <div className="admin-toggle-group" role="group" aria-label="Time window">
            {[0, 7, 30, 90].map((days) => (
              <button
                key={days}
                type="button"
                className={`btn btn-ghost admin-toggle ${windowDays === days ? 'is-active' : ''}`}
                onClick={() => setWindowDays(days as 0 | 7 | 30 | 90)}
              >
                {days === 0 ? 'All' : `${days}d`}
              </button>
            ))}
          </div>
          <div className="admin-toggle-group" role="group" aria-label="Density">
            <button
              type="button"
              className={`btn btn-ghost admin-toggle ${densityMode === 'expanded' ? 'is-active' : ''}`}
              onClick={() => setDensityMode('expanded')}
            >
              Expanded
            </button>
            <button
              type="button"
              className={`btn btn-ghost admin-toggle ${densityMode === 'compact' ? 'is-active' : ''}`}
              onClick={() => setDensityMode('compact')}
            >
              Compact
            </button>
          </div>
          <button className="btn btn-secondary" type="button" onClick={refresh} disabled={isRefreshing}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="btn btn-primary" type="button" onClick={startCreateUser}>
            <Plus size={14} /> New user
          </button>
        </div>
      </header>

      <DataStatusBanner
        loading={loading}
        error={error}
        lastUpdated={lastUpdated}
        isRefreshing={isRefreshing}
        onRetry={refresh}
        onRefresh={refresh}
      />

      <section className="admin-command-grid">
        <article className="card admin-command-card">
          <div className="admin-section-header">
            <div>
              <div className="card-title">Operational posture</div>
              <div className="card-subtitle">A system-level reading of execution health and delivery risk.</div>
            </div>
            <span className={`admin-score-pill ${operationalTone}`}>{operationalPosture}</span>
          </div>
          <div className="admin-command-metrics">
            <div>
              <span>Volatility index</span>
              <strong>{deliveryVolatility}</strong>
              <p>Composite of overdue intensity and workspace health decay.</p>
              <span className={`admin-delta-pill ${deltaTone(summaryDelta.openTasks, false)}`}>{formatDelta(summaryDelta.openTasks)} open vs previous window</span>
            </div>
            <div>
              <span>Task concentration</span>
              <strong>{taskConcentrationRatio}%</strong>
              <p>{topWorkspaceRisk ? `${topWorkspaceRisk.workspaceName} holds the largest share of workload.` : 'No concentration signal yet.'}</p>
            </div>
            <div>
              <span>People pressure</span>
              <strong>{overloadedPeople.length}</strong>
              <p>Active teammates with high queue pressure or overdue load.</p>
              <span className={`admin-delta-pill ${deltaTone(summaryDelta.avgEmployeeHealth, true)}`}>{formatDelta(summaryDelta.avgEmployeeHealth)} health vs previous window</span>
            </div>
            <div>
              <span>Recovery readiness</span>
              <strong>{highPerformers.length}</strong>
              <p>High-performing contributors who can mentor rescue efforts.</p>
              <span className={`admin-delta-pill ${deltaTone(summaryDelta.completionRate, true)}`}>{formatDelta(summaryDelta.completionRate, 'pp')} completion vs previous window</span>
            </div>
          </div>
        </article>

        <article className="card admin-command-card">
          <div className="admin-section-header">
            <div>
              <div className="card-title">Strategic signals</div>
              <div className="card-subtitle">Narrative intelligence beyond raw counts.</div>
            </div>
            <Activity size={16} />
          </div>
          <ul className="admin-signal-list">
            <li>
              <strong>Delivery drag</strong>
              <span>{workspacesWithOverdue} workspace{workspacesWithOverdue === 1 ? '' : 's'} have overdue execution. Top risk: {topWorkspaceRisk?.workspaceName || 'N/A'}.</span>
            </li>
            <li>
              <strong>Talent fragility</strong>
              <span>{rescuePeople.length} teammate{rescuePeople.length === 1 ? '' : 's'} are in a low-health zone, while {contractRiskPeople.length} contracts near expiry.</span>
            </li>
            <li>
              <strong>Coverage risk</strong>
              <span>{coverageGapWorkspaces.length} workspaces have insufficient active coverage and {singlePointFailureWorkspaces.length} depend on single-person continuity.</span>
            </li>
            <li>
              <strong>Retention pulse</strong>
              <span>{turnoverRate}% turnover with {leftUsers} offboarded accounts; keep continuity plans current.</span>
            </li>
          </ul>
        </article>
      </section>

      <section className="admin-cohort-grid">
        {[
          { label: 'High performers', value: highPerformers.length, hint: 'Low risk, high completion, no overdue tasks.' },
          { label: 'Overloaded', value: overloadedPeople.length, hint: 'Active users with overloaded queues.' },
          { label: 'Rescue needed', value: rescuePeople.length, hint: 'Active users with health score under 60.' },
          { label: 'Contract watch', value: contractRiskPeople.length, hint: 'Expiring within 30 days.' },
        ].map(({ label, value, hint }) => (
          <div key={label} className="card admin-cohort-card">
            <div className="admin-cohort-label">{label}</div>
            <div className="admin-cohort-value">{value}</div>
            <div className="admin-cohort-hint">{hint}</div>
          </div>
        ))}
      </section>

      <section className="admin-intervention card">
        <div className="admin-section-header">
          <div>
            <div className="card-title">Intervention queue</div>
            <div className="card-subtitle">Prioritized, high-impact actions for this cycle.</div>
          </div>
          <span className="badge">Top {interventionQueue.length} actions · {windowDays === 0 ? 'all-time' : `${windowDays}d window`}</span>
        </div>
        <div className="admin-intervention-list">
          {interventionQueue.map((item) => (
            <article key={item.id} className="admin-intervention-item">
              <div className="admin-intervention-head">
                <div>
                  <div className="admin-intervention-subject">{item.subject}</div>
                  <div className="admin-intervention-owner">{item.type} · {item.owner}</div>
                </div>
                <span className={`admin-score-pill ${item.urgency >= 90 ? 'tone-bad' : item.urgency >= 60 ? 'tone-warn' : 'tone-good'}`}>Urgency {item.urgency}</span>
              </div>
              <div className="admin-intervention-insight">{item.insight}</div>
              <div className="admin-intervention-playbook">{item.playbook}</div>
              <button
                type="button"
                className="btn btn-ghost admin-why-btn"
                onClick={() => setOpenInterventionId((current) => current === item.id ? null : item.id)}
              >
                {openInterventionId === item.id ? 'Hide urgency details' : 'Why urgent?'}
              </button>
              {openInterventionId === item.id ? (
                <div className="admin-why-panel">
                  {item.why.map((reason) => (
                    <div key={`${item.id}-${reason}`} className="admin-why-row">{reason}</div>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <div className="admin-toolbar card">
        <div className="admin-toolbar-search">
          <input
            className="input"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search workspaces, owners, users, or teams"
          />
        </div>
        <div className="admin-toolbar-filters">
          <select className="input" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)}>
            <option value="ALL">All roles</option>
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="LEFT">Left</option>
          </select>
        </div>
      </div>

      <div className="admin-layout">
        <div className="admin-column-main">
          <section className="admin-section card">
            <div className="admin-section-header">
              <div>
                <div className="card-title">Workspace intelligence</div>
                <div className="card-subtitle">Sorted by risk so attention goes to the right place first.</div>
              </div>
              <span className="badge">{filteredWorkspaces.length} workspaces</span>
            </div>
            <div className="admin-workspace-grid">
              {filteredWorkspaces
                .map((workspace) => {
                  const scored = scoredWorkspaces.find((entry) => entry.workspaceId === workspace.workspaceId);
                  return {
                    ...workspace,
                    riskScore: scored?.riskScore || 0,
                  };
                })
                .sort((left, right) => right.riskScore - left.riskScore)
                .map((workspace) => {
                const tone = scoreTone(workspace.healthScore);
                return (
                  <button
                    key={workspace.workspaceId}
                    type="button"
                    className={`admin-workspace-card ${selectedWorkspace?.workspaceId === workspace.workspaceId ? 'is-selected' : ''}`}
                    onClick={() => setSelectedWorkspaceId(workspace.workspaceId)}
                  >
                    <div className="admin-workspace-top">
                      <div>
                        <div className="admin-workspace-name">{workspace.workspaceName}</div>
                        <div className="admin-workspace-owner">Owner: {workspace.ownerName}</div>
                      </div>
                      <span className={`admin-score-pill ${tone.className}`}>{tone.label}</span>
                    </div>
                    <div className="admin-workspace-mini">Health score {workspace.healthScore} • Risk score {Math.round(workspace.riskScore)}</div>
                    <div className="admin-workspace-metrics">
                      <span>{workspace.projects} projects</span>
                      <span>{workspace.tasks} tasks</span>
                      <span>{workspace.overdueTasks} overdue</span>
                      <span>{workspace.activeMembers}/{workspace.members} active</span>
                    </div>
                    <div className="admin-progress-track">
                      <div className="admin-progress-fill" style={{ width: `${workspace.completionRate}%` }} />
                    </div>
                    <div className="admin-workspace-footer">
                      <span>{workspace.completionRate}% complete</span>
                      <span>{workspace.openTasks} open</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="admin-section card">
            <div className="admin-section-header">
              <div>
                <div className="card-title">People intelligence</div>
                <div className="card-subtitle">Sorted by date joined so long-tenure teammates appear first.</div>
              </div>
              <span className="badge">{filteredUsers.length} users</span>
            </div>
            <div className="admin-user-table">
              {filteredUsers
                .map((user) => {
                  const report = reportByUserId.get(user._id);
                  const scored = scoredPeople.find((person) => person.userId === user._id);
                  return {
                    user,
                    report,
                    riskScore: scored?.riskScore || 0,
                  };
                })
                .sort((left, right) => {
                  const leftDate = left.user.dateJoined ? new Date(left.user.dateJoined).getTime() : Number.POSITIVE_INFINITY;
                  const rightDate = right.user.dateJoined ? new Date(right.user.dateJoined).getTime() : Number.POSITIVE_INFINITY;
                  if (leftDate !== rightDate) return leftDate - rightDate;
                  return left.user.name.localeCompare(right.user.name);
                })
                .map(({ user, report, riskScore }) => {
                const tone = scoreTone(report?.healthScore || 0);
                const avatar = user.linkedinProfilePicUrl || user.image || '';
                return (
                  <button
                    key={user._id}
                    type="button"
                    className={`admin-user-row ${selectedUser?._id === user._id ? 'is-selected' : ''}`}
                    onClick={() => selectUser(user)}
                  >
                    <div className="admin-user-main">
                      <div className="admin-user-avatar">
                        {avatar ? <Image src={avatar} alt={user.name} width={42} height={42} unoptimized /> : <span>{initials(user.name)}</span>}
                      </div>
                      <div>
                        <div className="admin-user-name">{user.name}</div>
                        <div className="admin-user-meta">{user.email}</div>
                      </div>
                    </div>
                    <div className="admin-user-badges">
                      <span className={`admin-mini-pill ${statusTone(user.employmentStatus)}`}>{user.employmentStatus === 'ACTIVE' ? 'Active' : 'Left'}</span>
                    </div>
                    <div className="admin-user-stats">
                      <span className="admin-stat-token"><strong>{report?.completionRate ?? 0}%</strong> completion</span>
                      <span className="admin-stat-token"><strong>{report?.totalAssigned ?? 0}</strong> tasks</span>
                      <span className="admin-stat-token"><strong>{Math.round(riskScore)}</strong> risk</span>
                      <span className={`admin-score-pill ${tone.className}`}>{tone.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="admin-column-side">
          <section className="admin-detail card">
            <div className="admin-section-header">
              <div>
                <div className="card-title">Workspace spotlight</div>
                <div className="card-subtitle">A compact dashboard for the selected workspace.</div>
              </div>
              <Building2 size={16} />
            </div>
            {selectedWorkspace ? (
              <>
                <div className="admin-spotlight-title">{selectedWorkspace.workspaceName}</div>
                <div className="admin-spotlight-subtitle">Owned by {selectedWorkspace.ownerName}</div>
                <div className="admin-detail-pills">
                  <span className={`admin-score-pill ${selectedWorkspaceHealth?.className || 'tone-warn'}`}>{selectedWorkspace?.healthScore}</span>
                  <span className="admin-mini-pill">{selectedWorkspace.projects} projects</span>
                  <span className="admin-mini-pill">{selectedWorkspace.tasks} tasks</span>
                </div>
                <div className="admin-detail-grid">
                  <div><span>Completion</span><strong>{selectedWorkspace.completionRate}%</strong></div>
                  <div><span>Overdue</span><strong>{selectedWorkspace.overdueTasks}</strong></div>
                  <div><span>Members</span><strong>{selectedWorkspace.members}</strong></div>
                  <div><span>Active</span><strong>{selectedWorkspace.activeMembers}</strong></div>
                </div>
                <div className="admin-detail-note">
                  {selectedWorkspace.overdueTasks > 0
                    ? 'Escalate overdue work and remove blockers before they compound.'
                    : 'This workspace is operating cleanly with no overdue workload.'}
                </div>
                <div className="admin-detail-note">
                  {selectedWorkspace.completionRate < 60
                    ? 'Delivery momentum is weak. Review ownership and unblock top active tasks.'
                    : 'Delivery momentum is healthy. Maintain current operating rhythm.'}
                </div>
              </>
            ) : (
              <div className="admin-empty-state">No workspace selected.</div>
            )}
          </section>

          <section className="admin-detail card">
            <div className="admin-section-header">
              <div>
                <div className="card-title">User spotlight</div>
                <div className="card-subtitle">Status, risk, and workspace membership for the selected user.</div>
              </div>
              <Users size={16} />
            </div>
            {selectedUser ? (
              <>
                <div className="admin-user-spotlight">
                  <div className="admin-user-avatar large">
                    {selectedUserAvatar ? (
                      <Image src={selectedUserAvatar} alt={selectedUser.name} width={56} height={56} unoptimized />
                    ) : (
                      <span>{initials(selectedUser.name)}</span>
                    )}
                  </div>
                  <div className="admin-user-spotlight-copy">
                    <div className="admin-spotlight-title">{selectedUser.name}</div>
                    <div className="admin-spotlight-subtitle">{selectedUser.designation || 'Employee'} · {selectedUser.email}</div>
                    <div className="admin-detail-pills admin-spotlight-pills">
                      <span className={`admin-mini-pill ${statusTone(selectedUser.employmentStatus)}`}>{selectedUser.employmentStatus}</span>
                      <span className="admin-mini-pill">{roleLabel(selectedUser.role)}</span>
                      <span className={`admin-score-pill ${selectedUserHealth?.className || 'tone-warn'}`}>Health {selectedUserReport?.healthScore ?? 0}</span>
                    </div>
                    <div className="admin-spotlight-headline">
                      {selectedUserReport
                        ? selectedUserReport.workloadState === 'OVERLOADED'
                          ? 'Overloaded workload state. Immediate queue balancing recommended.'
                          : selectedUserReport.workloadState === 'STRETCHED'
                            ? 'Stretched workload state. Monitor and rebalance this cycle.'
                            : 'Balanced workload state with stable delivery signals.'
                        : 'No report-level analytics yet. Use deep dive for diagnostics and data checks.'}
                    </div>
                        <div className="admin-spotlight-meta-grid">
                          <div>
                            <span>Time at DreamShift</span>
                            <strong>{selectedUserTenure}</strong>
                          </div>
                          <div>
                            <span>Joined</span>
                            <strong>{selectedUser.dateJoined ? formatDisplayDate(selectedUser.dateJoined) : 'Not available'}</strong>
                          </div>
                          <div>
                            <span>Designation</span>
                            <strong>{selectedUser.designation || 'Not available'}</strong>
                          </div>
                          <div>
                            <span>History rows</span>
                            <strong>{selectedUserRoleHistory.length}</strong>
                          </div>
                        </div>
                  </div>
                </div>
                <div className="admin-detail-grid">
                  <div><span>Assigned</span><strong>{selectedUserReport?.totalAssigned ?? 0}</strong></div>
                  <div><span>Completion</span><strong>{selectedUserReport?.completionRate ?? 0}%</strong></div>
                  <div><span>Overdue</span><strong>{selectedUserReport?.overdueTasks ?? 0}</strong></div>
                  <div><span>Workspaces</span><strong>{selectedUserReport?.workspaceCount ?? selectedUser.workspaceCount ?? 0}</strong></div>
                </div>
                <div className="admin-spotlight-section-title">Coverage map</div>
                <div className="admin-workspace-tags">
                  {selectedUserWorkspaceNames.length > 0 ? (
                    selectedUserWorkspaceNames.map((workspaceName) => (
                      <span key={workspaceName} className="admin-mini-pill">{workspaceName}</span>
                    ))
                  ) : (
                    <span className="admin-mini-pill">No mapped workspace memberships. User may have tasks but no membership link.</span>
                  )}
                </div>
                {selectedUserReport ? (
                  <div className="admin-user-insight-grid">
                    <div className="admin-user-insight-card">
                      <span>Burnout risk</span>
                      <strong className={selectedUserReport.burnoutRisk >= 70 ? 'tone-bad' : selectedUserReport.burnoutRisk >= 45 ? 'tone-warn' : 'tone-good'}>{selectedUserReport.burnoutRisk}</strong>
                      <p>{selectedUserReport.workloadState === 'OVERLOADED' ? 'Immediate workload intervention required.' : selectedUserReport.workloadState === 'STRETCHED' ? 'Monitor capacity and rebalance queue.' : 'Current workload appears sustainable.'}</p>
                    </div>
                    <div className="admin-user-insight-card">
                      <span>Efficiency score</span>
                      <strong>{selectedUserReport.efficiencyScore}</strong>
                      <p>Based on completion, throughput per hour, and overdue drag.</p>
                    </div>
                    <div className="admin-user-insight-card">
                      <span>Productivity score</span>
                      <strong>{selectedUserReport.productivityScore}</strong>
                      <p>{selectedUserReport.completionDelta >= 0 ? `Completion trend is up by ${Math.round(selectedUserReport.completionDelta)}pp.` : `Completion trend is down by ${Math.round(Math.abs(selectedUserReport.completionDelta))}pp.`}</p>
                    </div>
                  </div>
                ) : null}
                <div className="admin-detail-note">
                  {selectedUser.employmentStatus === 'LEFT'
                    ? `Marked as left${selectedUser.leftReason ? `: ${selectedUser.leftReason}` : ''}`
                    : selectedUserReport?.overdueTasks
                      ? 'This user needs attention because overdue work is building up.'
                      : 'Healthy account with no obvious offboarding signals.'}
                </div>
                <div className="admin-spotlight-section-title">Role history</div>
                <div className="admin-history-preview">
                  {selectedUserRoleHistory.map((entry) => (
                    <div key={entry.id} className="admin-history-preview-row">
                      <div>
                        <div className="admin-history-preview-title">{entry.title}</div>
                        <div className="admin-history-preview-meta">
                          {entry.startedAt ? `Started ${entry.startedAt.toLocaleDateString()}` : 'Started not available'}
                          {entry.endedAt ? ` · Ended ${entry.endedAt.toLocaleDateString()}` : ' · Present'}
                        </div>
                      </div>
                      {entry.note ? <div className="admin-history-preview-note">{entry.note}</div> : null}
                    </div>
                  ))}
                </div>
                {selectedUserReport ? (
                  <div className="admin-detail-note">
                    {selectedUserReport.contractRemainingDays !== null && selectedUserReport.contractRemainingDays < 30
                      ? `Contract expires in ${selectedUserReport.contractRemainingDays} days. Prepare renewal or succession.`
                      : `Average time spent: ${selectedUserReport.averageTimeSpentHours.toFixed(1)}h per completed task.`}
                  </div>
                ) : null}
                <div className="admin-detail-actions">
                  <button className="btn btn-secondary" type="button" onClick={() => setDeepDiveOpen(true)}>
                    <Activity size={14} /> Deeper dive
                  </button>
                  <button className="btn btn-secondary" type="button" onClick={() => setEmploymentStatus('LEFT')} disabled={saving}>
                    <UserX size={14} /> Mark left
                  </button>
                  <button className="btn btn-secondary" type="button" onClick={() => setEmploymentStatus('ACTIVE')} disabled={saving}>
                    <UserCheck size={14} /> Restore active
                  </button>
                  <button className="btn btn-primary" type="button" onClick={openUserEditor} disabled={saving}>
                    <Edit3 size={14} /> Edit user
                  </button>
                </div>
              </>
            ) : (
              <div className="admin-empty-state">No user selected.</div>
            )}
          </section>

          <section className="admin-detail card">
            <div className="admin-section-header">
              <div>
                <div className="card-title">Operations planner</div>
                <div className="card-subtitle">A compact playbook for this week.</div>
              </div>
              <Sparkles size={16} />
            </div>
            <div className="admin-action-stack">
              <div className="admin-action-note">
                <strong>Immediate priorities</strong>
                <ul className="admin-action-list compact">
                  <li>{workspacesWithOverdue} workspaces currently carrying overdue tasks.</li>
                  <li>{contractsExpiringSoon} contracts expiring within 30 days.</li>
                  <li>{offlineActiveUsers} active teammates currently offline.</li>
                </ul>
              </div>
              <button className="btn btn-primary" type="button" onClick={startCreateUser} disabled={saving}>
                <UserPlus size={14} /> Create user
              </button>
              <button className="btn btn-secondary" type="button" onClick={openUserEditor} disabled={!selectedUser || saving}>
                <Edit3 size={14} /> Edit selected user
              </button>
            </div>
          </section>
        </aside>
      </div>

      {deepDiveOpen && selectedUser ? (
        <div className="admin-drawer-backdrop" role="presentation" onClick={() => setDeepDiveOpen(false)}>
          <aside className="admin-drawer" role="dialog" aria-modal="true" aria-label="Employee deep dive" onClick={(event) => event.stopPropagation()}>
            <div className="admin-drawer-header">
              <div>
                <div className="card-title">Employee deep dive</div>
                <div className="card-subtitle">{selectedUser.name} · {selectedUser.designation || 'Employee'}</div>
              </div>
              <button className="btn btn-ghost" type="button" onClick={() => setDeepDiveOpen(false)}>Close</button>
            </div>

            {selectedUserReport ? (
              <>
            <div className="admin-drawer-grid">
              <div className="admin-drawer-card">
                <span>Burnout risk</span>
                <strong className={selectedUserReport.burnoutRisk >= 70 ? 'tone-bad' : selectedUserReport.burnoutRisk >= 45 ? 'tone-warn' : 'tone-good'}>{selectedUserReport.burnoutRisk}</strong>
                <p>{selectedUserReport.workloadState} workload state with {selectedUserReport.openTasks} open and {selectedUserReport.overdueTasks} overdue tasks.</p>
              </div>
              <div className="admin-drawer-card">
                <span>Efficiency score</span>
                <strong>{selectedUserReport.efficiencyScore}</strong>
                <p>{formatDelta(selectedUserReport.completionDelta, 'pp')} completion change over selected window.</p>
              </div>
              <div className="admin-drawer-card">
                <span>Productivity score</span>
                <strong>{selectedUserReport.productivityScore}</strong>
                <p>{selectedUserReport.averageTimeSpentHours.toFixed(1)}h average time per task.</p>
              </div>
            </div>

            <div className="admin-drawer-section">
              <div className="admin-drawer-section-title">Trend signals (last 7 days)</div>
              <div className="admin-trend-grid">
                <div className="admin-trend-card">
                  <div className="admin-trend-title">Completion trend</div>
                  <svg viewBox="0 0 120 44" className="admin-sparkline" aria-label="Completion trend sparkline">
                    <path d={renderSparklinePath(selectedUserReport.completionTrend7 || [], 120, 44)} />
                  </svg>
                  <div className="admin-trend-values">{(selectedUserReport.completionTrend7 || []).join(' • ') || 'No recent completion events'}</div>
                </div>
                <div className="admin-trend-card">
                  <div className="admin-trend-title">Overdue pressure trend</div>
                  <svg viewBox="0 0 120 44" className="admin-sparkline tone-overdue" aria-label="Overdue trend sparkline">
                    <path d={renderSparklinePath(selectedUserReport.overdueTrend7 || [], 120, 44)} />
                  </svg>
                  <div className="admin-trend-values">{(selectedUserReport.overdueTrend7 || []).join(' • ') || 'No overdue trend data'}</div>
                </div>
              </div>
            </div>

            <div className="admin-drawer-section">
              <div className="admin-drawer-section-title">Burnout driver breakdown</div>
              <div className="admin-driver-list">
                {burnoutDrivers.map((driver) => (
                  <div key={driver.label} className="admin-driver-row">
                    <div>
                      <div className="admin-driver-label">{driver.label}</div>
                      <div className="admin-driver-context">{driver.context}</div>
                    </div>
                    <span className={`admin-score-pill ${driver.value >= 20 ? 'tone-bad' : driver.value >= 10 ? 'tone-warn' : 'tone-good'}`}>{driver.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="admin-drawer-section">
              <div className="admin-drawer-section-title">Recommended intervention plan</div>
              <ul className="admin-action-list">
                {selectedUserPlan.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </div>
              </>
            ) : (
              <div className="admin-drawer-section" style={{ marginTop: 0 }}>
                <div className="admin-drawer-section-title">Analytics unavailable for selected window</div>
                <div className="admin-empty-state" style={{ marginTop: 0 }}>
                  Employee analytics are not available for this account yet. Common causes: no assigned tasks in the selected time window, legacy assignment fields not mapped, or a new user with no activity.
                </div>
                <div className="admin-driver-list" style={{ marginTop: 10 }}>
                  <div className="admin-driver-row">
                    <div>
                      <div className="admin-driver-label">User status</div>
                      <div className="admin-driver-context">{selectedUser.employmentStatus} · {selectedUser.designation || 'Employee'}</div>
                    </div>
                    <span className={`admin-score-pill ${statusTone(selectedUser.employmentStatus)}`}>{selectedUser.employmentStatus}</span>
                  </div>
                  <div className="admin-driver-row">
                    <div>
                      <div className="admin-driver-label">Mapped workspaces</div>
                      <div className="admin-driver-context">{selectedUserWorkspaceNames.length > 0 ? selectedUserWorkspaceNames.join(' • ') : 'No mapped memberships found'}</div>
                    </div>
                    <span className="admin-score-pill tone-warn">{selectedUserWorkspaceNames.length}</span>
                  </div>
                </div>
                <div className="admin-detail-actions" style={{ marginTop: 12 }}>
                  <button className="btn btn-secondary" type="button" onClick={refresh} disabled={isRefreshing}>
                    <RefreshCw size={14} /> Refresh analytics
                  </button>
                  <button className="btn btn-primary" type="button" onClick={openUserEditor}>
                    <Edit3 size={14} /> Verify user mapping
                  </button>
                </div>
              </div>
            )}
          </aside>
        </div>
      ) : null}

      {editorOpen && (
        <div className="admin-modal-backdrop" role="presentation" onClick={() => !saving && setEditorOpen(false)}>
          <div className="admin-modal card" role="dialog" aria-modal="true" aria-label={editorUserId ? 'Edit user' : 'Create user'} onClick={(event) => event.stopPropagation()}>
            <div className="admin-modal-header">
              <div>
                <div className="card-title">{editorUserId ? 'Edit user' : 'Create user'}</div>
                <div className="card-subtitle">Keep identity, employment, and profile links separate so the form stays readable.</div>
              </div>
              <button className="btn btn-ghost" type="button" onClick={() => setEditorOpen(false)} disabled={saving}>
                Close
              </button>
            </div>

            <form className="admin-modal-form" onSubmit={(event) => { event.preventDefault(); void saveUser(); }}>
              <div className="admin-form-section">
                <div className="admin-form-section-title">Identity</div>
                <div className="admin-form-grid two-up">
                  <input className="input" placeholder="Full name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
                  <input className="input" placeholder="Email address" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required />
                  <input className="input" placeholder={editorUserId ? 'Password (leave blank to keep current)' : 'Password'} type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} />
                  <input className="input" placeholder="Designation" value={form.designation} onChange={(event) => setForm((current) => ({ ...current, designation: event.target.value }))} />
                </div>
              </div>

              <div className="admin-form-section">
                <div className="admin-form-section-title">Employment</div>
                <div className="admin-form-grid two-up">
                  <label className="admin-field">
                    <span className="admin-field-label">Current role</span>
                    <select className="input" value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as PlatformRole }))}>
                      {ROLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="admin-field">
                    <span className="admin-field-label">Employment status</span>
                    <select className="input" value={form.employmentStatus} onChange={(event) => setForm((current) => ({ ...current, employmentStatus: event.target.value as 'ACTIVE' | 'LEFT' }))}>
                      <option value="ACTIVE">Active</option>
                      <option value="LEFT">Left</option>
                    </select>
                  </label>
                  <label className="admin-field">
                    <span className="admin-field-label">Date joined</span>
                    <input className="input" type="date" value={form.dateJoined} onChange={(event) => setForm((current) => ({ ...current, dateJoined: event.target.value }))} />
                  </label>
                  <label className="admin-field">
                    <span className="admin-field-label">Contract end</span>
                    <input className="input" type="date" value={form.contractExpiry} onChange={(event) => setForm((current) => ({ ...current, contractExpiry: event.target.value }))} />
                  </label>
                  {form.employmentStatus === 'LEFT' ? (
                    <>
                      <label className="admin-field">
                        <span className="admin-field-label">Left date</span>
                        <input className="input" type="date" value={form.leftAt} onChange={(event) => setForm((current) => ({ ...current, leftAt: event.target.value }))} />
                      </label>
                      <label className="admin-field admin-field-full">
                        <span className="admin-field-label">Offboarding note</span>
                        <textarea className="input admin-textarea" rows={3} placeholder="Reason for leaving or offboarding note" value={form.leftReason} onChange={(event) => setForm((current) => ({ ...current, leftReason: event.target.value }))} />
                      </label>
                    </>
                  ) : (
                    <div className="admin-form-help admin-field-full">Left date and offboarding note only appear when the user is marked as left.</div>
                  )}
                </div>
                <div className="admin-form-help">Use the date picker for employment fields. Read-only dates elsewhere are shown as DD-MM-YYYY.</div>
              </div>

              <div className="admin-form-section">
                <div className="admin-form-section-header-row">
                  <div>
                    <div className="admin-form-section-title">Employment history</div>
                    <div className="admin-form-help">Add one row per role or job change. The last row can be ended when the user leaves.</div>
                  </div>
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => setForm((current) => ({
                      ...current,
                      employmentHistory: [...current.employmentHistory, makeDefaultHistory(current.designation || 'Employee', current.dateJoined || new Date().toISOString().slice(0, 10))],
                    }))}
                  >
                    <Plus size={14} /> Add role
                  </button>
                </div>

                <div className="admin-history-list">
                  {form.employmentHistory.length === 0 ? (
                    <div className="admin-empty-state" style={{ marginTop: 0 }}>No role history yet. Add one to show title changes over time.</div>
                  ) : form.employmentHistory.map((entry, index) => (
                    <div key={entry.id} className="admin-history-row">
                      <div className="admin-history-index">{index + 1}</div>
                      <div className="admin-form-grid history-grid">
                        <label className="admin-field">
                          <span className="admin-field-label">Role title</span>
                          <input
                            className="input"
                            placeholder="Role title"
                            value={entry.title}
                            onChange={(event) => setForm((current) => ({
                              ...current,
                              employmentHistory: current.employmentHistory.map((row) => row.id === entry.id ? { ...row, title: event.target.value } : row),
                            }))}
                          />
                        </label>
                        <label className="admin-field">
                          <span className="admin-field-label">Role started</span>
                          <input
                            className="input"
                            type="date"
                            value={entry.startedAt}
                            onChange={(event) => setForm((current) => ({
                              ...current,
                              employmentHistory: current.employmentHistory.map((row) => row.id === entry.id ? { ...row, startedAt: event.target.value } : row),
                            }))}
                          />
                        </label>
                        <label className="admin-field">
                          <span className="admin-field-label">Role ended</span>
                          <input
                            className="input"
                            type="date"
                            value={entry.endedAt}
                            onChange={(event) => setForm((current) => ({
                              ...current,
                              employmentHistory: current.employmentHistory.map((row) => row.id === entry.id ? { ...row, endedAt: event.target.value } : row),
                            }))}
                          />
                        </label>
                        <label className="admin-field">
                          <span className="admin-field-label">History note</span>
                          <textarea
                            className="input admin-textarea"
                            rows={2}
                            placeholder="Optional note"
                            value={entry.note}
                            onChange={(event) => setForm((current) => ({
                              ...current,
                              employmentHistory: current.employmentHistory.map((row) => row.id === entry.id ? { ...row, note: event.target.value } : row),
                            }))}
                          />
                        </label>
                      </div>
                      <button
                        className="btn btn-ghost admin-history-remove"
                        type="button"
                        onClick={() => setForm((current) => ({
                          ...current,
                          employmentHistory: current.employmentHistory.filter((row) => row.id !== entry.id),
                        }))}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="admin-form-section">
                <div className="admin-form-section-title">Links</div>
                <div className="admin-form-grid two-up">
                  <input className="input" placeholder="LinkedIn profile URL" value={form.linkedinProfileUrl} onChange={(event) => setForm((current) => ({ ...current, linkedinProfileUrl: event.target.value }))} />
                  <input className="input" placeholder="Image URL" value={form.linkedinProfilePicUrl} onChange={(event) => setForm((current) => ({ ...current, linkedinProfilePicUrl: event.target.value }))} />
                </div>
              </div>

              <div className="admin-modal-actions">
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  <Plus size={14} /> {editorUserId ? 'Save changes' : 'Create user'}
                </button>
                <button className="btn btn-secondary" type="button" onClick={() => setEditorOpen(false)} disabled={saving}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
