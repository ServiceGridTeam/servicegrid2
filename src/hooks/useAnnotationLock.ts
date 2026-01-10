/**
 * Annotation Lock Hook - Concurrency control for photo editing
 * Part 3 of Field Photo Documentation System
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { LockState, LockAcquireResult, LOCK_TTL_SECONDS, LOCK_HEARTBEAT_INTERVAL_MS } from '@/types/annotations';

interface UseAnnotationLockOptions {
  autoAcquire?: boolean;
  onLockDenied?: (holderName: string) => void;
  onLockExpiring?: (expiresAt: string) => void;
  onLockLost?: () => void;
}

export function useAnnotationLock(
  mediaId: string | undefined,
  options: UseAnnotationLockOptions = {}
) {
  const { autoAcquire = false, onLockDenied, onLockExpiring, onLockLost } = options;
  const { user } = useAuth();
  
  const [lockState, setLockState] = useState<LockState>({
    isLocked: false,
    isOwnLock: false,
    lockHolder: null,
    lockHolderName: null,
    expiresAt: null,
  });
  
  const [isAcquiring, setIsAcquiring] = useState(false);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const expiryWarningRef = useRef<NodeJS.Timeout | null>(null);

  // Acquire lock
  const acquireLock = useCallback(async (): Promise<boolean> => {
    if (!mediaId || !user?.id) {
      return false;
    }

    setIsAcquiring(true);

    try {
      const { data, error } = await supabase.rpc('acquire_annotation_lock', {
        p_media_id: mediaId,
        p_user_id: user.id,
        p_ttl_seconds: LOCK_TTL_SECONDS,
      });

      if (error) throw error;

      const result = data as unknown as LockAcquireResult;

      if (result.success) {
        setLockState({
          isLocked: true,
          isOwnLock: true,
          lockHolder: user.id,
          lockHolderName: null,
          expiresAt: result.expires_at || null,
        });

        // Start heartbeat
        startHeartbeat();

        // Setup expiry warning (30 seconds before expiry)
        if (result.expires_at) {
          setupExpiryWarning(result.expires_at);
        }

        return true;
      } else {
        setLockState({
          isLocked: true,
          isOwnLock: false,
          lockHolder: result.locked_by || null,
          lockHolderName: result.locked_by_name || null,
          expiresAt: result.expires_at || null,
        });

        if (onLockDenied && result.locked_by_name) {
          onLockDenied(result.locked_by_name);
        }

        toast.error('Photo is locked', {
          description: result.message,
        });

        return false;
      }
    } catch (error) {
      console.error('Failed to acquire lock:', error);
      toast.error('Failed to acquire lock');
      return false;
    } finally {
      setIsAcquiring(false);
    }
  }, [mediaId, user?.id, onLockDenied]);

  // Release lock
  const releaseLock = useCallback(async (): Promise<boolean> => {
    if (!mediaId || !user?.id) {
      return false;
    }

    // Stop heartbeat
    stopHeartbeat();
    stopExpiryWarning();

    try {
      const { data, error } = await supabase.rpc('release_annotation_lock', {
        p_media_id: mediaId,
        p_user_id: user.id,
      });

      if (error) throw error;

      setLockState({
        isLocked: false,
        isOwnLock: false,
        lockHolder: null,
        lockHolderName: null,
        expiresAt: null,
      });

      return true;
    } catch (error) {
      console.error('Failed to release lock:', error);
      return false;
    }
  }, [mediaId, user?.id]);

  // Extend lock (heartbeat)
  const extendLock = useCallback(async (): Promise<boolean> => {
    if (!mediaId || !user?.id) {
      return false;
    }

    try {
      const { data, error } = await supabase.rpc('acquire_annotation_lock', {
        p_media_id: mediaId,
        p_user_id: user.id,
        p_ttl_seconds: LOCK_TTL_SECONDS,
      });

      if (error) throw error;

      const result = data as unknown as LockAcquireResult;

      if (result.success) {
        setLockState((prev) => ({
          ...prev,
          expiresAt: result.expires_at || null,
        }));

        // Reset expiry warning
        if (result.expires_at) {
          setupExpiryWarning(result.expires_at);
        }

        return true;
      } else {
        // Lock was taken by someone else
        setLockState({
          isLocked: true,
          isOwnLock: false,
          lockHolder: result.locked_by || null,
          lockHolderName: result.locked_by_name || null,
          expiresAt: result.expires_at || null,
        });

        stopHeartbeat();
        
        if (onLockLost) {
          onLockLost();
        }

        toast.error('Lock lost', {
          description: `Photo is now being edited by ${result.locked_by_name}`,
        });

        return false;
      }
    } catch (error) {
      console.error('Failed to extend lock:', error);
      return false;
    }
  }, [mediaId, user?.id, onLockLost]);

  // Heartbeat management
  const startHeartbeat = useCallback(() => {
    stopHeartbeat();
    heartbeatRef.current = setInterval(() => {
      extendLock();
    }, LOCK_HEARTBEAT_INTERVAL_MS);
  }, [extendLock]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  // Expiry warning management
  const setupExpiryWarning = useCallback((expiresAt: string) => {
    stopExpiryWarning();

    const expiryTime = new Date(expiresAt).getTime();
    const warningTime = expiryTime - 30000; // 30 seconds before expiry
    const now = Date.now();

    if (warningTime > now) {
      expiryWarningRef.current = setTimeout(() => {
        if (onLockExpiring) {
          onLockExpiring(expiresAt);
        }
        toast.warning('Lock expiring soon', {
          description: 'Your editing session will expire in 30 seconds. Save your work.',
        });
      }, warningTime - now);
    }
  }, [onLockExpiring]);

  const stopExpiryWarning = useCallback(() => {
    if (expiryWarningRef.current) {
      clearTimeout(expiryWarningRef.current);
      expiryWarningRef.current = null;
    }
  }, []);

  // Check current lock status
  const checkLockStatus = useCallback(async () => {
    if (!mediaId) return;

    try {
      const { data, error } = await supabase
        .from('annotation_locks')
        .select('*')
        .eq('job_media_id', mediaId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const isExpired = new Date(data.expires_at) < new Date();
        
        if (isExpired) {
          setLockState({
            isLocked: false,
            isOwnLock: false,
            lockHolder: null,
            lockHolderName: null,
            expiresAt: null,
          });
        } else {
          setLockState({
            isLocked: true,
            isOwnLock: data.locked_by === user?.id,
            lockHolder: data.locked_by,
            lockHolderName: data.locked_by_name,
            expiresAt: data.expires_at,
          });
        }
      } else {
        setLockState({
          isLocked: false,
          isOwnLock: false,
          lockHolder: null,
          lockHolderName: null,
          expiresAt: null,
        });
      }
    } catch (error) {
      console.error('Failed to check lock status:', error);
    }
  }, [mediaId, user?.id]);

  // Auto-acquire on mount if specified
  useEffect(() => {
    if (autoAcquire && mediaId && user?.id) {
      acquireLock();
    }
  }, [autoAcquire, mediaId, user?.id, acquireLock]);

  // Release lock on unmount
  useEffect(() => {
    return () => {
      stopHeartbeat();
      stopExpiryWarning();
      
      // Release lock on cleanup (best effort)
      if (lockState.isOwnLock && mediaId && user?.id) {
        supabase.rpc('release_annotation_lock', {
          p_media_id: mediaId,
          p_user_id: user.id,
        }).then(() => {}).catch(() => {
          // Ignore errors on cleanup
        });
      }
    };
  }, [lockState.isOwnLock, mediaId, user?.id, stopHeartbeat, stopExpiryWarning]);

  // Handle beforeunload to release lock
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (lockState.isOwnLock && mediaId && user?.id) {
        // Use sendBeacon for reliable delivery during unload
        const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/release_annotation_lock`;
        navigator.sendBeacon(
          url,
          JSON.stringify({
            p_media_id: mediaId,
            p_user_id: user.id,
          })
        );
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [lockState.isOwnLock, mediaId, user?.id]);

  return {
    lockState,
    isAcquiring,
    acquireLock,
    releaseLock,
    extendLock,
    checkLockStatus,
  };
}
