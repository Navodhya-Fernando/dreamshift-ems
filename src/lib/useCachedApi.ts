"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
type Entry<T> = { data: T; updatedAt: string; expiresAt: number };
type Options<T> = { cacheKey: string; initialData: T; fetcher: () => Promise<T>; ttlMs?: number; enabled?: boolean };
function read<T>(key: string): Entry<T> | null {
  try { const raw = sessionStorage.getItem(key); const e = raw ? JSON.parse(raw) as Entry<T> : null; return e && typeof e.expiresAt === 'number' && e.updatedAt ? e : null; } catch { return null; }
}
function write<T>(key: string, entry: Entry<T>) { try { sessionStorage.setItem(key, JSON.stringify(entry)); } catch { /* optional cache */ } }
export function useCachedApi<T>({ cacheKey, initialData, fetcher, ttlMs = 90000, enabled = true }: Options<T>) {
  const { data: session, status } = useSession();
  const ready = enabled && status === 'authenticated' && Boolean(session?.user?.id);
  const key = `ems:v2:${session?.user?.id || 'anonymous'}:${cacheKey}`;
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(enabled);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const fetchRef = useRef(fetcher);
  const initialRef = useRef(initialData);
  const generation = useRef(0);
  const scope = useRef('');
  const inFlight = useRef<{key:string; promise:Promise<T>} | null>(null);
  useEffect(() => { fetchRef.current = fetcher; initialRef.current = initialData; }, [fetcher, initialData]);
  const load = useCallback(async (force = false) => {
    if (!ready) return;
    const version = ++generation.current;
    const current = () => version === generation.current && scope.current === key;
    const cached = read<T>(key);
    if (cached && current() && !force) {
      setData(cached.data); setLastUpdated(cached.updatedAt); setLoading(false);
      if (cached.expiresAt > Date.now()) { setError(null); setIsRefreshing(false); return; }
    }
    if (current()) { setLoading(!cached && !force); setIsRefreshing(Boolean(cached) || force); }
    let promise = inFlight.current?.key === key ? inFlight.current.promise : undefined;
    if (!promise) {
      promise = Promise.resolve().then(() => fetchRef.current());
      inFlight.current = { key, promise };
      const remove = () => { if (inFlight.current?.promise === promise) inFlight.current = null; };
      promise.then(remove, remove);
    }
    try {
      const fresh = await promise;
      if (!current()) return;
      const entry = { data: fresh, updatedAt: new Date().toISOString(), expiresAt: Date.now() + ttlMs };
      write(key, entry); setData(fresh); setLastUpdated(entry.updatedAt); setError(null);
    } catch (err) {
      if (current()) setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      if (current()) { setLoading(false); setIsRefreshing(false); }
    }
  }, [key, ready, ttlMs]);
  useEffect(() => {
    scope.current = key;
    setData(initialRef.current); setLastUpdated(null); setError(null); setLoading(enabled); setIsRefreshing(false);
    if (ready) void load();
    else if (status !== 'loading') setLoading(false);
    return () => { generation.current++; scope.current = ''; };
  }, [key, ready, enabled, status, load]);
  useEffect(() => {
    if (!ready) return;
    const refresh = () => { void load(true); };
    window.addEventListener('dreamshift:refresh-all', refresh);
    return () => window.removeEventListener('dreamshift:refresh-all', refresh);
  }, [ready, load]);
  const refresh = useCallback(() => load(true), [load]);
  return { data, loading, isRefreshing, error, lastUpdated, refresh, setData };
}
