import { useCallback, useState } from "react";

/** Value with an undo/redo history. `commit` records a new version; `set` edits the current one in place. */
export function useUndoable(initial = "") {
  const [state, setState] = useState<{ past: string[]; present: string; future: string[] }>({ past: [], present: initial, future: [] });
  const commit = useCallback((v: string) => {
    setState((s) => (v === s.present ? s : { past: [...s.past, s.present].slice(-50), present: v, future: [] }));
  }, []);
  const set = useCallback((v: string) => setState((s) => ({ ...s, present: v })), []);
  const undo = useCallback(() => {
    setState((s) => (s.past.length ? { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future] } : s));
  }, []);
  const redo = useCallback(() => {
    setState((s) => (s.future.length ? { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) } : s));
  }, []);
  const reset = useCallback((v = "") => setState({ past: [], present: v, future: [] }), []);
  return { value: state.present, commit, set, undo, redo, reset, canUndo: state.past.length > 0, canRedo: state.future.length > 0 };
}
