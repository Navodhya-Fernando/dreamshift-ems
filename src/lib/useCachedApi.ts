"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

type CacheEntry<T> = {
  data: T;
  updatedAt: string;
  expiresAt: number;
};

type UseCachedApiOptions<T> = {
  cacheKey: string;
  initialData: T;
  fetcher: () => Promise<T>;
  ttlMs?: number;
  enabled?: boolean;
};

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

function readCache<T>(cacheKey: string): CacheEntry<T> | null {
  if (!canUseStorage()) return null;

  try {
    const raw = window.sessionStorage.getItem(cacheKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (!parsed?.updatedAt || typeof parsed.expiresAt !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache<T>(cacheKey: string, data: T, ttlMs: number) {
  if (!canUseStorage()) return;

  const entry: CacheEntry<T> = {
    data,
    updatedAt: new Date().toISOString(),
    expiresAt: Date.now() + ttlMs,
  };

  window.sessionStorage.setItem(cacheKey, JSON.stringify(entry));
}

export function useCachedApi<T>({
  cacheKey,
  initialData,
  fetcher,
  ttlMs = 90_000,
  enabled = true,
}: UseCachedApiOptions<T>) {
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);
  const fetcherRef = useRef(fetcher);
  const initialDataRef = useRef(initialData);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const cooldownUntilRef = useRef(0);

  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  useEffect(() => {
    initialDataRef.current = initialData;
  }, [initialData]);

  useEffect(() => {
    hasLoadedRef.current = false;
  }, [cacheKey]);

  const load = useCallback(async (force = false) => {
    if (!enabled) return;
    if (inFlightRef.current) return inFlightRef.current;

    if (Date.now() < cooldownUntilRef.current) {
      return;
    }

    const run = (async () => {
      const cached = readCache<T>(cacheKey);
      const hasUsableCache = Boolean(cached && cached.expiresAt > Date.now());

      if (force) {
        setLoading(false);
        setIsRefreshing(true);
      } else if (hasUsableCache && cached) {
        setData(cached.data);
        setLastUpdated(cached.updatedAt);
        setLoading(false);
        setIsRefreshing(true);
      } else {
        setLoading(true);
        setIsRefreshing(false);
      }

      try {
        const freshData = await fetcherRef.current();
        setData(freshData);
        setError(null);
        cooldownUntilRef.current = 0;
        const updatedAt = new Date().toISOString();
        setLastUpdated(updatedAt);
        writeCache(cacheKey, freshData, ttlMs);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load data';
        setError(message);
        cooldownUntilRef.current = Date.now() + 2500;

        if (!cached) {
          setData(initialDataRef.current);
        }
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    })();

    inFlightRef.current = run;
    await run;
    inFlightRef.current = null;
  }, [cacheKey, enabled, ttlMs]);

  useEffect(() => {
    if (hasLoadedRef.current || !enabled) return;
    hasLoadedRef.current = true;
    load(false);
  }, [enabled, load]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const onRefreshAll = () => {
      load(true);
    };

    window.addEventListener('dreamshift:refresh-all', onRefreshAll);
    return () => window.removeEventListener('dreamshift:refresh-all', onRefreshAll);
  }, [enabled, load]);

  const refresh = useCallback(async () => {
    await load(true);
  }, [load]);

  return {
    data,
    loading,
    isRefreshing,
    error,
    lastUpdated,
    refresh,
    setData,
  };
}
