// Minimal dependency-free toast store (pub/sub). Any client component can call
// toast.success(...) / toast.error(...); the <Toaster/> mounted in the root layout renders them.

export type ToastKind = "success" | "error" | "info";
export type Toast = { id: number; kind: ToastKind; message: string };

type Listener = (toasts: Toast[]) => void;

let toasts: Toast[] = [];
let listeners: Listener[] = [];
let nextId = 1;

function emit() {
  for (const l of listeners) l(toasts);
}

export function subscribe(l: Listener): () => void {
  listeners.push(l);
  l(toasts);
  return () => {
    listeners = listeners.filter((x) => x !== l);
  };
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function showToast(message: string, kind: ToastKind = "info"): number {
  const id = nextId++;
  toasts = [...toasts, { id, kind, message }];
  emit();
  if (typeof window !== "undefined") {
    window.setTimeout(() => dismissToast(id), 4200);
  }
  return id;
}

export const toast = {
  success: (m: string) => showToast(m, "success"),
  error: (m: string) => showToast(m, "error"),
  info: (m: string) => showToast(m, "info"),
};
