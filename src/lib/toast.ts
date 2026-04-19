export type ToastType = 'success' | 'error' | 'info';

export type ToastPayload = {
  type: ToastType;
  message: string;
};

function emit(payload: ToastPayload) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ToastPayload>('dreamshift:toast', { detail: payload }));
}

export function toastSuccess(message: string) {
  emit({ type: 'success', message });
}

export function toastError(message: string) {
  emit({ type: 'error', message });
}

export function toastInfo(message: string) {
  emit({ type: 'info', message });
}
