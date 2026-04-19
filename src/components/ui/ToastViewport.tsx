"use client";

import React, { useEffect, useState } from 'react';
import { CheckCircle2, Info, XCircle } from 'lucide-react';
import type { ToastPayload } from '@/lib/toast';

type ToastItem = ToastPayload & { id: number };

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
} as const;

export default function ToastViewport() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<ToastPayload>).detail;
      if (!detail?.message) return;

      const id = Date.now() + Math.floor(Math.random() * 1000);
      setItems((prev) => [...prev, { ...detail, id }]);

      window.setTimeout(() => {
        setItems((prev) => prev.filter((item) => item.id !== id));
      }, 3200);
    };

    window.addEventListener('dreamshift:toast', onToast);
    return () => window.removeEventListener('dreamshift:toast', onToast);
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="toast-viewport" aria-live="polite" aria-atomic="true">
      {items.map((item) => {
        const Icon = ICONS[item.type];
        return (
          <div key={item.id} className={`toast-item toast-${item.type}`}>
            <Icon size={16} />
            <span>{item.message}</span>
          </div>
        );
      })}
    </div>
  );
}
