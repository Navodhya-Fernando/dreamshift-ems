"use client";

import React, { useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { AlertTriangle, CalendarDays, CheckCircle2, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import DataStatusBanner from '@/components/ui/DataStatusBanner';
import { useCachedApi } from '@/lib/useCachedApi';
import { toastError, toastSuccess } from '@/lib/toast';
import './calendar.css';

type CalendarEventItem = {
  id: string;
  title: string;
  date: string;
  dueDate?: string;
  status: string;
  priority: string;
  projectName: string;
  assigneeName: string;
};

type CalendarResponse = {
  events: CalendarEventItem[];
  summary: {
    total: number;
    overdue: number;
    dueThisWeek: number;
  };
};

const PRIORITY_COLORS: Record<string, string> = {
  low: '#4B5563',
  medium: '#3B82F6',
  high: '#F59E0B',
  urgent: '#EF4444',
};

export default function CalendarPage() {
  const [copied, setCopied] = useState(false);
  const [syncUrl, setSyncUrl] = useState('');
  const {
    data: payload,
    loading,
    error,
    lastUpdated,
    isRefreshing,
    refresh,
  } = useCachedApi<CalendarResponse>({
    cacheKey: 'calendar-events-v1',
    initialData: { events: [], summary: { total: 0, overdue: 0, dueThisWeek: 0 } },
    fetcher: async () => {
      const res = await fetch('/api/calendar', { cache: 'no-store' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load calendar events');
      return json.data as CalendarResponse;
    },
    ttlMs: 120000,
  });
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventItem | null>(null);

  const fallbackIcsUrl = useMemo(() => {
    if (typeof window === 'undefined') return '/api/calendar/ics';
    return `${window.location.origin}/api/calendar/ics`;
  }, []);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/calendar/sync-token', { cache: 'no-store' });
        const json = await res.json();
        if (!mounted) return;
        if (json.success && json.data?.syncUrl) {
          setSyncUrl(String(json.data.syncUrl));
        }
      } catch {
        if (mounted) setSyncUrl('');
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const icsUrl = syncUrl || fallbackIcsUrl;

  const copySyncUrl = async () => {
    try {
      await navigator.clipboard.writeText(icsUrl);
      setCopied(true);
      toastSuccess('Calendar sync URL copied');
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toastError('Unable to copy URL');
    }
  };

  const calendarEvents = useMemo(() => {
    return payload.events.map((event) => ({
      id: event.id,
      title: event.title,
      date: event.date,
      backgroundColor: PRIORITY_COLORS[event.priority] || '#4361ee',
      borderColor: 'transparent',
      extendedProps: event,
    }));
  }, [payload.events]);

  return (
    <div className="calendar-page animate-in">
      <div className="calendar-panel-main">
        <div className="calendar-header-premium">
          <div>
            <h1 className="calendar-title">Delivery Calendar</h1>
            <p className="text-muted text-sm">Your assigned tasks are shown here, including items without deadlines, with live updates from MongoDB.</p>
          </div>
          <div className="calendar-kpi-row">
            <button className="btn btn-secondary" onClick={refresh} disabled={isRefreshing}>
              <RefreshCw size={13} /> Refresh
            </button>
            <div className="calendar-kpi"><CalendarDays size={14} /><span>{payload.summary.total} scheduled</span></div>
            <div className="calendar-kpi"><CheckCircle2 size={14} /><span>{payload.summary.dueThisWeek} due this week</span></div>
            <div className="calendar-kpi warning"><AlertTriangle size={14} /><span>{payload.summary.overdue} overdue</span></div>
          </div>
        </div>

        <DataStatusBanner
          loading={loading}
          error={error}
          lastUpdated={lastUpdated}
          isRefreshing={isRefreshing}
          onRetry={refresh}
          onRefresh={refresh}
        />

        <div className="fc-wrapper premium">
          {loading ? (
            <div className="text-sm text-muted" style={{ padding: 30 }}>Loading calendar data...</div>
          ) : (
            <FullCalendar
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              events={calendarEvents}
              eventClick={(info) => setSelectedEvent(info.event.extendedProps as CalendarEventItem)}
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,dayGridWeek',
              }}
              height="auto"
              aspectRatio={1.45}
            />
          )}
        </div>
      </div>

      <aside className="calendar-panel-side">
        <h3 className="section-title" style={{ marginBottom: 10 }}>Sync Options</h3>
        <div className="calendar-side-card" style={{ marginBottom: 12 }}>
          <div className="calendar-sync-actions">
            <a className="btn btn-secondary" href={fallbackIcsUrl} download>
              <CalendarDays size={13} /> Download ICS
            </a>
            <button className="btn btn-secondary" type="button" onClick={copySyncUrl}>
              <Copy size={13} /> {copied ? 'Copied' : 'Copy Sync URL'}
            </button>
          </div>
          <div className="calendar-sync-links">
            <a className="calendar-sync-link" href="https://calendar.google.com/calendar/u/0/r/settings/addbyurl" target="_blank" rel="noreferrer">
              <ExternalLink size={13} /> Google Calendar (Add by URL)
            </a>
            <a className="calendar-sync-link" href="https://outlook.live.com/calendar/0/addcalendar" target="_blank" rel="noreferrer">
              <ExternalLink size={13} /> Outlook (Subscribe)
            </a>
          </div>
          <div className="text-xs text-muted" style={{ marginTop: 8 }}>
            Use the copied URL in Google/Outlook subscribe dialog for auto-updating assigned tasks.
          </div>
        </div>

        <h3 className="section-title" style={{ marginBottom: 10 }}>Task Detail</h3>
        {!selectedEvent ? (
          <div className="calendar-side-card">
            <div className="text-sm text-muted">Select a calendar event to inspect task details.</div>
          </div>
        ) : (
          <div className="calendar-side-card">
            <div className="calendar-side-title">{selectedEvent.title}</div>
            <div className="calendar-side-row"><span>Project</span><strong>{selectedEvent.projectName}</strong></div>
            <div className="calendar-side-row"><span>Assignee</span><strong>{selectedEvent.assigneeName}</strong></div>
            <div className="calendar-side-row"><span>Status</span><strong>{selectedEvent.status.replace('_', ' ')}</strong></div>
            <div className="calendar-side-row"><span>Priority</span><strong style={{ color: PRIORITY_COLORS[selectedEvent.priority] || '#4361ee' }}>{selectedEvent.priority}</strong></div>
            <div className="calendar-side-row"><span>Due</span><strong>{selectedEvent.dueDate ? new Date(selectedEvent.dueDate).toLocaleDateString() : '—'}</strong></div>
          </div>
        )}
      </aside>
    </div>
  );
}
