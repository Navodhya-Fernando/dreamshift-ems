"use client";

import React from 'react';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';

type DataStatusBannerProps = {
  loading: boolean;
  error?: string | null;
  lastUpdated?: string | null;
  isRefreshing?: boolean;
  onRetry?: () => void;
  onRefresh?: () => void;
};

export default function DataStatusBanner({
  loading,
  error,
  lastUpdated,
  isRefreshing = false,
  onRetry,
  onRefresh,
}: DataStatusBannerProps) {
  if (!loading && !error && !lastUpdated) return null;

  if (loading && !lastUpdated) {
    return (
      <div className="data-status-banner">
        <div className="data-status-left">
          <Loader2 size={14} className="spin" />
          <span>Loading live data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="data-status-banner data-status-error">
        <div className="data-status-left">
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
        <div className="data-status-actions">
          {onRetry && (
            <button type="button" className="btn btn-secondary" onClick={onRetry}>
              Retry
            </button>
          )}
          {onRefresh && (
            <button type="button" className="btn btn-secondary" onClick={onRefresh}>
              <RefreshCw size={13} /> Refresh
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="data-status-banner">
      <div className="data-status-left">
        {isRefreshing ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
        <span>
          {isRefreshing ? 'Refreshing data...' : `Last synced ${lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : 'just now'}`}
        </span>
      </div>
      {onRefresh && (
        <button type="button" className="btn btn-ghost" onClick={onRefresh} disabled={isRefreshing}>
          <RefreshCw size={13} /> Refresh
        </button>
      )}
    </div>
  );
}
