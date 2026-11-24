"use client";
import { AlertTriangle, Loader2 } from 'lucide-react';
type DataStatusBannerProps = { loading: boolean; error?: string | null; lastUpdated?: string | null; isRefreshing?: boolean; onRetry?: () => void; onRefresh?: () => void };
export default function DataStatusBanner({ loading, error, lastUpdated, onRetry, onRefresh }: DataStatusBannerProps) {
  if (error) return <div className="data-status-banner data-status-error" role="alert"><div className="data-status-left"><AlertTriangle size={14}/><span>{error}</span></div>{(onRetry || onRefresh) && <button type="button" className="btn btn-secondary" onClick={onRetry || onRefresh}>Retry</button>}</div>;
  if (loading && !lastUpdated) return <div className="data-status-banner" role="status"><div className="data-status-left"><Loader2 size={14} className="spin"/><span>Loading…</span></div></div>;
  return null;
}
