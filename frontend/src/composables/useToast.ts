import { reactive } from "vue";

export interface Toast {
  id: number;
  text: string;
  kind: "info" | "success" | "error";
}

const state = reactive<{ items: Toast[] }>({ items: [] });
let seq = 0;

export function useToast() {
  function push(text: string, kind: Toast["kind"] = "info", ms = 3200) {
    const id = ++seq;
    state.items.push({ id, text, kind });
    setTimeout(() => dismiss(id), ms);
    return id;
  }
  function dismiss(id: number) {
    const i = state.items.findIndex((t) => t.id === id);
    if (i !== -1) state.items.splice(i, 1);
  }
  return {
    toasts: state.items,
    toast: push,
    success: (t: string) => push(t, "success"),
    error: (t: string) => push(t, "error", 5000),
    dismiss,
  };
}
