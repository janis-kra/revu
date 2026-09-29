import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_DURATION_MS = 1800;

/**
 * Brief success state for copy actions ( Copied! tooltip / icon swap ).
 */
export function useCopiedFeedback(durationMs = DEFAULT_DURATION_MS) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const trigger = useCallback(() => {
    setCopied(true);
    clearTimer();
    timerRef.current = setTimeout(() => {
      setCopied(false);
      timerRef.current = null;
    }, durationMs);
  }, [clearTimer, durationMs]);

  useEffect(() => clearTimer, [clearTimer]);

  return { copied, trigger } as const;
}
