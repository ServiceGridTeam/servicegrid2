/**
 * Optimistic state machine for zero-latency business switching
 */

import { useState, useCallback, useRef } from 'react';
import type { AppRole } from '@/lib/permissions';

type SwitchState = 'idle' | 'optimistic' | 'confirming' | 'confirmed' | 'failed';

interface OptimisticState {
  state: SwitchState;
  targetBusinessId: string | null;
  targetRole: AppRole | null;
  previousBusinessId: string | null;
  previousRole: AppRole | null;
}

export function useOptimisticBusiness(
  currentBusinessId: string | null,
  currentRole: AppRole | null
) {
  const [optimisticState, setOptimisticState] = useState<OptimisticState>({
    state: 'idle',
    targetBusinessId: null,
    targetRole: null,
    previousBusinessId: null,
    previousRole: null,
  });

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Start optimistic switch - immediately update UI
   */
  const startSwitch = useCallback(
    (targetBusinessId: string, targetRole: AppRole) => {
      // Clear any pending timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      setOptimisticState({
        state: 'optimistic',
        targetBusinessId,
        targetRole,
        previousBusinessId: currentBusinessId,
        previousRole: currentRole,
      });

      return {
        rollback: () => {
          setOptimisticState({
            state: 'idle',
            targetBusinessId: null,
            targetRole: null,
            previousBusinessId: null,
            previousRole: null,
          });
        },
      };
    },
    [currentBusinessId, currentRole]
  );

  /**
   * Mark switch as confirming (server update in progress)
   */
  const setConfirming = useCallback(() => {
    setOptimisticState((prev) => ({
      ...prev,
      state: 'confirming',
    }));
  }, []);

  /**
   * Mark switch as confirmed (server update complete)
   */
  const confirmSwitch = useCallback(() => {
    setOptimisticState({
      state: 'confirmed',
      targetBusinessId: null,
      targetRole: null,
      previousBusinessId: null,
      previousRole: null,
    });

    // Reset to idle after a short delay
    timeoutRef.current = setTimeout(() => {
      setOptimisticState((prev) =>
        prev.state === 'confirmed'
          ? {
              state: 'idle',
              targetBusinessId: null,
              targetRole: null,
              previousBusinessId: null,
              previousRole: null,
            }
          : prev
      );
    }, 100);
  }, []);

  /**
   * Mark switch as failed and rollback
   */
  const failSwitch = useCallback(() => {
    setOptimisticState((prev) => ({
      state: 'failed',
      targetBusinessId: null,
      targetRole: null,
      previousBusinessId: null,
      previousRole: null,
    }));

    // Reset to idle after showing error
    timeoutRef.current = setTimeout(() => {
      setOptimisticState({
        state: 'idle',
        targetBusinessId: null,
        targetRole: null,
        previousBusinessId: null,
        previousRole: null,
      });
    }, 2000);
  }, []);

  /**
   * Get the effective business ID (optimistic or actual)
   */
  const effectiveBusinessId =
    optimisticState.state === 'optimistic' || optimisticState.state === 'confirming'
      ? optimisticState.targetBusinessId
      : currentBusinessId;

  /**
   * Get the effective role (optimistic or actual)
   */
  const effectiveRole =
    optimisticState.state === 'optimistic' || optimisticState.state === 'confirming'
      ? optimisticState.targetRole
      : currentRole;

  return {
    state: optimisticState.state,
    effectiveBusinessId,
    effectiveRole,
    isOptimistic: optimisticState.state === 'optimistic' || optimisticState.state === 'confirming',
    isSwitching: optimisticState.state !== 'idle' && optimisticState.state !== 'confirmed',
    startSwitch,
    setConfirming,
    confirmSwitch,
    failSwitch,
  };
}
