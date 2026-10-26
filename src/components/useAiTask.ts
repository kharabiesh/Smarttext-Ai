import { useCallback, useEffect, useRef, useState } from "react";

/** Runs an async AI action with loading/error/elapsed-time state. Ignores results from superseded runs. */
export function useAiTask<T>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [elapsed, setElapsed] = useState(0);
  const run = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  const execute = useCallback(async (fn: () => Promise<T>): Promise<T | undefined> => {
    const id = ++run.current;
    setLoading(true);
    setError(null);
    setElapsed(0);
    const started = Date.now();
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    try {
      const result = await fn();
      return id === run.current ? result : undefined;
    } catch (e) {
      if (id === run.current) setError(e);
      return undefined;
    } finally {
      if (id === run.current) {
        setLoading(false);
        if (timer.current) clearInterval(timer.current);
      }
    }
  }, []);

  return { loading, error, elapsed, execute, setError };
}
