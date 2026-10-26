import { create } from "zustand";

export interface Toast {
  id: number;
  kind: "success" | "error" | "info";
  message: string;
}

interface ToastState {
  toasts: Toast[];
  push(kind: Toast["kind"], message: string): void;
  dismiss(id: number): void;
}

let nextId = 1;
export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push(kind, message) {
    const id = nextId++;
    set({ toasts: [...get().toasts.slice(-3), { id, kind, message }] });
    setTimeout(() => get().dismiss(id), kind === "error" ? 7000 : 3500);
  },
  dismiss(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));
