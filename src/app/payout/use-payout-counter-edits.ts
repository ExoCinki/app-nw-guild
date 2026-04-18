import { useCallback, useEffect, useRef, useState } from "react";
import type { PayoutEntry } from "./payout-types";

export function usePayoutCounterEdits({
  onCommit,
}: {
  onCommit: (data: { entryId: string; updates: Partial<PayoutEntry> }) => void;
}) {
  const [counterEdits, setCounterEdits] = useState<
    Record<string, Partial<PayoutEntry>>
  >({});
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  );
  const onCommitRef = useRef(onCommit);

  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  useEffect(() => {
    const timers = debounceTimers.current;
    return () => {
      for (const timer of Object.values(timers)) {
        clearTimeout(timer);
      }
    };
  }, []);

  const debouncedUpdate = useCallback(
    (entryId: string, field: string, value: number) => {
      const timerKey = `${entryId}-${field}`;

      if (debounceTimers.current[timerKey]) {
        clearTimeout(debounceTimers.current[timerKey]);
      }

      debounceTimers.current[timerKey] = setTimeout(() => {
        onCommitRef.current({
          entryId,
          updates: { [field]: value } as Partial<PayoutEntry>,
        });

        setCounterEdits((previous) => {
          const entry = previous[entryId];
          if (!entry) return previous;
          const next = { ...entry };
          delete next[field as keyof PayoutEntry];
          if (Object.keys(next).length === 0) {
            const top = { ...previous };
            delete top[entryId];
            return top;
          }
          return { ...previous, [entryId]: next };
        });
      }, 300);
    },
    [],
  );

  const handleCounterChange = useCallback(
    (entryId: string, field: string, value: number) => {
      setCounterEdits((previous) => ({
        ...previous,
        [entryId]: {
          ...(previous[entryId] || {}),
          [field]: value,
        },
      }));
      debouncedUpdate(entryId, field, value);
    },
    [debouncedUpdate],
  );

  return {
    counterEdits,
    handleCounterChange,
  };
}